<template>
  <div
    class="new-task-form"
    style="
      margin-top: 50px; /* Change margin-top to move the header down */
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    "
  >
    <header>
      <h1 class="text-4xl font-semibold mb-6" style="color: hsl(190, 95%, 30%);">Enter a URL</h1>
    </header>
    <form
      class="children:w-full mx-auto flex w-11/12 flex-col items-center justify-center md:w-90"
    >
      <div>
        <input
          class="w-full rounded border border-2 border-blue-300 bg-gray-50 p-2 outline-blue-500"
          type="text"
          v-model="text"
          placeholder="Enter URL (https://)"
        />
      </div>
      <button
        @click.prevent="saveChannel"
        :disabled="!text.trim() || loading"
        :class="{
          'bg-gray-300 pointer-events-none': !text.trim() || loading,
          'bg-blue-500': text.trim() && !loading,
        }"
        class="mt-4 p-2 text-white rounded relative"
      >
        <span v-if="!loading">Send</span>
        <span v-else>
          <div class="loader" />
        </span>
      </button>
      <p v-if="linkSaved" class="text-red-600 mt-2">Link saved</p>
    </form>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useChannelStore } from "../stores/ChannelStore";
import { Auth } from "aws-amplify";

const user = ref(null);
const loading = ref(false);
const channelStore = useChannelStore();
const linkSaved = ref(false);

const saveChannel = async () => {
  if (text.value.trim()) {
    try {
      loading.value = true;
      await pushFile(text.value);
      linkSaved.value = true;
      setTimeout(() => {
        linkSaved.value = false;
        text.value = ""
      }, 1000); 
      
    } catch (error) {
      console.error("An error occurred while saving the channel:", error.message);
    } finally {
      loading.value = false;
    }
  }
};

const pushFile = async (linkName) => {
  try {
    // user.value = await Auth.currentAuthenticatedUser();
    if (linkName.length > 0) {
      const newChannel = {
        id: "None",
        linkName: linkName,
        schedulerId: "dehyu.sinyan@gmail.com"
        // schedulerId: user.value ? user.value.username : null,
      };

      await channelStore.addLink(newChannel);
    } else {
      console.error("Invalid linkName or timestamp");
    }
  } catch (error) {
    console.error("An error occurred in pushFile:", error);
    user.value = null;
  }
};

const text = ref("");
const size = ref(8000);
</script>

<style scoped>
.text-gray-500 {
  color: #a0aec0;
}

.loader {
  border: 4px solid hsl(190, 95%, 30%);
  border-radius: 50%;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
