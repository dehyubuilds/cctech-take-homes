<template>
  <div class="channel-guide">
    <section class="channel-guide-content">
      <div class="channel-guide-item">
        <div v-if="isLoading" class="loading-indicator"></div>
        <div v-else>
          <div class="show-preview" v-if="isVideo || isImage">
            <h2 class="channel-guide-title">{{ title }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <template v-if="isVideo">
              <div class="video-preview" @click="handleVideoClick">
                <img
                  v-show="!videoPlaying"
                  v-if="reconstructedImageUrl"
                  :src="reconstructedImageUrl"
                  alt="Video Preview"
                  class="file-image"
                />
                <video
                  v-show="videoPlaying && !isPaidContent"
                  controls
                  preload="metadata"
                  :src="`${reconstructedUrl}`"
                  class="file-player"
                  @error="handleVideoError"
                ></video>
                <div v-show="!videoPlaying" class="play-button"></div>
              </div>
              <div class="price-container">
                <button v-if="isPaidContent" @click="handleVideoClick">
                  <span v-if="price" class="price-tag"
                    >{{ formattedPrice }}</span
                  >
                </button>
              </div>
            </template>
            <template v-else-if="isImage">
              <img
                :src="reconstructedUrl"
                alt="Image Preview"
                class="file-image"
              />
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
  <div v-if="showPaymentPopup" class="payment-popup">
    <div class="popup-content">
      <div class="popup-scrollable-content">
        <div class="stripe-container">
  
        </div>
      </div>
      <div class="close-button">
        <button @click="closePopup">Close</button>
      </div>
    </div>
  </div>
</template>
  
  <script setup>
const isLoading = ref(true);
const videoPlaying = ref(false);
const showPaymentPopup = ref(false);

const reconstructedUrl = ref("");
const reconstructedImageUrl = ref("");
const ogImageUrl = ref(null);

const route = useRoute();
const username = ref(route.params.username);
const url = ref(route.params.url);
const title = ref(route.params.title);
const description = ref(route.params.description);
const price = ref(route.params.price);
const category = ref(route.params.category);
const isVideo = ref(false);
const isImage = ref(false);

if (category.value === "Video") {
  isVideo.value = true;
  const videoExtensions =
    /\.(mp4|MP4|mov|MOV|avi|wmv|flv|mkv|webm|mpeg|mpg|3gp|ogg|ogv|m3u8)$/i;
  const urlWithGifExtension = route.params.url.replace(videoExtensions, ".gif");
  ogImageUrl.value = `${urlWithGifExtension}`;
} else {
  isVideo.value = false;
  isImage.value = true;
  ogImageUrl.value = url.value;
}

const isPaidContent = computed(
  () => price.value !== "0.00" && price.value !== "0" && price.value !== "Free" && price.value !== "0-00"
);

function handleVideoClick() {
  if (isPaidContent.value) {
    showPaymentPopup.value = true;
  } else {
    playVideo();
  }
}

const formattedPrice = computed(() => {
  if (price.value === "0.00" || price.value === "0" || price.value === "Free" || price.value === "0-00")  {
    return "Free";
  } else {
    return `$${price.value}`;
  }
});

const titleWithPrice = computed(() => {
  if (price.value !== "0.00" && price.value !== "0" && price.value !== "Free" && price.value !== "0-00") {
    return `🔒${title.value}`;
  } else {
    return title.value;
  }
});

function closePopup() {
  showPaymentPopup.value = false;
}


useHead(() => {
  return {
    title: titleWithPrice,
    meta: [
      { hid: "og:title", property: "og:title", content: titleWithPrice },
      { hid: "og:url", property: "og:url", content: reconstructedUrl.value },
      { hid: "og:site_name", property: "og:site_name", content: "Twilly" },

      {
        hid: "og:description",
        property: "og:description",
        content: description.value,
      },
      { hid: "og:image", property: "og:image", content: ogImageUrl.value },
      { hid: "og:image:width", property: "og:image:width", content: "1280" },
      { hid: "og:image:height", property: "og:image:height", content: "720" },
      { hid: "og:image", property: "og:type", content: "image/jpeg" },

      // {
      //   hid: "og:video:url",
      //   property: "og:video:url",
      //   content: `https://d2i8yr68ly770u.cloudfront.net/${route.params.username}/${route.params.url}`,
      // },
      // {
      //   hid: "og:video:secure_url",
      //   property: "og:video:secure_url",
      //   content: `https://d2i8yr68ly770u.cloudfront.net/${route.params.username}/${route.params.url}`,
      // },
      { hid: "og:type", property: "og:type", content: "video.other" },
      { hid: "og:video:width", property: "og:image:width", content: "1280" },
      { hid: "og:video:height", property: "og:video:height", content: "720" },

      {
        hid: "twitter:url",
        name: "twitter:url",
        content: url.value,
      },
      {
        hid: "twitter:description",
        name: "twitter:description",
        content: description.value,
      },
      {
        hid: "twitter:title",
        name: "twitter:title",
        content: titleWithPrice,
      },
      {
        hid: "twitter:image",
        name: "twitter:image",
        content: ogImageUrl.value,
      },
    ],
  };
});

onMounted(() => {
  reconstructedUrl.value = url.value;
  if (category.value === "Video") {
    const videoExtensions =
      /\.(mp4|MP4|mov|MOV|avi|wmv|flv|mkv|webm|mpeg|mpg|3gp|ogg|ogv)$/i;
    const urlWithGifExtension = url.value.replace(videoExtensions, ".gif");

    reconstructedImageUrl.value = `${urlWithGifExtension}`;
  } else {
    reconstructedImageUrl.value = url.value;
  }
  title.value = decodeURIComponent(title.value);
  description.value = decodeURIComponent(description.value);
  isLoading.value = false;
});

function playVideo() {
  videoPlaying.value = true;
  const video = document.querySelector(".file-player");
  if (video) {
    video.play();
  }
}

function handleVideoError(event) {
  console.error("Error loading video:", event.target.error);
  // Optionally, display a message to the user or provide alternative content
}
</script>
  
    
<style scoped>
.price-container {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.video-preview {
  position: relative;
  cursor: pointer;
  max-width: 100%;
  margin-top: 0.1rem;
}

.image-container {
  position: relative;
  display: inline-block;
}

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: white;
  cursor: pointer;
}

.play-button::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 12px 0 12px 24px;
  border-color: transparent transparent transparent white;
}

.video-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
}

.control-button {
  background-color: #333;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  width: 50px;
  height: 50px;
  margin: 0 5px;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.3s;
}

.control-button:hover {
  background-color: #555;
}

.control-button:active {
  transform: scale(0.9);
}

.channel-guide-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.channel-guide-item {
  margin-bottom: 3rem;
}

.channel-guide-title {
  font-size: 2rem;
  color: hsl(190, 95%, 30%);
  text-align: center;
  margin-top: 1rem;
}

.popup-content {
  background-color: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  max-height: 90vh;
  overflow-y: auto;
  margin: 1rem;
}

.show-description {
  text-align: center;
  font-size: 1.2rem;
  margin-top: 0.1rem;
}

.red-text {
  color: red;
  font-weight: 550;
}

.price-tag {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 1rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.loading-indicator {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 2s linear infinite;
  margin-bottom: 1.5rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.file-image,
.file-player {
  max-width: 30%;
  margin: auto;
  display: block;
  border: 4px solid #333;
  box-shadow: 0 0 20px #000000cc;
  border-radius: 10px;
}

@media screen and (max-width: 767px) {
  .file-image,
  .file-player {
    max-width: 80%;
    margin-left: auto;
    margin-right: auto;
  }
}

.payment-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.popup-scrollable-content {
  max-height: 70vh;
  overflow-y: auto;
}

.stripe-container {
  width: 100%;
  margin-top: 3rem;
}

.close-button {
  color: red;
  margin-top: 1rem;
}
</style>
