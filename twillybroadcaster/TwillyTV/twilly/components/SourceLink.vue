<template>
  <div>
    <!-- Change Preview Button -->
    <div class="container">
      <!-- Share Button -->
      <button @click="openDialog" class="common-btn source-link-btn">
        Publish {{ updateCategory }} Source
      </button>
      
      <!-- Share Dialog for Changing Preview -->
      <ShareDialog v-if="showPreviewDialog" @close="closePreviewDialog">
        <template #title>Change Preview Image</template>
        <template #body>
          <div class="dialog-content">
            <div class="image-container">
              <img :src="previewImage" alt="Preview" class="preview-image" />
            </div>
            <div class="file-upload-container">
              <input type="file" @change="handleFileChange" />
              <span v-if="selectedFile">{{ selectedFile.name }}</span>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-center space-x-2">
            <button @click="uploadToS3" class="common-btn preview-link-btn">
              Upload Image
            </button>
            <span v-if="uploadStatus" class="text-red-600">
              {{ uploadStatus }}
            </span>
          </div>
        </template>
      </ShareDialog>

      <!-- Share Dialog for Sharing Link -->
      <ShareDialog v-if="showShareDialog" @close="closeShareDialog">
        <template #title>Publish to Page</template>
        <template #body>
          <div class="flex items-center space-x-2">
            <!-- New input fields for message and targetType with labels -->
            <div class="mt-4 w-full">
              <label for="targetType" class="block text-sm font-medium text-gray-700">Target Type</label>
              <input
                id="targetType"
                v-model="targetType"
                type="text"
                placeholder="Enter target type"
                class="border rounded p-2 w-full mt-2"
              />
              <button @click="clearTargetType" class="clear-btn mt-2">Clear</button>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-center space-x-2">
            <button @click="publishMessage" class="common-btn copy-share-link-btn">
              Publish Message
            </button>
            <span v-if="publishSuccess" class="text-red-600">
              Published Successfully!
            </span>
          </div>
        </template>
      </ShareDialog>
    </div>

    <!-- Share Dialog for Changing Preview -->
    <ShareDialog v-if="showPreviewDialog" @close="closePreviewDialog">
      <template #title>Change Preview Image</template>
      <template #body>
        <div class="dialog-content">
          <div class="image-container">
            <img :src="previewImage" alt="Preview" class="preview-image" />
          </div>
          <div class="file-upload-container">
            <input type="file" @change="handleFileChange" />
            <span v-if="selectedFile">{{ selectedFile.name }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center space-x-2">
          <button @click="uploadToS3" class="common-btn preview-link-btn">
            Upload Image
          </button>
          <span v-if="uploadStatus" class="text-red-600">
            {{ uploadStatus }}
          </span>
        </div>
      </template>
    </ShareDialog>
  </div>
</template>



<script setup>
import { Auth, Storage, Amplify } from "aws-amplify";
import awsmobile from "~/aws-exports";

// Define reactive variables
const messageContent = ref('');
const targetType = ref('series');
const statusMessage = ref('');
const publishSuccess = ref(false); // New reactive variable for publish success

const closeShareDialog = () => {
  showShareDialog.value = false;
  newLink.value = '';
  buttonClicked.value = false;
  publishSuccess.value = false; // Clear the success message when closing the dialog
  document.body.classList.remove('dialog-open');
};

let ws;

Amplify.configure(awsmobile);

Storage.configure({
  bucket: awsmobile.s3.bucket,
  region: awsmobile.s3.region,
});

const props = defineProps(["url", "category"]);
const showPreviewDialog = ref(false);
const showShareDialog = ref(false);
const updateCategory = ref(props.category);
const uploadStatus = ref("");
const buttonClicked = ref(false);
const selectedFile = ref(null);
const newLink = ref(props.url);
const previewImage = ref('');

const user = ref(null); 
const fileId = ref(null);

onMounted(() => {
  setupWebSocket();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  document.removeEventListener('click', handleClickOutside);
});

Auth.currentAuthenticatedUser().then((authUser) => {
  user.value = authUser;
});

const setupWebSocket = () => {
  if (ws) {
    console.warn('WebSocket already initialized.');
    return;
  }

  ws = new WebSocket('wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/');

  ws.onopen = () => {
    console.log('WebSocket connection opened.');
  };

  ws.onclose = (event) => {
    console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};


const publishMessage = () => {
  const message = {
    type: 'text',
    content: messageContent.value || 'Default message content',
    targetType: targetType.value || 'defaultType'
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    console.log('Message sent:', message);
    statusMessage.value = 'Message published successfully!';
    publishSuccess.value = true; // Set the success message state
    setTimeout(() => {
      closeShareDialog(); // Close the dialog after a short delay to allow the message to be seen
    }, 2000);
    console.log(publishSuccess.value)
  } else {
    statusMessage.value = 'WebSocket is not open.';
  }
};

const replaceVideoExtensionWithGif = (url) => {
  return url.replace(/\.(mp4|mov|avi|mkv|flv)$/i, ".gif");
};

previewImage.value = props.previewImageUrl && props.previewImageUrl !== ""
  ? props.previewImageUrl
  : props.url
  ? /\.(mp4|mov|avi|mkv|flv)$/i.test(props.url)
    ? replaceVideoExtensionWithGif(props.url)
    : props.url
  : "";

const openDialog = () => {
  showShareDialog.value = true;
  messageContent.value = props.url;
  console.log(messageContent.value)

  document.body.classList.add('dialog-open');
};

const closeDialog = () => {
  showShareDialog.value = false;
  newLink.value = '';
  buttonClicked.value = false;
  document.body.classList.remove('dialog-open');
};

const openPreviewDialog = () => {
  showPreviewDialog.value = true;
  document.body.classList.add('dialog-open');
};

const closePreviewDialog = () => {
  showPreviewDialog.value = false;
  previewImage.value = props.url
    ? /\.(mp4|mov|avi|mkv|flv)$/i.test(props.url)
      ? replaceVideoExtensionWithGif(props.url)
      : props.url
    : "";
  uploadStatus.value = "";
  selectedFile.value = null;
  document.body.classList.remove('dialog-open');
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    previewImage.value = URL.createObjectURL(file);
    selectedFile.value = file;
  }
};

const uploadToS3 = async () => {
  if (selectedFile.value) {
    try {
      const result = await Storage.put(selectedFile.value.name, selectedFile.value, {
        contentType: selectedFile.value.type,
      });
      console.log('File uploaded successfully:', result);
      uploadStatus.value = 'Upload successful!';
    } catch (error) {
      console.error('Error uploading file:', error);
      uploadStatus.value = 'Upload failed.';
    }
  }
};

const clearMessageContent = () => {
  messageContent.value = '';
};

const clearTargetType = () => {
  targetType.value = '';
};

const handleClickOutside = (event) => {
  const previewDialog = document.querySelector('.preview-dialog');
  const shareDialog = document.querySelector('.share-dialog');

  if (showPreviewDialog.value && previewDialog && !previewDialog.contains(event.target)) {
    closePreviewDialog();
  }

  if (showShareDialog.value && shareDialog && !shareDialog.contains(event.target)) {
    closeShareDialog();
  }
};
</script>






<style scoped>
.clear-btn {
  background-color: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
}

.clear-btn:hover {
  background-color: #e5e7eb;
}

.common-btn {
  width: 200px; /* Set a fixed width for buttons */
  display: block; /* Ensure buttons stack vertically */
  font-size: 14px; /* Larger font size */
  font-weight: 600; /* Bolder text */
  padding: 10px; /* Padding for a bigger button */
  border-radius: 8px; /* Rounded corners */
  color: white; /* White text color */
  text-align: center; /* Center text */
  cursor: pointer; /* Pointer cursor on hover */
  transition: all 0.3s ease; /* Smooth transition for hover effects */
  margin: 0 auto 10px;
  margin-top:10px;  /* Center the button and add space below */
}



.preview-link-btn {
  background-color: #4f46e5;
  color: #fff;
}

.preview-link-btn:hover {
  background-color: #4338ca;
}

.source-link-btn {
  background-color: orange;
  color: #fff;
  margin-bottom: 10px;
  margin-top: 10px;
}

.source-link-btn:hover {
  background-color: orange;
}


.copy-share-link-btn {
  background-color: #10b981;
  color: #fff;
}

.copy-share-link-btn:hover {
  background-color: #059669;
}

.dialog-content {
  padding: 1rem;
}

.image-container {
  margin-bottom: 1rem;
}

.preview-image {
  width: 100%;
  max-width: 300px;
  height: auto;
}

.file-upload-container {
  margin-top: 1rem;
}
</style>
