import { watch } from 'vue'
import { useUserStore } from '../stores/userStore'
import { useChatStore } from '../stores/chatStore'

// Auto-initialize socket connection when user authentication state changes
export function useSocketInitializer() {
  const userStore = useUserStore()
  const chatStore = useChatStore()

  // Watch for authentication changes
  watch(
    () => userStore.isAuthenticated,
    async (isAuthenticated) => {
      if (isAuthenticated) {
        const token = userStore.getToken()
        if (token) {
          console.log('User authenticated, initializing socket connection...')
          try {
            await chatStore.initializeSocket(token)
            console.log('Socket connection initialized successfully')
          } catch (error) {
            console.error('Failed to initialize socket connection:', error)
          }
        }
      } else {
        console.log('User logged out, disconnecting socket...')
        chatStore.disconnectSocket()
      }
    },
    { immediate: true }
  )
}