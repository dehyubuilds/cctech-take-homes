<template>
  <div class="subscription-button">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-400"></div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="text-red-400 text-sm">
      {{ error }}
    </div>
    
    <!-- Subscription Button -->
    <div v-else>
      <!-- Already Subscribed -->
      <div v-if="hasAccess" class="flex items-center gap-2 text-green-400">
        <Icon name="heroicons:check-circle" class="w-5 h-5" />
        <span class="font-medium">Subscribed</span>
      </div>
      
      <!-- Subscribe Button -->
      <button 
        v-else
        @click="createSubscription"
        :disabled="isCreating"
        class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon v-if="isCreating" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
        <Icon v-else name="heroicons:currency-dollar" class="w-5 h-5" />
        <span v-if="isCreating">Creating...</span>
        <span v-else>Subscribe for ${{ price }}/month</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const props = defineProps({
  channelId: {
    type: String,
    required: true
  },
  channelName: {
    type: String,
    required: true
  },
  creatorUsername: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0.00
  },
  existingChannelId: {
    type: String,
    default: null
  }
});

const authStore = useAuthStore();
const isLoading = ref(false);
const isCreating = ref(false);
const error = ref('');
const hasAccess = ref(false);



// Create subscription
const createSubscription = async () => {
  if (!authStore.user?.attributes?.email) {
    error.value = 'Please sign in to subscribe';
    return;
  }

  isCreating.value = true;
  error.value = '';

  try {
    const response = await $fetch('/api/stripe/create-subscription', {
      method: 'POST',
      body: {
        channelId: props.channelId,
        subscriberId: authStore.user.attributes.email,
        subscriberEmail: authStore.user.attributes.email,
        amount: props.price,
        channelName: props.channelName,
        creatorUsername: props.creatorUsername
      }
    });

    if (response.success && response.checkoutUrl) {
      // Redirect to Stripe Checkout
      window.location.href = response.checkoutUrl;
    } else {
      error.value = response.message || 'Failed to create subscription';
    }
  } catch (err) {
    console.error('Error creating subscription:', err);
    error.value = 'Failed to create subscription. Please try again.';
  } finally {
    isCreating.value = false;
  }
};

// Always check from DynamoDB - no caching
const checkAccess = async () => {
  if (!authStore.user?.attributes?.email) {
    hasAccess.value = false;
    return;
  }

  // Use existingChannelId if available, otherwise use channelId
  const channelIdToCheck = props.existingChannelId || props.channelId;

  console.log('SubscriptionButton checkAccess called with:', {
    subscriberId: authStore.user.attributes.email,
    channelId: channelIdToCheck,
    originalChannelId: props.channelId,
    existingChannelId: props.existingChannelId
  });

  try {
    const response = await $fetch('/api/stripe/check-subscription-access', {
      method: 'POST',
      body: {
        subscriberId: authStore.user.attributes.email,
        channelId: channelIdToCheck
      }
    });

    console.log('SubscriptionButton checkAccess response:', response);

    if (response.success) {
      hasAccess.value = response.hasAccess;
    } else {
      hasAccess.value = false;
    }
  } catch (err) {
    console.error('Error checking subscription access:', err);
    hasAccess.value = false;
  }
};

// Watch for prop changes and re-check
watch(() => [props.channelId, props.existingChannelId, authStore.user?.attributes?.email], async () => {
  console.log('SubscriptionButton props or user changed, re-checking access');
  await checkAccess();
}, { immediate: false });

// Watch for route changes (when user navigates back to page)
watch(() => window?.location?.href, async () => {
  console.log('SubscriptionButton route changed, re-checking access');
  await checkAccess();
}, { immediate: false });

// Periodic re-check to ensure status stays current
let checkInterval = null;

onMounted(async () => {
  isLoading.value = true;
  await checkAccess();
  isLoading.value = false;
  
  // Set up periodic re-check every 30 seconds
  checkInterval = setInterval(async () => {
    console.log('SubscriptionButton periodic re-check');
    await checkAccess();
  }, 30000);
});

// Clean up interval on unmount
onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
});
</script> 