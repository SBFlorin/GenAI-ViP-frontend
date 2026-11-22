import { onMounted, onUnmounted, watch } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useRealTimeChat(userToken?: string) {
  const chatStore = useChatStore()

  // Initialize socket connection
  onMounted(() => {
    chatStore.initializeSocket(userToken)
  })

  // Cleanup on unmount
  onUnmounted(() => {
    chatStore.disconnectSocket()
  })

  // Watch for conversation changes and manage room subscriptions
  watch(() => chatStore.currentConversation?.id, (newConversationId, oldConversationId) => {
    if (oldConversationId && oldConversationId !== newConversationId) {
      chatStore.leaveConversationRoom(oldConversationId)
    }
    
    if (newConversationId) {
      chatStore.joinConversationRoom(newConversationId)
    }
  })

  // Typing indicator management
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  
  const handleTypingStart = () => {
    chatStore.sendTypingIndicator(true)
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
    
    // Set timeout to stop typing indicator
    typingTimeout = setTimeout(() => {
      chatStore.sendTypingIndicator(false)
    }, 3000) // Stop typing after 3 seconds of inactivity
  }

  const handleTypingStop = () => {
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
    chatStore.sendTypingIndicator(false)
  }

  // Connection management
  const reconnect = () => {
    chatStore.disconnectSocket()
    setTimeout(() => {
      chatStore.initializeSocket(userToken)
    }, 1000)
  }

  // Notification management
  const markNotificationAsRead = (notificationId: string) => {
    chatStore.markNotificationRead(notificationId)
  }

  const clearAllNotifications = () => {
    chatStore.clearNotifications()
  }

  return {
    // State
    connectionStatus: chatStore.connectionStatus,
    typingUsers: chatStore.typingUsers,
    aiIsResponding: chatStore.aiIsResponding,
    notifications: chatStore.notifications,
    hasUnreadNotifications: chatStore.hasUnreadNotifications,
    
    // Methods
    handleTypingStart,
    handleTypingStop,
    reconnect,
    markNotificationAsRead,
    clearAllNotifications,
    
    // Store methods
    sendMessage: chatStore.sendMessage,
    selectConversation: chatStore.selectConversation,
  }
}

// Utility function to get user token from localStorage or other source
export function getUserToken(): string | undefined {
  return localStorage.getItem('auth_token') || undefined
}

// Utility function to detect if user is typing based on input events
export function createTypingDetector(
  onTypingStart: () => void,
  onTypingStop: () => void,
  delay: number = 3000
) {
  let isTyping = false
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  const handleInput = () => {
    if (!isTyping) {
      isTyping = true
      onTypingStart()
    }

    // Clear existing timer
    if (typingTimer) {
      clearTimeout(typingTimer)
    }

    // Set new timer
    typingTimer = setTimeout(() => {
      isTyping = false
      onTypingStop()
    }, delay)
  }

  const stopTyping = () => {
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    if (isTyping) {
      isTyping = false
      onTypingStop()
    }
  }

  return {
    handleInput,
    stopTyping,
    cleanup: stopTyping
  }
}
