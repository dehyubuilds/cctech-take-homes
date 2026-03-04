<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
          Creator <span class="text-teal-400">Dashboard</span>
        </h1>
        <p class="text-gray-300 text-lg">
          Manage your content, track earnings, and grow your audience
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading your dashboard...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <Icon name="heroicons:exclamation-circle" class="w-6 h-6 text-red-400" />
          <h3 class="text-red-300 font-semibold">Dashboard Error</h3>
        </div>
        <p class="text-red-200 mb-4">{{ error }}</p>
        <button 
          @click="loadDashboard"
          class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="space-y-8">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">Total Earnings</p>
                <p class="text-2xl font-bold text-white">${{ stats.totalEarnings.toFixed(2) }}</p>
              </div>
              <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-teal-400" />
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">This Month</p>
                <p class="text-2xl font-bold text-white">${{ stats.monthlyEarnings.toFixed(2) }}</p>
              </div>
              <Icon name="heroicons:calendar" class="w-8 h-8 text-teal-400" />
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">Total Content</p>
                <p class="text-2xl font-bold text-white">{{ stats.totalContent }}</p>
              </div>
              <Icon name="heroicons:video-camera" class="w-8 h-8 text-teal-400" />
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-sm">Total Views</p>
                <p class="text-2xl font-bold text-white">{{ stats.totalViews.toLocaleString() }}</p>
              </div>
              <Icon name="heroicons:eye" class="w-8 h-8 text-teal-400" />
            </div>
          </div>
        </div>

        <!-- Payment Status -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:credit-card" class="w-6 h-6 text-teal-400" />
            Payment Account Status
          </h2>
          
          <div v-if="paymentStatus.isConnected" class="space-y-4">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-6 h-6 text-green-400" />
              <span class="text-green-300">Payment account connected and verified</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p class="text-gray-400 text-sm">Next Payout</p>
                <p class="text-white font-medium">{{ paymentStatus.nextPayoutDate }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">Pending Balance</p>
                <p class="text-white font-medium">${{ paymentStatus.pendingBalance.toFixed(2) }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">Last Payout</p>
                <p class="text-white font-medium">${{ paymentStatus.lastPayoutAmount.toFixed(2) }}</p>
              </div>
            </div>
          </div>
          
          <div v-else class="space-y-4">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-yellow-400" />
              <span class="text-yellow-300">Payment account setup required</span>
            </div>
            
            <p class="text-gray-300 text-sm">
              Complete your payment account setup to start receiving payouts for your content.
            </p>
            
            <button 
              @click="setupPaymentAccount"
              class="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              Complete Payment Setup
            </button>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink 
            to="/creator/create-series"
            class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 hover:bg-black/60 transition-all duration-300 group"
          >
            <div class="flex items-center gap-3 mb-4">
              <Icon name="heroicons:video-camera" class="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
              <h3 class="text-xl font-semibold text-white">Create Series</h3>
            </div>
            <p class="text-gray-300">Set up subscription-based series with revenue sharing</p>
          </NuxtLink>

          <NuxtLink 
            to="/managefiles"
            class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 hover:bg-black/60 transition-all duration-300 group"
          >
            <div class="flex items-center gap-3 mb-4">
              <Icon name="heroicons:plus-circle" class="w-8 h-8 text-teal-400 group-hover:scale-110 transition-transform" />
              <h3 class="text-xl font-semibold text-white">Upload Content</h3>
            </div>
            <p class="text-gray-300">Add new videos, images, or other content to your channels</p>
          </NuxtLink>

          <NuxtLink 
            to="/creator/analytics"
            class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 hover:bg-black/60 transition-all duration-300 group"
          >
            <div class="flex items-center gap-3 mb-4">
              <Icon name="heroicons:chart-bar" class="w-8 h-8 text-teal-400 group-hover:scale-110 transition-transform" />
              <h3 class="text-xl font-semibold text-white">View Analytics</h3>
            </div>
            <p class="text-gray-300">Track your content performance and audience engagement</p>
          </NuxtLink>

          <NuxtLink 
            to="/creator/earnings"
            class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 hover:bg-black/60 transition-all duration-300 group"
          >
            <div class="flex items-center gap-3 mb-4">
              <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-teal-400 group-hover:scale-110 transition-transform" />
              <h3 class="text-xl font-semibold text-white">Earnings History</h3>
            </div>
            <p class="text-gray-300">View detailed earnings reports and payout history</p>
          </NuxtLink>
        </div>

        <!-- Talent Requests -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
              <Icon name="heroicons:user-group" class="w-6 h-6 text-teal-400" />
              Requests for Talent
            </h2>
            <NuxtLink 
              to="/talent-request/create"
              class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
            >
              <Icon name="heroicons:plus" class="w-4 h-4" />
              Create Request
            </NuxtLink>
          </div>
          
          <div v-if="talentRequestsStore.isLoading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
            <p class="text-gray-400">Loading talent requests...</p>
          </div>
          
          <div v-else-if="!talentRequestsStore.hasRequests" class="text-center py-8">
            <Icon name="heroicons:user-group" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p class="text-gray-400 mb-4">No talent requests yet</p>
            <p class="text-gray-500 text-sm mb-6">Create your first talent request to recruit collaborators for your streaming series.</p>
            <NuxtLink 
              to="/talent-request/create"
              class="inline-flex items-center px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Icon name="heroicons:plus" class="w-4 h-4 mr-2" />
              Create First Request
            </NuxtLink>
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="request in talentRequestsStore.requests.slice(0, 3)" 
              :key="request.id"
              class="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-teal-500/30 transition-colors"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <h3 class="text-white font-semibold mb-1">{{ request.projectTitle }}</h3>
                  <p class="text-gray-400 text-sm">{{ request.castingNeeds }}</p>
                </div>
                <div :class="getStatusBadgeClass(request.status)" class="px-2 py-1 rounded-full text-xs font-medium">
                  {{ getStatusText(request.status) }}
                </div>
              </div>
              
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-4 text-gray-400">
                  <span class="flex items-center gap-1">
                    <Icon name="heroicons:calendar" class="w-4 h-4" />
                    {{ formatDate(request.startDate) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Icon name="heroicons:clock" class="w-4 h-4" />
                    {{ request.timeSlots.length }} time slots
                  </span>
                  <span v-if="request.applications && request.applications.length > 0" class="flex items-center gap-1">
                    <Icon name="heroicons:user" class="w-4 h-4" />
                    {{ request.applications.length }} applications
                  </span>
                </div>
                
                <div class="flex items-center gap-2">
                  <NuxtLink 
                    :to="`/talent-request/${request.slug}`"
                    class="text-teal-400 hover:text-teal-300 text-sm"
                  >
                    View
                  </NuxtLink>
                  <button 
                    @click="manageRequest(request.id)"
                    class="text-gray-400 hover:text-white text-sm"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
            
            <div v-if="talentRequestsStore.totalRequests > 3" class="text-center pt-4">
              <NuxtLink 
                to="/talent-requests"
                class="text-teal-400 hover:text-teal-300 text-sm"
              >
                View all {{ talentRequestsStore.totalRequests }} requests →
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:clock" class="w-6 h-6 text-teal-400" />
            Recent Activity
          </h2>
          
          <div v-if="recentActivity.length === 0" class="text-center py-8">
            <Icon name="heroicons:inbox" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p class="text-gray-400">No recent activity</p>
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="activity in recentActivity" 
              :key="activity.id"
              class="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg"
            >
              <div class="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Icon :name="activity.icon" class="w-5 h-5 text-teal-400" />
              </div>
              <div class="flex-1">
                <p class="text-white font-medium">{{ activity.title }}</p>
                <p class="text-gray-400 text-sm">{{ activity.description }}</p>
              </div>
              <div class="text-right">
                <p class="text-gray-400 text-sm">{{ activity.time }}</p>
                <p v-if="activity.amount" class="text-teal-400 font-medium">${{ activity.amount }}</p>
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
import { useTalentRequestsStore } from '~/stores/talentRequests';


const authStore = useAuthStore();
const talentRequestsStore = useTalentRequestsStore();


const isLoading = ref(true);
const error = ref(null);

const stats = ref({
  totalEarnings: 0,
  monthlyEarnings: 0,
  totalContent: 0,
  totalViews: 0
});

const paymentStatus = ref({
  isConnected: false,
  nextPayoutDate: '',
  pendingBalance: 0,
  lastPayoutAmount: 0
});

const recentActivity = ref([]);

const loadDashboard = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Load creator stats
    const statsResponse = await $fetch('/api/creators/stats', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (statsResponse.success) {
      stats.value = statsResponse.stats;
    }
    
    // Load payment status
    const paymentResponse = await $fetch('/api/creators/payment-status', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (paymentResponse.success) {
      paymentStatus.value = paymentResponse.paymentStatus;
    }
    
    // Load recent activity
    const activityResponse = await $fetch('/api/creators/recent-activity', {
      method: 'POST',
      body: {
        userId: authStore.user?.username
      }
    });
    
    if (activityResponse.success) {
      recentActivity.value = activityResponse.activities;
    }
    
    // Load talent requests
    if (authStore.user?.attributes?.email) {
      await talentRequestsStore.loadUserRequests(authStore.user.attributes.email);
    }
    
  } catch (err) {
    console.error('Dashboard load error:', err);
    error.value = 'Failed to load dashboard data. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

// Helper functions for talent requests
const getStatusBadgeClass = (status) => {
  const classes = {
    'accepting_pilots': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'casting_closed': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'scheduled': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
}

const getStatusText = (status) => {
  const texts = {
    'accepting_pilots': 'Accepting Pilots',
    'casting_closed': 'Casting Closed',
    'scheduled': 'Scheduled'
  }
  return texts[status] || status
}

const formatDate = (dateString) => {
  if (!dateString) return 'TBD'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const manageRequest = (requestId) => {
  // Navigate to request management page
  navigateTo(`/talent-requests/${requestId}/manage`)
}

const setupPaymentAccount = async () => {
  try {
    // Lemon Squeezy integration - no account creation needed
    console.log('Lemon Squeezy integration - account creation handled automatically');
    // Redirect to Lemon Squeezy signup
    window.open('https://app.lemonsqueezy.com/signup', '_blank');
  } catch (err) {
    console.error('Payment setup error:', err);
    error.value = 'Failed to start payment setup. Please try again.';
  }
};

onMounted(() => {
  loadDashboard();
});
</script> 