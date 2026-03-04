<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16 flex items-start justify-center">
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
          <p class="text-gray-400">Processing your request...</p>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="text-center error-message">
        <div class="bg-red-500/20 border border-red-500/30 rounded-xl p-6">
          <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p class="text-red-400 text-lg">{{ error }}</p>
        </div>
      </div>
      
      <!-- Content (only shown when loaded) -->
      <div v-else>
        <!-- Header Section -->
        <div class="mb-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2">
                <span class="text-teal-400">Collaborator</span> Request
              </h1>
              <p class="text-gray-400 text-sm sm:text-base">Submit your interest in collaborating on this channel</p>
              <div class="flex items-center gap-2 mt-2">
                <Icon name="heroicons:user-group" class="w-4 h-4 text-teal-400" />
                <span class="text-teal-300 text-sm font-medium">{{ channelId }}</span>
              </div>
            </div>
            <div class="hidden sm:block">
              <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
                <Icon name="heroicons:user-plus" class="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        <!-- Channel Image -->
        <div class="text-center mb-8">
          <div v-if="channelImageUrl && channelImageUrl !== 'https://d4idc5cmwxlpy.cloudfront.net/twilly-collab-invite-preview.png'" class="relative inline-block">
            <img 
              :src="channelImageUrl" 
              :alt="`${channelId} Channel`" 
              class="w-32 h-32 object-cover rounded-2xl border-4 border-teal-500/30 shadow-2xl"
            />
            <div class="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
              <Icon name="heroicons:video-camera" class="w-5 h-5 text-white" />
            </div>
          </div>
          <div v-else class="w-32 h-32 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl border-4 border-teal-500/30 shadow-2xl mx-auto flex items-center justify-center">
            <Icon name="heroicons:video-camera" class="w-12 h-12 text-white" />
          </div>
        </div>

        <!-- Form Section -->
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
          <div class="flex items-center mb-6">
            <div class="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:document-text" class="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 class="text-xl font-semibold text-white">Collaboration Application</h2>
              <p class="text-gray-400 text-sm">Share your stream concept and availability</p>
            </div>
          </div>
          
          <form @submit.prevent="submitRequest" class="space-y-6">
            <!-- Full Name -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Full Name *</label>
              <input
                v-model="form.fullName"
                type="text"
                required
                placeholder="Enter your full name"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Contact Information -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Contact Information *</label>
              <input
                v-model="form.contactInfo"
                type="text"
                required
                placeholder="Email, phone, or social media handle"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Stream Concept -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Stream Concept *</label>
              <textarea
                v-model="form.streamConcept"
                required
                rows="4"
                placeholder="Describe your stream concept, content type, and what you bring to the collaboration"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300 resize-none"
              ></textarea>
            </div>

            <!-- Preferred Time Slots -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Preferred Time Slots *</label>
              <div class="space-y-3">
                <div>
                  <p class="text-gray-400 text-sm mb-2">Select your preferred days:</p>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label v-for="day in days" :key="day.value" class="flex items-center">
                      <input
                        v-model="form.preferredDays"
                        type="checkbox"
                        :value="day.value"
                        class="mr-3 w-4 h-4 text-teal-500 bg-black/50 border-teal-500/30 focus:ring-teal-400"
                      />
                      <span class="text-gray-300">{{ day.label }}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <p class="text-gray-400 text-sm mb-2">Select your preferred times:</p>
                  <div class="grid grid-cols-2 gap-3">
                    <label v-for="slot in timeSlots" :key="slot.value" class="flex items-center">
                      <input
                        v-model="form.preferredTimes"
                        type="checkbox"
                        :value="slot.value"
                        class="mr-3 w-4 h-4 text-teal-500 bg-black/50 border-teal-500/30 focus:ring-teal-400"
                      />
                      <span class="text-gray-300">{{ slot.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Content Link -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Content Link *</label>
              <input
                v-model="form.contentLink"
                type="url"
                required
                placeholder="Link to your content, portfolio, or previous streams"
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
              />
            </div>

            <!-- Availability -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Availability *</label>
              <select
                v-model="form.availability"
                required
                class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none transition-all duration-300"
              >
                <option value="" disabled>Select your availability</option>
                <option v-for="option in availabilityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- Clip Upload (Optional) -->
            <div>
              <label class="block text-gray-300 mb-3 font-medium">Pilot Clip Upload (Optional)</label>
              
              <!-- Upload Area -->
              <div class="relative">
                <!-- Drop Zone -->
                <div 
                  @click="triggerFileInput"
                  @dragover.prevent
                  @drop.prevent="handleFileDrop"
                  class="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-teal-500/50 transition-all duration-300 cursor-pointer bg-black/10 hover:bg-black/20"
                >
                  <input
                    ref="fileInput"
                    type="file"
                    accept="video/mp4,video/mov,video/avi,video/quicktime"
                    @change="handleFileSelect"
                    class="hidden"
                  />
                  
                  <!-- Upload Icon -->
                  <div class="mb-4">
                    <Icon name="heroicons:cloud-arrow-up" class="w-12 h-12 text-teal-400 mx-auto" />
                  </div>
                  
                  <!-- Upload Text -->
                  <div class="space-y-2">
                    <p class="text-white font-medium">Click to upload or drag and drop</p>
                    <p class="text-gray-400 text-sm">MP4, MOV, or AVI files only (max 2GB)</p>
                  </div>
                </div>
                
                                    <!-- Upload Progress -->
        <div v-if="isUploading || (uploadProgress > 0 && uploadProgress < 100)" class="mt-4">
          <div class="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span class="flex items-center gap-2">
              <Icon name="heroicons:arrow-up-tray" class="w-4 h-4 animate-pulse" />
              {{ isUploading && uploadProgress === 0 ? 'Preparing upload...' : `Uploading file... ${uploadProgress}%` }}
            </span>
            <span class="font-medium">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-black/30 rounded-full h-2">
            <div 
              class="bg-teal-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: Math.max(uploadProgress, 5) + '%' }"
            ></div>
          </div>
        </div>
                
                <!-- Uploaded File -->
                <div v-if="uploadedFile" class="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                      <div>
                        <p class="text-green-300 font-medium">{{ uploadedFile.name }}</p>
                        <p class="text-gray-400 text-sm">{{ formatFileSize(uploadedFile.size) }}</p>
                      </div>
                    </div>
                    <button
                      @click="removeUploadedFile"
                      type="button"
                      class="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Icon name="heroicons:trash" class="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <!-- Error Message -->
                <div v-if="uploadError" class="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div class="flex items-center space-x-2">
                    <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-red-400" />
                    <span class="text-red-300 text-sm">{{ uploadError }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Submit Button -->
            <div class="pt-6">
              <button
                type="submit"
                :disabled="isSubmitting || isUploading"
                class="w-full px-8 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg flex items-center justify-center gap-3"
              >
                <Icon v-if="isSubmitting" name="heroicons:arrow-path" class="w-6 h-6 animate-spin" />
                <Icon v-else-if="isUploading" name="heroicons:cloud-arrow-up" class="w-6 h-6 animate-spin" />
                <Icon v-else name="heroicons:paper-airplane" class="w-6 h-6" />
                {{ isSubmitting ? 'Submitting...' : isUploading ? 'Uploading Video...' : 'Submit Request' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Success Message -->
        <div v-if="showSuccess" class="bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg p-6 mt-8">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:check-circle" class="w-6 h-6" />
            <span class="text-lg font-medium">Request submitted successfully!</span>
          </div>
          <p class="mt-2 text-green-200">The channel owner will review your application and contact you soon.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeMount } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import Uppy from '@uppy/core'
import Transloadit from '@uppy/transloadit'

import collabInvite from "@/assets/twilly-collab-invite.png"



const route = useRoute()

// Route parameters
const creatorUsername = route.params.creatorUsername
const channelId = route.params.channelId



// Reactive state
const isLoading = ref(true)
const isSubmitting = ref(false)
const showSuccess = ref(false)
const error = ref('')
const channelInfo = ref(null)

// Upload state
const uploadProgress = ref(0)
const uploadedFile = ref(null)
const uploadError = ref('')
const fileInput = ref(null)
const isUploading = ref(false)
const uploadCompleted = ref(false)

// Form data
const form = ref({
  fullName: '',
  contactInfo: '',
  streamConcept: '',
  preferredDays: [],
  preferredTimes: [],
  contentLink: '',
  clipFile: null,
  clipUrl: '', // Store the uploaded clip URL
  availability: ''
})

// Time slot options
const days = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
]

const timeSlots = [
  { value: 'morning', label: 'Morning (6AM-12PM)' },
  { value: 'afternoon', label: 'Afternoon (12PM-6PM)' },
  { value: 'evening', label: 'Evening (6PM-12AM)' },
  { value: 'night', label: 'Night (12AM-6AM)' }
]

const availabilityOptions = [
  { value: 'this_week', label: 'This week' },
  { value: 'next_week', label: 'Next week' },
  { value: 'tbd', label: 'To be determined' }
]

// Get meta info from route query parameters (like collaborator invite)
const posterUrl = route.query.poster ? decodeURIComponent(route.query.poster) : ''
const titleFromQuery = route.query.title ? decodeURIComponent(route.query.title) : ''
const descriptionFromQuery = route.query.description ? decodeURIComponent(route.query.description) : ''
const creatorFromQuery = route.query.creator ? decodeURIComponent(route.query.creator) : ''

// SEO and meta tags
const title = ref(titleFromQuery ? `Collaborator Request - ${titleFromQuery} | Twilly` : `Collaborator Request - ${channelId} | Twilly`)
const description = ref(descriptionFromQuery || `Submit your interest in collaborating on the ${channelId} channel. Share your stream concept and availability.`)

// Channel image URL - use poster from query params or fallback
// Check if poster is the default Twilly icon and try to fetch actual channel poster
let channelImageUrl = posterUrl || 'https://d4idc5cmwxlpy.cloudfront.net/twilly-collab-invite-preview.png'

// If poster is the default Twilly icon, try to fetch the actual channel poster
if (posterUrl && (posterUrl.includes('icon-512.png') || posterUrl === '/assets/channels/icon-512.png')) {
  // Try to fetch actual channel poster
  try {
    const response = await $fetch('/api/channels/get-poster', {
      method: 'POST',
      body: {
        channelName: channelId,
        creatorUsername: creatorFromQuery || creatorUsername
      }
    });
    
    if (response.success && response.posterUrl && !response.posterUrl.includes('icon-512.png')) {
      channelImageUrl = response.posterUrl;
    }
  } catch (error) {
    console.error('Error fetching actual channel poster:', error);
  }
}

useHead({
  title: title.value,
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: description.value,
    },
    {
      hid: 'og:title',
      property: 'og:title',
      content: title.value,
    },
    {
      hid: 'og:description',
      property: 'og:description',
      content: description.value,
    },
    {
      hid: 'og:image',
      property: 'og:image',
      content: channelImageUrl,
    },
    {
      hid: 'og:image:width',
      property: 'og:image:width',
      content: '1200',
    },
    {
      hid: 'og:image:height',
      property: 'og:image:height',
      content: '630',
    },
    {
      hid: 'og:image:type',
      property: 'og:image:type',
      content: 'image/png',
    },
    {
      hid: 'og:image:alt',
      property: 'og:image:alt',
      content: title.value,
    },
    {
      hid: 'og:type',
      property: 'og:type',
      content: 'website',
    },
    {
      hid: 'og:url',
      property: 'og:url',
      content: `https://twilly.com${route.fullPath}`,
    },
    {
      hid: 'twitter:card',
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      hid: 'twitter:title',
      name: 'twitter:title',
      content: title.value,
    },
    {
      hid: 'twitter:description',
      name: 'twitter:description',
      content: description.value,
    },
    {
      hid: 'twitter:image',
      name: 'twitter:image',
      content: channelImageUrl,
    },
  ],
})

// Validate channel and creator
const validateRequest = async () => {
  try {
    const response = await $fetch('/api/collaborations/validate-request', {
      method: 'POST',
      body: {
        channelId,
        creatorUsername
      }
    })

    if (response.success) {
      channelInfo.value = response.channel
      return true
    } else {
      error.value = response.message || 'Invalid collaboration request'
      return false
    }
  } catch (err) {
    console.error('Validation error:', err)
    error.value = 'Failed to validate request'
    return false
  }
}

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// File upload functions
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
}

const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file) {
    processFile(file)
  }
}

// Transloadit configuration (using same approach as UploadChannel.vue)
const TRANSLOADIT_KEY = "be12be84f2614f06afd78081e9a529cd"

// Assembly options (same pattern as UploadChannel.vue)
const assemblyOptions = ref({
  params: {
    auth: { key: TRANSLOADIT_KEY },
    steps: {
      ":original": { 
        robot: "/upload/handle"
      },
      exported: {
        use: ":original",
        acl: "private",
        robot: "/s3/store",
        credentials: "twillyimages",
        path: `collaborator-requests/${creatorUsername}/\${file.basename}`,
        headers: {
          "Content-Type": "\${file.mime}"
        }
      },
    },
  },
})

// Initialize Uppy with Transloadit (same pattern as UploadChannel.vue)
const uppy = new Uppy({ 
  id: "collaborator-upload", 
  autoProceed: false, 
  debug: true 
}).use(Transloadit, {
  params: assemblyOptions.value.params,
})

console.log("Uppy initialized with Transloadit config:", assemblyOptions.value.params)

// Helper function to generate proper CloudFront URL
const generateCloudFrontUrl = (path) => {
  // Use the path as-is from Transloadit response
  // Don't add extensions - let Transloadit handle the file name
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  return `https://d3hv50jkrzkiyh.cloudfront.net/${encodedPath}`
}

// Set up Uppy event listeners
uppy.on("upload-success", (file, response) => {
  console.log("Upload success:", file, response)
  console.log("Full response body:", response.body)
  
  // Get the CloudFront URL from the response
  if (response.body && response.body.results && response.body.results.exported) {
    const uploadedFileResult = response.body.results.exported[0]
    console.log("Uploaded file result:", uploadedFileResult)
    console.log("Original path from Transloadit:", uploadedFileResult.path)
    
    // Use the actual path from Transloadit response
    const cloudFrontUrl = generateCloudFrontUrl(uploadedFileResult.path)
    console.log("Generated CloudFront URL:", cloudFrontUrl)
    
    // Test the URL immediately
    fetch(cloudFrontUrl, { method: 'HEAD' })
      .then(res => console.log("CloudFront URL test result:", res.status, res.statusText))
      .catch(err => console.error("CloudFront URL test error:", err))
    
    // Set success state
    uploadedFile.value = file
    form.value.clipUrl = cloudFrontUrl
    uploadProgress.value = 100
    uploadCompleted.value = true
    isUploading.value = false
    uploadError.value = '' // Clear any errors
  } else {
    // Fallback if no exported results
    console.log("No exported results, using fallback")
    // Use file name without extension to match Transloadit behavior
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
    const fallbackPath = `collaborator-requests/${creatorUsername}/${fileNameWithoutExt}`
    const cloudFrontUrl = generateCloudFrontUrl(fallbackPath)
    console.log("Fallback CloudFront URL:", cloudFrontUrl)
    
    uploadedFile.value = file
    form.value.clipUrl = cloudFrontUrl
    uploadProgress.value = 100
    uploadCompleted.value = true
    isUploading.value = false
    uploadError.value = ''
  }
})

uppy.on("upload-error", (file, error, response) => {
  console.error("Upload error:", error)
  console.error("Upload error details:", {
    file: file.name,
    error: error.message,
    response: response
  })
  
  // More specific error messages
  if (error.message && error.message.includes('network')) {
    uploadError.value = 'Network error. Please check your connection and try again.'
  } else if (error.message && error.message.includes('size')) {
    uploadError.value = 'File too large. Please select a smaller file.'
  } else if (error.message && error.message.includes('type')) {
    uploadError.value = 'Invalid file type. Please select MP4, MOV, or AVI files only.'
  } else {
    uploadError.value = 'Upload failed. Please try again.'
  }
  
  uploadProgress.value = 0
  isUploading.value = false
})

uppy.on("file-added", (file) => {
  console.log("File added to upload queue:", file)
  // Show that file is being prepared
  uploadProgress.value = 0
  uploadError.value = ''
})

uppy.on("upload-progress", (file, progress) => {
  console.log("Upload progress:", progress)
  console.log("Progress details:", {
    percentage: progress.percentage,
    bytesUploaded: progress.bytesUploaded,
    bytesTotal: progress.bytesTotal
  })
  
  // Show actual upload progress with proper validation
  if (progress.percentage && !isNaN(progress.percentage)) {
    uploadProgress.value = Math.round(progress.percentage)
  } else if (progress.bytesUploaded && progress.bytesTotal) {
    // Calculate percentage manually if percentage is not available
    const calculatedPercentage = (progress.bytesUploaded / progress.bytesTotal) * 100
    uploadProgress.value = Math.round(calculatedPercentage)
  } else {
    // Fallback to a small increment
    uploadProgress.value = Math.min(uploadProgress.value + 5, 95)
  }
})

uppy.on("complete", (result) => {
  console.log("Upload complete:", result)
  // Ensure UI is updated even if individual success handlers don't fire
  if (result.successful.length > 0) {
    isUploading.value = false
    uploadProgress.value = 100
    uploadCompleted.value = true
  }
})

const processFile = async (file) => {
  console.log("Processing file:", {
    name: file.name,
    type: file.type,
    size: file.size,
    creatorUsername: creatorUsername
  })
  
  // Reset states
  uploadError.value = ''
  uploadProgress.value = 0
  
  // Validate file size (2GB limit)
  const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
  if (file.size > maxSize) {
    uploadError.value = 'File size must be less than 2GB'
    console.error("File too large:", file.size, "max:", maxSize)
    return
  }
  
  // Validate file type
  const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
  if (!allowedTypes.includes(file.type)) {
    uploadError.value = 'Only MP4, MOV, and AVI files are allowed'
    console.error("Invalid file type:", file.type, "allowed:", allowedTypes)
    return
  }
  
  try {
    // Set upload state
    isUploading.value = true
    uploadError.value = ''
    uploadProgress.value = 0 // Start at 0 for actual upload progress
    
    console.log("Adding file to Uppy...")
    
    // Add file to Uppy and start upload
    uppy.addFile({
      name: file.name,
      type: file.type,
      data: file,
      meta: {
        creatorUsername: creatorUsername
      }
    })
    
    console.log("Starting Uppy upload...")
    
    // Start the upload
    uppy.upload()
    
  } catch (err) {
    console.error('Upload error:', err)
    uploadError.value = 'Failed to upload file. Please try again.'
    uploadProgress.value = 0
    isUploading.value = false
  }
}



const removeUploadedFile = () => {
  uploadedFile.value = null
  form.value.clipUrl = ''
  uploadProgress.value = 0
  uploadError.value = ''
  isUploading.value = false
  uploadCompleted.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Submit request
const submitRequest = async (event) => {
  // Prevent default form submission to avoid mobile navigation
  event.preventDefault()
  
  // Validate form before allowing upload
  if (form.value.preferredDays.length === 0 || form.value.preferredTimes.length === 0) {
    error.value = 'Please select at least one preferred day and one preferred time'
    // Scroll to error message
    nextTick(() => {
      const errorElement = document.querySelector('.error-message')
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    // Submit the request with the clip URL (Uppy handles uploads automatically)
    const requestData = {
      channelId,
      creatorUsername,
      fullName: form.value.fullName,
      contactInfo: form.value.contactInfo,
      streamConcept: form.value.streamConcept,
      preferredTimeSlots: [...form.value.preferredDays, ...form.value.preferredTimes],
      contentLink: form.value.contentLink,
      availability: form.value.availability,
      clipUrl: form.value.clipUrl || ''
    }

    const response = await $fetch('/api/collaborations/submit-request', {
      method: 'POST',
      body: requestData
    })

    if (response.success) {
      showSuccess.value = true
      // Reset form and upload state
      form.value = {
        fullName: '',
        contactInfo: '',
        streamConcept: '',
        preferredDays: [],
        preferredTimes: [],
        contentLink: '',
        clipFile: null,
        clipUrl: '',
        availability: ''
      }
      // Clear upload state
      uploadedFile.value = null
      uploadProgress.value = 0
      uploadError.value = ''
      
      // Auto-clear success message after 1 second
      setTimeout(() => {
        showSuccess.value = false
      }, 1000)
    } else {
      error.value = response.message || 'Failed to submit request'
    }
  } catch (err) {
    console.error('Submission error:', err)
    error.value = 'Failed to submit request. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

// Initialize
onMounted(async () => {
  // Force show the form for testing preview image
  isLoading.value = false
  
  try {
    const isValid = await validateRequest()
    if (!isValid) {
      // Show error message but keep form visible
      error.value = 'Channel validation failed, but you can still submit a request.'
    }
  } catch (error) {
    console.error('Validation error:', error)
    error.value = 'Channel validation failed, but you can still submit a request.'
  }
})

// Also clear error on route change
watch(() => route.params, () => {
  error.value = ''
  showSuccess.value = false
}, { immediate: true })

// Clear error on component mount
onBeforeMount(() => {
  error.value = ''
  showSuccess.value = false
})
</script>

<style scoped>
/* Custom styles for the form */
input[type="checkbox"]:checked {
  background-color: #00d4aa;
  border-color: #00d4aa;
}

input[type="radio"]:checked {
  background-color: #00d4aa;
  border-color: #00d4aa;
}

/* Smooth transitions */
.transition-all {
  transition: all 0.3s ease;
}

/* Responsive design */
@media (max-width: 768px) {
  .text-4xl {
    font-size: 2rem;
  }
  
  .text-5xl {
    font-size: 2.5rem;
  }
  
  .text-6xl {
    font-size: 3rem;
  }
}


</style> 