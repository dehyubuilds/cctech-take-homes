<template>
  <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
    <div class="flex items-center gap-3 mb-6">
      <Icon name="heroicons:video-camera" class="w-6 h-6 text-teal-400" />
      <h2 class="text-xl font-semibold text-white">Create Subscription Series</h2>
    </div>

    <form @submit.prevent="createSeries" class="space-y-6">
      <!-- Series Basic Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-gray-300 mb-2 font-medium">Series Name</label>
          <input
            v-model="seriesForm.name"
            type="text"
            required
            class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
            placeholder="Enter series name"
          />
        </div>

        <div>
          <label class="block text-gray-300 mb-2 font-medium">Category</label>
          <select
            v-model="seriesForm.category"
            class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
          >
            <option value="comedy">Comedy</option>
            <option value="gaming">Gaming</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="education">Education</option>
            <option value="entertainment">Entertainment</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-gray-300 mb-2 font-medium">Description</label>
        <textarea
          v-model="seriesForm.description"
          rows="3"
          class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
          placeholder="Describe your series content..."
        ></textarea>
      </div>

      <!-- Subscription Pricing -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/5">
        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-teal-400" />
          Subscription Pricing
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-gray-300 mb-2 font-medium">Monthly Price ($)</label>
            <input
              v-model="seriesForm.subscriptionPrice"
              type="number"
              min="0"
              step="0.01"
              required
              class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              placeholder="9.99"
            />
          </div>
          
          <div class="flex items-end">
            <div class="text-gray-400 text-sm">
              <p>Revenue Share: 70% Creator / 30% Platform</p>
              <p class="text-xs mt-1">You'll receive 70% of each subscription</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Revenue Sharing -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/5">
        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="heroicons:users" class="w-5 h-5 text-purple-400" />
          Revenue Sharing
        </h3>
        
        <div class="space-y-4">
          <!-- Default Revenue Shares -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:user" class="w-4 h-4 text-teal-400" />
                <span class="text-teal-300 font-medium">Creator (You)</span>
              </div>
              <p class="text-white text-lg font-bold">70%</p>
              <p class="text-gray-400 text-xs">Primary content creator</p>
            </div>
            
            <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:building-office" class="w-4 h-4 text-purple-400" />
                <span class="text-purple-300 font-medium">Platform</span>
              </div>
              <p class="text-white text-lg font-bold">30%</p>
              <p class="text-gray-400 text-xs">Twilly platform fee</p>
            </div>
            
            <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:plus" class="w-4 h-4 text-blue-400" />
                <span class="text-blue-300 font-medium">Collaborators</span>
              </div>
              <p class="text-white text-lg font-bold">0%</p>
              <p class="text-gray-400 text-xs">Add collaborators later</p>
            </div>
          </div>

          <!-- Add Collaborators -->
          <div class="border-t border-white/10 pt-4">
            <button
              type="button"
              @click="addCollaborator"
              class="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Icon name="heroicons:plus-circle" class="w-5 h-5" />
              Add Collaborator
            </button>
          </div>

          <!-- Collaborators List -->
          <div v-if="collaborators.length > 0" class="space-y-3">
            <h4 class="text-white font-medium">Collaborators</h4>
            <div v-for="(collaborator, index) in collaborators" :key="index" class="flex items-center gap-3 p-3 bg-black/20 rounded-lg">
              <div class="flex-1">
                <input
                  v-model="collaborator.email"
                  type="email"
                  placeholder="Collaborator email"
                  class="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
              <div class="w-24">
                <input
                  v-model="collaborator.percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="%"
                  class="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
              <button
                type="button"
                @click="removeCollaborator(index)"
                class="text-red-400 hover:text-red-300 transition-colors"
              >
                <Icon name="heroicons:trash" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Thumbnail Upload -->
      <div>
        <label class="block text-gray-300 mb-2 font-medium">Series Thumbnail</label>
        <div class="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-teal-500/50 transition-colors cursor-pointer">
          <Icon name="heroicons:photo" class="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-400">Click to upload thumbnail</p>
          <p class="text-gray-500 text-sm">Recommended: 1200x630px</p>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="isCreating"
          class="flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-700 text-white py-3 px-6 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Icon v-if="isCreating" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
          <Icon v-else name="heroicons:plus" class="w-5 h-5" />
          <span v-if="isCreating">Creating Series...</span>
          <span v-else>Create Series</span>
        </button>
        
        <button
          type="button"
          @click="$emit('cancel')"
          class="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all duration-300"
        >
          Cancel
        </button>
      </div>
    </form>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-black/90 border border-teal-500/30 rounded-xl p-6 max-w-md w-full mx-4">
        <div class="text-center">
          <Icon name="heroicons:check-circle" class="w-16 h-16 text-teal-400 mx-auto mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">Series Created!</h3>
          <p class="text-gray-300 mb-6">{{ createdSeries?.seriesName }} is now live and ready for subscribers.</p>
          
          <div class="space-y-3">
            <div class="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
              <p class="text-teal-300 font-medium">Subscription Price</p>
              <p class="text-white text-lg">${{ createdSeries?.subscriptionPrice }}/month</p>
            </div>
            
            <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p class="text-purple-300 font-medium">Your Revenue Share</p>
              <p class="text-white text-lg">70% of each subscription</p>
            </div>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button
              @click="viewSeries"
              class="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              View Series
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

const emit = defineEmits(['cancel', 'series-created']);

// Form data
const seriesForm = ref({
  name: '',
  description: '',
  category: 'entertainment',
  subscriptionPrice: 9.99
});

const collaborators = ref([]);
const isCreating = ref(false);
const showSuccessModal = ref(false);
const createdSeries = ref(null);

// Add collaborator
const addCollaborator = () => {
  collaborators.value.push({
    email: '',
    percentage: 0
  });
};

// Remove collaborator
const removeCollaborator = (index) => {
  collaborators.value.splice(index, 1);
};

// Calculate total revenue share
const totalRevenueShare = computed(() => {
  const creatorShare = 70;
  const platformShare = 30;
  const collaboratorShare = collaborators.value.reduce((sum, collab) => sum + (parseFloat(collab.percentage) || 0), 0);
  
  return creatorShare + platformShare + collaboratorShare;
});

// Create series
const createSeries = async () => {
  try {
    isCreating.value = true;

    // Validate revenue shares
    if (totalRevenueShare.value !== 100) {
      alert('Total revenue share must equal 100%. Current total: ' + totalRevenueShare.value + '%');
      return;
    }

    // Build revenue shares array
    const revenueShares = [
      {
        participantId: authStore.user?.attributes?.email,
        participantType: 'creator',
        participantEmail: authStore.user?.attributes?.email,
        percentage: 70
      },
      {
        participantId: 'platform',
        participantType: 'platform',
        participantEmail: 'platform@twilly.app',
        percentage: 30
      }
    ];

    // Add collaborators
    collaborators.value.forEach(collaborator => {
      if (collaborator.email && collaborator.percentage > 0) {
        revenueShares.push({
          participantId: collaborator.email,
          participantType: 'collaborator',
          participantEmail: collaborator.email,
          percentage: parseFloat(collaborator.percentage)
        });
      }
    });

    const seriesData = {
      creatorId: authStore.user?.attributes?.email,
      seriesName: seriesForm.value.name,
      description: seriesForm.value.description,
      subscriptionPrice: parseFloat(seriesForm.value.subscriptionPrice),
      revenueShares: revenueShares,
      thumbnailUrl: null, // TODO: Add thumbnail upload
      category: seriesForm.value.category
    };

    console.log('Creating series with data:', seriesData);

    const response = await $fetch('/api/subscriptions/create-series', {
      method: 'POST',
      body: seriesData
    });

    if (response.success) {
      createdSeries.value = response.data.series;
      showSuccessModal.value = true;
      emit('series-created', response.data);
    } else {
      throw new Error(response.message || 'Failed to create series');
    }

  } catch (error) {
    console.error('Error creating series:', error);
    alert('Failed to create series: ' + error.message);
  } finally {
    isCreating.value = false;
  }
};

// View series
const viewSeries = () => {
  if (createdSeries.value) {
    // Navigate to series management page
    navigateTo(`/series/${createdSeries.value.id}`);
  }
};

// Close success modal
const closeSuccessModal = () => {
  showSuccessModal.value = false;
  createdSeries.value = null;
  // Reset form
  seriesForm.value = {
    name: '',
    description: '',
    category: 'entertainment',
    subscriptionPrice: 9.99
  };
  collaborators.value = [];
};
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