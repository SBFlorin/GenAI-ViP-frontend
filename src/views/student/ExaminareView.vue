<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { useChatStore } from '@/stores/chatStore';
import { useExamStore } from '@/stores/examStore';
import { useRealTimeChat, createTypingDetector, getUserToken } from '@/composables/useRealTimeChat';

const appStore = useAppStore();
const isExamStarted = ref(false);
const chatStore = useChatStore();
const examStore = useExamStore();
const currentScenarioId = ref<string | null>(null);
const aiAsked = ref(false);
const medicSay = ref('');
const conversationMessages = ref<any[]>([]);
const errorMessage = ref('');
const dialogVisible = ref(false);
const messageInput = ref<any>();
const isUserTyping = ref(false);
const isTimeout = ref(false);
// Real-time chat integration
const {
    handleTypingStart,
    handleTypingStop,
    reconnect,
} = useRealTimeChat(getUserToken());

const breadcrumbData = ref([
    { label: 'student', route: '/student' },
    { label: 'examinare' },
]);
appStore.breadcrumb = breadcrumbData.value;
const footerInfoData = ref([
    { text: 'Observații:' },
    { text: '- Afișarea dialogului dintre student și agentul virtual este identică cu cea ilustrată pe paginile de inst' },
    { text: '- Pentru modulul de examinare, ar trebui să includem un temporizator cu numărătoare inversă pentru fiecare pas al dialogului (cca. 20 secunde). Poziția în pagină și numărul de secunde urmează să-l stabilim pe parcurs (la fel și dacă timpul acordat va fi diferit pentru fiecare fază a dialogului.' },
    { text: '- Când studentul termină primul caz, fie prin expirarea timpului alocat ultimului prompt de la cazul anterior, fie prin click pe buton dedicat (rămâne de stabilit mai exact), se va afișa eticheta pentru al doilea caz și promptul asociat, sub ultimul rând de text al cazului anterior.' },
]);
appStore.footerInfo = footerInfoData.value;

const duration = ref(20)
const remainingMs = ref(0)
const timer = ref<any>(null)

const onTick = (ms: number) => { remainingMs.value = ms }
const onComplete = () => {
    // handle time-out here
    isTimeout.value = true;
    console.log('Time is out!')
    // optionally restart:
    // timer.value?.reset(duration.value)
    // timer.value?.start()
}

const canSendMessage = computed(() => {
    return medicSay.value.trim() !== '' && !aiAsked.value && chatStore.isConnected;
});

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

const handleScenarioTextClick = async (scenario: any) => {
    isExamStarted.value = true;
    try {
        // Clear any previous errors
        errorMessage.value = '';

        // add active class to the clicked scenario
        examStore.scenarios.forEach(s => s.isActive = false);
        scenario.isActive = true;

        // Create or select conversation for this scenario
        currentScenarioId.value = scenario.index;

        // Find and update the scenario in store
        const storeScenario = examStore.scenarios.find(s => s.index === scenario.index);
        if (storeScenario && storeScenario.title) {
            scenario.title = storeScenario.title;
        }

        // Initialize conversation messages
        conversationMessages.value = [
            {
                id: 'intro-' + Date.now(),
                role: 'system',
                content: `${scenario.title}. Începe dialogul cu pacientul.`,
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
        } catch (error) {
            console.warn('Failed to create chat conversation, using local state:', error);
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

        // Restart timer after AI response
        isTimeout.value = false;
        timer.value?.reset(duration.value);
        timer.value?.start();

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
    examStore.scenarios.forEach(s => s.isActive = false);

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
</script>

<template>
    <div class="student flex flex-col flex-auto gap-4">
        <div class="info">
            <span>Instrucțiuni</span>: Examenul include o serie de 10 cazuri încadrate în diferite scenarii selectate
            aleator de sistem. Pentru a începe examenul, începeți să completați
            în câmpul rezervat studentului și dați click pe butonul Trimite (sau tasta Enter). După finalizarea unui
            caz, se va afișa automat cazul următor. La finalul celor 10
            cazuri, se va afișa nota corespunzătoare fiecărui caz în parte și media generală.
        </div>
        <div v-if="!isExamStarted" class="flex ">
            <Button class="ml-auto" label="Începe examenul" @click="handleScenarioTextClick({ index: 1 })" />
        </div>
        <div v-if="isExamStarted" class="box-examinare flex flex-1 gap-4">
            <div class="dialog flex flex-col flex-2 gap-4">
                <div class="dialog-header">
                    <span>Începe dialogul cu pacientul:</span>
                    <div class="connection-indicator">
                        <div :class="['indicator-dot', chatStore.isConnected ? 'connected' : 'disconnected']"></div>
                        <span class="indicator-text">{{ chatStore.isConnected ? 'Live' : 'Offline' }}</span>
                    </div>
                </div>
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
                <div class="dialog active flex flex-col gap-y-2">
                    <div class="row flex items-center gap-x-2">
                        <i class="icon medic"></i>
                        <IconField class="input-field">
                            <InputText ref="messageInput" class="message-input" type="text" v-model="medicSay"
                                @keyup.enter="handleAskAI" @input="handleInputChange" @blur="handleInputBlur"
                                :disabled="aiAsked || !chatStore.isConnected || isTimeout" placeholder="Scrie mesajul tău aici..." />
                            <InputIcon v-if="aiAsked || chatStore.aiIsResponding" class="pi pi-spin pi-spinner" />
                        </IconField>
                        <button @click="handleAskAI" :disabled="!canSendMessage"
                            :class="['send-button', (canSendMessage && !isTimeout) ? 'enabled' : 'disabled']">
                            <i class="icon enter-black"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="timer flex flex-col items-center justify-center flex-1">
                <CircularCountdown ref="timer" :size="140" :duration="duration" :autoStart="true" :arrowSize="32" :arrowGap="0" :showEndArrow="false" :showStartArrow="true" color="#264a87" @tick="onTick"
                    @complete="onComplete" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.student {
    padding: 20px 0;
}

.student span {
    font-weight: bold;
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

.send-button {
    min-width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
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
}
</style>