<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useChatStore } from '@/stores/chatStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useRealTimeChat, createTypingDetector, getUserToken } from '@/composables/useRealTimeChat';

const props = defineProps<{
  sessionOrder: number;
  personaName: string;
}>();

const emit = defineEmits<{ chatComplete: [] }>();

const chatStore = useChatStore();
const evaluatorStore = useEvaluatorStore();
const medicSay = ref('');
const aiAsked = ref(false);
const finishing = ref(false);
const errorMessage = ref('');
const messageInput = ref<any>();
const messagesContainer = ref<HTMLElement | null>(null);
const conversationMessages = ref<any[]>([]);
const chatStarted = ref(false);

const { handleTypingStart, handleTypingStop } = useRealTimeChat(getUserToken());

const typingDetector = createTypingDetector(
  () => handleTypingStart(),
  () => handleTypingStop(),
  2000
);

const canSendMessage = computed(
  () =>
    medicSay.value.trim() !== '' &&
    !aiAsked.value &&
    !finishing.value &&
    chatStore.isConnected &&
    chatStarted.value
);

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const mapStoreMessages = (msgs: any[]) =>
  (msgs || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt || m.metadata?.timestamp || new Date().toISOString(),
      metadata: m.metadata
    }));

const resetLocalChatState = () => {
  chatStarted.value = false;
  conversationMessages.value = [];
  medicSay.value = '';
  aiAsked.value = false;
  errorMessage.value = '';
  typingDetector.stopTyping();
};

const detachConversation = () => {
  if (chatStore.currentConversation?.id) {
    chatStore.leaveConversationRoom(chatStore.currentConversation.id);
  }
  chatStore.clearCurrentConversation();
};

const loadConversationMessages = async (conversationId: number) => {
  await chatStore.selectConversation(conversationId);
  conversationMessages.value = mapStoreMessages(chatStore.messages);
};

const resumeExistingConversation = async (conversationId: number) => {
  errorMessage.value = '';
  chatStarted.value = true;
  try {
    await chatStore.initializeSocket();
    await loadConversationMessages(conversationId);
    await nextTick();
    scrollToBottom();
  } catch (e: any) {
    resetLocalChatState();
    errorMessage.value = e.message || 'Nu s-a putut încărca conversația';
  }
};

const startChat = async () => {
  errorMessage.value = '';
  try {
    await evaluatorStore.startSession(props.sessionOrder);
    chatStarted.value = true;
    await chatStore.initializeSocket();
    const convId = evaluatorStore.currentSession?.conversationId;
    if (convId) {
      await loadConversationMessages(convId);
    } else {
      conversationMessages.value = [];
    }
    await nextTick();
    scrollToBottom();
    messageInput.value?.$el?.querySelector('input')?.focus();
  } catch (e: any) {
    resetLocalChatState();
    errorMessage.value = e.message || 'Nu s-a putut porni conversația';
  }
};

const handleAskAI = async () => {
  if (!canSendMessage.value) return;
  const messageContent = medicSay.value.trim();
  medicSay.value = '';
  aiAsked.value = true;
  errorMessage.value = '';
  typingDetector.stopTyping();

  conversationMessages.value.push({
    id: 'user-' + Date.now(),
    role: 'user',
    content: messageContent,
    timestamp: new Date().toISOString()
  });
  await nextTick();
  scrollToBottom();

  try {
    const response = await chatStore.sendMessage(messageContent);
    if (chatStore.currentConversation?.id) {
      conversationMessages.value = mapStoreMessages(chatStore.messages);
    } else if (response?.assistantMessage) {
      conversationMessages.value.push({
        id: response.assistantMessage.id,
        role: 'assistant',
        content: response.assistantMessage.content,
        timestamp: response.assistantMessage.createdAt
      });
    }
    await nextTick();
    scrollToBottom();
  } catch (e: any) {
    errorMessage.value = e.message || 'Trimiterea mesajului a eșuat';
  } finally {
    aiAsked.value = false;
  }
};

const finishChat = async () => {
  if (finishing.value) return;
  finishing.value = true;
  errorMessage.value = '';
  try {
    if (!evaluatorStore.chatCompleted) {
      await evaluatorStore.markChatComplete(props.sessionOrder);
    }
    emit('chatComplete');
  } catch (e: any) {
    errorMessage.value = e.message || 'Nu s-a putut finaliza conversația';
  } finally {
    finishing.value = false;
  }
};

onMounted(async () => {
  const convId = evaluatorStore.currentSession?.conversationId;
  if (convId) {
    await resumeExistingConversation(convId);
  }
});

onBeforeUnmount(() => {
  detachConversation();
  resetLocalChatState();
});
</script>

<template>
  <div class="chat-panel evaluator-card">
    <div v-if="!chatStarted" class="start-block">
      <p class="start-text">
        Scenariul <strong>{{ sessionOrder }}</strong> din {{ evaluatorStore.totalPersonas }} —
        <strong>{{ personaName }}</strong>
      </p>
      <Button label="Începe conversația" @click="startChat" />
    </div>

    <template v-else>
      <div class="chat-toolbar">
        <span class="eval-badge" :class="{ 'eval-badge--on': chatStore.isConnected }">
          {{ chatStore.isConnected ? 'Conectat' : 'Deconectat' }}
        </span>
      </div>

      <div ref="messagesContainer" class="eval-chat-messages">
        <div
          v-for="msg in conversationMessages"
          :key="msg.id"
          class="msg-row"
          :class="msg.role === 'user' ? 'msg-row--right' : 'msg-row--left'"
        >
          <div
            class="msg-bubble"
            :class="{
              'eval-bubble-user': msg.role === 'user',
              'eval-bubble-ai': msg.role === 'assistant',
              'eval-bubble-system': msg.role === 'system'
            }"
          >
            {{ msg.content }}
          </div>
        </div>
        <div v-if="aiAsked" class="msg-row msg-row--left">
          <div class="msg-bubble eval-bubble-ai">…</div>
        </div>
      </div>

      <div class="input-row">
        <InputText
          ref="messageInput"
          v-model="medicSay"
          class="flex-1 eval-message-input"
          placeholder="Mesaj către pacient..."
          :disabled="finishing"
          @keydown.enter.prevent="handleAskAI"
          @input="typingDetector.handleInput()"
        />
        <Button label="Trimite" :disabled="!canSendMessage" @click="handleAskAI" />
      </div>

      <div class="actions-row">
        <Button
          label="Finalizează conversația"
          outlined
          :loading="finishing"
          :disabled="finishing"
          @click="finishChat"
        />
      </div>
    </template>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.chat-panel {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.start-block {
  text-align: center;
  padding: 1rem;
}

.start-text {
  margin-bottom: 1rem;
  font-size: 1rem;
  line-height: 1.5;
}

.chat-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.msg-row {
  display: flex;
  margin-bottom: 0.75rem;
}

.msg-row--right {
  justify-content: flex-end;
}

.msg-row--left {
  justify-content: flex-start;
}

.msg-bubble {
  max-width: 85%;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.95rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}

:deep(.eval-message-input.p-inputtext),
:deep(.eval-message-input input) {
  background: #ffffff !important;
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
  border: 1px solid #2f5597 !important;
}
</style>
