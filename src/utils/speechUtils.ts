/**
 * Fast Speech Recognition and Synthesis Utilities
 * Uses native Web Speech API for instant response in VR
 */

// Type definitions
export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechSynthesisOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Fast Speech-to-Text using Web Speech API
 * Much faster than OpenAI Whisper (~1-2 seconds vs 10+ seconds)
 */
export class FastSpeechRecognition {
  private recognition: any = null;
  private isListening = false;
  private transcript = '';
  private isFinal = false;
  /** Latest interim text (browsers often never mark VR utterances as final). */
  private lastInterimTranscript = '';
  /** True when user called stop() — do not Whisper-fallback. */
  private cancelled = false;
  private isSupported: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor() {
    // Initialize Web Speech API with cross-browser support
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        (window as any).mozSpeechRecognition ||
        (window as any).msSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.isSupported = true;
        console.log('✓ Web Speech API initialized');
      } else {
        console.warn('⚠ Web Speech API not available - will use audio recording + server Whisper');
        this.isSupported = false;
      }
    } catch (error) {
      console.error('Web Speech API initialization failed:', error);
      this.isSupported = false;
    }
  }

  /**
   * Check if Web Speech API is supported
   */
  public isWebSpeechSupported(): boolean {
    return this.isSupported && !!this.recognition;
  }

  /**
   * Start recording audio (fallback for when Web Speech API is unavailable)
   */
  private async startAudioRecording(timeoutMs: number = 30000): Promise<Blob> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        this.stream = stream;
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          if (!resolved) {
            resolved = true;
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.stream?.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
            this.stream = null;
            resolve(audioBlob);
          }
        };

        this.mediaRecorder.onerror = (event) => {
          if (!resolved) {
            resolved = true;
            this.stream?.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
            this.stream = null;
            reject(new Error(`Recording error: ${event.error}`));
          }
        };

        this.mediaRecorder.start();

        // Auto-stop recording after timeout (e.g., 30 seconds for VR)
        const timeoutHandle = setTimeout(() => {
          if (!resolved && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('Audio recording auto-stopped after timeout');
            this.stopAudioRecording();
          }
          clearTimeout(timeoutHandle);
        }, timeoutMs);
      }).catch(error => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Microphone access denied: ${error.message}`));
        }
      });
    });
  }

  /**
   * Stop audio recording
   */
  private stopAudioRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Start listening for speech
   */
  public start(options: SpeechRecognitionOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        reject(new Error('Already listening'));
        return;
      }

      this.transcript = '';
      this.isFinal = false;
      this.lastInterimTranscript = '';
      this.cancelled = false;
      this.isListening = true;

      // Try Web Speech API first
      if (this.isWebSpeechSupported()) {
        this.startWebSpeech(options, resolve, reject);
      } else {
        // Fallback to audio recording for server-side processing
        console.log('Using audio recording fallback (Whisper)');
        this.startAudioRecording()
          .then((audioBlob) => {
            this.isListening = false;
            resolve(audioBlob as any); // Return blob for server processing
          })
          .catch((error) => {
            this.isListening = false;
            reject(error);
          });
      }
    });
  }

  /**
   * Start Web Speech API recognition
   */
  private startWebSpeech(
    options: SpeechRecognitionOptions,
    resolve: (value: string) => void,
    reject: (reason?: any) => void
  ): void {
    let settled = false;
    let whisperFallbackStarted = false;
    const safeResolve = (value: string | Blob) => {
      if (settled) return;
      settled = true;
      this.isListening = false;
      resolve(value as any);
    };
    const safeReject = (reason: any) => {
      if (settled) return;
      settled = true;
      this.isListening = false;
      reject(reason);
    };

    const lang = options.language || 'ro-RO';
    // Standard property is `lang`; `.language` is non-standard and often ignored.
    this.recognition.lang = lang;
    if ('language' in this.recognition) {
      (this.recognition as any).language = lang;
    }
    if (options.continuous !== undefined) {
      this.recognition.continuous = options.continuous;
    }
    if (options.interimResults !== undefined) {
      this.recognition.interimResults = options.interimResults;
    }
    if (options.maxAlternatives !== undefined) {
      this.recognition.maxAlternatives = options.maxAlternatives;
    }

    const tryWhisperFallback = (reason: string) => {
      if (settled || whisperFallbackStarted) return;
      whisperFallbackStarted = true;
      console.warn(`Web Speech: ${reason} — falling back to microphone recording + server Whisper`);
      this.startAudioRecording()
        .then((blob) => safeResolve(blob))
        .catch((err) => safeReject(err));
    };

    // Handle incoming results
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();

        if (event.results[i].isFinal) {
          if (transcript.length > 0) {
            this.transcript += transcript + ' ';
            this.isFinal = true;
          }
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.lastInterimTranscript = interimTranscript;
        console.log('Interim:', interimTranscript);
      }
    };

    // Handle end of recognition
    this.recognition.onend = () => {
      if (settled || whisperFallbackStarted) return;

      if (this.cancelled) {
        this.cancelled = false;
        safeReject(new Error('Recognition cancelled'));
        return;
      }

      const finalText = this.transcript.trim();
      const interimText = this.lastInterimTranscript.trim();
      const bestText = finalText || interimText;

      if (bestText.length > 0) {
        safeResolve(bestText);
        return;
      }

      tryWhisperFallback('no final or interim transcript');
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      if (this.cancelled) {
        safeReject(new Error('Recognition cancelled'));
        return;
      }

      // Recoverable: let Whisper handle (onend may also fire; settled prevents double work)
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        tryWhisperFallback(event.error);
        return;
      }

      if (event.error === 'aborted') {
        safeReject(new Error('Recognition aborted'));
        return;
      }

      let errorMsg = 'Speech recognition failed';
      if (event.error === 'network') {
        errorMsg = 'Network error. Check your connection.';
      }

      safeReject(new Error(errorMsg));
    };

    // Start recognition
    try {
      this.recognition.start();
    } catch (error) {
      this.isListening = false;
      safeReject(new Error(`Failed to start recognition: ${error}`));
    }
  }

  /**
   * Stop listening
   */
  public stop(): void {
    this.cancelled = true;
    this.isListening = false;

    if (this.isWebSpeechSupported() && this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    } else {
      // Stop audio recording fallback
      this.stopAudioRecording();
    }
  }

  /**
   * Abort recognition
   */
  public abort(): void {
    this.cancelled = true;
    this.isListening = false;

    if (this.isWebSpeechSupported() && this.recognition) {
      try {
        this.recognition.abort();
      } catch (error) {
        console.error('Error aborting recognition:', error);
      }
    } else {
      // Abort audio recording
      this.stopAudioRecording();
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.mediaRecorder) {
        this.mediaRecorder = null;
      }
    }
  }

  /**
   * Check if browser supports Web Speech API
   */
  public static isSupported(): boolean {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }
}

/**
 * Fast Text-to-Speech using OpenAI Onyx voice
 * High-quality audio with Onyx voice model
 */
export class FastSpeechSynthesis {
  private isSpeaking = false;
  private audioElement: HTMLAudioElement | null = null;
  private apiHost: string = '';
  private token: string = '';

  constructor() {
    // Create a hidden audio element for playback
    if (typeof document !== 'undefined') {
      this.audioElement = document.createElement('audio');
    }
  }

  /**
   * Set authentication token for API calls
   */
  public setToken(token: string): void {
    this.token = token;
  }

  /**
   * Set API host for backend calls
   */
  public setApiHost(apiHost: string): void {
    this.apiHost = apiHost;
  }

  /**
   * Speak text using OpenAI Onyx voice
   */
  public speak(text: string, options: SpeechSynthesisOptions = {}): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Stop any ongoing playback
        if (this.audioElement) {
          this.audioElement.pause();
          this.audioElement.currentTime = 0;
        }

        if (!text || !text.trim()) {
          resolve();
          return;
        }

        this.isSpeaking = true;

        // Call backend TTS endpoint
        const response = await fetch(`${this.apiHost}/chat/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({
            text: text.trim(),
            voice: 'onyx' // Male voice
          })
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.statusText}`);
        }

        // Get audio blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        if (!this.audioElement) {
          throw new Error('Audio element not available');
        }

        this.audioElement.src = audioUrl;
        this.audioElement.onended = () => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        this.audioElement.onerror = (error) => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          console.error('Audio playback error:', error);
          reject(new Error('Audio playback failed'));
        };

        this.audioElement.play().catch((error) => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
      } catch (error) {
        this.isSpeaking = false;
        console.error('Speech synthesis error:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop speaking
   */
  public stop(): void {
    this.isSpeaking = false;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  /**
   * Check if currently speaking
   */
  public isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Check if browser supports Web Speech API
   */
  public static isSupported(): boolean {
    return true; // OpenAI TTS always supported as long as backend is available
  }

  /**
   * Get available voices (for compatibility)
   */
  public getAvailableVoices(): any[] {
    return [{ name: 'Onyx', lang: 'en-US' }]; // OpenAI Onyx voice
  }
}

/**
 * Utility function to check if device is VR-ready
 * OpenAI TTS is always available, check only for STT
 */
export function isVRSpeechReady(): boolean {
  return FastSpeechRecognition.isSupported();
}
