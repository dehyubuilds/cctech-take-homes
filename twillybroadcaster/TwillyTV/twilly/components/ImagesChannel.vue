<template>Images</template>
<!-- <template>
    <div class="image-list">
      <ul>
        <li v-for="image in filteredImages.reverse()" :key="image.id">
          {{ image.name }}
        </li>
      </ul>
    </div>
  </template>
  
  <style scoped>
  .image-list {
    /* Optionally, add styling for the image list container */
  }
  
  /* Optionally, add styling for each list item if needed */
  </style>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  
  const supabase = useSupabaseClient();
  const images = ref([]);
  const filteredImages = ref([]);
  
  const fetchImages = async () => {
    const { data, error } = await supabase.storage.from('twillyprofileimages').list('twilly');
  
    if (error) {
      console.error('Error fetching images:', error.message);
    } else {
      const imageFiles = data.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file.name));
  
      const imagesData = imageFiles.map(image => ({
        id: image.id,
        name: image.name,
      }));
  
      images.value = imagesData;
      filteredImages.value = imagesData;
    }
  };
  
  onMounted(() => {
    fetchImages();
  });
  </script>
   -->

<script setup>
// TODO: Replace with AWS S3 list functionality
const listS3Files = async () => {
  try {
    console.log('Listing files from AWS S3...');
    // TODO: Implement AWS S3 list logic
  } catch (error) {
    console.error('Error listing files from S3:', error);
  }
};
</script>