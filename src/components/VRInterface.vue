<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { useChatStore } from '@/stores/chatStore';
import { useUserStore } from '@/stores/userStore';
import { API_HOST, API_PATH } from '@/apiConfig';
import { FastSpeechRecognition, FastSpeechSynthesis } from '@/utils/speechUtils';
import {
    OpenAILiveConversation,
    supportsOpenAILive,
    type LiveTranscriptSegment
} from '@/services/openaiLiveService';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['close']);

const chatStore = useChatStore();
const userStore = useUserStore(); // Need this for token
const container = ref<HTMLElement | null>(null);
const statusText = ref('Ready');
const isListening = ref(false);
const isSpeaking = ref(false);
const isLiveConnecting = ref(false);
const isLiveConnected = ref(false);
const isLiveMuted = ref(false);
const lastLiveResponseLatencyMs = ref<number | null>(null);
const liveAudioLevel = ref(0);

// Three.js variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let avatar: THREE.Object3D;
let controller1: any, controller2: any;
let controllerGrip1: any, controllerGrip2: any;
let raycaster: THREE.Raycaster;
const intersected: any[] = [];
let vrSupportLabelObserver: MutationObserver | null = null;

// UI Variables
let talkButton: THREE.Mesh;
let closeButton: THREE.Mesh;
let debugPanel: THREE.Mesh;

// Fast Speech Recognition & Synthesis (WebXR optimized)
let speechRecognition: FastSpeechRecognition | null = null;
let speechSynthesis: FastSpeechSynthesis | null = null;
let liveConversation: OpenAILiveConversation | null = null;
let liveUnavailableForSession = false;

// Audio Recording (backup for unsupported browsers)
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let stream: MediaStream | null = null;

// Audio Playback (backup)
const synth = window.speechSynthesis;
let currentAudio: HTMLAudioElement | null = null;
let smoothedMouthLevel = 0;

// --- Helper Functions ---

const createTextTexture = (text: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128; // Standard button size
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 512, 128);
        ctx.font = '60px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

const updateDebugPanel = () => {
    if (!debugPanel) return;
    const mat = debugPanel.material as THREE.MeshBasicMaterial;
    if (!mat.map) return;
    
    const canvas = mat.map.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 512, 256);
    
    ctx.font = '24px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const padding = 20;
    let y = padding;
    
    // Status Lines
    const isSecure = window.isSecureContext;

    ctx.fillText(`Secure Context: ${isSecure ? 'YES' : 'NO'}`, padding, y);
    ctx.fillStyle = isSecure ? '#4caf50' : '#ff4444';
    ctx.fillRect(400, y, 20, 20); 
    
    y += 40;
    ctx.fillStyle = '#fff';
    const usingClassicVoice = liveUnavailableForSession || !supportsOpenAILive();
    const voiceState = isLiveConnected.value
        ? (isLiveMuted.value ? 'Muted' : 'Realtime')
        : (isLiveConnecting.value
            ? 'Connecting'
            : usingClassicVoice ? 'Classic (slow)' : 'Ready');
    ctx.fillText(`Voice: ${voiceState}`, padding, y);
    ctx.fillStyle = isLiveConnected.value
        ? '#4caf50'
        : usingClassicVoice ? '#ff4444' : '#ffa500';
    ctx.fillRect(400, y, 20, 20);

    y += 40;
    ctx.fillStyle = '#fff';
    ctx.fillText(`Status: ${statusText.value}`, padding, y);

    if (lastLiveResponseLatencyMs.value !== null) {
        y += 40;
        ctx.fillText(
            `Reply delay: ${(lastLiveResponseLatencyMs.value / 1000).toFixed(1)}s`,
            padding,
            y
        );
    }
    
    mat.map.needsUpdate = true;
};

const updateUIState = () => {
    if (!talkButton) return;
    
    const mat = talkButton.material as THREE.MeshBasicMaterial;
    if (mat.map) {
        const canvas = mat.map.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const active = isLiveConnected.value || isLiveConnecting.value;
            ctx.fillStyle = active ? '#ff4444' : '#2196F3';
            ctx.fillRect(0, 0, 512, 128);
            ctx.font = '60px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = isLiveConnecting.value
                ? 'Connecting'
                : !isLiveConnected.value
                    ? 'Start Voice'
                    : isLiveMuted.value ? 'Resume Voice' : 'Mute Voice';
            ctx.fillText(label, 256, 64);
        }
        mat.map.needsUpdate = true;
    }
};

const createVRInterface = () => {
    // Talk Button
    const talkGeo = new THREE.PlaneGeometry(0.4, 0.15);
    const talkMat = new THREE.MeshBasicMaterial({ map: createTextTexture('Start Voice', '#2196F3'), side: THREE.DoubleSide });
    talkButton = new THREE.Mesh(talkGeo, talkMat);
    talkButton.position.set(-0.3, 1.3, -0.8); // Left, slightly up, in front
    talkButton.rotation.x = -0.2;
    talkButton.userData = { isButton: true, action: 'talk' };
    talkButton.visible = false; 
    scene.add(talkButton);

    // Close Button
    const closeGeo = new THREE.PlaneGeometry(0.4, 0.15);
    const closeMat = new THREE.MeshBasicMaterial({ map: createTextTexture('Close VR', '#ff4444'), side: THREE.DoubleSide });
    closeButton = new THREE.Mesh(closeGeo, closeMat);
    closeButton.position.set(0.3, 1.3, -0.8); // Right, slightly up, in front
    closeButton.rotation.x = -0.2;
    closeButton.userData = { isButton: true, action: 'close' };
    closeButton.visible = false; 
    scene.add(closeButton);
};

const createDebugPanel = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    // DoubleSide to be seen from behind if needed, transparent for HUD feel
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    debugPanel = new THREE.Mesh(geo, mat);
    // Keep panel in front of user and away from avatar center so text stays visible in headset.
    debugPanel.position.set(-0.75, 1.8, -1.0);
    debugPanel.visible = false; 
    scene.add(debugPanel);

    updateDebugPanel();
};

const createPlaceholder = () => {
    const group = new THREE.Group();
    const headGeometry = new THREE.SphereGeometry(0.15, 32, 32); 
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    avatar = new THREE.Mesh(headGeometry, material);
    avatar.position.set(0, 1.6, -1.5); 
    group.add(avatar);
    scene.add(group);
};

// --- Logic ---

const speak = async (text: string) => {
    if (!text || !text.trim()) return;

    try {
        statusText.value = "Speaking...";
        isSpeaking.value = true;
        updateDebugPanel();

        // Use fast Web Speech API for instant response
        if (speechSynthesis) {
            await speechSynthesis.speak(text, {
                language: 'ro-RO',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0
            });
        } else {
            // Fallback to Web Speech API
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ro-RO';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            await new Promise<void>((resolve) => {
                utterance.onend = () => resolve();
                synth.speak(utterance);
            });
        }

        isSpeaking.value = false;
        statusText.value = "Ready";
        updateDebugPanel();

    } catch (error) {
        console.error('Speech Error:', error);
        statusText.value = "Voice Error";
        isSpeaking.value = false;
        updateDebugPanel();
    }
};

// Fast speech recognition using Web Speech API
const recognizeSpeech = async (): Promise<string> => {
    try {
        if (!speechRecognition) {
            throw new Error('Speech recognition not initialized');
        }

        statusText.value = "Listening...";
        isListening.value = true;
        updateDebugPanel();

        const result = await speechRecognition.start({
            language: 'ro-RO',
            continuous: false,
            interimResults: true,
            maxAlternatives: 1
        });

        isListening.value = false;

        // Check if result is a Blob (audio recording fallback) or string (Web Speech API)
        if (result && typeof result === 'object' && 'type' in result && 'size' in result) {
            // It's a Blob
            statusText.value = "Processing audio on server...";
            updateDebugPanel();
            
            // Use server-side Whisper for audio
            const transcript = await localTranscribeAudio(result as any);
            statusText.value = `Heard: "${transcript}"`;
            updateDebugPanel();
            return transcript;
        } else {
            // Web Speech API returned text directly
            statusText.value = `Heard: "${result}"`;
            updateDebugPanel();
            return result;
        }
    } catch (error: any) {
        isListening.value = false;
        console.error('Recognition Error:', error);
        throw error;
    }
};

// Local implementation to bypass store caching issues
const localTranscribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      const token = userStore.getToken();

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language', 'ro'); // Explicitly request Romanian

      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for Whisper

      try {
        // Use the config constants directly
        const response = await fetch(`${API_HOST}${API_PATH}/chat/transcribe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Note: Content-Type is auto-set by fetch when using FormData
          },
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to transcribe audio');
        }

        const data = await response.json();
        return data.text;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Transcription timed out. Please try again.');
        }
        throw err;
      }
    } catch (err: any) {
      console.error('Local STT Error:', err);
      throw err;
    }
};

let isProcessing = false; // Prevent double-clicking
const isXRSessionActive = () => !!(renderer && renderer.xr && renderer.xr.isPresenting);

const toggleLegacyListening = async () => {
    try {
        // Prevent double-clicking or rapid button presses
        if (isProcessing) {
            console.warn('Already processing, ignoring button press');
            return;
        }

        // In headset/XR mode prefer MediaRecorder flow (same as browser fallback path).
        // Web Speech can stay stuck in XR on some headsets.
        if (isXRSessionActive() && mediaRecorder) {
            if (isListening.value) {
                if (mediaRecorder.state === 'recording') {
                    isProcessing = true;
                    mediaRecorder.stop();
                    statusText.value = "Processing Audio...";
                    updateDebugPanel();
                }
                isListening.value = false;
                updateUIState();
                return;
            }

            if (mediaRecorder.state === 'inactive') {
                audioChunks = [];
                mediaRecorder.start();
                isListening.value = true;
                statusText.value = "Listening...";
                updateDebugPanel();
                updateUIState();
                return;
            }
        }

        if (!speechRecognition) {
            statusText.value = "Mic Error: Speech recognition not initialized";
            updateDebugPanel();
            throw new Error('Speech recognition not available');
        }

        if (isListening.value) {
            speechRecognition.stop();
            isListening.value = false;
            updateUIState();
            return;
        }

        // Mark as processing to prevent double-clicks
        isProcessing = true;

        // Perform speech recognition (Web Speech API or audio recording fallback)
        try {
            const transcript = await recognizeSpeech();

            if (!chatStore.currentConversation) {
                statusText.value = "Error: No active conversation";
                updateDebugPanel();
                return;
            }

            statusText.value = "Thinking...";
            updateDebugPanel();

            // Create timeout promise for chat message (30s timeout for faster response)
            const messagePromise = chatStore.sendMessage(transcript);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Chat response timed out after 30s')), 30000)
            );

            const response = await Promise.race([messagePromise, timeoutPromise]);

            if (response && response.assistantMessage) {
                await speak(response.assistantMessage.content);
            } else {
                statusText.value = "Ready";
            }
            updateDebugPanel();

        } catch (error: any) {
            console.error('Speech/Chat Error:', error);
            statusText.value = "Error: " + (error.message || "Unknown");
            updateDebugPanel();
        } finally {
            // Always reset processing flag
            isProcessing = false;
            isListening.value = false;
            updateUIState();
        }
    } catch (error: any) {
        console.error('Listening Error:', error);
        statusText.value = "Mic Error: " + (error.message || "Unknown");
        updateDebugPanel();
        isProcessing = false;
    }
};

const handleLiveTranscript = (segments: LiveTranscriptSegment[]) => {
    const latest = segments[segments.length - 1];
    if (latest) {
        const speaker = latest.role === 'user' ? 'Medic' : 'Pacient';
        const preview = latest.content.trim().slice(-80);
        statusText.value = `${speaker}: ${preview}`;
        updateDebugPanel();
    }
};

const startLiveConversation = async () => {
    if (!chatStore.currentConversation?.id) {
        throw new Error('Nu există o conversație activă.');
    }

    isLiveConnecting.value = true;
    statusText.value = 'Se conectează conversația în timp real…';
    updateUIState();
    updateDebugPanel();

    liveConversation = new OpenAILiveConversation(chatStore.currentConversation.id, {
        onStatus: (status) => {
            statusText.value = status;
            updateDebugPanel();
        },
        onTranscript: handleLiveTranscript,
        onResponseLatency: (latencyMs) => {
            lastLiveResponseLatencyMs.value = latencyMs;
            updateDebugPanel();
        },
        onConnectionChange: (connected) => {
            isLiveConnected.value = connected;
            if (!connected) {
                isLiveMuted.value = false;
                isListening.value = false;
            }
            updateUIState();
            updateDebugPanel();
        },
        onSpeakingChange: (speaking) => {
            isSpeaking.value = speaking;
        },
        onAudioLevel: (level) => {
            liveAudioLevel.value = level;
        },
        onMutedChange: (muted) => {
            isLiveMuted.value = muted;
            isListening.value = !muted;
            updateUIState();
            updateDebugPanel();
        },
        onError: (error) => {
            console.error('Realtime voice error:', error);
        }
    });

    try {
        await liveConversation.start();
        isLiveConnected.value = true;
        isLiveMuted.value = false;
        isListening.value = true;
        statusText.value = 'Conversație vocală activă. Vorbește natural.';
    } finally {
        isLiveConnecting.value = false;
        updateUIState();
        updateDebugPanel();
    }
};

const stopLiveConversation = async () => {
    const activeConversation = liveConversation;
    liveConversation = null;
    isLiveConnected.value = false;
    isLiveConnecting.value = false;
    isLiveMuted.value = false;
    lastLiveResponseLatencyMs.value = null;
    isListening.value = false;
    isSpeaking.value = false;
    liveAudioLevel.value = 0;
    statusText.value = 'Se încheie conversația vocală…';
    updateUIState();
    updateDebugPanel();

    if (activeConversation) {
        try {
            await activeConversation.stop();
        } catch (error) {
            console.error('Failed to close the realtime voice session cleanly:', error);
        }
    }
    statusText.value = 'Conversație vocală oprită.';
    updateUIState();
    updateDebugPanel();
};

const toggleListening = async () => {
    if (!supportsOpenAILive() || liveUnavailableForSession) {
        await toggleLegacyListening();
        return;
    }

    if (isLiveConnecting.value) {
        await stopLiveConversation();
        return;
    }

    if (!isLiveConnected.value || !liveConversation) {
        try {
            await startLiveConversation();
            return;
        } catch (error: any) {
            if (error?.name === 'AbortError') return;
            console.error('Realtime voice unavailable, using legacy voice fallback:', error);
            liveUnavailableForSession = true;
            liveConversation = null;
            isLiveConnected.value = false;
            isLiveConnecting.value = false;
            isListening.value = false;
            statusText.value = `Vocea realtime a eșuat: ${error?.message || 'eroare necunoscută'}. Se folosește modul clasic.`;
            updateUIState();
            updateDebugPanel();
            if (isXRSessionActive() && !mediaRecorder) {
                await initAudioRecording();
            }
            await toggleLegacyListening();
            return;
        }
    }

    await liveConversation.setMuted(!isLiveMuted.value);
};

const initAudioRecording = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            statusText.value = "Processing Audio...";
            updateDebugPanel();
            
            try {
                // Use LOCAL implementation instead of store to guarantee we use the new code
                const transcript = await localTranscribeAudio(audioBlob);
                
                statusText.value = `Heard: "${transcript}"`;
                updateDebugPanel();

                if (!chatStore.currentConversation) {
                    statusText.value = "Error: No active conversation";
                    updateDebugPanel();
                    return;
                }

                statusText.value = "Thinking...";
                updateDebugPanel();

                // Create timeout promise for chat message
                const messagePromise = chatStore.sendMessage(transcript);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Chat response timed out after 60s')), 60000)
                );

                const response = await Promise.race([messagePromise, timeoutPromise]);

                if (response && response.assistantMessage) {
                    speak(response.assistantMessage.content);
                } else {
                     statusText.value = "Ready";
                }
                updateDebugPanel();

            } catch (error: any) {
                console.error('Transcribe/Send Error:', error);
                statusText.value = "Error: " + (error.message || "Unknown");
                updateDebugPanel();
            } finally {
                isProcessing = false;
                isListening.value = false;
                updateUIState();
            }
        };
        
        updateDebugPanel();

    } catch (err: any) {
        console.error("Mic Access Error:", err);
        statusText.value = "Mic Access Denied";
        updateDebugPanel();
    }
};

const closeVR = async () => {
    await stopLiveConversation();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    emit('close');
};

const onSelectStart = (event: any) => {
    const controller = event.target;
    
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects([talkButton, closeButton].filter(Boolean));

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.action === 'talk') {
            toggleListening();
        } else if (object.userData.action === 'close') {
            const session = renderer.xr.getSession();
             if (session) {
                session.end();
            }
            void closeVR();
        }
    }
};

const onSelectEnd = () => {
    // Trigger release
};

const render = () => {
    const cleanIntersected = () => {
        while (intersected.length) {
            intersected.pop();
        }
    };

    cleanIntersected();
    
    const controllers = [controller1, controller2];
    
    for (const controller of controllers) {
        if (!controller) continue;
        
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);

        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const intersects = raycaster.intersectObjects([talkButton, closeButton].filter(Boolean));

        if (intersects.length > 0) {
            const object = intersects[0].object;
            intersected.push(object);
        }
    }

    if (avatar) {
        const legacyAnimationLevel = isSpeaking.value
            ? (Math.sin(Date.now() * 0.015) + 1) * 0.35
            : 0;
        const targetMouthLevel = isLiveConnected.value
            ? liveAudioLevel.value
            : legacyAnimationLevel;
        smoothedMouthLevel += (targetMouthLevel - smoothedMouthLevel) * 0.4;
        if (smoothedMouthLevel < 0.01) smoothedMouthLevel = 0;

        avatar.traverse((child: any) => {
            if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                const targetIndex = child.morphTargetDictionary['viseme_aa'] ??
                                  child.morphTargetDictionary['mouthOpen'] ??
                                  child.morphTargetDictionary['O'];

                if (targetIndex !== undefined) {
                    child.morphTargetInfluences[targetIndex] = Math.min(
                        1,
                        Math.max(0, smoothedMouthLevel)
                    );
                }
            }
        });
    }
    
    updateUIState();
    renderer.render(scene, camera);
};

const animate = () => {
    renderer.setAnimationLoop(render);
};

const initThreeJS = () => {
    if (!container.value) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.0, 2.0); 

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; 
    container.value.appendChild(renderer.domElement);

    createVRInterface();
    createDebugPanel();

    const loader = new GLTFLoader();
    loader.load(
        '/avatar.glb',
        (gltf) => {
            const model = gltf.scene;
            model.position.set(0, 0, -1.5); 
            model.rotation.y = 0;
            avatar = model; 
            scene.add(model);
            statusText.value = "Ready";
            updateDebugPanel();
        },
        undefined,
        (error) => {
             console.error('Error loading avatar:', error);
             statusText.value = "Avatar Error";
             createPlaceholder();
             updateDebugPanel();
        }
    );

    // VR Button
    const vrButton = VRButton.createButton(renderer);
    vrButton.classList.add('paviagen-vr-button');

    // Three.js changes this label and its inline positioning asynchronously
    // after checking WebXR support. Keep unsupported notices separate from the
    // ENTER/EXIT VR control regardless of those later inline changes.
    const updateVRSupportLabelPosition = () => {
        const label = (vrButton.textContent || '').toUpperCase();
        const isUnsupported =
            label.includes('NOT SUPPORTED') ||
            label.includes('NOT AVAILABLE') ||
            label.includes('NOT ALLOWED') ||
            label.includes('NEEDS HTTPS');
        vrButton.classList.toggle('paviagen-vr-unsupported', isUnsupported);
    };
    vrSupportLabelObserver?.disconnect();
    vrSupportLabelObserver = new MutationObserver(updateVRSupportLabelPosition);
    vrSupportLabelObserver.observe(vrButton, {
        childList: true,
        characterData: true,
        subtree: true
    });
    updateVRSupportLabelPosition();
    container.value.appendChild(vrButton);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(0, 2, 3); 
    scene.add(directionalLight);

    // Controllers
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geometry);
    line.name = 'line';
    line.scale.z = 5;
    controller1.add(line.clone());
    controller2.add(line.clone());

    raycaster = new THREE.Raycaster();

    renderer.xr.addEventListener('sessionstart', () => {
        if (talkButton) talkButton.visible = true;
        if (closeButton) closeButton.visible = true;
        if (debugPanel) debugPanel.visible = true;
        void liveConversation?.resumeAudioPlayback();
        updateDebugPanel();
    });

    renderer.xr.addEventListener('sessionend', () => {
        if (talkButton) talkButton.visible = false;
        if (closeButton) closeButton.visible = false;
        if (debugPanel) debugPanel.visible = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        void stopLiveConversation();
    });

    animate();
};

const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

onMounted(() => {
    // Initialize speech utilities for VR response
    // Always initialize FastSpeechRecognition even if Web Speech API might not be available
    speechRecognition = new FastSpeechRecognition();
    speechSynthesis = new FastSpeechSynthesis();
    
    // Configure OpenAI TTS with API credentials
    const token = userStore.getToken();
    if (token) {
        speechSynthesis.setToken(token);
        // Must include API_PATH — same base as transcribe (`/api/v1/chat/...`), not origin alone.
        speechSynthesis.setApiHost(`${API_HOST}${API_PATH}`);
    }
    
    if (supportsOpenAILive()) {
        statusText.value = "Conversație vocală în timp real pregătită";
    } else if (speechRecognition && (speechRecognition as any).isWebSpeechSupported?.()) {
        statusText.value = "Mod vocal clasic pregătit";
    } else {
        statusText.value = "VR Speech Ready (Server Fallback)";
    }

    initThreeJS();
    window.addEventListener('resize', handleResize);

    // Opening the exercise pre-connects one persistent WebRTC session so the
    // first spoken turn does not pay connection-setup latency.
    if (supportsOpenAILive()) {
        void startLiveConversation().catch((error: any) => {
            if (error?.name === 'AbortError') return;
            console.error('Realtime voice pre-connection failed:', error);
            liveUnavailableForSession = true;
            liveConversation = null;
            isLiveConnected.value = false;
            isLiveConnecting.value = false;
            isListening.value = false;
            statusText.value = `Vocea realtime a eșuat: ${error?.message || 'eroare necunoscută'}. Se folosește modul clasic.`;
            updateUIState();
            updateDebugPanel();
        });
    }
});

onUnmounted(() => {
    void stopLiveConversation();
    vrSupportLabelObserver?.disconnect();
    vrSupportLabelObserver = null;
    // Cleanup speech resources
    if (speechRecognition) {
        speechRecognition.abort();
    }
    if (speechSynthesis) {
        speechSynthesis.stop();
    }

    if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
    }
    window.removeEventListener('resize', handleResize);
    synth.cancel();
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
</script>

<template>
  <div v-if="visible" class="vr-overlay">
    <div ref="container" class="three-container"></div>
    
    <div class="ui-layer">
        <div class="header">
            <button @click="closeVR" class="close-btn">Close VR</button>
            <div class="status">{{ statusText }}</div>
        </div>

        <div class="controls">
            <button 
                @click="toggleListening" 
                :class="['mic-btn', isLiveConnected || isLiveConnecting ? 'listening' : '']"
            >
                {{
                    !isLiveConnected && !isLiveConnecting
                            ? 'Pornește conversația vocală'
                            : isLiveConnecting
                                ? 'Se conectează…'
                                : isLiveMuted
                                    ? 'Reia microfonul'
                                    : 'Oprește microfonul'
                }}
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.vr-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    background-color: #000;
}

.three-container {
    width: 100%;
    height: 100%;
}

.ui-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none; 
}

.ui-layer > * {
    pointer-events: auto;
}

.header {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 1001;
    display: flex;
    gap: 20px;
    align-items: center;
}

.three-container :deep(.paviagen-vr-button) {
    position: absolute !important;
    top: 20px !important;
    right: 20px !important;
    bottom: auto !important;
    left: auto !important;
    z-index: 1000 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: auto !important;
    min-width: 112px !important;
    height: auto !important;
    min-height: 38px !important;
    max-height: 44px !important;
    margin: 0 !important;
    padding: 8px 14px !important;
    border: 1px solid #7c3aed !important;
    border-radius: 8px !important;
    background: rgba(0, 0, 0, 0.82) !important;
    color: #fff !important;
    font: 600 14px/1.1 Arial, sans-serif !important;
    text-align: center !important;
    white-space: nowrap !important;
}

.three-container :deep(.paviagen-vr-button.paviagen-vr-unsupported) {
    top: auto !important;
    right: 20px !important;
    bottom: 20px !important;
    left: auto !important;
    min-width: 150px !important;
    border-color: #6b7280 !important;
    opacity: 0.8 !important;
    cursor: default !important;
}

.close-btn {
    padding: 10px 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
}

.status {
    color: white;
    font-size: 1.2rem;
    background: rgba(0,0,0,0.5);
    padding: 5px 10px;
    border-radius: 5px;
}

.controls {
    position: absolute;
    bottom: 50px;
    left: 50px; 
    width: 100%; 
    display: flex;
    justify-content: center;
}

.mic-btn {
    padding: 20px 40px;
    font-size: 1.5rem;
    border-radius: 50px;
    border: none;
    background: #2196F3;
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    transition: all 0.2s;
}

.mic-btn.listening {
    background: #ff4444;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
</style>
