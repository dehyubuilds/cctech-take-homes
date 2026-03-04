<template>
  <div class="file-container">
    <button @click="showConfirmation" class="delete-button">DELETE</button>

    <!-- Confirmation Dialog -->
    <div v-if="isConfirmationVisible" class="confirmation-dialog">
      <h2 class="confirmation-dialog-title">
        Are you sure you want to delete this file?
      </h2>
      <div class="confirmation-dialog-buttons">
        <button
          @click="confirmDelete"
          :disabled="isLoading"
          class="confirmation-dialog-button confirmation-dialog-button-primary"
        >
          Yes
        </button>
        <button
          @click="cancelDelete"
          :disabled="isLoading"
          class="confirmation-dialog-button confirmation-dialog-button-secondary"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Loading Indicator -->
    <span v-if="isLoading" class="lds-ring">
      <!-- all divs needed for spinner do not remove-->
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <!-- all divs needed for spinner do not remove-->
    </span>

    <!-- Deletion Confirmation Dialog -->
    <div v-if="isDeletedVisible" class="deletion-confirmation-dialog">
      <h2 class="deletion-confirmation-dialog-title">
        File Deleted Successfully!
      </h2>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useMediaStore } from "../stores/MediaStore";
import { useFileStore } from "@/stores/useFileStore";

const fileStore = useFileStore();
const props = defineProps(["url", "category", "sk"]);
const mediaStore = useMediaStore();
const isConfirmationVisible = ref(false);
const isLoading = ref(false);
const isDeletedVisible = ref(false);


const deleteFile = async () => {
  isLoading.value = true;
  try {
    const deletedFile = await mediaStore.deleteMedia(props.url, props.category, props.sk);
    if (deletedFile) {
      isConfirmationVisible.value = false; // Hide the confirmation dialog
      isDeletedVisible.value = true; // Show the deletion confirmation message
      setTimeout(() => {
        fileStore.deleteFile(props.url, props.category, props.sk);
        isLoading.value = false;
        isDeletedVisible.value = false; // Hide the deletion confirmation message after 2 seconds
      }, 1000);
    }
  } catch (error) {
    console.error("Error deleting file:", error.message);
    // Optionally handle the error
    isLoading.value = false;
  }
};

const confirmDelete = () => {
  isConfirmationVisible.value = false; // Disable the confirmation dialog
  deleteFile();
};

const cancelDelete = () => {
  // Close the confirmation dialog
  isConfirmationVisible.value = false;
};

const showConfirmation = () => {
  // Show the confirmation dialog
  isConfirmationVisible.value = true;
};
</script>

<style scoped>

.confirmation-dialog-buttons {
  display: flex;
  justify-content: center; /* Center the buttons horizontally */
}

/* Add margin to each button */
.confirmation-dialog-button {
  margin: 0 10px; /* Horizontal spacing of 10px on each button */
}
.delete-button {
  color: red;
  padding: 10px 20px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5); /* Add shadow effect */
  transition: box-shadow 0.3s, text-shadow 0.3s; /* Add transition for smooth effect */
}

.delete-button:hover {
  text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.7); /* Increase shadow on hover */
}

/* Hover effect */
/* .delete-button:hover {
  background-color: #d32f2f;
} */

/* Custom confirmation dialog styling */
.confirmation-dialog {
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 20px;
  max-width: 400px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: -400px;
  left: 60%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

.confirmation-dialog-title {
  font-size: 18px;
  margin-bottom: 10px;
}

.confirmation-dialog-buttons {
  display: flex;
  justify-content: space-between;
}

.confirmation-dialog-button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.confirmation-dialog-button-primary {
  background-color: #f44336;
  color: white;
}

.confirmation-dialog-button-primary:hover {
  background-color: #d32f2f;
}

.confirmation-dialog-button-secondary {
  background-color: #ccc;
  color: #333;
}

.confirmation-dialog-button-secondary:hover {
  background-color: #bbb;
}

/* Loading Indicator Styling */
.lds-ring {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

.lds-ring div {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 51px;
  height: 51px;
  margin: 6px;
  border: 6px solid hsl(190, 95%, 30%);
  border-radius: 50%;
  animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: hsl(190, 95%, 30%) transparent transparent transparent;
}

@keyframes lds-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Deletion confirmation dialog styling */
.deletion-confirmation-dialog {
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 20px;
  max-width: 400px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

.deletion-confirmation-dialog-title {
  font-size: 18px;
  margin-bottom: 10px;
}
</style>
