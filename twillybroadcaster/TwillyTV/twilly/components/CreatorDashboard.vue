<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Creator Dashboard</h1>
        <p class="text-gray-300">Manage your streams, clips, and earnings</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-teal-900/30">
          <div class="text-teal-400 mb-2">
            <Icon name="heroicons:video-camera" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Active Streams</h3>
          <p class="text-2xl font-bold text-teal-400">{{ stats.activeStreams }}</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-blue-900/30">
          <div class="text-blue-400 mb-2">
            <Icon name="heroicons:film" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Total Clips</h3>
          <p class="text-2xl font-bold text-blue-400">{{ stats.totalClips }}</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-green-900/30">
          <div class="text-green-400 mb-2">
            <Icon name="heroicons:currency-dollar" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Total Earnings</h3>
          <p class="text-2xl font-bold text-green-400">${{ stats.totalEarnings }}</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-purple-900/30">
          <div class="text-purple-400 mb-2">
            <Icon name="heroicons:chart-bar" class="w-6 h-6" />
          </div>
          <h3 class="text-white font-semibold">Revenue Share</h3>
          <p class="text-2xl font-bold text-purple-400">{{ stats.revenueShare }}%</p>
        </div>
      </div>



      <!-- Stream Keys Section -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-teal-900/30 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-white">Stream Keys</h2>
          <button
            @click="generateStreamKey"
            :disabled="isGenerating"
            class="bg-teal-500 hover:bg-teal-600 disabled:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {{ isGenerating ? 'Generating...' : 'Generate New Key' }}
          </button>
        </div>
        
        <div class="space-y-3">
          <div v-for="key in streamKeys" :key="key.streamKey" class="bg-black/20 p-4 rounded-lg border border-teal-900/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium">{{ key.channelName }}</p>
                <p class="text-gray-400 text-sm">{{ key.streamKey }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span :class="key.isActive ? 'text-green-400' : 'text-red-400'" class="text-sm">
                  {{ key.isActive ? 'Active' : 'Inactive' }}
                </span>
                <button
                  @click="copyStreamKey(key.streamKey)"
                  class="text-teal-400 hover:text-teal-300 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clips Section -->
      <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-blue-900/30 mb-8">
        <h2 class="text-xl font-bold text-white mb-4">Your Clips</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="clip in clips" :key="clip.id" class="bg-black/20 p-4 rounded-lg border border-blue-900/20">
            <div class="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
              <Icon name="heroicons:play" class="w-8 h-8 text-gray-400" />
            </div>
            <h3 class="text-white font-medium mb-2">{{ clip.title }}</h3>
            <p class="text-gray-400 text-sm mb-3">{{ clip.description }}</p>
            
            <div class="flex items-center justify-between">
              <span v-if="clip.isMonetized" class="text-green-400 text-sm font-medium">
                ${{ clip.price }}
              </span>
              <span v-else class="text-gray-400 text-sm">
                Not monetized
              </span>
              
              <button
                v-if="!clip.isMonetized"
                @click="monetizeClip(clip)"
                class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Monetize
              </button>
              <button
                v-else
                @click="viewClip(clip)"
                class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    

    <!-- Monetize Clip Modal -->
    <div v-if="showMonetizeModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
        <h3 class="text-xl font-bold text-white mb-4">Monetize Clip</h3>
        
        <form @submit.prevent="submitMonetization" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              v-model="monetizeForm.title"
              type="text"
              required
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="Clip Title"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              v-model="monetizeForm.description"
              rows="3"
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="Describe your clip..."
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Price ($)</label>
            <input
              v-model="monetizeForm.price"
              type="number"
              step="0.01"
              min="0.01"
              required
              class="w-full px-4 py-2 bg-black/20 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
              placeholder="0.00"
            />
          </div>
          
          <div class="flex items-center gap-2">
            <input
              v-model="monetizeForm.isExclusive"
              type="checkbox"
              id="exclusive"
              class="w-4 h-4 text-teal-600 bg-black/20 border-gray-600 rounded focus:ring-teal-500"
            />
            <label for="exclusive" class="text-sm text-gray-300">Make this clip exclusive</label>
          </div>
          
          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="isMonetizing"
              class="flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {{ isMonetizing ? 'Monetizing...' : 'Monetize Clip' }}
            </button>
            <button
              type="button"
              @click="showMonetizeModal = false"
              class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

// State
const stats = ref({
  activeStreams: 0,
  totalClips: 0,
  totalEarnings: 0,
  revenueShare: 80
});

const streamKeys = ref([]);
const clips = ref([]);
// Modal states
const showMonetizeModal = ref(false);
const isGenerating = ref(false);
const isMonetizing = ref(false);

const monetizeForm = ref({
  title: '',
  description: '',
  price: '',
  isExclusive: false
});

const selectedClip = ref(null);

// Methods
const generateStreamKey = async () => {
  try {
    isGenerating.value = true;
    const response = await $fetch('/api/stream-keys/generate', {
      method: 'POST',
      body: {
        userEmail: authStore.user?.attributes?.email,
        channelName: `Channel ${streamKeys.value.length + 1}`,
        creatorId: authStore.user?.attributes?.email
      }
    });

    if (response.success) {
      streamKeys.value.push({
        streamKey: response.streamKey,
        channelName: `Channel ${streamKeys.value.length}`,
        isActive: true
      });
    }
  } catch (error) {
    console.error('Error generating stream key:', error);
  } finally {
    isGenerating.value = false;
  }
};



const monetizeClip = (clip) => {
  selectedClip.value = clip;
  monetizeForm.value = {
    title: clip.title || '',
    description: clip.description || '',
    price: '',
    isExclusive: false
  };
  showMonetizeModal.value = true;
};

const submitMonetization = async () => {
  try {
    isMonetizing.value = true;
    const response = await $fetch('/api/clips/monetize', {
      method: 'POST',
      body: {
        clipId: selectedClip.value.id,
        creatorId: authStore.user?.attributes?.email,
        price: monetizeForm.value.price,
        title: monetizeForm.value.title,
        description: monetizeForm.value.description,
        isExclusive: monetizeForm.value.isExclusive
      }
    });

    if (response.success) {
      // Update the clip in the list
      const clipIndex = clips.value.findIndex(c => c.id === selectedClip.value.id);
      if (clipIndex !== -1) {
        clips.value[clipIndex].isMonetized = true;
        clips.value[clipIndex].price = monetizeForm.value.price;
        clips.value[clipIndex].title = monetizeForm.value.title;
      }
      
      showMonetizeModal.value = false;
      monetizeForm.value = { title: '', description: '', price: '', isExclusive: false };
      selectedClip.value = null;
    }
  } catch (error) {
    console.error('Error monetizing clip:', error);
  } finally {
    isMonetizing.value = false;
  }
};

const copyStreamKey = (streamKey) => {
  navigator.clipboard.writeText(streamKey);
  // You could add a toast notification here
};

const viewClip = (clip) => {
  // Navigate to clip view page
  navigateTo(`/clips/${clip.id}`);
};

// Load data on mount
onMounted(async () => {
  // Load creator data
  // This would typically fetch from your API
  stats.value = {
    activeStreams: 2,
    totalClips: 15,
    totalEarnings: 245.50,
    revenueShare: 80
  };

  streamKeys.value = [
    {
      streamKey: 'sk_abc123def456',
      channelName: 'Main Channel',
      isActive: true
    }
  ];

  clips.value = [
    {
      id: '1',
      title: 'Amazing Gaming Moment',
      description: 'Epic play from my latest stream',
      isMonetized: true,
      price: 2.99
    },
    {
      id: '2',
      title: 'Funny Reaction Clip',
      description: 'Hilarious moment with friends',
      isMonetized: false
    }
  ];


});
</script> 