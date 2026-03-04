<template>
    <div
    class="new-task-form"
    style="
      margin-top: -20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    "
  >
  
    <header>
      <h1 class="text-4xl font-semibold mb-6">Create Channel</h1>
    </header>
    <form
      class="children:w-full mx-auto flex w-11/12 flex-col items-center justify-center md:w-90"
    >
      <div>
        <input
          class="w-full rounded border border-2 border-blue-300 bg-gray-50 p-2 outline-blue-500"
          type="text"
          v-model="text"
          placeholder="Channel Name"
        />
      </div>
      <div>
        <div>
          <BaseCheckbox
            label="Accept All Requests"
            :checked="channelData.ApproveAccepts"
            @onChange="(value) => changeField('ApproveAccepts', value)"
            :disabled="!text.trim()"
            class="text-gray-500 mt-5"
          />
        </div>
      </div>
      <div>
        <BaseCheckbox
          label="Allow Subscribers to Publish"
          :checked="channelData.SubscriberPublish"
          @onChange="(value) => changeField('SubscriberPublish', value)"
          :disabled="!text.trim()"
          class="text-gray-500 mt-2"
        />
      </div>
      <button
        @click.prevent="saveChannel"
        :class="{
          'bg-gray-300 pointer-events-none': !text.trim(),
          'bg-blue-500': text.trim(),
        }"
        class="mt-4 p-2 text-white rounded"
      >
        Save Channel
      </button>
    </form>
  </div>
</template>
  
<script setup>
import { ref, onMounted, watch } from "vue";
import { RGBA, generate } from "lean-qr";
import { useChannelStore } from "../stores/ChannelStore";
import { Auth } from "aws-amplify";

const verifyLoggedIn = async () => {
  try {
    user.value = await Auth.currentAuthenticatedUser();
    const schedulerId = user.value ? user.value.username : null;
 
  } catch (error) {
    console.error("Error verifying login:", error);
    navigateTo("/signin");
  }
};

const user = ref(null);

async function hashEmailWithSalt(email) {
  // Define the TextEncoder
  const encoder = new TextEncoder();

  // Generate a random salt
  const salt = generateRandomSalt();

  // Combine email and salt, then encode
  const data = encoder.encode(email + salt);

  // Compute the SHA-256 hash
  const buffer = await crypto.subtle.digest("SHA-256", data);

  // Convert the hash to a hexadecimal string
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

const loading = ref(false);
const channelData = reactive({
  ApproveAccepts: true,
  SubscriberPublish: true,
});

const channelStore = useChannelStore();

const changeField = (propertyName, value) => {
  if (
    propertyName === "ApproveAccepts" ||
    propertyName === "SubscriberPublish"
  ) {
    channelData[propertyName] = value;
  }
};

const saveChannel = async () => {
  if (text.value.trim()) {
    try {
      // Pass both schedulerId and hashedSchedulerId to pushChannel
      await pushChannel(
        text.value,
        channelData.ApproveAccepts,
        channelData.SubscriberPublish
      );
    } catch (error) {
      console.error(
        "An error occurred while saving the channel:",
        error.message
      );
    }
  }
};
const pushChannel = async (channelName, approveAccepts, subscriberPublish) => {
  try {


    // Attempt to get the current authenticated user
    user.value = await Auth.currentAuthenticatedUser();
    const hashedSchedulerId = await hashEmailWithSalt(user.value.username);

    loading.value = true;

    // Use the current timestamp as an associated property
    const timestampToUse = new Date().toISOString();



    if (channelName.length > 0 && timestampToUse.length) {
      // Create a new channel object
      const newChannel = {
        id: "None",
        channelName: channelName,
        approveAccepts: approveAccepts,
        subscriberPublish: subscriberPublish,
        timestamp: timestampToUse,
        schedulerId: user.value ? user.value.username : null, // Use the plain schedulerId
        hashedSchedulerId: hashedSchedulerId, // Include the hashedSchedulerId
      };

      // Attempt to add the new channel
      await channelStore.addChannel(newChannel);
    } else {
      console.error("Invalid channelName or timestamp");
    }
  } catch (error) {
    console.error("An error occurred in pushChannel:", error);
    // Handle the error appropriately, e.g., show a user-friendly message or log it
    user.value = null;
  } finally {
    loading.value = false;
    text.value = "";
  }
};

const blackRGBA = [0, 0, 0, 255];
const whiteRGBA = [255, 255, 255, 255];
const qrConfig = {
  on: blackRGBA,
  off: whiteRGBA,
};

const canvas = ref();
const text = ref("");
const size = ref(8000);

let code = generate(text.value, { size: size.value });

onMounted(() => {
  verifyLoggedIn();
  watch(text, (newText) => {
    code = generate(newText, { size: size.value });
    renderQRCode();
  });

  renderQRCode();
});

function generateRandomSalt() {
  // Generate a random string or number to use as a salt
  // Note: This is a basic example; you might want to use a more secure method to generate a random value
  return Math.random().toString(36).substring(2); // For simplicity, using part of a random string
}

function renderQRCode() {
  if (canvas.value) {
    canvas.value.width = size.value;
    canvas.value.height = size.value;
    code.toCanvas(canvas.value, qrConfig);
  }
}
</script>
  
  <style scoped>

.text-gray-500 {
  color: #a0aec0;
}
</style>
  