<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-8 sm:py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading events...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center">
        <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-4 mb-4">
          {{ error }}
        </div>
      </div>

      <!-- Content -->
      <div v-else>
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white">Events</h1>
            <p class="text-gray-300 mt-2">Manage your events and create new ones</p>
          </div>
          <nuxt-link
            to="/events/create"
            class="mt-4 sm:mt-0 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center"
          >
            <Icon name="material-symbols:add" class="w-5 h-5 mr-2" />
            Create Event
          </nuxt-link>
        </div>

        <!-- Series Section -->
        <div class="mb-12">
          <h2 class="text-xl font-semibold text-white mb-6">Your Series</h2>
          
          <!-- Series Loading State -->
          <div v-if="isLoadingSeries" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
            <p class="text-gray-300">Loading series...</p>
          </div>

          <!-- Series Error State -->
          <div v-else-if="seriesError" class="text-center">
            <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-4 mb-4">
              {{ seriesError }}
            </div>
          </div>

          <!-- Series Grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="folder in folders" :key="folder.SK" class="bg-black/20 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6 hover:border-teal-400 transition-colors">
              <div class="relative aspect-video mb-4 rounded-lg overflow-hidden">
                <img 
                  v-if="getSeriesPosterUrl(folder)" 
                  :src="getSeriesPosterUrl(folder)" 
                  :alt="folder.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-teal-900/20 flex items-center justify-center">
                  <Icon name="material-symbols:image" class="w-12 h-12 text-teal-400/50" />
                </div>
                <ChangeFolderPreview
                  :folderName="folder.name"
                  @poster-updated="(url) => handlePosterUpdate(url, folder.name)"
                  class="absolute bottom-2 right-2"
                />
              </div>
              
              <h3 class="text-xl font-semibold text-white mb-2">{{ folder.name }}</h3>
              <p class="text-gray-300 mb-4">{{ folder.description || 'No description available' }}</p>
              
              <div class="flex justify-end space-x-3">
                <button 
                  @click="editEvent(folder)"
                  class="px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg border border-teal-900/30 hover:border-teal-400"
                >
                  Edit
                </button>
                <button 
                  @click="viewEventDetails(folder)"
                  class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="folders.length === 0" class="col-span-full text-center py-12">
              <div class="inline-block p-4 bg-black/20 rounded-full mb-4">
                <Icon name="material-symbols:folder" class="w-8 h-8 text-teal-400" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-2">No Series Yet</h3>
              <p class="text-gray-300 mb-4">Create your first series in the Manage Files section</p>
              <nuxt-link
                to="/managefiles"
                class="inline-flex items-center px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
              >
                <Icon name="material-symbols:folder" class="w-5 h-5 mr-2" />
                Go to Manage Files
              </nuxt-link>
            </div>
          </div>
        </div>

        <!-- Events Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Event Card -->
          <div v-for="event in events" :key="event.id" class="bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-teal-900/30">
            <h3 class="text-xl font-semibold text-white mb-2">{{ event.name }}</h3>
            <p class="text-gray-300 mb-4">{{ event.description }}</p>
            <div class="flex justify-between">
              <button @click="editEvent(event)" class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">Edit</button>
              <button @click="viewEventDetails(event)" class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">View Details</button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="events.length === 0" class="col-span-full text-center py-12">
            <div class="inline-block p-4 bg-black/20 rounded-full mb-4">
              <Icon name="material-symbols:event" class="w-8 h-8 text-teal-400" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">No Events Yet</h3>
            <p class="text-gray-300 mb-4">Create your first event to get started</p>
            <nuxt-link
              to="/events/create"
              class="inline-flex items-center px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Create Event
            </nuxt-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal v-if="showEditModal" @close="showEditModal = false">
      <div class="p-6 bg-black/80 rounded-lg">
        <h2 class="text-xl font-bold text-white mb-4">Edit Event Details</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              v-model="selectedEvent.name"
              type="text"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-2 text-white"
              disabled
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              v-model="selectedEvent.description"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-2 text-white"
              rows="3"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Location</label>
            <input
              v-model="selectedEvent.location"
              type="text"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-2 text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Time</label>
            <input
              v-model="selectedEvent.time"
              type="text"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-2 text-white"
            />
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              @click="showEditModal = false"
              class="px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg border border-teal-900/30 hover:border-teal-400"
            >
              Cancel
            </button>
            <button
              @click="updateEventDetails(selectedEvent)"
              class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Event Details Modal -->
    <Modal v-if="showEventDetailsModal" @close="showEventDetailsModal = false">
      <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
        <div class="max-w-7xl mx-auto">
          <!-- Header -->
          <header class="text-center mb-12 bg-transparent flex flex-col items-center">
            <h1 class="text-4xl md:text-5xl font-bold text-white mb-3 bg-transparent whitespace-nowrap">
              Event <span class="text-teal-400">Details</span>
            </h1>
            <p class="text-gray-300 text-lg bg-transparent block">
              View and manage your event information
            </p>
          </header>

          <!-- Content -->
          <div class="max-w-xl mx-auto">
            <!-- Series Preview -->
            <div class="mb-8">
              <div class="aspect-video bg-black/40 rounded-lg overflow-hidden">
                <img
                  :src="selectedEvent.seriesPosterUrl"
                  :alt="selectedEvent.name"
                  class="w-full h-full object-contain"
                />
              </div>
            </div>

            <!-- Event Details -->
            <div class="bg-black/30 backdrop-blur-sm rounded-lg border border-teal-500/30 p-6 mb-8">
              <h2 class="text-2xl font-semibold text-white mb-4">{{ selectedEvent.name }}</h2>
              <p class="text-gray-300 mb-4">{{ selectedEvent.description }}</p>
              
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <Icon name="material-symbols:location-on" class="w-5 h-5 text-teal-400" />
                  <span class="text-gray-300">{{ selectedEvent.location || 'Location not specified' }}</span>
                </div>
                
                <div class="flex items-center gap-2">
                  <Icon name="material-symbols:schedule" class="w-5 h-5 text-teal-400" />
                  <span class="text-gray-300">{{ selectedEvent.time || 'Time not specified' }}</span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="mt-6 space-y-3">
                <button 
                  @click="updateEventDetails(selectedEvent)"
                  class="w-full px-6 py-2.5 text-sm bg-teal-500/20 text-teal-300 
                         border border-teal-500/30 rounded-lg hover:bg-teal-500/30 
                         transition-all duration-300 min-w-[140px] justify-center"
                >
                  <div class="flex items-center justify-center gap-2">
                    <Icon name="heroicons:pencil-square" class="w-5 h-5" />
                    Update Details
                  </div>
                </button>

                <button 
                  @click="generateEventInviteUrl(selectedEvent)"
                  class="w-full px-6 py-2.5 text-sm bg-teal-500/20 text-teal-300 
                         border border-teal-500/30 rounded-lg hover:bg-teal-500/30 
                         transition-all duration-300 min-w-[140px] justify-center"
                >
                  <div class="flex items-center justify-center gap-2">
                    <Icon name="heroicons:link" class="w-5 h-5" />
                    Generate Invite Link
                  </div>
                </button>

                <button 
                  @click="showEventDetailsModal = false"
                  class="w-full px-6 py-2.5 text-sm bg-gray-500/20 text-gray-300 
                         border border-gray-500/30 rounded-lg hover:bg-gray-500/30 
                         transition-all duration-300 min-w-[140px] justify-center"
                >
                  <div class="flex items-center justify-center gap-2">
                    <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    Close
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useAuthStore } from "~/stores/auth";
import { useFileStore } from "~/stores/useFileStore";
import { useTaskStore } from "~/stores/TaskStore";
import { Auth } from "aws-amplify";
import ChangeFolderPreview from "~/components/ChangeFolderPreview.vue";
import Modal from '~/components/Modal.vue';

const authStore = useAuthStore();
const fileStore = useFileStore();
const taskStore = useTaskStore();
const isLoading = ref(true);
const error = ref(null);
const events = ref([]);
const folders = ref([]);
const user = ref(null);
const selectedfolderName = ref('');
const isLoadingSeries = ref(true);
const seriesError = ref(null);

// Add fields for event details
const eventDetails = ref({
  location: '',
  description: '',
  time: ''
});

// Add reactive state for modal visibility and selected event
const showEventDetailsModal = ref(false);
const selectedEvent = ref(null);

// Add new reactive state for edit modal
const showEditModal = ref(false);

const loadSeries = async () => {
  isLoadingSeries.value = true;
  seriesError.value = null;
  try {
    if (!user.value) {
      console.log('No user found, trying to get from auth store');
      if (authStore.authenticated && authStore.user) {
        user.value = authStore.user;
      } else {
        user.value = await Auth.currentAuthenticatedUser();
      }
    }
    
    console.log('Loading series for user:', user.value.attributes.email);
    await fileStore.getFiles(user.value.attributes.email);
    folders.value = fileStore.folders.filter(folder => folder.category === 'Mixed');
  } catch (error) {
    console.error("Error loading series:", error);
    seriesError.value = "Unable to load series. Please try again later.";
  } finally {
    isLoadingSeries.value = false;
  }
};

// Watch for changes in auth state
watch(() => authStore.authenticated, (newVal) => {
  console.log('Auth state changed in events/index.vue:', {
    newVal,
    user: authStore.user,
    path: window.location.pathname
  });
  
  if (newVal && authStore.user) {
    user.value = authStore.user;
    console.log('Updated local state from auth change:', {
      user: user.value
    });
    loadSeries();
  }
}, { immediate: true });

const handlePosterUpdate = async (imageUrl, folderName) => {
  try {
    if (!fileStore) {
      console.error('fileStore is undefined');
      return;
    }

    if (!Array.isArray(fileStore.folders) || fileStore.folders.length === 0) {
      return;
    }

    const folderSK = `FOLDER#Mixed#${folderName}`;
    console.log('Looking for folder:', {
      SK: folderSK,
      folderName,
      availableFolders: fileStore.folders.map(f => f.SK)
    });

    const folder = fileStore.folders.find(f => f?.SK === folderSK);
    
    if (!folder) {
      return;
    }

    folder.seriesPosterUrl = imageUrl;
  } catch (error) {
    console.error('Error updating folder preview:', {
      error,
      stack: error.stack,
      fileStore,
      folderName
    });
  }
};

const getSeriesPosterUrl = (folder) => {
  if (!folder || !folder.seriesPosterUrl) return '';
  return folder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/');
};

const generateEventInviteUrl = async (event) => {
  try {
    if (!process.client) return;
    
    const baseUrl = window.location.origin;
    const posterUrl = event.seriesPosterUrl;
    const fullUrl = `${baseUrl}/event/invite/${encodeURIComponent(event.name)}/${encodeURIComponent(event.location || '')}/${encodeURIComponent(event.description || '')}/${encodeURIComponent(event.time || '')}/${encodeURIComponent(posterUrl)}`;
    
    try {
      // Try to use taskStore if available
      if (taskStore) {
        const response = await taskStore.shortenUrl({ url: fullUrl });
        if (response && response.returnResult) {
          alert(`Event invite URL: ${response.returnResult}`);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to shorten URL, using full URL instead:', error);
    }
    
    // Fallback to full URL if shortening fails
    alert(`Event invite URL: ${fullUrl}`);
  } catch (error) {
    console.error('Error generating event invite URL:', error);
    alert('Failed to generate event invite URL: ' + error.message);
  }
};

onMounted(async () => {
  if (!process.client) return;
  
  console.log('Events page mounted - Initial auth state:', {
    authenticated: authStore.authenticated,
    user: authStore.user,
    path: window.location.pathname
  });
  
  isLoading.value = true;
  error.value = null;
  
  try {
    // First check if we already have auth state
    if (authStore.authenticated && authStore.user) {
      console.log('Using existing auth state from store:', {
        authenticated: authStore.authenticated,
        user: authStore.user
      });
      user.value = authStore.user;
      await loadSeries();
      return;
    }

    // If no auth state, try to get from AWS
    console.log('No auth state in store, checking AWS...');
    const cognitoUser = await Auth.currentAuthenticatedUser();
    
    if (cognitoUser) {
      console.log('Found Cognito user:', cognitoUser);
      // Update auth store
      authStore.authenticated = true;
      authStore.user = cognitoUser;
      
      // Update local state
      user.value = cognitoUser;
      
      console.log('Auth state updated:', {
        user: cognitoUser
      });
      
      await loadSeries();
    } else {
      console.log('No Cognito user found, checking localStorage...');
      // If no AWS user, try to initialize from localStorage
      const initialized = authStore.initializeAuth();
      console.log('LocalStorage auth initialization result:', initialized);
      
      if (!initialized) {
        console.log('No auth found anywhere, redirecting to home');
        navigateTo('/home');
      }
    }
  } catch (error) {
    console.log('Auth check error:', error);
    // Only redirect if we're not already on home
    if (process.client && window.location.pathname !== '/home') {
      console.log('Redirecting to home due to auth error');
      navigateTo('/home');
    }
  } finally {
    isLoading.value = false;
    console.log('Events page initialization complete');
  }
});

// Methods for editing and viewing event details
const editEvent = (folder) => {
  selectedEvent.value = {
    ...folder,
    location: folder.location || '',
    time: folder.time || '',
    description: folder.description || '',
    name: folder.name,
    seriesPosterUrl: getSeriesPosterUrl(folder)
  };
  showEditModal.value = true;
};

const viewEventDetails = (folder) => {
  selectedEvent.value = {
    ...folder,
    location: folder.location || '',
    time: folder.time || '',
    description: folder.description || '',
    name: folder.name,
    seriesPosterUrl: getSeriesPosterUrl(folder)
  };
  showEventDetailsModal.value = true;
};

// Add method to update event details
const updateEventDetails = async (event) => {
  try {
    if (!user.value) {
      console.error('No user found');
      return;
    }

    // Update the folder in the fileStore
    const folderSK = `FOLDER#Mixed#${event.name}`;
    const folder = fileStore.folders.find(f => f?.SK === folderSK);
    
    if (folder) {
      folder.description = event.description;
      folder.location = event.location;
      folder.time = event.time;
      
      // Update in DynamoDB
      await $fetch('/api/folders/update', {
        method: 'POST',
        body: {
          userId: user.value.attributes.email,
          folderName: event.name,
          description: event.description,
          location: event.location,
          time: event.time
        }
      });
      
      alert('Event details updated successfully');
      showEditModal.value = false; // Close the edit modal after successful update
    } else {
      throw new Error('Folder not found');
    }
  } catch (error) {
    console.error('Error updating event details:', error);
    alert('Failed to update event details: ' + error.message);
  }
};
</script> 