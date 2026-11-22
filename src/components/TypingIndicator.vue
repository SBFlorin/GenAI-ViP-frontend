<template>
  <div v-if="isVisible" class="typing-indicator">
    <!-- AI is responding -->
    <div v-if="aiIsResponding" class="typing-bubble ai-typing">
      <div class="typing-avatar">
        <svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="typing-message">
        <div class="typing-text">
          <span>Pacientul răspunde</span>
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Other users typing -->
    <div v-else-if="typingUsers.length > 0" class="typing-bubble user-typing">
      <div class="typing-avatar">
        <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div class="typing-message">
        <div class="typing-text">
          <span>{{ typingText }}</span>
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  aiIsResponding: boolean
  typingUsers: string[]
  userNames?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  userNames: () => ({})
})

const isVisible = computed(() => {
  return props.aiIsResponding || props.typingUsers.length > 0
})

const typingText = computed(() => {
  const users = props.typingUsers.map(userId => 
    props.userNames[userId] || `User ${userId.slice(-4)}`
  )
  
  if (users.length === 1) {
    return `${users[0]} is typing`
  } else if (users.length === 2) {
    return `${users[0]} and ${users[1]} are typing`
  } else if (users.length > 2) {
    return `${users[0]} and ${users.length - 1} others are typing`
  }
  
  return ''
})
</script>

<style scoped>
.typing-indicator {
  padding: 8px 16px;
  animation: fade-in 0.3s ease-out;
}

.typing-bubble {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 20rem;
}

.ai-typing {
  margin-left: 0;
}

.user-typing {
  margin-right: 0;
  margin-left: auto;
  flex-direction: row-reverse;
}

.user-typing > * + * {
  margin-left: 8px;
  margin-right: 0;
}

.typing-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.typing-avatar svg {
  width: 24px;
  height: 24px;
}

.ai-typing .typing-avatar svg {
  color: #3b82f6;
}

.user-typing .typing-avatar svg {
  color: #6b7280;
}

.typing-message {
  background-color: #f3f4f6;
  border-radius: 8px;
  padding: 8px 12px;
  position: relative;
}

.ai-typing .typing-message {
  background-color: #dbeafe;
}

.typing-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4b5563;
}

.ai-typing .typing-text {
  color: #1d4ed8;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background-color: #9ca3af;
  border-radius: 50%;
  animation: typing 1.2s ease-in-out infinite;
}

.ai-typing .typing-dots span {
  background-color: #60a5fa;
}

.typing-dots span:nth-child(1) {
  animation-delay: 0ms;
}

.typing-dots span:nth-child(2) {
  animation-delay: 200ms;
}

.typing-dots span:nth-child(3) {
  animation-delay: 400ms;
}

@keyframes typing {
  0%, 20%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>