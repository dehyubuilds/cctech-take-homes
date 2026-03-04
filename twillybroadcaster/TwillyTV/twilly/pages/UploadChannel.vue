<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Dashboard, DashboardModal, DragDrop, ProgressBar } from "@uppy/vue";
import Uppy from "@uppy/core";
import Transloadit from "@uppy/transloadit";
import { Auth } from "aws-amplify";
import { useFileStore } from '~/stores/useFileStore';
import { useAuthStore } from '~/stores/auth';
import { storeToRefs } from 'pinia';

const TRANSLOADIT_KEY = "be12be84f2614f06afd78081e9a529cd"
const authStore = useAuthStore();
const fileStore = useFileStore();
const { folders } = storeToRefs(fileStore);
const selectedFolder = ref('default');
const isLoading = ref(true);
const error = ref(null);

// Initialize auth state on mount
onMounted(async () => {
  try {
    // First check if we already have auth state
    if (authStore.authenticated && authStore.user) {
      console.log('Using existing auth state:', {
        isAuthenticated: authStore.authenticated,
        user: authStore.user
      });
      await initializeUploadChannel();
      isLoading.value = false;
      return;
    }

    // If no auth state, try to get from AWS
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      console.log('Cognito User:', user);
      // Check if user has email in attributes or username
      const isProducer = user?.attributes?.email || user?.username?.includes('@');
      if (isProducer) {
        authStore.authenticated = true;
        authStore.user = user;
        authStore.userType = 'producer';
        console.log('User is a producer');
        await initializeUploadChannel();
      } else {
        authStore.authenticated = true;
        authStore.user = user;
        authStore.userType = 'regular';
        console.log('User is a regular user');
        await initializeUploadChannel();
      }
    } else {
      // If no AWS user, try to initialize from localStorage
      await authStore.initializeAuth();
      if (authStore.authenticated && authStore.user) {
        await initializeUploadChannel();
      }
    }
  } catch (error) {
    console.log('No authenticated user found');
    // Try to initialize from localStorage
    await authStore.initializeAuth();
    if (authStore.authenticated && authStore.user) {
      await initializeUploadChannel();
    }
  } finally {
    isLoading.value = false;
  }
});

// Watch for auth state changes
watch(() => authStore.authenticated, (newVal) => {
  if (!newVal && !isLoading.value) {
    // Only redirect if we're sure the user is not authenticated
    navigateTo('/home');
  }
}, { immediate: true });

const initializeUploadChannel = async () => {
  try {
    // Fetch folders first
    await fileStore.getFiles(authStore.user.attributes.email);

    uppy1.setMeta({
      schedulerId: authStore.user.attributes.email,
    });

    uppy1.on("upload-success", (file, response) => {
      console.log("Upload success:", file, response);
    });

    uppy1.on("file-added", (file) => {
      console.log('File added:', file);
      currentFileType.value = "Mixed";  // Always set to Mixed
      console.log('Current file type set to:', currentFileType.value);
      
      const isVideo = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/webm'].includes(file.type);
      
      // Always include category for default folder
      const folderPath = selectedFolder.value === 'default'
        ? `${authStore.user.attributes.email}/mixed`
        : `${authStore.user.attributes.email}/${selectedFolder.value}`;

      if (isVideo) {
        assemblyOptions.value.params.steps.exported.use = [":original", "video_thumbed"];
        assemblyOptions.value.params.steps.exported.path = 
          `${authStore.user.attributes.email}/videos/thumbnails/\${file.url_name}`;
      } else {
        assemblyOptions.value.params.steps.exported.use = [":original"];
        assemblyOptions.value.params.steps.exported.path = 
          `${folderPath}/\${file.url_name}`;
      }

      file.meta = {
        ...file.meta,
        folder: selectedFolder.value,
        path: isVideo 
          ? `${authStore.user.attributes.email}/videos/thumbnails` 
          : folderPath,
        isVideo
      };

      uppy1.setFileMeta(file.id, {
        ...file.meta,
        schedulerId: authStore.user.attributes.email
      });
    });

    uppy1.on("file-removed", () => {
      // Reset current file type when file is removed
      currentFileType.value = null;
    });

    uppy1.on("complete", (result) => {
      console.log(
        "Upload complete! We've uploaded these files:",
        result.successful
      );
    });
  } catch (error) {
    console.error("Error initializing upload channel:", error);
    error.value = "Unable to initialize upload channel. Please try again later.";
  }
};

const assemblyOptions = ref({
  params: {
    auth: { key: TRANSLOADIT_KEY },
    steps: {
      ":original": { 
        robot: "/upload/handle"
      },
      video_thumbed: {
        use: ":original",
        robot: "/video/thumbs",
        result: true,
        background: "#000000",
        ffmpeg_stack: "v6.0.0",
        resize_strategy: "fit",
        format: "gif",
        count: 1,
        offset: 1
      },
      exported: {
        use: [":original", "video_thumbed"],
        acl: "private",
        robot: "/s3/store",
        credentials: "twillyinputbucket",
        path: "",
      },
    },
  },
});

const uppy1 = 
  new Uppy({ id: "uppy1", autoProceed: false, debug: true }).use(Transloadit, {
    params: assemblyOptions.value.params,
  })
;

const data = ref({
  open: false,
  showInlineDashboard: false,
});

// Computed properties for category-specific folders
const videoFolders = computed(() => 
  fileStore.categoryFolders('Videos').filter(folder => folder.name !== 'thumbnails')
);

const imageFolders = computed(() => 
  fileStore.categoryFolders('Images').filter(folder => folder.name !== 'thumbnails')
);

const audioFolders = computed(() => 
  fileStore.categoryFolders('Audios')
);

const docFolders = computed(() => 
  fileStore.categoryFolders('Docs')
);

// Helper function to determine file category (same as Lambda)
const determineCategory = (mimeType) => {
  const videoTypes = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/webm'];
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
  const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  
  if (videoTypes.includes(mimeType)) return 'Videos';
  if (imageTypes.includes(mimeType)) return 'Images';
  if (audioTypes.includes(mimeType)) return 'Audios';
  if (docTypes.includes(mimeType)) return 'Docs';
  return 'Other';
};

// Track current file type
const currentFileType = ref(null);

// Add a watch for selectedFolder changes
watch(selectedFolder, () => {
  if (uppy1.getFiles().length > 0) {
    const file = uppy1.getFiles()[0];
    const isVideo = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/webm'].includes(file.type);
    const category = "Mixed";  // Hardcode to Mixed
    
    // Always include category for default folder
    const folderPath = selectedFolder.value === 'default'
      ? `${authStore.user.attributes.email}/${category.toLowerCase()}`
      : `${authStore.user.attributes.email}/${selectedFolder.value}`;

    assemblyOptions.value.params.steps.exported.path = isVideo
      ? `${authStore.user.attributes.email}/videos/thumbnails/\${file.url_name}`
      : `${folderPath}/\${file.url_name}`;

    uppy1.setFileMeta(file.id, {
      ...file.meta,
      folder: selectedFolder.value,
      path: isVideo 
        ? `${authStore.user.attributes.email}/videos/thumbnails`
        : folderPath,
      isVideo,
      schedulerId: authStore.user.attributes.email
    });
  }
});

const handleClose = () => {
  data.value.open = false;
};

const handleFileAdded = () => {
  data.value.showInlineDashboard = true;
};

// Computed property to get available folders based on current file type
const availableFolders = computed(() => {
  if (!currentFileType.value) return [];
  if (!folders.value) {
    return [];
  }
  
  const mixedFolders = folders.value
    .filter(folder => folder.category === 'Mixed' && folder.name !== 'thumbnails')
    .sort((a, b) => a.name.localeCompare(b.name));
    
  return mixedFolders;
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-3xl mx-auto">
      <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-8 mx-auto">
        <header class="text-center mb-12 bg-transparent">
          <div class="mb-3 bg-transparent">
            <h1 class="text-4xl md:text-5xl font-bold text-white bg-transparent">
              Upload <span class="text-teal-400">Files</span>
            </h1>
            <p class="text-gray-300 text-lg bg-transparent mt-2">Upload and manage your content</p>
          </div>
        </header>

        <!-- Folder Selection -->
        <div class="mb-6">
          <label class="block text-white text-sm font-medium mb-2">Upload to Menu</label>
          <select 
            v-model="selectedFolder"
            class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white outline-teal-500"
            :disabled="!currentFileType"
          >
            <option value="default">Default Menu</option>
            <!-- Show Mixed category folders -->
            <option v-for="folder in availableFolders" 
                    :key="folder.SK" 
                    :value="folder.name">
              {{ folder.name }}
            </option>
          </select>
          <p v-if="!currentFileType" class="text-gray-400 text-sm mt-1">
            Add a file to see available menus
          </p>
          <p v-else-if="availableFolders.length === 0" class="text-gray-400 text-sm mt-1">
            No Mixed menus available
          </p>
        </div>

        <!-- Dashboard -->
        <div class="max-w-xl mx-auto">
          <Dashboard
            :uppy="uppy1"
            :props="{
              metaFields: [{ id: 'name', name: 'Name', placeholder: 'File name' }],
              theme: 'dark'
            }"
            class="uppy-dashboard"
          />
          <!-- Add Upload Button -->
          <div class="text-center mt-6">
            <button 
              @click="uppy1.upload()"
              class="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Upload Files
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="@uppy/core/dist/style.css"></style>
<style src="@uppy/dashboard/dist/style.css"></style>
<style src="@uppy/drag-drop/dist/style.css"></style>
<style src="@uppy/progress-bar/dist/style.css"></style>

<style>
@import url("~/assets/css/reminders.css");

/* Apply styles to the Dashboard component */
.uppy-dashboard {
  width: 100%; /* Set the width to 100% */
  max-width: 600px; /* Set a maximum width if needed */
}

/* Apply styles to specific elements within the Dashboard component */
.uppy-dashboard .uppy-Root {
  /* Add your styles here */
}

/* Optional: Add some styles to the drag-drop area */
#drag-drop-area {
  border: 2px dashed #ccc;
  padding: 20px;
  cursor: pointer;
}

/* Glass morphism and theme styles */
:deep(.uppy-Dashboard-inner) {
  @apply bg-black/20 backdrop-blur-sm border border-teal-900/30;
}

:deep(.uppy-Dashboard-dropzone) {
  @apply border-2 border-dashed border-teal-500/30 hover:border-teal-400/50;
}

:deep(.uppy-Dashboard-browse) {
  @apply text-teal-400 hover:text-teal-300;
}

:deep(.uppy-Dashboard-Item-previewInnerWrap) {
  @apply bg-black/40 backdrop-blur-sm;
  object-fit: contain !important;
}

:deep(.uppy-Dashboard-Item-previewImg) {
  object-fit: contain !important;
  width: 100%;
  height: 100%;
}

:deep(.uppy-Dashboard-Item) {
  @apply bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg;
}

:deep(.uppy-Dashboard-Item-name) {
  @apply text-white/90;
}

:deep(.uppy-Dashboard-Item-statusSize) {
  @apply text-teal-400/80;
}

:deep(.uppy-Dashboard-Item-action) {
  @apply text-teal-400 hover:text-teal-300;
}

:deep(.uppy-Dashboard-AddFiles) {
  @apply border-2 border-dashed border-teal-500/30 hover:border-teal-400/50;
}

:deep(.uppy-Dashboard-FileCard) {
  @apply bg-black/80 backdrop-blur-md;
}

:deep(.uppy-Dashboard-FileCard-inner) {
  @apply bg-transparent;
}

/* Add styles for the select optgroups */
select optgroup {
  @apply bg-gray-900;
}

select option {
  @apply bg-black/20 text-white py-1;
}
</style>