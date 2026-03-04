<template>
  <div>
    <!-- Download Button -->
    <button @click="downloadFile" class="common-btn source-link-btn">
      Download {{ category }} File
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps(['url', 'category']);

// Download logic for both web and mobile browsers
const downloadFile = async () => {
  try {
    console.log(props.url)
    const response = await fetch(props.url);
    if (!response.ok) throw new Error('Failed to fetch the file.');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;

    // Set file name based on the URL or category
    const fileName = props.url.split('/').pop() || `${props.category}-file`;

    // Set download attribute for web browsers
    link.download = fileName;
    document.body.appendChild(link);

    // Simulate a click to trigger the download
    link.click();

    // Clean up the temporary link
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading the file:', error);
  }
};
</script>

<style scoped>
.common-btn {
  width: 200px;
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  border-radius: 8px;
  color: white;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;

  margin-bottom: 1px;
}

.source-link-btn {
  background-color: rgb(190, 211, 0);
  margin-bottom: 10px;
}

.source-link-btn:hover {
  background-color: rgb(211, 207, 0);
}
</style>
