<template>
  <div>
    <button
      @click="openDialog"
      class="text-sm text-white px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 transition-colors duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-50"
    >
      Share Series
    </button>
    <ShareDialog v-if="showDialog" @close="closeDialog">
      <template #title>Share Folder with link</template>
      <template #body>
        <div class="flex items-center space-x-2">
          <span class="border rounded p-2 w-full truncate">{{ newLink }}</span>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center space-x-2">
          <button
            @click="copyToClipboard"
            :class="buttonClass"
            class="rounded-md px-4 py-2"
          >
            Copy Link
          </button>
          <span v-if="buttonClicked" class="text-red-600">Link copied</span>
        </div>
      </template>
    </ShareDialog>
  </div>
</template>



<script setup>
import { useTaskStore } from "~/stores/TaskStore";
const taskStore = useTaskStore();



const props = defineProps(['folder', 'category', 'email','seriesPosterUrl' ]);



const showDialog = ref(false);
const newLink = ref('');
const buttonClicked = ref(false);

const openDialog = async () => {
  if (props.folder && props.category && props.email.username) {
    const shareableLink = constructShareableLink(props.folder, props.category, props.email.username, props.seriesPosterUrl);
    console.log(shareableLink)

    try {
      const response = await taskStore.shortenUrl({ url: shareableLink });


      let cleanResponse = response;
      
      // If response is a string, parse it as JSON
      if (typeof response === 'string') {
        try {
          cleanResponse = JSON.parse(response);
        } catch (error) {
          console.error('Error parsing response:', error);
        }
      }
      
      // Extract the URL from the cleaned response
      if (cleanResponse && cleanResponse.returnResult) {
        newLink.value = cleanResponse.returnResult;
      } else {
        console.error('Failed to get shortened URL from the store.');
      }
    } catch (error) {
      console.error('Error shortening URL:', error);
    }
  }
  
  showDialog.value = true;
  document.body.classList.add('dialog-open');
};




const closeDialog = () => {
  showDialog.value = false;
  newLink.value = '';
  buttonClicked.value = false;
  document.body.classList.remove('dialog-open');
};

const copyToClipboard = () => {
  if (!newLink.value) {
    console.error('No link to copy.');
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

function constructShareableLink(folder, category, email, seriesPoster) {
  const encodedFolder = encodeURIComponent(folder.trim());
  const encodedCategory = encodeURIComponent(category.trim());
  const encodedSeriesUrl = encodeURIComponent(seriesPoster.trim());
  return `https://twilly.app/channel/${email}/${encodedFolder}/${encodedCategory}/${encodedSeriesUrl}`;
}

const buttonClass = computed(() => {
  return buttonClicked.value ? 'bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600';
});
</script>



<style scoped>
.dialog-content {
  background: white;
  border-radius: 5px;
  padding: 20px;
  z-index: 2001; /* Ensure content is above backdrop */
}

.flex {
  display: flex;
  align-items: center;
}

.space-x-2 > :not(:last-child) {
  margin-right: 0.5rem;
}

span.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bg-green-600:hover {
  background-color: #22c55e; /* Adjust hover color if needed */
}

.text-red-600 {
  color: #dc2626; /* Tailwind CSS red-600 */
}
</style>







