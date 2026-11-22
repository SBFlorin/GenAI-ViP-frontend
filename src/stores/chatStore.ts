import { defineStore } from 'pinia'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '../apiRequest'
import { API_HOST, API_PATH } from '../apiConfig'
import { socketService } from '../services/socketService'
import { useUserStore } from './userStore'

export const useChatStore = defineStore('chatStore', () => {
  // State
  const conversations = ref<any[]>([])
  const currentConversation = ref<any>(null)
  const messages = ref<any[]>([])
  const isLoading = ref(false)
  const isSendingMessage = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Real-time state
  const isConnected = ref(false)
  const isTyping = ref(false)
  const typingUsers = ref<string[]>([])
  const notifications = ref<any[]>([])
  const aiIsResponding = ref(false)

  // Getters
  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  })

  const hasMoreConversations = computed(() => {
    return pagination.value.page < pagination.value.pages
  })

  const currentConversationTitle = computed(() => {
    return currentConversation.value?.title || 'Select a conversation'
  })

  const hasUnreadNotifications = computed(() => {
    return notifications.value.some(n => !n.read)
  })

  const connectionStatus = computed(() => {
    return {
      connected: isConnected.value,
      socketId: socketService.socketId
    }
  })

  // Actions
interface ErrorHandler {
    (message: string): void
}

const setError: ErrorHandler = (message: string) => {
    error.value = message
    setTimeout(() => {
        error.value = null
    }, 5000)
}

  const clearError = () => {
    error.value = null
  }

  // Real-time functions
  const initializeSocket = async (token?: string) => {
    try {
      const userStore = useUserStore()
      const authToken = token || userStore.getToken()
      
      if (!authToken) {
        console.warn('No authentication token available for socket connection')
        return
      }
      
      await socketService.connect(authToken)
      
      setupSocketEventListeners()
      
    } catch (error) {
      console.error('Failed to initialize socket:', error)
      setError('Failed to connect to real-time service')
    }
  }

  const setupSocketEventListeners = () => {
    // Connection status
    socketService.on('connection:status', (data: any) => {
      console.log(`dbg isconnected: ${data.connected}`);
      isConnected.value = data.connected
    })

    // Real-time messages
    socketService.on('message:new', (data: any) => {
      if (currentConversation.value?.id === data.conversationId) {
        // Add message if not already present
        const messageExists = messages.value.some(m => m.id === data.message.id)
        if (!messageExists) {
          messages.value.push(data.message)
        }
      }
      
      // Update conversation in list if conversation data is provided
      if (data.conversation) {
        updateConversationInList(data.conversationId, data.conversation)
      }
    })

    // Typing indicators
    socketService.on('message:typing', (data: any) => {
      if (data.userId !== 'current-user' && currentConversation.value?.id === data.conversationId) {
        if (data.isAI) {
          aiIsResponding.value = true
        } else {
          if (!typingUsers.value.includes(data.userId)) {
            typingUsers.value.push(data.userId)
          }
        }
      }
    })

    socketService.on('message:typing:stop', (data: any) => {
      if (data.isAI) {
        aiIsResponding.value = false
      } else {
        typingUsers.value = typingUsers.value.filter(id => id !== data.userId)
      }
    })

    // Conversation updates
    socketService.on('conversation:updated', (data: any) => {
      updateConversationInList(data.conversationId, data.conversation)
    })

    // AI Progress updates
    socketService.on('ai:progress', (data: any) => {
      if (data.conversationId === currentConversation.value?.id) {
        if (data.progress.status === 'thinking' || data.progress.status === 'generating') {
          aiIsResponding.value = true
        } else {
          aiIsResponding.value = false
        }
      }
    })

    // Notifications
    socketService.on('notification', (data: any) => {
      addNotification(data)
    })
  }

  const disconnectSocket = () => {
    socketService.disconnect()
    isConnected.value = false
    typingUsers.value = []
    aiIsResponding.value = false
  }

  const joinConversationRoom = (conversationId: string) => {
    socketService.joinConversation(conversationId)
  }

  const leaveConversationRoom = (conversationId: string) => {
    socketService.leaveConversation(conversationId)
  }

  const sendTypingIndicator = (isTyping: boolean) => {
    if (currentConversation.value) {
      socketService.sendTyping(currentConversation.value.id, isTyping)
    }
  }

  const updateConversationInList = (conversationId: string, updatedConversation: any) => {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index !== -1) {
      conversations.value[index] = updatedConversation
    } else {
      // Add new conversation if not in list
      conversations.value.unshift(updatedConversation)
    }
  }

  const addNotification = (notification: any) => {
    notifications.value.unshift({
      ...notification,
      id: notification.id || Date.now(),
      timestamp: new Date().toISOString(),
      read: false
    })

    // Keep only last 50 notifications
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50)
    }
  }

  const markNotificationRead = (notificationId: string) => {
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  const loadConversations = async (page = 1, status = 'active') => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await apiRequest(`/chat/conversations?page=${page}&limit=${pagination.value.limit}&status=${status}`)
      
      if (page === 1) {
        conversations.value = response.conversations
      } else {
        conversations.value.push(...response.conversations)
      }
      
      pagination.value = response.pagination
      
    } catch (err) {
      console.error('Failed to load conversations:', err)
      setError('Failed to load conversations')
    } finally {
      isLoading.value = false
    }
  }

  const createConversation = async (title = 'New Chat', metadata?: any) => {
    try {
      isLoading.value = true
      clearError()
      
      console.log('createConversation called with:', { title, metadata })
      
      // System prompt is always generated from health profile on server side
      // Explicitly name properties to avoid any conflicts
      const requestBody = { 
        title: title,
        metadata: metadata
      }
      console.log('Request body:', JSON.stringify(requestBody, null, 2))
      
      const response = await apiRequest('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })
      
      // Add new conversation to the beginning of the list
      conversations.value.unshift(response.conversation)
      
      // Auto-select the new conversation
      await selectConversation(response.conversation.id)
      
      return response.conversation
      
    } catch (err) {
      console.error('Failed to create conversation:', err)
      setError('Failed to create new conversation')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const selectConversation = async (conversationId: any) => {
    try {
      isLoading.value = true
      clearError()
      
      // Leave previous conversation room
      if (currentConversation.value) {
        leaveConversationRoom(currentConversation.value.id)
      }
      
      const response = await apiRequest(`/chat/conversations/${conversationId}`)
      
      currentConversation.value = response.conversation
      messages.value = response.conversation.messages || []
      
      // Join new conversation room for real-time updates
      joinConversationRoom(conversationId)
      
      // Update the conversation in the list
      const index = conversations.value.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        conversations.value[index] = response.conversation
      }
      
    } catch (err) {
      console.error('Failed to load conversation:', err)
      setError('Failed to load conversation')
    } finally {
      isLoading.value = false
    }
  }

  const sendMessage = async (content: any) => {
    if (!currentConversation.value || !content.trim()) {
      return
    }

    try {
      isSendingMessage.value = true
      clearError()
      
      // Stop typing indicator
      sendTypingIndicator(false)
      
      // Optimistically add user message to UI
      const tempUserMessage = {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
        isTemporary: true
      }
      
      messages.value.push(tempUserMessage)
      
      // Show AI is responding
      aiIsResponding.value = true
      
      const response = await apiRequest(`/chat/conversations/${currentConversation.value.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })
      
      // Remove temporary message and add real messages
      messages.value = messages.value.filter(m => !m.isTemporary)
      
      // Add user message first
      if (response.userMessage) {
        messages.value.push(response.userMessage)
      }
      
      // Add assistant message if available immediately
      if (response.assistantMessage) {
        messages.value.push(response.assistantMessage)
        aiIsResponding.value = false
      }
      
      // Update current conversation
      currentConversation.value = response.conversation
      
      // Update conversation in the list
      const index = conversations.value.findIndex(c => c.id === currentConversation.value.id)
      if (index !== -1) {
        conversations.value[index] = response.conversation
        // Move updated conversation to top
        conversations.value.unshift(conversations.value.splice(index, 1)[0])
      }
      
      return response
      
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError('Failed to send message: ' + (err.response?.data?.error || err.message))
      
      // Remove temporary message on error
      messages.value = messages.value.filter(m => !m.isTemporary)
      aiIsResponding.value = false
      
      throw err
    } finally {
      isSendingMessage.value = false
    }
  }

  const updateConversation = async (conversationId: any, updates: any) => {
    try {
      clearError()
      
      const response = await apiRequest(`/chat/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })
      
      // Update conversation in store
      const index = conversations.value.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        conversations.value[index] = response.conversation
      }
      
      // Update current conversation if it's the same
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value = response.conversation
      }
      
      return response.conversation
      
    } catch (err) {
      console.error('Failed to update conversation:', err)
      setError('Failed to update conversation')
      throw err
    }
  }

  const deleteConversation = async (conversationId: any) => {
    try {
      clearError()
      
      await apiRequest(`/chat/conversations/${conversationId}`, {
        method: 'DELETE'
      })
      
      // Remove from conversations list
      conversations.value = conversations.value.filter(c => c.id !== conversationId)
      
      // Clear current conversation if it was deleted
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value = null
        messages.value = []
      }
      
    } catch (err) {
      console.error('Failed to delete conversation:', err)
      setError('Failed to delete conversation')
      throw err
    }
  }

  const clearCurrentConversation = () => {
    currentConversation.value = null
    messages.value = []
  }

  const loadMoreMessages = async (page = 2) => {
    if (!currentConversation.value) return
    
    try {
      const response = await apiRequest(`/chat/conversations/${currentConversation.value.id}?page=${page}`)
      
      // Prepend older messages
      messages.value.unshift(...response.conversation.messages)
      
    } catch (err) {
      console.error('Failed to load more messages:', err)
      setError('Failed to load more messages')
    }
  }

  const generateSpeech = async (text: string, voice = 'onyx'): Promise<Blob> => {
    try {
      const userStore = useUserStore()
      const token = userStore.getToken()

      const response = await fetch(`${API_HOST}${API_PATH}/chat/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, voice })
      })

      if (!response.ok) {
        throw new Error('Failed to generate speech')
      }

      return await response.blob()
    } catch (err: any) {
      console.error('TTS Error:', err)
      throw err
    }
  }

  return {
    // State
    conversations,
    currentConversation,
    messages,
    isLoading,
    isSendingMessage,
    error,
    pagination,
    
    // Real-time state
    isConnected,
    isTyping,
    typingUsers,
    notifications,
    aiIsResponding,
    
    // Getters
    sortedConversations,
    hasMoreConversations,
    currentConversationTitle,
    hasUnreadNotifications,
    connectionStatus,
    
    // Actions
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    updateConversation,
    deleteConversation,
    clearCurrentConversation,
    loadMoreMessages,
    clearError,
    generateSpeech,
    
    // Real-time actions
    initializeSocket,
    disconnectSocket,
    joinConversationRoom,
    leaveConversationRoom,
    sendTypingIndicator,
    addNotification,
    markNotificationRead,
    clearNotifications
  }
})