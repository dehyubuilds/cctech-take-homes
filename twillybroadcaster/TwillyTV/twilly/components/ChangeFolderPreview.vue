<template>
  <div>
    <!-- Menu Poster Button -->
    <button
      @click="showDialog = true"
      class="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-teal-500/20 text-teal-300 
             border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300
             min-w-[140px] justify-center"
    >
      <Icon name="heroicons:photo" class="w-5 h-5" />
      Channel Poster
    </button>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" 
           style="z-index: 99999 !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;">
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-teal-500/30 
                    shadow-2xl shadow-teal-500/20 mx-auto 
                    transform transition-all duration-300 scale-95 hover:scale-100"
             style="width: 95vw !important; max-width: 800px !important; min-width: 320px !important; position: relative !important;">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-teal-500/20">
          <h3 class="text-xl sm:text-2xl font-bold text-white">
            Change Channel <span class="text-teal-400">Poster</span>
          </h3>
          <button 
            @click="showDialog = false"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 
                   rounded-lg transition-all duration-200"
          >
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 sm:p-6">
          <!-- Image Preview Section -->
          <div class="mb-6 sm:mb-8">
            <h4 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Preview</h4>
            <div class="aspect-video bg-black/40 rounded-xl overflow-hidden relative border border-gray-600/30" 
                 style="min-height: 200px !important; max-height: 400px !important; width: 100% !important;">
              <img
                :src="previewUrl || defaultPosterUrl"
                alt="Channel Poster Preview"
                class="w-full h-full object-cover"
                @load="isImageLoading = false"
                @error="isImageLoading = false"
              />
              <!-- Loading Overlay -->
              <div v-if="isImageLoading" 
                   class="absolute inset-0 flex items-center justify-center bg-black/60">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-teal-400 font-medium">Loading image...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- File Input -->
          <input 
            type="file" 
            @change="handleFileChange" 
            accept="image/*"
            class="hidden"
            ref="fileInput"
          />
          
          <!-- Action Buttons -->
          <div class="space-y-3 sm:space-y-4">
            <button 
              @click="$refs.fileInput.click()"
              class="w-full px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-teal-500/20 to-blue-500/20 
                     text-white border border-teal-500/40 rounded-xl hover:from-teal-500/30 hover:to-blue-500/30 
                     transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg font-medium
                     transform hover:scale-105 active:scale-95"
            >
              <Icon name="heroicons:photo" class="w-5 h-5 sm:w-6 sm:h-6" />
              Choose New Image
            </button>

            <div class="flex gap-3 sm:gap-4">
              <button 
                @click="showDialog = false"
                class="flex-1 px-4 sm:px-6 py-2 sm:py-3 text-gray-300 hover:text-white transition-all duration-200
                       border border-gray-500/40 rounded-xl hover:border-gray-400/60 hover:bg-gray-700/30
                       font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
              <button 
                @click="uploadImage"
                :disabled="!selectedFile"
                class="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-teal-500/30 to-teal-600/30 
                       text-teal-200 border border-teal-500/50 rounded-xl hover:from-teal-500/40 hover:to-teal-600/40 
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-1 sm:gap-2 font-medium text-sm sm:text-base
                       transform hover:scale-105 active:scale-95 disabled:transform-none"
              >
                <Icon name="heroicons:cloud-arrow-up" class="w-4 h-4 sm:w-5 sm:h-5" />
                Upload Poster
              </button>
            </div>
          </div>

          <!-- Status Message -->
          <div v-if="status" 
               class="mt-6 p-4 rounded-xl text-center font-medium"
               :class="status.includes('Error') 
                 ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                 : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'"
          >
            {{ status }}
          </div>
        </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { Storage, Auth } from 'aws-amplify';
import { useFileStore } from '../stores/useFileStore';
import awsExports from '~/aws-exports';

// Configure Amplify with the same settings as producer.vue
Auth.configure(awsExports);

// Configure Storage for twillyimages bucket
Storage.configure({
  AWSS3: {
    bucket: 'twillyimages',
    region: 'us-east-1'
  }
});

const props = defineProps(['folder', 'category', 'email']);
const emit = defineEmits(['updated', 'modalOpen', 'modalClose']);
const fileStore = useFileStore();

const showDialog = ref(false);
const selectedFile = ref(null);
const previewUrl = ref(null);
const status = ref('');
const isImageLoading = ref(false);

// Default poster URL
const defaultPosterUrl = 'https://d4idc5cmwxlpy.cloudfront.net/No_Image_Available.jpg';

const getCurrentPosterUrl = () => {
  console.log('Getting current poster URL for folder:', props.folder);

  // Find the folder with exact match
  const targetFolder = fileStore.folders.find(folder => {
    const folderSK = folder.SK;
    const expectedSK = `FOLDER#Mixed#${props.folder}`;
    
    console.log('Comparing:', {
      folderSK,
      expectedSK,
      matches: folderSK === expectedSK,
      folderData: folder
    });

    return folderSK === expectedSK;
  });

  console.log('Found target folder:', targetFolder);

  if (targetFolder) {
    // Handle both string and object formats for seriesPosterUrl
    const seriesPosterUrl = targetFolder.seriesPosterUrl;
    console.log('Raw seriesPosterUrl:', seriesPosterUrl);
    
    if (seriesPosterUrl) {
      // If it's an object with S property, use that, otherwise use the value directly
      const url = typeof seriesPosterUrl === 'object' ? seriesPosterUrl.S : seriesPosterUrl;
      console.log('Processed seriesPosterUrl:', url);
      
      // Ensure the URL has the public prefix
      if (url && !url.includes('public/')) {
        const parts = url.split('/');
        parts.splice(3, 0, 'public'); // Insert 'public' after the domain
        return parts.join('/');
      }
      return url;
    }
  }

  console.log('No poster found, returning default');
  return defaultPosterUrl;
};

// Update showDialog watcher to load current poster and emit events
watch(showDialog, async (newValue) => {
  if (newValue) {
    isImageLoading.value = true;
    previewUrl.value = await getCurrentPosterUrl();
    emit('modalOpen');
  } else {
    emit('modalClose');
  }
});

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }
};

const uploadImage = async () => {
  if (!selectedFile.value) return;

  try {
    status.value = 'Uploading image...';
    
    // Validate email
    if (!props.email) {
      throw new Error('Email is required to upload poster');
    }

    // Get current authenticated user
    const user = await Auth.currentAuthenticatedUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Log the props for debugging
    console.log('Uploading poster with props:', {
      email: props.email,
      folder: props.folder,
      category: 'Mixed' // Force Mixed category
    });
    
    // Construct the correct path without duplicating 'public'
    const fileName = `series-posters/${props.email}/${props.folder}/${selectedFile.value.name}`;
    console.log('Uploading to path:', fileName);
    
    // Determine content type - explicitly handle SVG files
    let contentType = selectedFile.value.type;
    if (selectedFile.value.name.toLowerCase().endsWith('.svg')) {
      contentType = 'image/svg+xml';
    } else if (!contentType || contentType === '') {
      // Fallback: detect from file extension
      const ext = selectedFile.value.name.toLowerCase().split('.').pop();
      if (ext === 'svg') contentType = 'image/svg+xml';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'gif') contentType = 'image/gif';
      else contentType = 'image/jpeg'; // Default fallback
    }
    
    console.log('Uploading with Content-Type:', contentType, 'for file:', selectedFile.value.name);
    
    // Upload to S3 using Amplify Storage with the same configuration
    const result = await Storage.put(fileName, selectedFile.value, {
      contentType: contentType,
      level: 'public',
      region: 'us-east-1',
      bucket: 'twillyimages'
    });

    console.log('Storage.put result:', result);

    status.value = 'Updating series information...';
    
    // Construct the correct CloudFront URL without 'public' prefix
    const imageUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${fileName}`;
    console.log('Generated image URL:', imageUrl);
    
    // Ensure we have a valid URL before updating
    if (!imageUrl) {
      throw new Error('Failed to generate valid image URL');
    }

    // Update DynamoDB with Mixed category
    const updateResult = await fileStore.updateFolderMetadata(
      props.email,
      props.folder,
      'Mixed', // Force Mixed category
      { seriesPosterUrl: imageUrl } // Ensure we're passing a valid URL
    );

    console.log('DynamoDB update result:', updateResult);

    // Update local preview and show loading state
    isImageLoading.value = true;
    previewUrl.value = imageUrl;

    status.value = '✓ Menu poster updated successfully!';
    
    // Emit event to refresh parent
    emit('updated', imageUrl);
    
    // Wait for image to load before closing
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        isImageLoading.value = false;
        resolve();
      };
      img.onerror = () => {
        isImageLoading.value = false;
        resolve();
      };
      img.src = imageUrl;
    });

    // Reset form but keep the previewUrl
    selectedFile.value = null;
    status.value = '';
    
    // Close dialog after image loads
    showDialog.value = false;

  } catch (error) {
    console.error('Error uploading:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    let errorMessage = 'Unknown error occurred';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code) {
      switch (error.code) {
        case 'NoSuchBucket':
          errorMessage = 'S3 bucket not found. Please check bucket configuration.';
          break;
        case 'AccessDenied':
          errorMessage = 'Access denied. Please check permissions.';
          break;
        case 'InvalidAccessKeyId':
          errorMessage = 'Invalid AWS credentials. Please check configuration.';
          break;
        default:
          errorMessage = `AWS Error: ${error.code}`;
      }
    } else if (error.toString) {
      errorMessage = error.toString();
    }
    
    status.value = `Error: ${errorMessage}`;
    isImageLoading.value = false;
  }
};
</script>