<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
          <span class="text-teal-400">Earnings</span> History
        </h1>
        <p class="text-gray-300 text-lg">
          Track your earnings and payout history
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading earnings data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <Icon name="heroicons:exclamation-circle" class="w-6 h-6 text-red-400" />
          <h3 class="text-red-300 font-semibold">Error Loading Earnings</h3>
        </div>
        <p class="text-red-200 mb-4">{{ error }}</p>
        <button 
          @click="loadEarnings"
          class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>

      <!-- Earnings Content -->
      <div v-else class="space-y-8">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">Total Earnings</p>
                <p class="text-3xl font-bold text-white">${{ summary.totalEarnings.toFixed(2) }}</p>
              </div>
              <Icon name="heroicons:currency-dollar" class="w-10 h-10 text-teal-400" />
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">This Month</p>
                <p class="text-3xl font-bold text-white">${{ summary.monthlyEarnings.toFixed(2) }}</p>
              </div>
              <Icon name="heroicons:calendar" class="w-10 h-10 text-teal-400" />
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">Pending Payout</p>
                <p class="text-3xl font-bold text-white">${{ summary.pendingPayout.toFixed(2) }}</p>
              </div>
              <Icon name="heroicons:clock" class="w-10 h-10 text-teal-400" />
            </div>
          </div>
        </div>

        <!-- Earnings Chart -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:chart-bar" class="w-6 h-6 text-teal-400" />
            Earnings Over Time
          </h2>
          
          <div class="h-64 flex items-center justify-center">
            <p class="text-gray-400">Chart coming soon...</p>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:receipt-refund" class="w-6 h-6 text-teal-400" />
            Recent Transactions
          </h2>
          
          <div v-if="transactions.length === 0" class="text-center py-8">
            <Icon name="heroicons:inbox" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p class="text-gray-400">No transactions yet</p>
            <p class="text-gray-500 text-sm mt-2">Start selling content to see your earnings here</p>
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="transaction in transactions" 
              :key="transaction.id"
              class="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg"
            >
              <div class="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Icon :name="transaction.icon" class="w-5 h-5 text-teal-400" />
              </div>
              <div class="flex-1">
                <p class="text-white font-medium">{{ transaction.title }}</p>
                <p class="text-gray-400 text-sm">{{ transaction.description }}</p>
              </div>
              <div class="text-right">
                <p class="text-teal-400 font-medium text-lg">${{ transaction.amount.toFixed(2) }}</p>
                <p class="text-gray-400 text-sm">{{ transaction.date }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Payout History -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:banknotes" class="w-6 h-6 text-teal-400" />
            Payout History
          </h2>
          
          <div v-if="payouts.length === 0" class="text-center py-8">
            <Icon name="heroicons:banknotes" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p class="text-gray-400">No payouts yet</p>
            <p class="text-gray-500 text-sm mt-2">Payouts are processed weekly when you have available balance</p>
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="payout in payouts" 
              :key="payout.id"
              class="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg"
            >
              <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Icon name="heroicons:banknotes" class="w-5 h-5 text-green-400" />
              </div>
              <div class="flex-1">
                <p class="text-white font-medium">Payout to Bank Account</p>
                <p class="text-gray-400 text-sm">{{ payout.status }} • {{ payout.date }}</p>
              </div>
              <div class="text-right">
                <p class="text-green-400 font-medium text-lg">${{ payout.amount.toFixed(2) }}</p>
                <p class="text-gray-400 text-sm">{{ payout.reference }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

const isLoading = ref(true);
const error = ref(null);

const summary = ref({
  totalEarnings: 0,
  monthlyEarnings: 0,
  pendingPayout: 0
});

const transactions = ref([]);
const payouts = ref([]);

const loadEarnings = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Load earnings summary
    const summaryResponse = await $fetch('/api/creators/earnings-summary', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (summaryResponse.success) {
      summary.value = summaryResponse.summary;
    }
    
    // Load recent transactions
    const transactionsResponse = await $fetch('/api/creators/transactions', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (transactionsResponse.success) {
      transactions.value = transactionsResponse.transactions;
    }
    
    // Load payout history
    const payoutsResponse = await $fetch('/api/creators/payouts', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (payoutsResponse.success) {
      payouts.value = payoutsResponse.payouts;
    }
    
  } catch (err) {
    console.error('Earnings load error:', err);
    error.value = 'Failed to load earnings data. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadEarnings();
});
</script> 