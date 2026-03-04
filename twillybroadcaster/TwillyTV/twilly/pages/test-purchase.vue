<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-4">🧪 Test Purchase Flow</h1>
        <p class="text-gray-300">This simulates the Lemon Squeezy checkout for testing</p>
      </div>

      <!-- Product Details -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-16 h-16 bg-teal-500/20 rounded-lg flex items-center justify-center">
            <Icon name="heroicons:video-camera" class="w-8 h-8 text-teal-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">{{ productTitle }}</h2>
            <p class="text-gray-400">Digital Content</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Price:</span>
            <span class="text-white font-semibold">${{ productPrice }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Product ID:</span>
            <span class="text-gray-400 text-sm font-mono">{{ productId }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Variant ID:</span>
            <span class="text-gray-400 text-sm font-mono">{{ variantId }}</span>
          </div>
        </div>
      </div>

      <!-- Test Actions -->
      <div class="space-y-4">
        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
            <span class="text-yellow-300 font-medium">Test Mode</span>
          </div>
          <p class="text-yellow-200 text-sm">
            This is a test purchase flow. In production, this would redirect to Lemon Squeezy checkout.
          </p>
        </div>

        <!-- Simulate Success -->
        <button
          @click="simulateSuccessfulPurchase"
          :disabled="isProcessing"
          class="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-700 text-white py-4 px-6 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Icon v-if="isProcessing" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
          <Icon v-else name="heroicons:check-circle" class="w-5 h-5" />
          <span v-if="isProcessing">Processing...</span>
          <span v-else>✅ Simulate Successful Purchase</span>
        </button>

        <!-- Simulate Failure -->
        <button
          @click="simulateFailedPurchase"
          :disabled="isProcessing"
          class="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-700 text-white py-4 px-6 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Icon v-if="isProcessing" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
          <Icon v-else name="heroicons:x-circle" class="w-5 h-5" />
          <span v-if="isProcessing">Processing...</span>
          <span v-else>❌ Simulate Failed Purchase</span>
        </button>

        <!-- Go Back -->
        <button
          @click="goBack"
          class="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 px-6 rounded-lg font-medium transition-all duration-300"
        >
          ← Go Back
        </button>
      </div>

      <!-- Success Modal -->
      <div v-if="showSuccessModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-black/90 border border-green-500/30 rounded-xl p-8 max-w-md w-full mx-4">
          <div class="text-center">
            <Icon name="heroicons:check-circle" class="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 class="text-xl font-semibold text-white mb-2">Purchase Successful!</h3>
            <p class="text-gray-300 mb-6">
              Test purchase completed. This simulates a successful Lemon Squeezy transaction.
            </p>
            
            <div class="space-y-3 mb-6">
              <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p class="text-green-300 font-medium">Order Details:</p>
                <p class="text-white text-sm">Product: {{ productTitle }}</p>
                <p class="text-white text-sm">Amount: ${{ productPrice }}</p>
                <p class="text-white text-sm">Order ID: test_order_{{ Date.now() }}</p>
              </div>
            </div>
            
            <div class="flex gap-3">
              <button
                @click="viewContent"
                class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                View Content
              </button>
              <button
                @click="closeSuccessModal"
                class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Failure Modal -->
      <div v-if="showFailureModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-black/90 border border-red-500/30 rounded-xl p-8 max-w-md w-full mx-4">
          <div class="text-center">
            <Icon name="heroicons:x-circle" class="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 class="text-xl font-semibold text-white mb-2">Purchase Failed</h3>
            <p class="text-gray-300 mb-6">
              Test purchase failed. This simulates a failed Lemon Squeezy transaction.
            </p>
            
            <div class="space-y-3 mb-6">
              <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p class="text-red-300 font-medium">Error Details:</p>
                <p class="text-white text-sm">Payment declined</p>
                <p class="text-white text-sm">Insufficient funds</p>
              </div>
            </div>
            
            <button
              @click="closeFailureModal"
              class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isProcessing = ref(false);
const showSuccessModal = ref(false);
const showFailureModal = ref(false);

// Extract query parameters
const productId = ref(route.query.productId || 'test_product');
const variantId = ref(route.query.variantId || 'test_variant');
const productTitle = ref(decodeURIComponent(route.query.title || 'Test Product'));
const productPrice = ref(parseFloat(route.query.price) || 9.99);

// Simulate successful purchase
const simulateSuccessfulPurchase = async () => {
  try {
    isProcessing.value = true;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate webhook call to our backend
    const orderData = {
      id: `test_order_${Date.now()}`,
      attributes: {
        total: Math.round(productPrice.value * 100), // Convert to cents
        created_at: new Date().toISOString()
      },
      relationships: {
        customer: {
          data: {
            id: 'test_customer'
          }
        },
        product: {
          data: {
            id: productId.value
          }
        }
      }
    };

    // Call our webhook handler
    await $fetch('/api/lemonsqueezy/webhook', {
      method: 'POST',
      body: {
        event_name: 'order_created',
        data: orderData
      }
    });

    showSuccessModal.value = true;
    
  } catch (error) {
    console.error('Error simulating purchase:', error);
    alert('Error simulating purchase: ' + error.message);
  } finally {
    isProcessing.value = false;
  }
};

// Simulate failed purchase
const simulateFailedPurchase = async () => {
  try {
    isProcessing.value = true;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    showFailureModal.value = true;
    
  } catch (error) {
    console.error('Error simulating failed purchase:', error);
  } finally {
    isProcessing.value = false;
  }
};

// Go back
const goBack = () => {
  window.history.back();
};

// View content
const viewContent = () => {
  // Navigate back to the original content page
  window.history.back();
};

// Close modals
const closeSuccessModal = () => {
  showSuccessModal.value = false;
  goBack();
};

const closeFailureModal = () => {
  showFailureModal.value = false;
};

onMounted(() => {
  console.log('Test purchase page loaded with params:', {
    productId: productId.value,
    variantId: variantId.value,
    productTitle: productTitle.value,
    productPrice: productPrice.value
  });
});
</script>

<style scoped>
/* Custom animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 