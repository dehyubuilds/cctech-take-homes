<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Affiliate Dashboard</h1>
        <p class="text-gray-300">Track your earnings and manage talent signups</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-green-900/30">
          <div class="text-green-400 mb-2">
            <Icon name="heroicons:currency-dollar" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Total Earnings</h3>
          <p class="text-2xl font-bold text-green-400">${{ earnings.totalEarnings?.toFixed(2) || '0.00' }}</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-blue-900/30">
          <div class="text-blue-400 mb-2">
            <Icon name="heroicons:users" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Active Signups</h3>
          <p class="text-2xl font-bold text-blue-400">{{ earnings.activeSignups || 0 }}</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-purple-900/30">
          <div class="text-purple-400 mb-2">
            <Icon name="heroicons:chart-bar" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Commission Rate</h3>
          <p class="text-2xl font-bold text-purple-400">{{ (earnings.commissionRate * 100) || 5 }}%</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-yellow-900/30">
          <div class="text-yellow-400 mb-2">
            <Icon name="heroicons:clock" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Pending Payout</h3>
          <p class="text-2xl font-bold text-yellow-400">${{ earnings.pendingEarnings?.toFixed(2) || '0.00' }}</p>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-teal-900/30 mb-8">
        <h2 class="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            @click="showTalentForm = true"
            class="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Add New Talent
          </button>
          <button
            @click="showAffiliateLink = true"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Get Affiliate Link
          </button>
          <button
            @click="refreshEarnings"
            class="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Refresh Earnings
          </button>
        </div>
      </div>

      <!-- Channel-Specific Performance -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-900/30 mb-8">
        <h2 class="text-xl font-bold text-white mb-4">Channel Performance</h2>
        
        <!-- Channel Selection -->
        <div class="mb-4">
          <label class="block text-gray-300 font-medium mb-2">Select Channel</label>
          <select
            v-model="selectedChannel"
            @change="loadChannelData"
            class="w-full bg-black/20 border border-orange-500/30 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
          >
            <option value="">All Channels</option>
            <option v-for="channel in userChannels" :key="channel" :value="channel">
              {{ channel }}
            </option>
          </select>
        </div>

        <!-- Channel Stats -->
        <div v-if="selectedChannel" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <p class="text-orange-300 text-sm">Channel Earnings</p>
            <p class="text-white text-2xl font-bold">${{ channelEarnings.totalEarnings || 0 }}</p>
          </div>
          <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p class="text-green-300 text-sm">Active Referrals</p>
            <p class="text-white text-2xl font-bold">{{ channelEarnings.activeSignups || 0 }}</p>
          </div>
          <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <p class="text-purple-300 text-sm">Commission Rate</p>
            <p class="text-white text-2xl font-bold">5%</p>
          </div>
        </div>

        <!-- Channel Talent List -->
        <div v-if="selectedChannel && channelTalent.length > 0" class="space-y-3">
          <h3 class="text-lg font-semibold text-white mb-3">Talent for {{ selectedChannel }}</h3>
          <div v-for="talent in channelTalent" :key="talent.trackingId" 
               class="bg-black/20 rounded-lg p-4 border border-orange-500/30">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium">{{ talent.talentFullName }}</p>
                <p class="text-gray-400 text-sm">{{ talent.talentEmail }}</p>
                <p class="text-orange-300 text-xs">{{ talent.channelName }}</p>
              </div>
              <div class="text-right">
                <p class="text-green-300 font-medium">${{ talent.commissionEarned || 0 }}</p>
                <p class="text-gray-400 text-xs">{{ new Date(talent.signupDate).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="selectedChannel" class="text-center py-6 text-gray-400">
          <Icon name="heroicons:user-group" class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No talent signups for this channel yet</p>
        </div>
      </div>

      <!-- Earnings History -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-green-900/30 mb-8">
        <h2 class="text-xl font-bold text-white mb-4">Recent Earnings</h2>
        <div class="space-y-3">
          <div v-for="earning in earnings.earningsHistory?.slice(0, 5)" :key="earning.trackingId" 
               class="bg-black/20 p-4 rounded-lg border border-green-900/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium">{{ earning.talentUsername }}</p>
                <p class="text-gray-400 text-sm">{{ earning.channelName }}</p>
                <p class="text-gray-500 text-xs">{{ new Date(earning.signupDate).toLocaleDateString() }}</p>
              </div>
              <div class="text-right">
                <p class="text-green-400 font-bold">${{ earning.commissionEarned?.toFixed(2) || '0.00' }}</p>
                <span :class="earning.status === 'active' ? 'text-green-400' : 'text-gray-400'" class="text-sm">
                  {{ earning.status }}
                </span>
              </div>
            </div>
          </div>
          
          <div v-if="!earnings.earningsHistory?.length" class="text-center text-gray-400 py-8">
            <Icon name="heroicons:chart-bar" class="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No earnings yet. Start by adding talent to your network!</p>
          </div>
        </div>
      </div>

      <!-- Talent Management -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-blue-900/30 mb-8">
        <h2 class="text-xl font-bold text-white mb-4">Talent Management</h2>
        <div class="space-y-3">
          <div v-for="talent in activeTalent" :key="talent.trackingId" 
               class="bg-black/20 p-4 rounded-lg border border-blue-900/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium">{{ talent.talentUsername }}</p>
                <p class="text-gray-400 text-sm">{{ talent.channelName }}</p>
                <p class="text-gray-500 text-xs">Joined: {{ new Date(talent.signupDate).toLocaleDateString() }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-green-400 text-sm">Active</span>
                <button
                  @click="viewTalentDetails(talent)"
                  class="text-blue-400 hover:text-blue-300 text-sm"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="!activeTalent.length" class="text-center text-gray-400 py-8">
            <Icon name="heroicons:users" class="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active talent yet. Start building your network!</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Talent Modal -->
    <div v-if="showTalentForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-white mb-4">Add New Talent</h3>
        
        <form @submit.prevent="addTalent" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Talent Email</label>
              <input
                v-model="talentForm.email"
                type="email"
                required
                class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
                placeholder="talent@example.com"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Talent Username</label>
              <input
                v-model="talentForm.username"
                type="text"
                required
                class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
                placeholder="talent_username"
              />
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              v-model="talentForm.fullName"
              type="text"
              required
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="Full Name"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Channel Name</label>
            <input
              v-model="talentForm.channelName"
              type="text"
              required
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="Channel Name"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
            <textarea
              v-model="talentForm.notes"
              rows="3"
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="Additional notes about this talent..."
            ></textarea>
          </div>
          
          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="isAddingTalent"
              class="flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {{ isAddingTalent ? 'Adding...' : 'Add Talent' }}
            </button>
            <button
              type="button"
              @click="showTalentForm = false"
              class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Affiliate Link Modal -->
    <div v-if="showAffiliateLink" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
        <h3 class="text-xl font-bold text-white mb-4">Your Affiliate Link</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Affiliate Link</label>
            <div class="flex gap-2">
              <input
                :value="affiliateLink"
                readonly
                class="flex-1 px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white"
              />
              <button
                @click="copyAffiliateLink"
                class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div class="text-sm text-gray-400">
            <p>Share this link with potential talent to track signups and earn commissions.</p>
          </div>
          
          <button
            @click="showAffiliateLink = false"
            class="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAffiliateStore } from '~/stores/useAffiliateStore';

const affiliateStore = useAffiliateStore();

// State
const showTalentForm = ref(false);
const showAffiliateLink = ref(false);
const isAddingTalent = ref(false);
const selectedChannel = ref('');
const channelEarnings = ref({});
const channelTalent = ref([]);
const userChannels = ref([]);

const talentForm = ref({
  email: '',
  username: '',
  fullName: '',
  channelName: '',
  notes: ''
});

// Computed
const earnings = computed(() => affiliateStore.affiliateEarnings);
const activeTalent = computed(() => affiliateStore.affiliateEarnings?.earningsHistory?.filter(t => t.status === 'active') || []);
const affiliateLink = computed(() => {
  // This would come from the affiliate's profile
  const affiliateId = 'aff_123'; // Replace with actual affiliate ID
  return `${window.location.origin}/affiliate/${affiliateId}`;
});

// Methods
const addTalent = async () => {
  try {
    isAddingTalent.value = true;
    
    const talentData = {
      email: talentForm.value.email,
      username: talentForm.value.username,
      fullName: talentForm.value.fullName,
      channelId: talentForm.value.channelName.toLowerCase().replace(/\s+/g, '-'),
      channelName: talentForm.value.channelName,
      notes: talentForm.value.notes
    };

    const trackingId = await affiliateStore.trackAffiliateSignup('aff_123', talentData);
    
    if (trackingId) {
      // Reset form and close modal
      talentForm.value = { email: '', username: '', fullName: '', channelName: '', notes: '' };
      showTalentForm.value = false;
      
      // Refresh earnings
      await refreshEarnings();
    }
  } catch (error) {
    console.error('Error adding talent:', error);
  } finally {
    isAddingTalent.value = false;
  }
};

const refreshEarnings = async () => {
  try {
    await affiliateStore.getAffiliateEarnings('aff_123'); // Replace with actual affiliate ID
  } catch (error) {
    console.error('Error refreshing earnings:', error);
  }
};

const loadChannelData = async () => {
  if (!selectedChannel.value) {
    channelEarnings.value = {};
    channelTalent.value = [];
    return;
  }

  try {
    // Filter earnings and talent for the selected channel
    const channelData = earnings.value?.earningsHistory?.filter(item => 
      item.channelName === selectedChannel.value
    ) || [];

    channelTalent.value = channelData;
    
    // Calculate channel-specific earnings
    const totalEarnings = channelData.reduce((sum, item) => sum + (item.commissionEarned || 0), 0);
    const activeSignups = channelData.filter(item => item.status === 'active').length;
    
    channelEarnings.value = {
      totalEarnings,
      activeSignups,
      commissionRate: 0.05
    };
  } catch (error) {
    console.error('Error loading channel data:', error);
  }
};

const loadUserChannels = async () => {
  try {
    // Get unique channels from earnings history
    const channels = earnings.value?.earningsHistory?.map(item => item.channelName) || [];
    userChannels.value = [...new Set(channels)];
  } catch (error) {
    console.error('Error loading user channels:', error);
  }
};

const viewTalentDetails = (talent) => {
  // Navigate to talent details page
  console.log('Viewing talent details:', talent);
};

const copyAffiliateLink = async () => {
  try {
    await navigator.clipboard.writeText(affiliateLink.value);
    // You could add a toast notification here
  } catch (error) {
    console.error('Error copying link:', error);
  }
};

// Load data on mount
onMounted(async () => {
  try {
    await refreshEarnings();
    await loadUserChannels();
  } catch (error) {
    console.error('Error loading affiliate data:', error);
  }
});
</script>
