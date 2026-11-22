import { apiRequest } from '@/apiRequest';

export type LiveTranscriptRole = 'user' | 'assistant';

export interface LiveTranscriptFragment {
  id: string;
  role: LiveTranscriptRole;
  delta: string;
  startMs: number;
  endMs: number;
  sequence?: number;
}

export interface LiveTranscriptSegment {
  id: string;
  role: LiveTranscriptRole;
  content: string;
  startMs: number;
  endMs: number;
}

export interface OpenAILiveCallbacks {
  onStatus?: (status: string) => void;
  onTranscript?: (segments: LiveTranscriptSegment[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onResponseLatency?: (latencyMs: number) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onAudioLevel?: (level: number) => void;
  onMutedChange?: (muted: boolean) => void;
  onError?: (error: Error) => void;
}

const TRANSCRIPT_GROUP_GAP_MS = 1000;
const TRANSCRIPT_SYNC_DELAY_MS = 2500;
const AUDIBLE_RMS_THRESHOLD = 0.018;
const MICROPHONE_SPEECH_RMS_THRESHOLD = 0.018;
const SPEECH_RELEASE_MS = 160;

function createAbortError(): Error {
  const error = new Error('Conectarea vocală a fost oprită.');
  error.name = 'AbortError';
  return error;
}

export function supportsOpenAILive(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function groupLiveTranscriptFragments(
  fragments: LiveTranscriptFragment[]
): LiveTranscriptSegment[] {
  const sorted = [...fragments].sort(
    (a, b) =>
      a.startMs - b.startMs ||
      (a.sequence ?? 0) - (b.sequence ?? 0) ||
      a.endMs - b.endMs ||
      a.id.localeCompare(b.id)
  );
  const segments: LiveTranscriptSegment[] = [];

  for (const fragment of sorted) {
    const previousForRole = [...segments].reverse().find(
      (segment) => segment.role === fragment.role
    );
    const otherSpeakerBetween = previousForRole
      ? sorted.some(
          (candidate) =>
            candidate.role !== fragment.role &&
            candidate.startMs >= previousForRole.endMs &&
            candidate.startMs <= fragment.startMs
        )
      : false;
    const canAppend = Boolean(
      previousForRole &&
      fragment.startMs - previousForRole.endMs <= TRANSCRIPT_GROUP_GAP_MS &&
      !otherSpeakerBetween
    );

    if (canAppend && previousForRole) {
      previousForRole.content += fragment.delta;
      previousForRole.endMs = Math.max(previousForRole.endMs, fragment.endMs);
      continue;
    }

    segments.push({
      id: `${fragment.role}-${fragment.id}`,
      role: fragment.role,
      content: fragment.delta,
      startMs: fragment.startMs,
      endMs: fragment.endMs
    });
  }

  return segments
    .filter((segment) => segment.content.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export class OpenAILiveConversation {
  private readonly conversationId: string | number;
  private readonly callbacks: OpenAILiveCallbacks;
  private peer: RTCPeerConnection | null = null;
  private events: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private microphoneAudioSource: MediaStreamAudioSourceNode | null = null;
  private microphoneAnalyser: AnalyserNode | null = null;
  private audioSilentGain: GainNode | null = null;
  private audioMeterFrame: number | null = null;
  private sessionId = '';
  private startedAt = '';
  private voiceConfig: Record<string, unknown> | null = null;
  private fragments = new Map<string, LiveTranscriptFragment>();
  private fragmentSequence = 0;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<void> | null = null;
  private syncDirty = false;
  private closeResolver: (() => void) | null = null;
  private startedResolver: (() => void) | null = null;
  private startedRejecter: ((error: Error) => void) | null = null;
  private muted = false;
  private cleanedUp = false;
  private cancelRequested = false;
  private started = false;
  private lastInputTranscriptAt = 0;
  private waitingForFirstOutput = false;
  private transportMode: 'live' | 'realtime' = 'live';
  private realtimeTranscriptText = new Map<string, string>();
  private inputTurnStartMs = 0;
  private inputTurnEndMs = 0;
  private assistantAudioStartMs = 0;
  private assistantTurnSequenceFloor = 0;
  private lastAudibleAudioAt = 0;
  private lastMicrophoneSpeechMs = 0;
  private assistantAudioAudible = false;
  private userSpeaking = false;

  constructor(conversationId: string | number, callbacks: OpenAILiveCallbacks = {}) {
    this.conversationId = conversationId;
    this.callbacks = callbacks;
  }

  public get connected(): boolean {
    return Boolean(this.sessionId && this.events?.readyState === 'open' && !this.cleanedUp);
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public async resumeAudioPlayback(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    if (this.audioContext?.state === 'suspended') {
      tasks.push(this.audioContext.resume());
    }
    if (this.audioElement?.paused) {
      tasks.push(this.audioElement.play());
    }
    if (tasks.length > 0) await Promise.allSettled(tasks);
  }

  public async start(): Promise<string> {
    if (!supportsOpenAILive()) {
      throw new Error('Acest browser nu suportă conversații vocale WebRTC.');
    }
    if (this.peer) {
      throw new Error('Conversația vocală este deja pornită.');
    }

    this.cleanedUp = false;
    this.cancelRequested = false;
    this.started = false;
    this.callbacks.onStatus?.('Se conectează la pacient…');

    const startedPromise = new Promise<void>((resolve, reject) => {
      this.startedResolver = resolve;
      this.startedRejecter = reject;
    });
    // Cancellation may happen while microphone permission or ICE gathering is
    // still pending, before the start routine reaches its final Promise.race.
    void startedPromise.catch(() => undefined);

    try {
      this.peer = new RTCPeerConnection({ iceCandidatePoolSize: 4 });
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      this.audioElement.setAttribute('playsinline', 'true');
      this.audioElement.setAttribute('aria-hidden', 'true');
      this.audioElement.style.display = 'none';
      document.body.appendChild(this.audioElement);

      this.peer.addEventListener('track', (event) => {
        if (!this.audioElement) return;
        // Prefer conversational immediacy over a large browser jitter buffer.
        // The hint is supported by Chromium-based browsers and ignored safely
        // elsewhere.
        const receiver = event.receiver as RTCRtpReceiver & {
          playoutDelayHint?: number;
          jitterBufferTarget?: number;
        };
        try {
          receiver.playoutDelayHint = 0;
          receiver.jitterBufferTarget = 0;
        } catch {
          // Experimental WebRTC hint; the browser default remains valid.
        }
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        this.audioElement.srcObject = remoteStream;
        this.startAudioMeter(remoteStream);
        void this.audioElement.play().catch(() => {
          this.callbacks.onStatus?.('Apasă din nou pentru a permite redarea audio.');
        });
      });

      this.peer.addEventListener('connectionstatechange', () => {
        const state = this.peer?.connectionState;
        if (state === 'failed' || state === 'disconnected') {
          this.fail(new Error('Conexiunea vocală a fost întreruptă.'));
        }
      });

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      if (this.cancelRequested || this.cleanedUp) {
        microphone.getTracks().forEach((track) => track.stop());
        throw createAbortError();
      }
      this.microphone = microphone;
      for (const track of this.microphone.getAudioTracks()) {
        this.peer.addTrack(track, this.microphone);
      }

      this.events = this.peer.createDataChannel('oai-events');
      this.events.addEventListener('message', ({ data }) => this.handleEvent(data));
      this.events.addEventListener('close', () => {
        if (!this.cleanedUp && this.sessionId) {
          this.callbacks.onStatus?.('Conversația vocală s-a încheiat.');
        }
      });

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      await this.waitForIceGathering();
      this.throwIfCancelled();

      const sdp = this.peer.localDescription?.sdp;
      if (!sdp) throw new Error('Nu s-a putut crea conexiunea audio.');

      const result = await apiRequest(
        `/chat/conversations/${this.conversationId}/live/session`,
        {
          method: 'POST',
          body: JSON.stringify({ sdp })
        }
      );
      this.throwIfCancelled();
      if (!result?.session?.id || !result?.transport?.sdp) {
        throw new Error('Serverul vocal a returnat un răspuns incomplet.');
      }

      this.transportMode = result.mode === 'realtime' ? 'realtime' : 'live';
      this.sessionId = result.session.id;
      this.voiceConfig = result.voiceConfig && typeof result.voiceConfig === 'object'
        ? result.voiceConfig
        : null;
      this.startedAt = new Date().toISOString();
      await this.peer.setRemoteDescription({
        type: 'answer',
        sdp: result.transport.sdp
      });
      this.throwIfCancelled();

      await Promise.race([
        startedPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Conectarea vocală a expirat.')), 15000);
        })
      ]);

      return this.sessionId;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.startedRejecter?.(normalized);
      this.cleanup();
      if (normalized.name !== 'AbortError') {
        this.callbacks.onError?.(normalized);
      }
      throw normalized;
    }
  }

  public async setMuted(muted: boolean): Promise<void> {
    if (!this.connected || !this.events) {
      throw new Error('Conversația vocală nu este conectată.');
    }

    this.muted = muted;
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    if (this.transportMode === 'live') {
      this.events.send(JSON.stringify({
        type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute',
        event_id: `paviagen-${muted ? 'mute' : 'unmute'}-${Date.now()}`
      }));
    }
    this.callbacks.onMutedChange?.(muted);
    this.callbacks.onStatus?.(muted ? 'Microfon oprit.' : 'Conversație vocală activă.');
    if (!muted) await this.resumeAudioPlayback();
  }

  public async stop(): Promise<void> {
    if (this.cleanedUp) return;

    this.cancelRequested = true;
    if (!this.started) {
      this.startedRejecter?.(createAbortError());
      this.cleanup();
      return;
    }

    this.callbacks.onStatus?.('Se încheie conversația vocală…');
    const initialSync = this.syncTranscripts();

    if (this.transportMode === 'live' && this.events?.readyState === 'open') {
      const closedPromise = new Promise<void>((resolve) => {
        this.closeResolver = resolve;
      });
      this.events.send(JSON.stringify({
        type: 'session.close',
        event_id: `paviagen-close-${Date.now()}`
      }));
      await Promise.race([
        closedPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 12000))
      ]);
    }

    await initialSync;
    await this.syncTranscripts();
    this.cleanup();
  }

  private startAudioMeter(stream: MediaStream): void {
    const AudioContextConstructor = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    if (this.audioMeterFrame !== null) {
      cancelAnimationFrame(this.audioMeterFrame);
      this.audioMeterFrame = null;
    }
    void this.audioContext?.close().catch(() => undefined);

    const context = new AudioContextConstructor({ latencyHint: 'interactive' });
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    const microphoneSource = this.microphone
      ? context.createMediaStreamSource(this.microphone)
      : null;
    const microphoneAnalyser = microphoneSource ? context.createAnalyser() : null;
    const silentGain = context.createGain();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.25;
    if (microphoneAnalyser) {
      microphoneAnalyser.fftSize = 256;
      microphoneAnalyser.smoothingTimeConstant = 0.2;
    }
    silentGain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(silentGain);
    if (microphoneSource && microphoneAnalyser) {
      microphoneSource.connect(microphoneAnalyser);
      microphoneAnalyser.connect(silentGain);
    }
    silentGain.connect(context.destination);

    this.audioContext = context;
    this.audioSource = source;
    this.audioAnalyser = analyser;
    this.microphoneAudioSource = microphoneSource;
    this.microphoneAnalyser = microphoneAnalyser;
    this.audioSilentGain = silentGain;
    void context.resume().catch(() => undefined);

    const samples = new Uint8Array(analyser.fftSize);
    const microphoneSamples = microphoneAnalyser
      ? new Uint8Array(microphoneAnalyser.fftSize)
      : null;
    const calculateRms = (values: Uint8Array) => {
      let squareSum = 0;
      for (const sample of values) {
        const normalized = (sample - 128) / 128;
        squareSum += normalized * normalized;
      }
      return Math.sqrt(squareSum / values.length);
    };
    const sampleAudio = () => {
      if (this.cleanedUp || this.audioAnalyser !== analyser) return;

      analyser.getByteTimeDomainData(samples);
      const rms = calculateRms(samples);
      const level = Math.min(1, Math.max(0, (rms - 0.006) * 22));
      const now = this.nowMs();
      if (microphoneAnalyser && microphoneSamples && !this.muted) {
        microphoneAnalyser.getByteTimeDomainData(microphoneSamples);
        if (calculateRms(microphoneSamples) >= MICROPHONE_SPEECH_RMS_THRESHOLD) {
          this.lastMicrophoneSpeechMs = this.timelineMs();
        }
      }
      this.callbacks.onAudioLevel?.(level);

      if (rms >= AUDIBLE_RMS_THRESHOLD && !this.userSpeaking) {
        this.lastAudibleAudioAt = now;
        if (!this.assistantAudioAudible) {
          this.assistantAudioAudible = true;
          this.markFirstAudibleResponse();
          this.callbacks.onSpeakingChange?.(true);
          this.callbacks.onStatus?.('Pacientul vorbește…');
        }
      } else if (
        this.assistantAudioAudible &&
        now - this.lastAudibleAudioAt >= SPEECH_RELEASE_MS
      ) {
        this.assistantAudioAudible = false;
        this.callbacks.onAudioLevel?.(0);
        this.callbacks.onSpeakingChange?.(false);
        if (!this.userSpeaking) {
          this.callbacks.onStatus?.(
            this.muted ? 'Microfon oprit.' : 'Conversație vocală activă.'
          );
        }
      }

      this.audioMeterFrame = requestAnimationFrame(sampleAudio);
    };
    this.audioMeterFrame = requestAnimationFrame(sampleAudio);
  }

  private markFirstAudibleResponse(): void {
    if (!this.waitingForFirstOutput) return;

    const audioStartMs = this.timelineMs();
    this.assistantAudioStartMs = audioStartMs;
    const latencyMs = Math.max(0, audioStartMs - this.inputTurnEndMs);
    this.waitingForFirstOutput = false;
    this.callbacks.onResponseLatency?.(latencyMs);
    console.info(`[OpenAI Voice] First audible response after ${Math.round(latencyMs)} ms`);

    const currentAssistantFragments = [...this.fragments.values()]
      .filter((fragment) =>
        fragment.role === 'assistant' &&
        (fragment.sequence ?? -1) >= this.assistantTurnSequenceFloor
      );
    if (currentAssistantFragments.length > 0) {
      const firstFragment = currentAssistantFragments.sort(
        (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
      )[0];
      firstFragment.startMs = audioStartMs;
      firstFragment.endMs = Math.max(firstFragment.endMs, audioStartMs);
      this.callbacks.onTranscript?.(
        groupLiveTranscriptFragments([...this.fragments.values()])
      );
      this.scheduleTranscriptSync();
    }
  }

  private async waitForIceGathering(): Promise<void> {
    if (!this.peer || this.peer.iceGatheringState === 'complete') return;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.peer?.removeEventListener('icegatheringstatechange', onState);
        reject(new Error('Conectarea audio a expirat.'));
      }, 10000);
      const onState = () => {
        if (this.peer?.iceGatheringState !== 'complete') return;
        clearTimeout(timeout);
        this.peer.removeEventListener('icegatheringstatechange', onState);
        resolve();
      };
      this.peer?.addEventListener('icegatheringstatechange', onState);
      onState();
    });
  }

  private throwIfCancelled(): void {
    if (this.cancelRequested || this.cleanedUp) {
      throw createAbortError();
    }
  }

  private handleEvent(rawData: unknown): void {
    try {
      const event = JSON.parse(String(rawData));

      if (event.type === 'session.started') {
        this.sessionId = event.session?.id || this.sessionId;
        this.startedAt ||= new Date().toISOString();
        this.started = true;
        this.callbacks.onConnectionChange?.(true);
        this.callbacks.onStatus?.('Conversație vocală activă. Vorbește natural.');
        this.startedResolver?.();
        return;
      }

      if (event.type === 'session.created') {
        this.sessionId = event.session?.id || this.sessionId;
        this.startedAt ||= new Date().toISOString();
        this.started = true;
        this.callbacks.onConnectionChange?.(true);
        this.callbacks.onStatus?.('Conversație vocală activă. Vorbește natural.');
        this.startedResolver?.();
        return;
      }

      if (event.type === 'session.closed') {
        this.callbacks.onSpeakingChange?.(false);
        void this.syncTranscripts().finally(() => {
          this.cleanup();
          this.closeResolver?.();
        });
        return;
      }

      if (
        event.type === 'session.input_transcript.delta' ||
        event.type === 'session.output_transcript.delta'
      ) {
        this.addTranscriptFragment(event);
        return;
      }

      if (event.type === 'input_audio_buffer.speech_started') {
        this.userSpeaking = true;
        // WebRTC truncates the unheard response on the server. Muting the
        // remote element immediately also prevents any buffered audio from
        // talking over the student while that event propagates.
        if (this.audioElement) this.audioElement.muted = true;
        this.inputTurnStartMs = Number(event.audio_start_ms) || this.timelineMs();
        this.inputTurnEndMs = this.inputTurnStartMs;
        this.waitingForFirstOutput = false;
        this.assistantAudioStartMs = 0;
        this.assistantAudioAudible = false;
        this.callbacks.onAudioLevel?.(0);
        this.callbacks.onSpeakingChange?.(false);
        this.callbacks.onStatus?.('Te ascult…');
        return;
      }

      if (event.type === 'input_audio_buffer.speech_stopped') {
        this.userSpeaking = false;
        if (this.audioElement) this.audioElement.muted = false;
        const serverTurnEndMs = Number(event.audio_end_ms) || this.timelineMs();
        this.inputTurnEndMs = this.lastMicrophoneSpeechMs >= this.inputTurnStartMs
          ? this.lastMicrophoneSpeechMs
          : serverTurnEndMs;
        this.lastInputTranscriptAt = this.nowMs();
        this.waitingForFirstOutput = true;
        this.assistantAudioStartMs = 0;
        this.assistantTurnSequenceFloor = this.fragmentSequence;
        this.callbacks.onStatus?.('Pacientul răspunde…');
        return;
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.delta' ||
        event.type === 'conversation.item.input_audio_transcription.completed'
      ) {
        this.addRealtimeTranscript(event, 'user');
        return;
      }

      if (
        event.type === 'response.output_audio_transcript.delta' ||
        event.type === 'response.output_audio_transcript.done' ||
        event.type === 'response.audio_transcript.delta' ||
        event.type === 'response.audio_transcript.done'
      ) {
        this.addRealtimeTranscript(event, 'assistant');
        return;
      }

      if (event.type === 'response.done' || event.type === 'response.cancelled') {
        if (this.transportMode === 'live') {
          if (this.speakingTimer) clearTimeout(this.speakingTimer);
          this.callbacks.onSpeakingChange?.(false);
        }
        if (!this.userSpeaking && !this.assistantAudioAudible) {
          this.callbacks.onStatus?.(
            this.muted ? 'Microfon oprit.' : 'Conversație vocală activă.'
          );
        }
        return;
      }

      if (event.type === 'session.input_audio.muted') {
        this.callbacks.onMutedChange?.(true);
        return;
      }

      if (event.type === 'session.input_audio.unmuted') {
        this.callbacks.onMutedChange?.(false);
        return;
      }

      if (event.type === 'error' || event.type === 'invalid_request_error') {
        this.fail(new Error(
          event.error?.message || event.message || 'Eroare în conversația vocală.'
        ));
      }
    } catch (error) {
      console.error('Invalid OpenAI voice event:', error);
    }
  }

  private addTranscriptFragment(event: any): void {
    if (!event.event_id || typeof event.delta !== 'string' || !event.delta) return;

    const role: LiveTranscriptRole = event.type.includes('input_') ? 'user' : 'assistant';
    const receivedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (role === 'user' && this.transportMode === 'live') {
      this.lastInputTranscriptAt = receivedAt;
      this.waitingForFirstOutput = true;
    } else if (
      this.transportMode === 'live' &&
      this.waitingForFirstOutput &&
      this.lastInputTranscriptAt
    ) {
      const latencyMs = Math.max(0, receivedAt - this.lastInputTranscriptAt);
      this.waitingForFirstOutput = false;
      this.callbacks.onResponseLatency?.(latencyMs);
      console.info(`[OpenAI Voice] First response transcript after ${Math.round(latencyMs)} ms`);
    }
    const existing = this.fragments.get(event.event_id);
    this.fragments.set(event.event_id, {
      id: event.event_id,
      role,
      delta: event.delta,
      startMs: Number(event.start_ms) || 0,
      endMs: Number(event.end_ms) || Number(event.start_ms) || 0,
      sequence: existing?.sequence ?? this.fragmentSequence++
    });

    const segments = groupLiveTranscriptFragments([...this.fragments.values()]);
    this.callbacks.onTranscript?.(segments);
    if (role === 'assistant' && this.transportMode === 'live') {
      this.callbacks.onSpeakingChange?.(true);
      this.callbacks.onStatus?.('Pacientul vorbește…');
      if (this.speakingTimer) clearTimeout(this.speakingTimer);
      this.speakingTimer = setTimeout(() => {
        this.callbacks.onSpeakingChange?.(false);
        this.callbacks.onStatus?.(
          this.muted ? 'Microfon oprit.' : 'Conversație vocală activă.'
        );
      }, 700);
    } else if (this.transportMode === 'live') {
      this.callbacks.onSpeakingChange?.(false);
      this.callbacks.onStatus?.('Te ascult…');
    }
    this.scheduleTranscriptSync();
  }

  private addRealtimeTranscript(event: any, role: LiveTranscriptRole): void {
    const sourceId = String(
      event.item_id || event.response_id || event.event_id || `${role}-${Date.now()}`
    );
    const fragmentId = `realtime-${role}-${sourceId}`;
    const previousText = this.realtimeTranscriptText.get(fragmentId) || '';
    const completedText = typeof event.transcript === 'string' ? event.transcript : '';
    const delta = typeof event.delta === 'string' ? event.delta : '';
    const text = completedText || `${previousText}${delta}`;
    if (!text) return;

    this.realtimeTranscriptText.set(fragmentId, text);
    const existing = this.fragments.get(fragmentId);
    const currentTimelineMs = this.timelineMs();
    const startMs = role === 'user'
      ? this.inputTurnStartMs
      : this.assistantAudioStartMs || existing?.startMs || currentTimelineMs;
    const endMs = role === 'user'
      ? Math.max(this.inputTurnEndMs, startMs)
      : Math.max(currentTimelineMs, startMs);

    this.addTranscriptFragment({
      type: role === 'user'
        ? 'session.input_transcript.delta'
        : 'session.output_transcript.delta',
      event_id: fragmentId,
      delta: text,
      start_ms: startMs,
      end_ms: endMs
    });
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private timelineMs(): number {
    const startedAtMs = Date.parse(this.startedAt);
    return Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : 0;
  }

  private scheduleTranscriptSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.syncTranscripts();
    }, TRANSCRIPT_SYNC_DELAY_MS);
  }

  private async syncTranscripts(): Promise<void> {
    if (!this.sessionId || !this.startedAt || this.fragments.size === 0) return;
    if (this.syncInFlight) {
      this.syncDirty = true;
      await this.syncInFlight;
      return;
    }

    const segments = groupLiveTranscriptFragments([...this.fragments.values()]);
    this.syncInFlight = apiRequest(
      `/chat/conversations/${this.conversationId}/live/transcripts`,
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.sessionId,
          startedAt: this.startedAt,
          mode: this.transportMode,
          voiceConfig: this.voiceConfig,
          segments
        })
      }
    )
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to synchronize voice transcripts:', error);
      })
      .finally(() => {
        this.syncInFlight = null;
      });

    await this.syncInFlight;
    if (this.syncDirty) {
      this.syncDirty = false;
      await this.syncTranscripts();
    }
  }

  private fail(error: Error): void {
    this.callbacks.onError?.(error);
    this.callbacks.onStatus?.(error.message);
    this.startedRejecter?.(error);
    this.cleanup();
    void this.syncTranscripts();
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    if (this.audioMeterFrame !== null) cancelAnimationFrame(this.audioMeterFrame);
    this.audioMeterFrame = null;
    this.audioSource?.disconnect();
    this.audioAnalyser?.disconnect();
    this.microphoneAudioSource?.disconnect();
    this.microphoneAnalyser?.disconnect();
    this.audioSilentGain?.disconnect();
    void this.audioContext?.close().catch(() => undefined);
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.events?.close();
    this.peer?.close();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
    }
    this.microphone = null;
    this.events = null;
    this.peer = null;
    this.audioElement = null;
    this.audioContext = null;
    this.audioSource = null;
    this.audioAnalyser = null;
    this.microphoneAudioSource = null;
    this.microphoneAnalyser = null;
    this.audioSilentGain = null;
    this.assistantAudioAudible = false;
    this.callbacks.onAudioLevel?.(0);
    this.callbacks.onSpeakingChange?.(false);
    this.callbacks.onConnectionChange?.(false);
  }
}
