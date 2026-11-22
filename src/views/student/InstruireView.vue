<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { useTrainingStore } from '@/stores/trainingStore';
import { useChatStore } from '@/stores/chatStore';
import { useRealTimeChat, createTypingDetector, getUserToken } from '@/composables/useRealTimeChat';
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import VRInterface from '@/components/VRInterface.vue';

const appStore = useAppStore();
const trainingStore = useTrainingStore();
const chatStore = useChatStore();
const dialogVisible = ref(false);
const aiAsked = ref(false);
const medicSay = ref('');
const isVRVisible = ref(false);

// Real-time chat integration
const {
    handleTypingStart,
    handleTypingStop,
    reconnect,
} = useRealTimeChat(getUserToken());

// Training dialog state
const currentScenarioId = ref<string | null>(null);
const conversationMessages = ref<any[]>([]);
const isUserTyping = ref(false);
const errorMessage = ref('');
const messageInput = ref<any>();

// Typing detector for real-time indicators
const typingDetector = createTypingDetector(
    () => {
        isUserTyping.value = true;
        handleTypingStart();
    },
    () => {
        isUserTyping.value = false;
        handleTypingStop();
    },
    2000 // Stop typing after 2 seconds of inactivity
);

// Computed properties
const currentScenario = computed(() => {
    return trainingStore.scenarios.find(s => s.isActive);
});

const canSendMessage = computed(() => {
    return medicSay.value.trim() !== '' && !aiAsked.value && chatStore.isConnected;
});

const connectionStatusText = computed(() => {
    return chatStore.isConnected ? 'Connected' : 'Disconnected - Click to reconnect';
});

const breadcrumbData = ref([
    { label: 'student', route: '/student' },
    { label: 'instruire' },
]);
appStore.breadcrumb = breadcrumbData.value;
const footerInfoData = ref([
    { icon: 'enter-black', text: 'Trimite mesajul introdus în câmpul prompt (acțiune identică cu tasta Enter)' },
    { icon: 'medic-dark-blue', text: 'Student' }
]);
appStore.footerInfo = footerInfoData.value;

const handleScenarioTextClick = async (scenario: any) => {
    try {
        // Clear any previous errors
        errorMessage.value = '';

        // add active class to the clicked scenario
        trainingStore.scenarios.forEach(s => s.isActive = false);
        scenario.isActive = true;

        // Create or select conversation for this scenario
        currentScenarioId.value = scenario.id || `scenario-${scenario.index}`;

        // Initialize conversation messages
        conversationMessages.value = [
            {
                id: 'intro-' + Date.now(),
                role: 'system',
                content: `${scenario.index}: ${scenario.title}. Începe dialogul cu pacientul.`,
                timestamp: new Date().toISOString()
            }
        ];

        // Create conversation in chat store for real-time features
        // System prompt will be automatically generated from health profile on server
        // Pass scenario information to be used in prompt generation
        try {
            await chatStore.createConversation(
                `Training - ${scenario.title}`,
                {
                    scenarioIndex: scenario.index,
                    scenarioTitle: scenario.title
                }
            );
        } catch (error: any) {
            console.error('Failed to create chat conversation:', error);
            errorMessage.value = `Authentication/Server Error: ${error.message}. Try logging out and back in.`;
            return; // Don't open dialog if server fails
        }

        dialogVisible.value = true;

        // Focus input after dialog appears
        await nextTick();
        if (messageInput.value?.$el) {
            messageInput.value.$el.focus();
        }

        // Send notification about scenario start
        chatStore.addNotification({
            id: `scenario-start-${Date.now()}`,
            type: 'info',
            message: `Started training scenario: ${scenario.title}`,
            timestamp: new Date().toISOString(),
            read: false
        });

    } catch (error) {
        console.error('Failed to initialize scenario:', error);
        errorMessage.value = 'Failed to start scenario. Please try again.';
    }
};

const handleAskAI = async () => {
    if (!canSendMessage.value) {
        return;
    }

    const messageContent = medicSay.value.trim();
    medicSay.value = '';
    aiAsked.value = true;
    errorMessage.value = '';

    // Stop typing indicator
    typingDetector.stopTyping();

    try {
        // Add user message to local conversation
        const userMessage = {
            id: 'user-' + Date.now(),
            role: 'user',
            content: messageContent,
            timestamp: new Date().toISOString()
        };
        conversationMessages.value.push(userMessage);

        // Auto-scroll after user message is added
        await nextTick();
        scrollToBottom();

        // Send message via chat store to get real AI response
        if (chatStore.currentConversation) {
            const response = await chatStore.sendMessage(messageContent);
            
            // Add AI response to local conversation
            if (response.assistantMessage) {
                const aiMessage = {
                    id: response.assistantMessage.id,
                    role: 'assistant',
                    content: response.assistantMessage.content,
                    timestamp: response.assistantMessage.createdAt
                };
                
                // Remove user message if it was added by chatStore
                const lastMsg = conversationMessages.value[conversationMessages.value.length - 1];
                if (lastMsg.id === response.userMessage?.id) {
                    conversationMessages.value.pop();
                }
                
                conversationMessages.value.push(aiMessage);
                
                // Auto-scroll after AI message is added
                await nextTick();
                scrollToBottom();
            }

            // Send success notification
            chatStore.addNotification({
                id: `message-sent-${Date.now()}`,
                type: 'success',
                message: 'Message sent successfully',
                timestamp: new Date().toISOString(),
                read: false
            });
        } else {
            throw new Error('No active conversation. Please try restarting the scenario.');
        }

    } catch (error: any) {
        console.error('Failed to send message:', error);
        errorMessage.value = error?.message || 'Failed to send message. Please try again.';

        // Send error notification
        chatStore.addNotification({
            id: `message-error-${Date.now()}`,
            type: 'error',
            message: 'Failed to send message',
            timestamp: new Date().toISOString(),
            read: false
        });
    } finally {
        aiAsked.value = false;

        // Auto-scroll to bottom
        await nextTick();
        scrollToBottom();

        // Focus input for next message
        if (messageInput.value?.$el) {
            messageInput.value.$el.focus();
        }
    }
};

// Note: AI response is now handled by the server via chatStore.sendMessage()
// The server uses OpenAI API to generate intelligent responses based on conversation context

// Scroll to bottom of messages
const scrollToBottom = () => {
    const messagesContainer = document.querySelector('.dialog-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
};

// Format message timestamp
const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

// Handle input events for typing detection
const handleInputChange = () => {
    typingDetector.handleInput();
};

const handleInputBlur = () => {
    typingDetector.stopTyping();
};

onMounted(async () => {
    trainingStore.scenarios.forEach(s => s.isActive = false);

    // Initialize real-time chat features
    try {
        // Load conversations if needed
        await chatStore.loadConversations();
    } catch (error) {
        console.error('Failed to initialize chat features:', error);
        errorMessage.value = 'Some features may be limited due to connection issues.';
    }
});

// Watch for AI response status changes
watch(() => chatStore.aiIsResponding, (isResponding) => {
    if (isResponding) {
        console.log('AI is generating response...');
    }
});

// Watch for connection status changes
watch(() => chatStore.isConnected, (connected) => {
    if (connected) {
        errorMessage.value = '';
        console.log('Real-time connection established');
    } else {
        errorMessage.value = 'Connection lost. Some features may be limited.';
        console.warn('Real-time connection lost');
    }
});
// Watch for isVRVisible to sync messages when closing VR
watch(isVRVisible, async (newValue) => {
    if (!newValue && chatStore.currentConversation) {
        // VR Interface closed, sync messages from store
        console.log('Syncing messages from VR session...');
        
        // Refresh messages from backend to be sure
        await chatStore.loadMoreMessages(1); // or just use current state if reliable
        
        // Preserve intro message
        const intro = conversationMessages.value.find(m => m.role === 'system' && m.id.startsWith('intro-'));
        
        const storeMessages = chatStore.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.createdAt || m.metadata?.timestamp || new Date().toISOString()
        }));
        
        if (intro) {
            conversationMessages.value = [intro, ...storeMessages];
        } else {
            conversationMessages.value = storeMessages;
        }
        
        await nextTick();
        scrollToBottom();
    }
});
</script>

<template>
    <div class="student flex flex-col flex-auto gap-4">
        <div class="info">Alege un scenariu</div>
        <div class="scenarios flex gap-4">
            <div class="scenario flex items-center justify-between" :class="{ active: scenario.isActive }"
                v-for="(scenario, index) in trainingStore.scenarios" :key="index">
                <div class="text flex flex-col gap-1" @click="handleScenarioTextClick(scenario)">
                    <div>{{ scenario.index }}</div>
                    <div>{{ scenario.title }}</div>
                </div>
                <div v-if="scenario.isActive" class="button">
                    <i class="icon cycle"></i>
                </div>
            </div>
        </div>

        <!-- Connection Status -->
        <div v-if="!chatStore.isConnected" class="connection-status">
            <div class="connection-status-content">
                <div class="status-dot"></div>
                <span class="status-text">{{ connectionStatusText }}</span>
                <button @click="reconnect" class="reconnect-btn">
                    Reconnect
                </button>
            </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
        </div>

        <div v-if="dialogVisible" class="dialog-header">
            <span>Începe dialogul cu pacientul:</span>
            <div class="connection-indicator">
                <div :class="['indicator-dot', chatStore.isConnected ? 'connected' : 'disconnected']"></div>
                <span class="indicator-text">{{ chatStore.isConnected ? 'Live' : 'Offline' }}</span>
            </div>
            <button 
                @click="isVRVisible = true" 
                class="vr-button"
                :disabled="!chatStore.currentConversation"
                :title="!chatStore.currentConversation ? 'Chat not connected' : 'Open VR Interface'"
            >
                Interfata VR
            </button>
        </div>

        <div v-if="dialogVisible" class="dialog active flex flex-col gap-y-4 w-full">
            <!-- Messages Area -->
            <div class="dialog-messages">
                <div v-for="message in conversationMessages" :key="message.id" :class="[
                    'message',
                    message.role === 'user' ? 'user-message' : 'ai-message'
                ]">
                    <div :class="[
                        'message-bubble',
                        message.role === 'user' ? 'user-bubble' :
                            message.role === 'system' ? 'system-bubble' : 'ai-bubble'
                    ]">
                        <div class="message-content">{{ message.content }}</div>
                        <div class="message-time">
                            {{ formatMessageTime(message.timestamp) }}
                        </div>
                    </div>
                </div>

                <!-- Typing Indicators -->
                <TypingIndicator :ai-is-responding="chatStore.aiIsResponding || aiAsked"
                    :typing-users="chatStore.typingUsers" />
            </div>

            <!-- Input Area -->
            <div class="input-area">
                <div class="row input-row">
                    <i class="icon medic"></i>
                    <IconField class="input-field">
                        <InputText ref="messageInput" class="message-input" type="text" v-model="medicSay"
                            @keyup.enter="handleAskAI" @input="handleInputChange" @blur="handleInputBlur"
                            :disabled="aiAsked || !chatStore.isConnected" placeholder="Scrie mesajul tău aici..." />
                        <InputIcon v-if="aiAsked || chatStore.aiIsResponding" class="pi pi-spin pi-spinner" />
                    </IconField>
                    <button @click="handleAskAI" :disabled="!canSendMessage"
                        :class="['send-button', canSendMessage ? 'enabled' : 'disabled']">
                        <i class="icon enter-black"></i>
                    </button>
                </div>

                <!-- Typing Indicator for Current User -->
                <div v-if="isUserTyping" class="typing-status">
                    You are typing...
                </div>
            </div>
        </div>
        
        <VRInterface 
            v-if="isVRVisible"
            :visible="isVRVisible" 
            @close="isVRVisible = false" 
        />
    </div>
</template>

<style scoped>
.student {
    padding: 20px 0;
}

.scenario {
    border: 1px solid #000;
    border-radius: 15px;
    padding: 12px 16px;
    transition: background-color 0.5s;
    width: 250px;
}

.scenario:has(.text:hover) {
    background-color: #BDD7EE;
}

.scenario.active {
    background-color: #BDD7EE;
}

.text {
    font-size: 14px;
    cursor: pointer;
}

.button {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

/* Real-time messaging styles */
.dialog-messages {
    scroll-behavior: smooth;
}

.message {
    animation: fadeIn 0.3s ease-out;
}

.message-bubble {
    word-wrap: break-word;
    transition: all 0.2s ease;
}

.message-bubble:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.connection-status {
    animation: slideDown 0.3s ease-out;
}

.error-message {
    animation: slideDown 0.3s ease-out;
}

.connection-indicator {
    font-size: 12px;
}

.input-area {
    position: relative;
}

.send-button {
    min-width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.typing-status {
    opacity: 0.8;
    font-style: italic;
}

/* Animations */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}

/* Connection Status Styles */
.connection-status {
    background-color: #fef3c7;
    border: 1px solid #fbbf24;
    color: #92400e;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slideDown 0.3s ease-out;
}

.connection-status-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-dot {
    width: 8px;
    height: 8px;
    background-color: #fbbf24;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.status-text {
    font-size: 14px;
    flex: 1;
}

.reconnect-btn {
    color: #b45309;
    font-size: 14px;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    margin-left: auto;
}

.reconnect-btn:hover {
    color: #92400e;
}

/* Error Message Styles */
.error-message {
    background-color: #fee2e2;
    border: 1px solid #fca5a5;
    color: #991b1b;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slideDown 0.3s ease-out;
}

/* Dialog Header Styles */
.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.connection-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.indicator-dot.connected {
    background-color: #10b981;
}

.indicator-dot.disconnected {
    background-color: #ef4444;
}

.indicator-text {
    color: #6b7280;
}

/* Messages Area Styles */
.dialog-messages {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 16px;
    scroll-behavior: smooth;
}

.message {
    display: flex;
    margin-bottom: 12px;
    animation: fadeIn 0.3s ease-out;
}

.user-message {
    justify-content: flex-end;
}

.ai-message {
    justify-content: flex-start;
}

.message-bubble {
    max-width: 320px;
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    word-wrap: break-word;
    transition: all 0.2s ease;
}

.message-bubble:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.user-bubble {
    background-color: #3b82f6;
    color: white;
}

.ai-bubble {
    background-color: white;
    color: #1f2937;
    border: 1px solid #e5e7eb;
}

.system-bubble {
    background-color: #d1d5db;
    color: #374151;
}

.message-content {
    font-size: 14px;
    line-height: 1.4;
}

.message-time {
    font-size: 11px;
    opacity: 0.7;
    margin-top: 4px;
}

/* Input Area Styles */
.input-area {
    position: relative;
}

.input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 80%;
}

.input-field {
    flex: 1;
    display: flex;
}

.message-input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
}

.message-input:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
}

.send-button {
    min-width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.send-button.enabled {
    background-color: #3b82f6;
    color: white;
}

.send-button.enabled:hover {
    background-color: #2563eb;
}

.send-button.disabled {
    background-color: #d1d5db;
    color: #6b7280;
    cursor: not-allowed;
}

.typing-status {
    font-size: 12px;
    color: #6b7280;
    margin-top: 8px;
    margin-left: 32px;
    opacity: 0.8;
    font-style: italic;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .dialog-messages {
        max-height: 60vh;
        padding: 12px;
    }

    .input-row {
        width: 100% !important;
    }

    .message-bubble {
        max-width: 280px;
    }

    .connection-status,
    .error-message {
        padding: 10px 12px;
        font-size: 13px;
    }
}

@media (min-width: 992px) {
    .message-bubble {
        max-width: 400px;
    }
    .message-bubble {
        max-width: 400px;
    }
}

.vr-button {
    background-color: #7c3aed;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin-left: 10px;
    transition: background-color 0.2s;
}

.vr-button:hover {
    background-color: #6d28d9;
}
</style>