<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
    <div class="max-w-4xl mx-auto px-4 pt-24 pb-8 sm:px-6 lg:px-8">
      <!-- Top Bar -->
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          class="inline-flex items-center gap-2 text-gray-300 hover:text-white"
          @click="goBack"
        >
          <Icon name="heroicons:arrow-left" class="w-5 h-5" />
          Back
        </button>
        <button
          type="button"
          class="text-gray-400 hover:text-white"
          @click="goBack"
        >
          Cancel
        </button>
      </div>
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center mb-4">
          <div class="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mr-4">
            <Icon name="heroicons:user-group" class="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white">Create Talent Request</h1>
            <p class="text-gray-400">Recruit collaborators for your streaming series</p>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
        <form @submit.prevent="submitRequest" class="space-y-8">
          <!-- Basic Information -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:document-text" class="w-5 h-5 mr-2 text-teal-400" />
              Project Information
            </h2>

            <!-- Project Title -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Project Title *</label>
              <input
                v-model="form.projectTitle"
                type="text"
                required
                placeholder="Enter your project title"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Channel Selection -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Channel *</label>
              <select
                v-model="form.channel"
                required
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
              >
                <option value="" disabled>Select a channel</option>
                <option v-for="channel in userChannels" :key="channel" :value="channel">
                  {{ channel }}
                </option>
              </select>
            </div>

            <!-- Stream Type -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Type of Stream *</label>
              <select
                v-model="form.streamType"
                required
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
              >
                <option value="" disabled>Select stream type</option>
                <option value="Desktop">Desktop</option>
                <option value="IRL">IRL</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <!-- Casting Needs -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Casting Needs *</label>
              <input
                v-model="form.castingNeeds"
                type="text"
                required
                placeholder="e.g., 1 performer, interviewer + guest, on-camera model"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Stream Length -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Stream Length *</label>
              <select
                v-model="form.streamLength"
                required
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
              >
                <option value="" disabled>Select stream length</option>
                <option value="15 min">15 min</option>
                <option value="25 min">25 min</option>
                <option value="45 min">45 min</option>
                <option value="60 min">60 min</option>
              </select>
            </div>

            <!-- Location -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Location *</label>
              <input
                v-model="form.location"
                type="text"
                required
                :placeholder="form.streamType === 'Desktop' ? 'Remote' : 'Enter city or area'"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>
          </div>

          <!-- Show Concept -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:light-bulb" class="w-5 h-5 mr-2 text-teal-400" />
              Show Concept
            </h2>

            <div>
              <label class="block text-gray-300 mb-3 font-medium">Show Concept *</label>
              <textarea
                v-model="form.showConcept"
                required
                rows="6"
                placeholder="Write a compelling pitch or treatment-style paragraph describing your show concept, tone, and what you're looking for in collaborators..."
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300 resize-none"
              ></textarea>
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Tags (Optional)</label>
              <div class="flex flex-wrap gap-2 mb-3">
                <span 
                  v-for="tag in selectedTags" 
                  :key="tag"
                  class="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full text-sm flex items-center gap-2"
                >
                  {{ tag }}
                  <button 
                    @click="removeTag(tag)" 
                    type="button"
                    class="hover:text-teal-300"
                  >
                    <Icon name="heroicons:x-mark" class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tag in availableTags"
                  :key="tag"
                  @click="addTag(tag)"
                  type="button"
                  class="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm hover:bg-white/20 transition-colors"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>

            <!-- Project Poster (Upload for OG image) -->
            <div class="space-y-6">
              <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
                <Icon name="heroicons:photo" class="w-5 h-5 mr-2 text-teal-400" />
                Project Poster (used for Share image)
              </h2>

              <div>
                <label class="block text-gray-300 mb-3 font-medium">Upload Poster Image</label>
                
                <!-- Upload Area -->
                <div class="relative">
                  <!-- Drop Zone -->
                  <div 
                    @click="triggerPosterFileSelect"
                    @dragover.prevent
                    @drop.prevent="handlePosterFileDrop"
                    class="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-teal-500/50 transition-all duration-300 cursor-pointer bg-black/10 hover:bg-black/20"
                  >
                    <input
                      ref="posterFileInput"
                      type="file"
                      accept="image/*"
                      @change="handlePosterFileChange"
                      class="hidden"
                    />
                    
                    <!-- Upload Icon -->
                    <div class="mb-4">
                      <Icon name="heroicons:cloud-arrow-up" class="w-12 h-12 text-teal-400 mx-auto" />
                    </div>
                    
                    <!-- Upload Text -->
                    <div class="space-y-2">
                      <p class="text-white font-medium">Click to upload or drag and drop</p>
                      <p class="text-gray-400 text-sm">PNG or JPG recommended (1200x630)</p>
                    </div>
                  </div>
                  
                  <!-- Upload Progress -->
                  <div v-if="posterUploadProgress > 0 && posterUploadProgress < 100" class="mt-4">
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-2">
                      <span class="flex items-center gap-2">
                        <Icon name="heroicons:arrow-up-tray" class="w-4 h-4 animate-pulse" />
                        Uploading file... {{ posterUploadProgress }}%
                      </span>
                      <span class="font-medium">{{ posterUploadProgress }}%</span>
                    </div>
                    <div class="w-full bg-black/30 rounded-full h-2">
                      <div 
                        class="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        :style="{ width: Math.max(posterUploadProgress, 5) + '%' }"
                      ></div>
                    </div>
                  </div>
                  
                  <!-- Uploaded File -->
                  <div v-if="uploadedPosterFile" class="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                        <div>
                          <p class="text-green-300 font-medium">{{ uploadedPosterFile.name }}</p>
                          <p class="text-gray-400 text-sm">{{ formatFileSize(uploadedPosterFile.size) }}</p>
                        </div>
                      </div>
                      <button
                        @click="removePosterImage"
                        type="button"
                        class="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Icon name="heroicons:trash" class="w-5 h-5" />
                      </button>
                    </div>
                    <!-- Poster Preview -->
                    <div v-if="form.channelPosterUrl" class="mb-4">
                      <p class="text-gray-400 text-sm mb-2">Poster URL:</p>
                      <p class="text-teal-400 text-sm break-all">{{ form.channelPosterUrl }}</p>
                    </div>
                  </div>
                  
                  <!-- Error Message -->
                  <div v-if="posterUploadError" class="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div class="flex items-center space-x-2">
                      <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-red-400" />
                      <span class="text-red-300 text-sm">{{ posterUploadError }}</span>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          <!-- Inspiration & Moodboard -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:photo" class="w-5 h-5 mr-2 text-teal-400" />
              Inspiration & Moodboard (Optional)
            </h2>

            <!-- Inspiration Link -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Reference Link</label>
              <input
                v-model="form.inspirationLink"
                type="url"
                placeholder="https://example.com/moodboard"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Inspiration Image Upload -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Reference Image</label>
              
              <!-- Upload Area -->
              <div class="relative">
                <!-- Drop Zone -->
                <div 
                  @click="$refs.imageInput.click()"
                  @dragover.prevent
                  @drop.prevent="handleImageDrop"
                  class="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-teal-500/50 transition-all duration-300 cursor-pointer bg-black/10 hover:bg-black/20"
                >
                  <input
                    ref="imageInput"
                    type="file"
                    accept="image/*"
                    @change="handleImageUpload"
                    class="hidden"
                  />
                  
                  <!-- Upload Icon -->
                  <div class="mb-4">
                    <Icon name="heroicons:cloud-arrow-up" class="w-12 h-12 text-teal-400 mx-auto" />
                </div>
                  
                  <!-- Upload Text -->
                  <div class="space-y-2">
                    <p class="text-white font-medium">Click to upload or drag and drop</p>
                    <p class="text-gray-400 text-sm">PNG, JPG up to 10MB</p>
                  </div>
                </div>
                
                <!-- Uploaded File -->
                <div v-if="uploadedInspirationFile" class="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                      <div>
                        <p class="text-green-300 font-medium">{{ uploadedInspirationFile.name }}</p>
                        <p class="text-gray-400 text-sm">{{ formatFileSize(uploadedInspirationFile.size) }}</p>
                      </div>
                    </div>
                  <button
                    @click="removeImage"
                    type="button"
                      class="text-red-400 hover:text-red-300 transition-colors"
                  >
                      <Icon name="heroicons:trash" class="w-5 h-5" />
                  </button>
                  </div>
                  <!-- Inspiration Image Preview -->
                  <div v-if="form.inspirationImage" class="mb-4">
                    <p class="text-gray-400 text-sm mb-2">Reference Image URL:</p>
                    <p class="text-teal-400 text-sm break-all">{{ form.inspirationImage }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline & Schedule -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:calendar" class="w-5 h-5 mr-2 text-teal-400" />
              Timeline & Schedule
            </h2>

            <!-- Start Date -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Start Date *</label>
              <input
                v-model="form.startDate"
                type="date"
                required
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Shoot Window -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Shoot Window (Optional)</label>
              <input
                v-model="form.shootWindow"
                type="text"
                placeholder="e.g., Weekends only, Flexible schedule"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Time Slots -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Available Time Slots *</label>
              <div class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      v-model="form.timeSlots"
                      type="checkbox"
                      value="Morning (6AM-12PM)"
                      class="w-4 h-4 text-teal-500 bg-black/20 border-white/10 rounded focus:ring-teal-500"
                    />
                    <span class="text-white">Morning (6AM-12PM)</span>
                  </label>
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      v-model="form.timeSlots"
                      type="checkbox"
                      value="Afternoon (12PM-6PM)"
                      class="w-4 h-4 text-teal-500 bg-black/20 border-white/10 rounded focus:ring-teal-500"
                    />
                    <span class="text-white">Afternoon (12PM-6PM)</span>
                  </label>
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      v-model="form.timeSlots"
                      type="checkbox"
                      value="Evening (6PM-12AM)"
                      class="w-4 h-4 text-teal-500 bg-black/20 border-white/10 rounded focus:ring-teal-500"
                    />
                    <span class="text-white">Evening (6PM-12AM)</span>
                  </label>
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input
                      v-model="form.timeSlots"
                      type="checkbox"
                      value="Night (12AM-6AM)"
                      class="w-4 h-4 text-teal-500 bg-black/20 border-white/10 rounded focus:ring-teal-500"
                    />
                    <span class="text-white">Night (12AM-6AM)</span>
                  </label>
                </div>
                <p v-if="timeSlotsError" class="text-red-400 text-sm">{{ timeSlotsError }}</p>
              </div>
            </div>
          </div>

          <!-- Payment & Revenue -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:currency-dollar" class="w-5 h-5 mr-2 text-teal-400" />
              Payment & Revenue
            </h2>

            <div>
              <label class="block text-gray-300 mb-3 font-medium">Revenue Share / Payment (Optional)</label>
              <textarea
                v-model="form.revenueShare"
                rows="3"
                placeholder="Describe payment structure, revenue share, or compensation details..."
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300 resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Privacy Settings -->
          <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white mb-6 flex items-center">
              <Icon name="heroicons:eye" class="w-5 h-5 mr-2 text-teal-400" />
              Privacy Settings
            </h2>

            <div>
              <label class="flex items-center space-x-3 cursor-pointer">
                <input
                  v-model="form.isPublic"
                  type="checkbox"
                  class="w-4 h-4 text-teal-500 bg-black/20 border-white/10 rounded focus:ring-teal-500"
                />
                <span class="text-white">Make this request publicly viewable</span>
              </label>
              <p class="text-gray-400 text-sm mt-2">
                Public requests can be discovered by talent browsing the platform. Private requests are only accessible via direct link.
              </p>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-8">
            <button
              type="submit"
              :disabled="isSubmitting"
              class="w-full px-8 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg flex items-center justify-center gap-3"
            >
              <Icon v-if="isSubmitting" name="heroicons:arrow-path" class="w-6 h-6 animate-spin" />
              <Icon v-else name="heroicons:paper-airplane" class="w-6 h-6" />
              {{ isSubmitting ? 'Creating Request...' : 'Create Talent Request' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Success Modal -->
      <div 
        v-if="showSuccessModal" 
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        @click.self="showSuccessModal = false"
      >
        <div class="relative bg-gray-900 border border-green-500/30 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
          <button
            type="button"
            class="absolute top-3 right-3 text-gray-400 hover:text-white p-2"
            @click="showSuccessModal = false"
            aria-label="Close"
          >
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
          <div class="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:check-circle" class="w-8 h-8 text-green-400" />
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Talent Request Created!</h3>
          <p class="text-gray-300 mb-6">
            Your talent request has been created successfully. You can now share the link with potential collaborators.
          </p>
          <div class="space-y-3">
            <!-- Share Link Section - using exact same pattern as managefiles.vue -->
            <div class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
              <p class="text-gray-300 text-sm mb-2">Share Link:</p>
              <div class="flex items-center gap-2">
                <input
                  :value="shareableLink"
                  readonly
                  class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm"
                />
            <button
              @click="copyShareLink"
                  class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                         rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                  :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': showCopySuccess }"
                >
                  <Icon 
                    :name="showCopySuccess ? 'heroicons:check' : 'heroicons:clipboard'" 
                    class="w-4 h-4" 
                  />
            </button>
              </div>
            </div>
            
            <button
              @click="showSuccessModal = false"
              class="w-full px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors"
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
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/useFileStore'
import Uppy from '@uppy/core'
import Transloadit from '@uppy/transloadit'
import { useTaskStore } from '@/stores/TaskStore'

const authStore = useAuthStore()
const fileStore = useFileStore()
const router = useRouter()
const route = useRoute() // Nuxt 3 built-in composable

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/profile')
  }
}
const taskStore = useTaskStore()

// Reactive state
const isSubmitting = ref(false)
const showSuccessModal = ref(false)
const showCopySuccess = ref(false)
const timeSlotsError = ref('')
const userChannels = ref([])
const createdRequestSlug = ref('')
const lastCreated = ref(null)

// Shareable link for display (like managefiles.vue)
const shareableLink = ref('')

// Upload state
const posterUploadProgress = ref(0)
const posterUploadError = ref('')
const uploadedPosterFile = ref(null)
const uploadedInspirationFile = ref(null)

// Format file size (same as collaborator request form)
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Form data
const form = ref({
  projectTitle: '',
  channel: '',
  streamType: '',
  showConcept: '',
  castingNeeds: '',
  streamLength: '',
  location: '',
  startDate: '',
  shootWindow: '',
  timeSlots: [],
  revenueShare: '',
  inspirationLink: '',
  inspirationImage: '',
  channelPosterUrl: '',
  tags: [],
  isPublic: true
})

// Available tags
const availableTags = [
  'comedy', 'drama', 'gaming', 'interview', 'cooking', 'fitness', 'music', 
  'art', 'education', 'news', 'entertainment', 'lifestyle', 'tech', 'sports',
  'after dark', 'family friendly', 'adult content', 'interactive', 'live events'
]

const selectedTags = computed(() => form.value.tags)

// Load user channels from file store
const loadUserChannels = async () => {
  try {
    if (authStore.user?.attributes?.email) {
      // Load files and folders from the file store
      // Ensure folders are loaded (await resolves after store populates)
      await fileStore.getFiles(authStore.user.attributes.email)
      
      // Extract channel names from folders
      userChannels.value = (fileStore.folders && fileStore.folders.length)
        ? fileStore.folders.map(folder => folder.name)
        : []
    }
  } catch (error) {
    console.error('Error loading channels:', error)
    userChannels.value = []
  }
}

// Tag management
const addTag = (tag) => {
  if (!form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
  }
}

const removeTag = (tag) => {
  const index = form.value.tags.indexOf(tag)
  if (index > -1) {
    form.value.tags.splice(index, 1)
  }
}

// Inspiration image upload handler
const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      // Use EXACT same logic as collaborator request form
      const TRANSLOADIT_KEY = "be12be84f2614f06afd78081e9a529cd"
      
      // Get username from route (same as collaborator request form)
      const creatorUsername = computed(() => 
        route.params.creatorUsername || 
        authStore.user?.attributes?.username || 
        authStore.user?.attributes?.email?.split('@')[0] || 
        'unknown'
      )
      
      // Create Uppy instance for inspiration image (EXACT same config)
      const inspirationUppy = new Uppy({ 
        id: "inspiration-upload", 
        autoProceed: false, 
        debug: true 
      }).use(Transloadit, {
        params: {
          auth: { key: TRANSLOADIT_KEY },
          steps: {
            ":original": { 
              robot: "/upload/handle"
            },
            exported: {
              use: ":original",
              acl: "private", // Use EXACT same as working collaborator request form
              robot: "/s3/store",
              credentials: "twillyimages",
              path: `collaborator-requests/${creatorUsername.value}/\${file.basename}`, // Use EXACT same path as working collaborator request
              headers: {
                "Content-Type": "\${file.mime}"
              }
            },
          },
        },
      })

      // Helper function to generate proper CloudFront URL (EXACT same as collaborator request form)
      const generateCloudFrontUrl = (path) => {
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
        return `https://d3hv50jkrzkiyh.cloudfront.net/${encodedPath}` // Use EXACT same as collaborator request
      }

      // Set up EXACT same event handlers as collaborator request form
      inspirationUppy.on("upload-success", (file, response) => {
        console.log("Upload success:", file, response)
        console.log("Full response body:", response.body)
        
        // Get the CloudFront URL from the response (EXACT same as collaborator request)
        if (response.body && response.body.results && response.body.results.exported) {
          const uploadedFileResult = response.body.results.exported[0]
          console.log("Uploaded file result:", uploadedFileResult)
          console.log("Original path from Transloadit:", uploadedFileResult.path)
          
          // Use the actual path from Transloadit response (EXACT same as collaborator request)
          const cloudFrontUrl = generateCloudFrontUrl(uploadedFileResult.path)
          console.log("Generated CloudFront URL:", cloudFrontUrl)
          
          // Set success state (EXACT same as collaborator request)
          form.value.inspirationImage = cloudFrontUrl
          console.log('✅ Inspiration image uploaded and set in form:', cloudFrontUrl)
          
          // Store the file object for display
          uploadedInspirationFile.value = file
        } else {
          // Fallback if no exported results (EXACT same as collaborator request)
          console.log("No exported results, using fallback")
          // Use file name without extension to match Transloadit behavior
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
          const fallbackPath = `collaborator-requests/${creatorUsername.value}/${fileNameWithoutExt}`
          const cloudFrontUrl = generateCloudFrontUrl(fallbackPath)
          console.log("Fallback CloudFront URL:", cloudFrontUrl)
          
          form.value.inspirationImage = cloudFrontUrl
          console.log('✅ Inspiration image uploaded (fallback):', cloudFrontUrl)
          
          // Store the file object for display
          uploadedInspirationFile.value = file
        }
      })

      inspirationUppy.on("transloadit:result", (stepName, result) => {
        console.log("🔧 Inspiration Transloadit result event:", stepName, result)
        console.log("📂 Result structure:", JSON.stringify(result, null, 2))
        
        if (stepName === 'exported' && result) {
          console.log("✅ Inspiration S3 processing complete! File uploaded to S3")
          console.log("📂 S3 path:", result.path)
          
          // Use EXACT same logic as working collaborator request form
          const cloudFrontUrl = generateCloudFrontUrl(result.path)
          console.log("🌐 Final CloudFront URL:", cloudFrontUrl)
          
          // Set success state
          form.value.inspirationImage = cloudFrontUrl
          console.log('✅ Inspiration image uploaded and set in form:', cloudFrontUrl)
          
          // Store the file object for display
          uploadedInspirationFile.value = file
        }
      })

      inspirationUppy.on("upload-error", (file, error, response) => {
        console.error("Inspiration upload error:", error)
        console.error("Upload error details:", {
          file: file.name,
          error: error.message,
          response: response
        })
        alert('Failed to upload inspiration image')
      })

      inspirationUppy.on("upload-progress", (file, progress) => {
        console.log("Inspiration upload progress:", progress)
      })

      inspirationUppy.on("complete", (result) => {
        console.log("Inspiration upload complete:", result)
      })

      // Add file and upload (EXACT same as collaborator request form)
      console.log("Adding inspiration file to Uppy...")
      inspirationUppy.addFile({
        name: file.name,
        type: file.type,
        data: file
      })
      
      console.log("Starting inspiration Uppy upload...")
      inspirationUppy.upload()
      
    } catch (error) {
      console.error('Error uploading inspiration image:', error)
      alert('Failed to upload inspiration image')
    }
  }
}

const removeImage = () => {
  form.value.inspirationImage = ''
  uploadedInspirationFile.value = null
}

// Handle poster file selection manually
const handlePosterFileSelect = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      // Use EXACT same logic as collaborator request form
      const TRANSLOADIT_KEY = "be12be84f2614f06afd78081e9a529cd"
      
      // Get username from route (same as collaborator request form)
      const creatorUsername = computed(() => 
        route.params.creatorUsername || 
        authStore.user?.attributes?.username || 
        authStore.user?.attributes?.email?.split('@')[0] || 
        'unknown'
      )
      
      // Create Uppy instance for poster image (EXACT same config)
      const posterUppy = new Uppy({ 
        id: "poster-upload", 
        autoProceed: false, 
        debug: true 
      }).use(Transloadit, {
        params: {
          auth: { key: TRANSLOADIT_KEY },
          steps: {
            ":original": { 
              robot: "/upload/handle"
            },
            exported: {
              use: ":original",
              acl: "private", // Use EXACT same as working collaborator request form
              robot: "/s3/store",
              credentials: "twillyimages",
              path: `collaborator-requests/${creatorUsername.value}/\${file.basename}`, // Use EXACT same path as working collaborator request
              headers: {
                "Content-Type": "\${file.mime}"
              }
            },
          },
        },
      })

      // Helper function to generate proper CloudFront URL (EXACT same as collaborator request form)
      const generateCloudFrontUrl = (path) => {
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
        return `https://d3hv50jkrzkiyh.cloudfront.net/${encodedPath}` // Use EXACT same as collaborator request
      }

      // Set up EXACT same event handlers as collaborator request form
      posterUppy.on("upload-success", (file, response) => {
        console.log("Upload success:", file, response)
        console.log("Full response body:", response.body)
        
        // Get the CloudFront URL from the response (EXACT same as collaborator request)
        if (response.body && response.body.results && response.body.results.exported) {
          const uploadedFileResult = response.body.results.exported[0]
          console.log("Uploaded file result:", uploadedFileResult)
          console.log("Original path from Transloadit:", uploadedFileResult.path)
          
          // Use the actual path from Transloadit response (EXACT same as collaborator request)
          const cloudFrontUrl = generateCloudFrontUrl(uploadedFileResult.path)
          console.log("Generated CloudFront URL:", cloudFrontUrl)
          
          // Set success state (EXACT same as collaborator request)
          uploadedPosterFile.value = file
          form.value.channelPosterUrl = cloudFrontUrl
          posterUploadProgress.value = 100
          posterUploadError.value = ''
          console.log('✅ Poster image uploaded and set in form:', cloudFrontUrl)
        } else {
          // Fallback if no exported results (EXACT same as collaborator request)
          console.log("No exported results, using fallback")
          // Use file name without extension to match Transloadit behavior
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
          const fallbackPath = `collaborator-requests/${creatorUsername.value}/${fileNameWithoutExt}`
          const cloudFrontUrl = generateCloudFrontUrl(fallbackPath)
          console.log("Fallback CloudFront URL:", cloudFrontUrl)
          
          uploadedPosterFile.value = file
          form.value.channelPosterUrl = cloudFrontUrl
          posterUploadProgress.value = 100
          posterUploadError.value = ''
          console.log('✅ Poster image uploaded (fallback):', cloudFrontUrl)
        }
      })

      posterUppy.on("transloadit:result", (stepName, result) => {
        console.log("🔧 Transloadit result event:", stepName, result)
        console.log("📂 Result structure:", JSON.stringify(result, null, 2))
        
        if (stepName === 'exported' && result) {
          console.log("✅ S3 processing complete! File uploaded to S3")
          console.log("📂 S3 path:", result.path)
          console.log("🌐 S3 URL:", result.ssl_url)
          
          // Use the actual S3 URL from Transloadit
          const cloudFrontUrl = result.ssl_url
          console.log("🌐 Final CloudFront URL:", cloudFrontUrl)
          
          // Test the URL immediately
          fetch(cloudFrontUrl, { method: 'HEAD' })
            .then(res => {
              console.log("🔍 CloudFront URL test result:", res.status, res.statusText)
              if (res.ok) {
                console.log("✅ CloudFront URL is accessible!")
              } else {
                console.log("❌ CloudFront URL returned status:", res.status)
              }
            })
            .catch(err => {
              console.error("❌ CloudFront URL test error:", err)
            })
          
          // Set success state
          form.value.channelPosterUrl = cloudFrontUrl
          posterUploadProgress.value = 100
          posterUploadError.value = ''
          console.log('✅ Poster image uploaded and set in form:', cloudFrontUrl)
          console.log('🔍 Form channelPosterUrl after setting:', form.value.channelPosterUrl)
        }
      })

      posterUppy.on("upload-error", (file, error, response) => {
        console.error("❌ Poster upload error:", error)
        console.error("📁 Upload error details:", {
          file: file.name,
          error: error.message,
          response: response
        })
        posterUploadError.value = 'Upload failed. Please try again.'
        posterUploadProgress.value = 0
      })

      posterUppy.on("upload-progress", (file, progress) => {
        posterUploadProgress.value = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
        console.log("📊 Poster upload progress:", posterUploadProgress.value)
        console.log("📁 File being uploaded:", file.name)
        console.log("📊 Bytes uploaded:", progress.bytesUploaded, "of", progress.bytesTotal)
      })

      posterUppy.on("complete", (result) => {
        console.log("🎉 Poster upload complete:", result)
        console.log("🔍 Complete result structure:", JSON.stringify(result, null, 2))
        
        // Check if the upload actually succeeded
        if (result.successful && result.successful.length > 0) {
          console.log("✅ Upload successful, files:", result.successful)
        } else {
          console.log("❌ Upload failed or no successful files")
        }
        
        // Check Transloadit results
        if (result.transloadit && result.transloadit.length > 0) {
          const assembly = result.transloadit[0]
          console.log("🔍 Assembly status:", assembly.ok)
          console.log("🔍 Assembly results:", assembly.results)
        }
      })

      // Add file and upload (EXACT same as collaborator request form)
      console.log("Adding poster file to Uppy...")
      posterUppy.addFile({
        name: file.name,
        type: file.type,
        data: file
      })
      
      console.log("Starting poster Uppy upload...")
      posterUppy.upload()
      
    } catch (error) {
      console.error('Error uploading poster image:', error)
      posterUploadError.value = 'Upload failed. Please try again.'
      posterUploadProgress.value = 0
    }
  }
}

// Trigger poster file input
const triggerPosterFileSelect = () => {
  document.querySelector('input[type="file"][accept="image/*"]').click()
}

// Handle poster file change
const handlePosterFileChange = (event) => {
  handlePosterFileSelect(event)
}

// Handle poster file drop
const handlePosterFileDrop = (event) => {
  const file = event.dataTransfer.files[0];
  if (file) {
    handlePosterFileSelect({ target: { files: [file] } });
  }
};

// Handle inspiration image drop
const handleImageDrop = (event) => {
  const file = event.dataTransfer.files[0];
  if (file) {
    handleImageUpload({ target: { files: [file] } });
  }
};

// Form validation
const validateForm = () => {
  timeSlotsError.value = ''
  
  if (form.value.timeSlots.length === 0) {
    timeSlotsError.value = 'Please select at least one time slot'
    return false
  }
  
  return true
}

// Submit form
const submitRequest = async () => {
  if (isSubmitting.value) return
  
  // Validate form first
  if (!validateForm()) return

    isSubmitting.value = true
  
  try {
    // Check if we have uploaded files but no URLs yet
    if ((uploadedPosterFile.value && !form.value.channelPosterUrl) || 
        (uploadedInspirationFile.value && !form.value.inspirationImage)) {
      console.log('⏳ Waiting for Transloadit to complete...')
      // Wait up to 10 seconds for Transloadit to complete
      let waitCount = 0
      while (waitCount < 10 && 
             ((uploadedPosterFile.value && !form.value.channelPosterUrl) || 
              (uploadedInspirationFile.value && !form.value.inspirationImage))) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        waitCount++
        console.log(`⏳ Waited ${waitCount} seconds for Transloadit...`)
      }
      
      // If still no URLs, create fallback URLs
      if (uploadedPosterFile.value && !form.value.channelPosterUrl) {
        console.log('🚨 Creating fallback URL for poster after waiting')
        // Use the username from the route (same as the page URL)
        const routeUsername = route.params.creatorUsername || authStore.user?.attributes?.username || 'unknown'
        const fallbackPath = `collaborator-requests/${routeUsername}/${uploadedPosterFile.value.name}` // Use same path as working collaborator request
        const cloudFrontUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${fallbackPath}`
        form.value.channelPosterUrl = cloudFrontUrl
        console.log('🚨 Set fallback URL:', cloudFrontUrl)
      }
      
      if (uploadedInspirationFile.value && !form.value.inspirationImage) {
        console.log('🚨 Creating fallback URL for inspiration image after waiting')
        // Use the username from the route (same as the page URL)
        const routeUsername = route.params.creatorUsername || authStore.user?.attributes?.username || 'unknown'
        const fallbackPath = `collaborator-requests/${routeUsername}/${uploadedInspirationFile.value.name}` // Use same path as working collaborator request
        const cloudFrontUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${fallbackPath}`
        form.value.inspirationImage = cloudFrontUrl
        console.log('🚨 Set fallback URL:', cloudFrontUrl)
      }
    }

    // Debug: Show current form values
    console.log('🔍 DEBUG: Form values before validation:')
    console.log('🔍 inspirationImage:', form.value.inspirationImage)
    console.log('🔍 channelPosterUrl:', form.value.channelPosterUrl)
    console.log('🔍 uploadedPosterFile:', uploadedPosterFile.value)
    console.log('🔍 uploadedInspirationFile:', uploadedInspirationFile.value)
    console.log('🔍 Full form object:', form.value)

    // Check if images were uploaded - use both form fields and file objects
    const hasPosterImage = form.value.channelPosterUrl || uploadedPosterFile.value
    const hasInspirationImage = form.value.inspirationImage || uploadedInspirationFile.value
    
    // SIMPLE FIX: If we have uploaded files, consider it valid regardless of form fields
    const hasAnyUploadedFile = uploadedPosterFile.value || uploadedInspirationFile.value
    
    console.log('🔍 Validation check:')
    console.log('🔍 hasPosterImage:', hasPosterImage)
    console.log('🔍 hasInspirationImage:', hasInspirationImage)
    console.log('🔍 Combined check:', hasPosterImage || hasInspirationImage)
    console.log('🔍 hasAnyUploadedFile:', hasAnyUploadedFile)
    console.log('🔍 Detailed poster check:')
    console.log('🔍   - form.value.channelPosterUrl:', form.value.channelPosterUrl)
    console.log('🔍   - uploadedPosterFile.value:', uploadedPosterFile.value)
    console.log('🔍   - uploadedPosterFile.value type:', typeof uploadedPosterFile.value)
    console.log('🔍   - uploadedPosterFile.value truthy:', !!uploadedPosterFile.value)
    console.log('🔍   - hasPosterImage truthy:', !!hasPosterImage)

    if (!hasPosterImage && !hasInspirationImage && !hasAnyUploadedFile) {
      console.log('❌ Validation failed: No images found in form or file objects')
      console.log('❌ inspirationImage:', form.value.inspirationImage)
      console.log('❌ channelPosterUrl:', form.value.channelPosterUrl)
      console.log('❌ uploadedPosterFile:', uploadedPosterFile.value)
      console.log('❌ uploadedInspirationFile:', uploadedInspirationFile.value)
      alert('Please upload at least one image (Project Poster or Reference Image)')
      isSubmitting.value = false
      return
    }

    // Fetch username from DynamoDB as single source of truth
    let username = ''
    try {
      const usernameResponse = await $fetch('/api/creators/get-username', {
        method: 'POST',
        body: {
          userId: authStore.user?.attributes?.sub,
          email: authStore.user?.attributes?.email
        }
      })
      if (usernameResponse && usernameResponse.username) {
        username = usernameResponse.username
      }
    } catch (error) {
      console.error('Failed to fetch username from DynamoDB:', error)
    }
    
    // If no username from DynamoDB, fall back to auth store
    if (!username) {
      username = authStore.user?.attributes?.username || authStore.user?.attributes?.preferred_username
    }
    
    // Final safety check - ensure no @ symbols
    const safeUsername = (username || '').includes('@') ? (username || '').split('@')[0] : (username || '')

    console.log('🔍 Form data being sent:', form.value)
    console.log('🔍 inspirationImage:', form.value.inspirationImage)
    console.log('🔍 channelPosterUrl:', form.value.channelPosterUrl)

    const response = await $fetch('/api/talent-requests/create', {
      method: 'POST',
      body: {
        ...form.value,
        creatorEmail: authStore.user?.attributes?.email,
        creatorUsername: safeUsername
      }
    })

    console.log('🔍 API Response:', response)
    console.log('🔍 Form data that was sent to API:', {
      inspirationImage: form.value.inspirationImage,
      channelPosterUrl: form.value.channelPosterUrl,
      projectTitle: form.value.projectTitle,
      channel: form.value.channel
    })

    if (response.success) {
      createdRequestSlug.value = response.slug
      lastCreated.value = {
        projectTitle: form.value.projectTitle,
        channel: form.value.channel,
        channelPosterUrl: form.value.channelPosterUrl
      }
      console.log('🎉 Setting showSuccessModal to true')
      showSuccessModal.value = true
      console.log('✅ showSuccessModal value:', showSuccessModal.value)
      
      // Generate the shareable link for the modal
      await generateShareableLink()
      
      // Reset form
      form.value = {
        projectTitle: '',
        channel: '',
        streamType: '',
        showConcept: '',
        castingNeeds: '',
        streamLength: '',
        location: '',
        startDate: '',
        shootWindow: '',
        timeSlots: [],
        revenueShare: '',
        inspirationLink: '',
        inspirationImage: '',
        channelPosterUrl: '',
        tags: [],
        isPublic: true
      }
    } else {
      console.error('Error creating request:', response.message)
    }
  } catch (error) {
    console.error('Error submitting form:', error)
  } finally {
    isSubmitting.value = false
  }
}

// Generate shareable link (called when modal is shown)
const generateShareableLink = async () => {
  try {
    const baseUrl = window.location.origin
    
    // Fetch username from DynamoDB as single source of truth
    let username = ''
    try {
      const response = await $fetch('/api/creators/get-username', {
        method: 'POST',
        body: {
          userId: authStore.user?.attributes?.sub,
          email: authStore.user?.attributes?.email
        }
      })
      if (response && response.username) {
        username = response.username
      }
    } catch (error) {
      console.error('Failed to fetch username from DynamoDB:', error)
    }
    
    // If no username from DynamoDB, fall back to auth store
    if (!username) {
      username = authStore.user?.attributes?.username || authStore.user?.attributes?.preferred_username
    }
    
    // Final safety check - ensure no @ symbols
    const safeUsername = (username || '').includes('@') ? (username || '').split('@')[0] : (username || '')
    
    const channel = lastCreated.value?.channel || form.value.channel
    const titleRaw = lastCreated.value?.projectTitle || form.value.projectTitle || channel || 'Talent Request'
    const title = titleRaw
    const description = `Submit your interest in collaborating on ${titleRaw}. Share your stream concept and availability.`
    const queryParams = `title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`
    
    // Poster: uploaded poster first, then channel poster
    let posterUrl = lastCreated.value?.channelPosterUrl || form.value.channelPosterUrl || ''
    if (!posterUrl && channel) {
      try {
        const currentFolder = (fileStore.folders || []).find(f => f.name === channel)
        if (currentFolder?.seriesPosterUrl) {
          posterUrl = currentFolder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/').replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net')
        }
      } catch {}
    }

    let fullUrl = `${baseUrl}/talent-request/${safeUsername}/${channel}`
    fullUrl += posterUrl ? `?${queryParams}&poster=${encodeURIComponent(posterUrl)}` : `?${queryParams}`

    // Use the existing shortener store
    const response = await taskStore.shortenUrl({ url: fullUrl })
    const shortUrl = response?.returnResult || fullUrl
    
    // Set the shareableLink value
    shareableLink.value = shortUrl
  } catch (error) {
    console.error('Failed to generate shareable link:', error)
    shareableLink.value = 'Error generating link'
  }
}

// Copy share link - simplified to just copy the existing link (like managefiles.vue)
const copyShareLink = async () => {
  try {
    // Use the working clipboard method from managefiles.vue
    try {
      await navigator.clipboard.writeText(shareableLink.value)
      showCopySuccess.value = true
      setTimeout(() => { showCopySuccess.value = false }, 2000)
  } catch (error) {
      console.error('Error copying link:', error)
      // Fallback for older browsers/mobile - using the exact same method from managefiles.vue
      const textArea = document.createElement('textarea')
      textArea.value = shareableLink.value
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showCopySuccess.value = true
      setTimeout(() => { showCopySuccess.value = false }, 2000)
    }
    
  } catch (error) {
    console.error('Failed to copy link:', error)
    alert('Failed to copy link. Please try again.')
  }
}

// Remove poster image
const removePosterImage = () => {
  form.value.channelPosterUrl = ''
  uploadedPosterFile.value = null
}

// Load data on mount
onMounted(() => {
  try { window.scrollTo({ top: 0, behavior: 'instant' }) } catch {}
  loadUserChannels()
})
</script>

<style scoped>
/* Prevent text selection on buttons */
button {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
</style>
