<template>
  <div>
    <!-- Container with improved responsive layout -->
    <div class="flex flex-col sm:flex-row gap-2 justify-center items-center p-2">
      <!-- Change Preview Button -->
      <button @click="openPreviewDialog" class="action-btn preview-btn">
        <span class="flex items-center gap-2">
          <Icon name="heroicons:photo" class="w-5 h-5" />
          Change Preview
        </span>
      </button>

      <!-- Share Button -->
      <button @click="openDialog" class="action-btn share-btn">
        <span class="flex items-center gap-2">
          <Icon name="heroicons:share" class="w-5 h-5" />
          Share {{ updateCategory }}
        </span>
      </button>
    </div>

    <!-- Share Dialog -->
    <ShareDialog v-if="showDialog" @close="closeDialog">
      <template #title>
        <div class="flex items-center gap-2 text-xl font-semibold text-gray-800">
          <Icon name="heroicons:link" class="w-6 h-6 text-teal-500" />
          Share File
        </div>
      </template>
      <template #body>
        <div class="flex flex-col gap-4 p-4">
          <div class="relative">
            <input 
              type="text" 
              readonly 
              :value="newLink"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-b-lg">
          <button
            @click="copyToClipboard"
            class="action-btn copy-btn"
          >
            <span class="flex items-center gap-2">
              <Icon :name="buttonClicked ? 'heroicons:check' : 'heroicons:clipboard'" class="w-5 h-5" />
              {{ buttonClicked ? 'Copied!' : 'Copy Link' }}
            </span>
          </button>
        </div>
      </template>
    </ShareDialog>

    <!-- Preview Dialog -->
    <ShareDialog v-if="showPreviewDialog" @close="closePreviewDialog">
      <template #title>
        <div class="flex items-center gap-2 text-xl font-semibold text-gray-800">
          <Icon name="heroicons:photo" class="w-6 h-6 text-teal-500" />
          Change Preview Image
        </div>
      </template>
      <template #body>
        <div class="flex flex-col gap-6 p-4">
          <!-- Preview Image -->
          <div class="preview-container">
            <img :src="previewImage" alt="Preview" class="preview-image" />
          </div>
          <!-- File Upload -->
          <div class="upload-container">
            <label class="file-input-label">
              <input type="file" @change="handleFileChange" class="hidden" accept="image/*" />
              <span class="flex items-center gap-2">
                <Icon name="heroicons:cloud-arrow-up" class="w-5 h-5" />
                Choose Image
              </span>
            </label>
            <span v-if="selectedFile" class="text-sm text-gray-600 mt-2">
              {{ selectedFile.name }}
            </span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-b-lg">
          <button
            @click="uploadToS3"
            class="action-btn upload-btn"
            :disabled="!selectedFile"
          >
            <span class="flex items-center gap-2">
              <Icon name="heroicons:arrow-up-tray" class="w-5 h-5" />
              Upload Image
            </span>
          </button>
          <span v-if="uploadStatus" class="text-sm" :class="uploadStatus.includes('successful') ? 'text-green-600' : 'text-red-600'">
            {{ uploadStatus }}
          </span>
        </div>
      </template>
    </ShareDialog>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Auth, Storage, Amplify } from "aws-amplify";
import awsmobile from "~/aws-exports";
import { useTaskStore } from "~/stores/TaskStore";
const taskStore = useTaskStore();

Amplify.configure(awsmobile);

Storage.configure({
  bucket: awsmobile.s3.bucket,
  region: awsmobile.s3.region,
});

const props = defineProps(["url", "title", "description", "price", "category","fileId","previewImageUrl", "email", "noCoverPreview", "folderName"]);
const showPreviewDialog = ref(false);
const showDialog = ref(false);
const showShareDialog = ref(false);
const updateCategory = ref(props.category);
const uploadStatus = ref("");
const buttonClicked = ref(false);
const selectedFile = ref(null);
const newLink = ref('');
const previewImageUrl = ref('')



const user = ref(null); 
const fileId = ref(null); // Define fileId variable

// Get current authenticated user
Auth.currentAuthenticatedUser().then((authUser) => {
  user.value = authUser;
});

// Function to replace video extensions with .gif
const replaceVideoExtensionWithGif = (url) => {
  return url.replace(/\.(mp4|mov|avi|mkv|flv)$/i, ".gif");
};

// Initialize previewImage with the transformed props.url
const previewImage = ref(
  props.previewImageUrl && props.previewImageUrl !== ""
    ? props.previewImageUrl
    : props.url
    ? /\.(mp4|mov|avi|mkv|flv)$/i.test(props.url)
      ? 'https://d4idc5cmwxlpy.cloudfront.net/0731.gif'
      : props.url
    : ""
);

const openDialog = async () => {
  if (props.url && props.category && props.email.username) {
    if (!props.previewImageUrl) {
      previewImageUrl.value = props.noCoverPreview;
    } else {
      previewImageUrl.value = props.previewImageUrl;
    }
    
    // Make sure to await the constructShareableLink function
    try {
      newLink.value = await constructShareableLink(
        props.email.username,
        props.url,
        props.fileId,
        props.title,
        props.description,
        props.category,
        previewImageUrl.value,
        props.price
      );
    } catch (error) {
      console.error('Error constructing shareable link:', error);
      newLink.value = ''; // Clear the link in case of an error
    }

    showDialog.value = true;
    document.body.classList.add('dialog-open');
  }
};

const closeDialog = () => {
  showDialog.value = false;
  newLink.value = '';
  buttonClicked.value = false;
  document.body.classList.remove('dialog-open');
};
const buttonClass = computed(() => {
  return buttonClicked.value ? 'bg-blue-300' : 'bg-blue-300 hover:bg-blue-350';
});
// Watch for changes in props.url
watch(
  [() => props.previewImageUrl, () => props.url],
  ([newPreviewImageUrl, newUrl]) => {
    previewImage.value =
      newPreviewImageUrl && newPreviewImageUrl !== ""
        ? newPreviewImageUrl
        : newUrl
        ? /\.(mp4|mov|avi|mkv|flv)$/i.test(newUrl)
          ? replaceVideoExtensionWithGif(newUrl)
          : newUrl
        : "";
  }
);

watchEffect(() => {
  fileId.value = props.fileId;
});

// Open Change Preview Dialog
const openPreviewDialog = () => {
  showPreviewDialog.value = true;
  document.body.classList.add("dialog-open");
};

// Close Change Preview Dialog
const closePreviewDialog = () => {
  showPreviewDialog.value = false;
  previewImage.value = props.url
    ? /\.(mp4|mov|avi|mkv|flv)$/i.test(props.url)
      ? replaceVideoExtensionWithGif(props.url)
      : props.url
    : ""; // Reset to initial preview
  uploadStatus.value = "";
  selectedFile.value = null; // Reset selected file
  document.body.classList.remove("dialog-open");
};

// Handle file change for preview
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    previewImage.value = URL.createObjectURL(file);
    selectedFile.value = file; // Store selected file
  }
};

// Upload file to S3
const uploadToS3 = async () => {
  const file = selectedFile.value;
  if (!file || !user.value) return;

  // Replace FILE# with META# in fileId
  const fileName = `${user.value.username}/${fileId.value}`;



  try {
    const result = await Storage.put(fileName, file, {
      level: "public",
      contentType: file.type,
      metadata: {
  user: encodeURIComponent(user.value.username),
  description: encodeURIComponent(props.description),
  title: encodeURIComponent(props.title),
  category: encodeURIComponent(props.category),
  price: encodeURIComponent(props.price ? props.price.toString() : "Free")
}
    });
    const imageUrl = await Storage.get(result.key, { level: "public" });
    previewImage.value = imageUrl;
    uploadStatus.value = "Upload successful!";
  } catch (error) {
    console.error("Error uploading image:", error);
    uploadStatus.value = "Upload failed!";
  }
};


// Copy link to clipboard
const copyToClipboard = () => {
  if (!props.url) {
    console.error("URL is not provided.");
    return;
  }


  const el = document.createElement('textarea');
  el.value = newLink.value;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  buttonClicked.value = true;
};

// Construct shareable link


async function constructShareableLink(email, url, fileId, title, description, category, previewUrl, price) {
  if (props.folderName === "default") {
    title = `Twilly ${props.category}`;
    description = `${props.category} shared with you`;
  }
  const encodedUserName = encodeURIComponent(email.trim());
  const encodedUrl = encodeURIComponent(url.trim());
  const encodedFileId = encodeURIComponent(fileId.trim());
  const encodedTitle = encodeURIComponent(title.trim());
  const encodedDescription = encodeURIComponent(description.trim());
  const encodedCategory = encodeURIComponent(category.trim());
  const encodedPrice = encodeURIComponent(price.toString().replace('.', '-'));

  let shareableLink;

  if (category === "Video" && !previewUrl) {
    shareableLink = `https://twilly.app/channel/file/${encodedUserName}/${encodedUrl}/${encodedTitle}/${encodedDescription}/${encodedCategory}/${encodedPrice}`;
  } else if (category === "Image") {
    shareableLink = `https://twilly.app/channel/file/${encodedUserName}/${encodedUrl}/${encodedTitle}/${encodedDescription}/${encodedCategory}/${encodedPrice}`;
  } else if (category === "Audio") {
    const encodedPreviewUrl = encodeURIComponent(previewUrl.trim());
    shareableLink = `https://twilly.app/channel/audio/${encodedUserName}/${encodedUrl}/${encodedTitle}/${encodedDescription}/${encodedCategory}/${encodedPreviewUrl}/${encodedPrice}`;
  } else {
    const encodedPreviewUrl = encodeURIComponent(previewUrl.trim());
    shareableLink = `https://twilly.app/channel/${encodedUserName}/${encodedUrl}/${encodedFileId}/${encodedTitle}/${encodedDescription}/${encodedCategory}/${encodedPreviewUrl}/${encodedPrice}`;
  }

  // Shorten the URL
  try {
    const response = await taskStore.shortenUrl({ url: shareableLink });
    return response.returnResult; // Return the shortened link
  } catch (error) {
    console.error('Error shortening URL:', error);
    return shareableLink; // Return the original URL if shortening fails
  }
}

// Extract email and file name from URL
function extractEmailAndFileName(url) {
  const emailMatch = url.match(/\/([^/]+)\/[^/]+$/);
  const fileNameMatch = url.match(/\/([^/]+)$/);

  const email = emailMatch ? emailMatch[1] : "";
  const fileName = fileNameMatch ? fileNameMatch[1] : "";

  return [email, fileName];
}
</script>

<style scoped>
.action-btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-300 
         flex items-center justify-center gap-2 w-full sm:w-auto
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.preview-btn {
  @apply bg-teal-500 text-white hover:bg-teal-600 
         focus:ring-2 focus:ring-teal-500 focus:ring-offset-2;
}

.share-btn {
  @apply bg-blue-500 text-white hover:bg-blue-600
         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

.copy-btn {
  @apply bg-gray-800 text-white hover:bg-gray-900
         focus:ring-2 focus:ring-gray-800 focus:ring-offset-2;
}

.upload-btn {
  @apply bg-teal-500 text-white hover:bg-teal-600
         focus:ring-2 focus:ring-teal-500 focus:ring-offset-2;
}

.preview-container {
  @apply relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden
         flex items-center justify-center border-2 border-dashed border-gray-300;
}

.preview-image {
  @apply max-w-full max-h-full object-contain;
}

.file-input-label {
  @apply flex items-center justify-center px-4 py-2 rounded-lg
         bg-gray-100 hover:bg-gray-200 cursor-pointer
         border-2 border-dashed border-gray-300
         transition-all duration-300;
}

.upload-container {
  @apply flex flex-col items-center gap-2;
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .action-btn {
    @apply w-full mb-2;
  }
  
  .preview-container {
    @apply aspect-square;
  }
}
</style>