<template>
  <div class="centered-container" v-bind="$attrs">
    <!-- Empty container -->
  </div>
</template>

<style scoped>
.centered-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
}
</style>

<script setup>
import { ref, onMounted } from "vue";
import { useAuthStore } from "~/stores/auth";

const loading = ref(true);

onMounted(async () => {
  try {
    const authStore = useAuthStore();

    // Set loading to true when the component starts mounting
    loading.value = true;

    await authStore.loggedIn();

    // Simulate a 2-second delay with setTimeout
    setTimeout(() => {
      // Navigate after the delay is complete
              navigateTo("/account");
    }, 2000); // 2000 milliseconds (2 seconds)
  } catch (error) {
    console.error(error);
    navigateTo("/");
  } finally {
    // Set loading back to false after the asynchronous operation is complete
    loading.value = false;
  }
});
</script>
  