import { io, Socket } from 'socket.io-client'
import { API_HOST } from '../apiConfig'

class SocketService {
  private socket: Socket | null = null
  private isConnected: boolean = false
  private eventHandlers: Map<string, Set<Function>> = new Map()

  connect(token?: string) {
    if (this.socket?.connected) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      if (!token) {
        console.warn('No token provided for socket connection')
        reject(new Error('Authentication token is required'))
        return
      }

      const options: any = {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        auth: { token }
      }

      this.socket = io(API_HOST, options)

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id)
        this.isConnected = true
        this.emitToHandlers('connection:status', { connected: true })
        resolve(this.socket)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        this.isConnected = false
        this.emitToHandlers('connection:status', { connected: false, reason })
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        this.isConnected = false
        this.emitToHandlers('connection:error', error)
        reject(error)
      })

      this.socket.on('authenticated', (data) => {
        console.log('Socket authenticated:', data)
      })

      // Real-time chat events
      this.socket.on('message:new', (data) => {
        this.emitToHandlers('message:new', data)
      })

      this.socket.on('typing:start', (data) => {
        this.emitToHandlers('message:typing', data)
      })

      this.socket.on('typing:stop', (data) => {
        this.emitToHandlers('message:typing:stop', data)
      })

      this.socket.on('conversation:updated', (data) => {
        this.emitToHandlers('conversation:updated', data)
      })

      this.socket.on('ai:progress', (data) => {
        this.emitToHandlers('ai:progress', data)
      })

      this.socket.on('notification', (data) => {
        this.emitToHandlers('notification', data)
      })

      this.socket.on('connection:status', (data) => {
        this.emitToHandlers('connection:status', data)
      })
    })
  }

  disconnect() {
    if (this.socket) {
      // Clear all event handlers first to prevent circular reference errors
      this.eventHandlers.clear()
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  // Join a conversation room for real-time updates
  joinConversation(conversationId: string) {
    if (this.socket?.connected) {
      this.socket.emit('conversation:join', conversationId)
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId: string) {
    if (this.socket?.connected) {
      this.socket.emit('conversation:leave', conversationId)
    }
  }

  // Send typing indicator
  sendTyping(conversationId: string, isTyping: boolean) {
    if (this.socket?.connected) {
      if (isTyping) {
        this.socket.emit('typing:start', { conversationId })
      } else {
        this.socket.emit('typing:stop', { conversationId })
      }
    }
  }

  // Generic event subscription
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)?.add(handler)

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  // Remove event handler
  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
  }

  // Emit event to all handlers
  private emitToHandlers(event: string, data: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error)
        }
      })
    }
  }

  get connected() {
    return this.isConnected
  }

  get socketId() {
    return this.socket?.id
  }

  // Send custom events to server
  sendEvent(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }
}

// Export singleton instance
export const socketService = new SocketService()