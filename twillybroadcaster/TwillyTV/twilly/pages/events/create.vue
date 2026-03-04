<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-8 sm:py-12 px-4">
    <div class="max-w-3xl mx-auto">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center">
        <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-4 mb-4">
          {{ error }}
        </div>
      </div>

      <!-- Content -->
      <div v-else class="space-y-8">
        <!-- Header -->
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-white">Create New Event</h1>
          <p class="text-gray-300 mt-2">Fill in the details below to create your event</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="createEvent" class="space-y-6">
          <!-- Event Title -->
          <div>
            <label for="title" class="block text-sm font-medium text-gray-300 mb-1">Event Title</label>
            <input
              id="title"
              v-model="event.title"
              type="text"
              required
              class="w-full px-4 py-3 bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Enter event title"
            />
          </div>

          <!-- Event Description -->
          <div>
            <label for="description" class="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              id="description"
              v-model="event.description"
              required
              rows="4"
              class="w-full px-4 py-3 bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Enter event description"
            ></textarea>
          </div>

          <!-- Date and Time -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label for="date" class="block text-sm font-medium text-gray-300 mb-1">Date</label>
              <input
                id="date"
                v-model="event.date"
                type="date"
                required
                class="w-full px-4 py-3 bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label for="time" class="block text-sm font-medium text-gray-300 mb-1">Time</label>
              <input
                id="time"
                v-model="event.time"
                type="time"
                required
                class="w-full px-4 py-3 bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Location -->
          <div>
            <label for="location" class="block text-sm font-medium text-gray-300 mb-1">Location</label>
            <input
              id="location"
              v-model="event.location"
              type="text"
              required
              class="w-full px-4 py-3 bg-black/20 backdrop-blur-sm border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Enter event location"
            />
          </div>

          <!-- Event Poster -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Event Poster</label>
            <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-teal-900/30 border-dashed rounded-lg">
              <div class="space-y-1 text-center">
                <Icon name="material-symbols:image" class="mx-auto h-12 w-12 text-gray-400" />
                <div class="flex text-sm text-gray-300">
                  <label
                    for="file-upload"
                    class="relative cursor-pointer bg-black/20 rounded-md font-medium text-teal-400 hover:text-teal-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
                  >
                    <span>Upload a file</span>
                    <input id="file-upload" name="file-upload" type="file" class="sr-only" />
                  </label>
                  <p class="pl-1">or drag and drop</p>
                </div>
                <p class="text-xs text-gray-400">PNG, JPG, GIF up to 10MB</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="!isFormValid"
              class="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
const isLoading = ref(true);
const error = ref(null);
const event = ref({
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  poster: null,
});

const isFormValid = computed(() => {
  return (
    event.value.title &&
    event.value.description &&
    event.value.date &&
    event.value.time &&
    event.value.location
  );
});

onMounted(() => {
  isLoading.value = false;
});

const createEvent = async () => {
  try {
    isLoading.value = true;
    // TODO: Implement event creation logic
    console.log('Creating event:', event.value);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    navigateTo('/events');
  } catch (error) {
    console.error("Error creating event:", error);
    error.value = "Unable to create event. Please try again later.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<style>
/* Ensure proper styling initialization */
:root {
  --tw-bg-opacity: 1;
  --tw-text-opacity: 1;
}

/* Prevent layout shifts */
input, textarea, button {
  min-height: 44px;
}

/* Ensure proper backdrop blur */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
</style> 