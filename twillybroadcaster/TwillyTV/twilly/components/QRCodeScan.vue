<template>
    <div
      class="new-task-form"
      style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-top: 20px;
      "
    >
      <form
        action="#"
        class="children:w-full mx-auto flex w-11/12 flex-col items-center justify-center md:w-90"
      >       
        <div class="qr-container flex items-center justify-center">
          <canvas
            class="image-render-pixel"
            ref="canvas"
          ></canvas>
        </div>
  
        <p v-if="isCopied" class="text-red-500 mt-2">Link copied</p>
      </form>
    </div>
  </template>
  
  <script setup>
  import { RGBA, generate } from "lean-qr";
  import { useChannelStore } from "../stores/ChannelStore";
  import { Auth } from "aws-amplify";
  
  const user = ref(null);
  const blackRGBA = [0, 0, 0, 255];
  const whiteRGBA = [255, 255, 255, 255];
  const qrConfig = {
  on: blackRGBA,
  off: whiteRGBA,
  };
  
  const channelStore = useChannelStore();
  const { getChannels } = storeToRefs(channelStore); // Fetch channels from the store
  const getChannelsReverse = ref([]); // Reverse order of getChannels
  const hashedSchedulerId = ref(""); // Map to store hashedSchedulerId for each channel
  const canvas = ref();
  const selectedChannel = ref(""); // Default selected channel
  const size = ref(null);
  const isCopied = ref(false);
  const loading = ref(false);
  let code = generate(
  getChannelLink(selectedChannel.value, hashedSchedulerId.value),
  {
    size: size.value,
  }
  ); // Generate QR code with specified size
  
  onMounted(() => {
  watch(
    () => selectedChannel.value,
    (newSelectedChannel) => {
      // console.log("Selected channel changed:", newSelectedChannel);
  
      code = generate(
        getChannelLink(newSelectedChannel, hashedSchedulerId.value),
        {
          size: size.value,
        }
      );
      renderQRCode();
    }
  );
  
  watch(
    () => getChannels.value,
    (newChannels) => {
      getChannelsReverse.value = [...newChannels.channelNames].reverse();
      hashedSchedulerId.value = newChannels.hashedSchedulerId;
  
      selectedChannel.value = getChannelsReverse.value[0] || "";
      loading.value = false;
  
      code = generate(
        getChannelLink(selectedChannel.value, hashedSchedulerId.value),
        {
          size: size.value,
        }
      );
  
      renderQRCode();
    }
  );
  
  renderQRCode();
  });
  function renderQRCode() {
  if (canvas.value) {
    canvas.value.width = size.value;
    canvas.value.height = size.value;
    code.toCanvas(canvas.value, qrConfig);
  }
  }
  
  function getChannelLink(channel, hashedSchedulerId) {
  return `https://twilly.app}`;
  }
  
  function copyLink() {
  const link = getChannelLink(selectedChannel.value, hashedSchedulerId.value);
  navigator.clipboard.writeText(link);
  isCopied.value = true;
  
  // Revert to the original color after a short delay (e.g., 3000 milliseconds or 3 seconds)
  setTimeout(() => {
    isCopied.value = false;
  }, 1000);
  }
  

  </script>
  <style scoped>
.image-render-pixel {
  image-rendering: pixelated;
  width: 130px; /* Adjust to a reasonable size for the QR code */
  height: 130px; /* Maintain aspect ratio with the width */
  margin-top: 20px;
  margin-bottom: 20px; /* Adjust the margin for better positioning */
}
  
  /* Loader styles */
  .lds-ring {
  display: inline-block;
  position: relative;
  width: 10px;
  height: 10px;
  }
  
  .lds-ring div {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 18px;
  height: 18px;
  margin: 3px;
  border: 3px solid #3498db;
  border-radius: 50%;
  animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: #3498db transparent transparent transparent;
  }
  
  @keyframes lds-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
  }
  
  /* Add any additional styles specific to this component */
  </style>