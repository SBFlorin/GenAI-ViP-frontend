<template>
  <div class="notification-system">
    <!-- Connection Status -->
    <div 
      v-if="!isConnected" 
      class="connection-status offline"
      @click="onReconnect"
    >
      <div class="status-indicator">
        <div class="status-dot"></div>
        <span>Disconnected - Click to reconnect</span>
      </div>
    </div>

    <!-- Notification Panel -->
    <div 
      v-if="showNotifications && notifications.length > 0" 
      class="notification-panel"
    >
      <div class="notification-header">
        <h3 class="notification-title">Notifications</h3>
        <div class="notification-actions">
          <button 
            @click="clearAll" 
            class="btn-clear"
            title="Clear all"
          >
            Clear All
          </button>
          <button 
            @click="closePanel" 
            class="btn-close"
            title="Close"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="notification-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="[
            'notification-item',
            { 'unread': !notification.read },
            `type-${notification.type || 'info'}`
          ]"
          @click="markAsRead(notification.id)"
        >
          <div class="notification-icon">
            <svg 
              v-if="notification.type === 'message'" 
              class="w-5 h-5" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
            <svg 
              v-else-if="notification.type === 'conversation'" 
              class="w-5 h-5" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/>
            </svg>
            <svg 
              v-else 
              class="w-5 h-5" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clip-rule="evenodd"/>
            </svg>
          </div>
          
          <div class="notification-content">
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ formatTime(notification.timestamp) }}</div>
          </div>
          
          <div v-if="!notification.read" class="notification-unread-dot"></div>
        </div>
      </div>
    </div>

    <!-- Notification Bell -->
    <button 
      @click="togglePanel"
      class="notification-bell"
      :class="{ 'has-notifications': hasUnread }"
    >
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
      </svg>
      <span v-if="unreadCount > 0" class="notification-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Toast Notifications -->
    <transition-group name="toast" tag="div" class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'toast',
          `toast-${toast.type || 'info'}`
        ]"
      >
        <div class="toast-content">
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button 
          @click="dismissToast(toast.id)"
          class="toast-close"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Notification {
  id: string
  type?: 'message' | 'conversation' | 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: string
  read: boolean
}

interface Props {
  notifications: Notification[]
  isConnected: boolean
}

interface Emits {
  (e: 'reconnect'): void
  (e: 'mark-read', id: string): void
  (e: 'clear-all'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showNotifications = ref(false)
const toasts = ref<Array<Notification & { id: string }>>([])

const hasUnread = computed(() => {
  return props.notifications.some(n => !n.read)
})

const unreadCount = computed(() => {
  return props.notifications.filter(n => !n.read).length
})

// Watch for new notifications and show as toasts
watch(() => props.notifications, (newNotifications, oldNotifications) => {
  if (oldNotifications && newNotifications.length > oldNotifications.length) {
    const newNotification = newNotifications[0] // Newest notification
    if (newNotification && !newNotification.read) {
      showToast(newNotification)
    }
  }
}, { deep: true })

const togglePanel = () => {
  showNotifications.value = !showNotifications.value
}

const closePanel = () => {
  showNotifications.value = false
}

const markAsRead = (id: string) => {
  emit('mark-read', id)
}

const clearAll = () => {
  emit('clear-all')
  showNotifications.value = false
}

const onReconnect = () => {
  emit('reconnect')
}

const showToast = (notification: Notification) => {
  const toastId = `toast-${Date.now()}`
  const toast = {
    ...notification,
    id: toastId
  }
  
  toasts.value.unshift(toast)
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    dismissToast(toastId)
  }, 5000)
  
  // Keep max 5 toasts
  if (toasts.value.length > 5) {
    toasts.value = toasts.value.slice(0, 5)
  }
}

const dismissToast = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
</script>

<style scoped>
.notification-system {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 50;
}

.connection-status {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s;
}

.connection-status.offline {
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.connection-status.offline:hover {
  background-color: #fecaca;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
  animation: pulse 2s infinite;
}

.notification-bell {
  position: relative;
  padding: 8px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
  cursor: pointer;
}

.notification-bell:hover {
  background-color: #f9fafb;
}

.notification-bell svg {
  width: 24px;
  height: 24px;
}

.notification-bell.has-notifications {
  color: #2563eb;
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #ef4444;
  color: white;
  font-size: 12px;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.notification-panel {
  margin-bottom: 16px;
  width: 320px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
  max-height: 384px;
  display: flex;
  flex-direction: column;
}

.notification-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notification-title {
  font-weight: 600;
  color: #111827;
}

.notification-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-clear {
  font-size: 14px;
  color: #4b5563;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-clear:hover {
  color: #111827;
}

.btn-close {
  padding: 4px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #4b5563;
}

.btn-close svg {
  width: 16px;
  height: 16px;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
}

.notification-item {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f9fafb;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item.unread {
  background-color: #eff6ff;
}

.notification-item.unread:hover {
  background-color: #dbeafe;
}

.notification-item.type-message {
  border-left: 4px solid #3b82f6;
}

.notification-item.type-conversation {
  border-left: 4px solid #10b981;
}

.notification-item.type-error {
  border-left: 4px solid #ef4444;
}

.notification-icon {
  color: #6b7280;
  margin-top: 4px;
}

.notification-icon svg {
  width: 20px;
  height: 20px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-message {
  font-size: 14px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-time {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.notification-unread-dot {
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
  margin-top: 8px;
}

.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 60;
}

.toast-container > * + * {
  margin-top: 8px;
}

.toast {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 300px;
  max-width: 384px;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-success {
  border-left: 4px solid #10b981;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  font-size: 14px;
  color: #111827;
}

.toast-close {
  margin-left: 12px;
  padding: 4px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.toast-close:hover {
  color: #4b5563;
}

.toast-close svg {
  width: 16px;
  height: 16px;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s;
}

/* Additional animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>