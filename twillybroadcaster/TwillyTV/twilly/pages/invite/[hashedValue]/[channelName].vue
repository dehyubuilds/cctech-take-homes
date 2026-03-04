<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">{{ channelName }}</h1>

      <button @click="collab" class="bg-green-500 text-white p-2 rounded">
        Click to Collab
      </button>
      
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { onMounted } from "vue";
import { useChannelStore } from "@/stores/ChannelStore";
import { Auth } from "aws-amplify";


definePageMeta({
  middleware: ["subscribersignin"],
});
const channelStore = useChannelStore();
const hashedValue = ref("");
const channelName = ref("");
const schedulerId = ref("")
const route = useRoute();

onMounted(async () => {
  const authenticatedUser = await Auth.currentAuthenticatedUser();
  schedulerId.value = authenticatedUser ? authenticatedUser.username : null;
  channelName.value = route.params.channelName;
  hashedValue.value = route.params.hashedValue;
});

const collab = async () => {
  const subscriptionDetails = {
    schedulerId: schedulerId.value,
    channelName: channelName.value,
    hashedValue: hashedValue.value,
  };

  try {
    // Attempt to subscribe to the channel
    await channelStore.inviteToChannel(subscriptionDetails);

    // Redirect to a success page or perform other actions
  } catch (error) {
    console.error("Error subscribing to channel:", error);
    // Handle the error, show a user-friendly message, or perform other actions
  }
};
</script>

<style scoped>
/* Add your custom styles here */
</style>
