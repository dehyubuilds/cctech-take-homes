<template>
  <div class="fixed top-4 right-4 z-50 space-y-3">
    <TransitionGroup name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="bg-gray-900 border border-white/20 rounded-xl p-4 shadow-2xl backdrop-blur-sm max-w-sm"
        :class="{
          'border-green-500/30 bg-green-500/5': notification.type === 'success',
          'border-red-500/30 bg-red-500/5': notification.type === 'error',
          'border-blue-500/30 bg-blue-500/5': notification.type === 'info',
          'border-yellow-500/30 bg-yellow-500/5': notification.type === 'warning'
        }"
      >
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <Icon 
              :name="getNotificationIcon(notification.type)" 
              class="w-5 h-5"
              :class="{
                'text-green-400': notification.type === 'success',
                'text-red-400': notification.type === 'error',
                'text-blue-400': notification.type === 'info',
                'text-yellow-400': notification.type === 'warning'
              }"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-white mb-1">
              {{ notification.title }}
            </h4>
            <p class="text-sm text-gray-300">
              {{ notification.message }}
            </p>
            <div v-if="notification.amount" class="mt-2">
              <span class="text-lg font-bold text-green-400">
                ${{ notification.amount.toFixed(2) }}
              </span>
            </div>
          </div>
          <button
            @click="removeNotification(notification.id)"
            class="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// State
const notifications = ref([]);
let notificationId = 0;

// Methods
const getNotificationIcon = (type) => {
  switch (type) {
    case 'success': return 'heroicons:check-circle';
    case 'error': return 'heroicons:exclamation-triangle';
    case 'warning': return 'heroicons:exclamation-triangle';
    case 'info': return 'heroicons:information-circle';
    default: return 'heroicons:bell';
  }
};

const addNotification = (notification) => {
  const id = ++notificationId;
  const newNotification = {
    id,
    type: notification.type || 'info',
    title: notification.title || 'Notification',
    message: notification.message || '',
    amount: notification.amount || null,
    duration: notification.duration || 5000
  };

  notifications.value.push(newNotification);

  // Auto-remove after duration
  setTimeout(() => {
    removeNotification(id);
  }, newNotification.duration);
};

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id);
  if (index > -1) {
    notifications.value.splice(index, 1);
  }
};

// Expose methods globally
const showSuccess = (title, message, amount = null) => {
  addNotification({ type: 'success', title, message, amount });
};

const showError = (title, message) => {
  addNotification({ type: 'error', title, message });
};

const showInfo = (title, message) => {
  addNotification({ type: 'info', title, message });
};

const showWarning = (title, message) => {
  addNotification({ type: 'warning', title, message });
};

// Payout-specific notifications
const showPayoutNotification = (amount, channelName) => {
  addNotification({
    type: 'success',
    title: 'Payout Received!',
    message: `You've received a payout from ${channelName}`,
    amount,
    duration: 8000
  });
};

const showPayoutPending = (amount, channelName) => {
  addNotification({
    type: 'info',
    title: 'Payout Pending',
    message: `Your payout from ${channelName} is being processed`,
    amount,
    duration: 6000
  });
};

// Make methods available globally
onMounted(() => {
  // Add to global window object for easy access
  window.$notify = {
    success: showSuccess,
    error: showError,
    info: showInfo,
    warning: showWarning,
    payout: showPayoutNotification,
    payoutPending: showPayoutPending
  };
});

onUnmounted(() => {
  // Clean up global reference
  if (window.$notify) {
    delete window.$notify;
  }
});

// Expose methods for parent components
defineExpose({
  addNotification,
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showPayoutNotification,
  showPayoutPending
});
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>
