<template>
  <div class="channel-guide">
    <section class="channel-guide-content">
      <div class="channel-guide-item">
        <!-- Loading Indicator -->
        <div v-if="isLoading" class="loading-indicator"></div>

        <!-- Content Display -->
        <div v-else>
          <!-- Display for Video Content -->
          <div v-if="isVideo && !isM3U8" class="show-preview">
            <h2 class="channel-guide-title">{{ titleWithPrice }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <!-- Video Preview Section -->
            <div class="video-preview">
              <div class="video-container">
                <!-- Standard Video Element for Non-m3u8 Files -->
                <video
                  ref="videoRef"
                  :src="reconstructedUrl"
                  :controls="videoPlaying"
                  @play="onPlay"
                  @pause="onPause"
                  @ended="onEnded"
                  class="video-player"
                >
                  Your browser does not support the video element.
                </video>

                <!-- Cover Art Overlay (Hide when video is playing) -->
                <div
                  v-if="!videoPlaying && previewUrl"
                  class="cover-art-overlay"
                  @click="handlePreviewClick"
                >
                  <img :src="previewUrl" alt="Cover Art" />
                </div>

                <!-- Play/Pause Overlay Button -->
                <div
                  v-if="!videoPlaying"
                  class="play-button"
                  @click="handlePreviewClick"
                >
                  <span class="play-text">Play</span>
                </div>
              </div>
            </div>

            <!-- Emoji Reactions -->
            <div class="emoji-reactions">
              <div class="emoji" @click="sendFiya">🔥</div>
              <div class="emoji" @click="sendHeart">❤️</div>
              <div class="emoji" @click="sendHeartEyes">😍</div>
              <div class="emoji" @click="sendThumbsUp">👍</div>
            </div>

            <!-- Toggle Comment Box Button -->
            <button class="toggle-comment-button" @click="toggleCommentBox">
              {{ showCommentBox ? "Hide Comment Box" : "Show Comment Box" }}
            </button>

            <!-- Comment Box -->
            <div v-if="showCommentBox" class="comment-box">
              <textarea placeholder="Add a comment..."></textarea>
              <button class="postButton" @click="submitComment">Post</button>
            </div>
          </div>

          <!-- Alternative Display for m3u8 Files -->
          <div v-if="isVideo && isM3U8" class="show-preview">
            <h2 class="channel-guide-title">{{ titleWithPrice }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <!-- Video Preview Section -->
            <div class="video-preview">
                <ClientOnly>
                  <VideoPlayer
                    type="default"
                    :link="reconstructedUrl"
                    class="video-player"
                    :isMuted="false"
                    :isControls="true"
                    @play="handleVideoPlay"
                    @pause="handleVideoPause"
                  />
                </ClientOnly>
                 <!-- <div
                  v-if="!videoPlaying && previewUrl"
                  class="cover-art-overlay"
                  @click="startVideo"
                >
                  <img src="https://d4idc5cmwxlpy.cloudfront.net/0731.gif" alt="Cover Art" />
                </div>

                 <div
                  v-if="!videoPlaying"
                  class="play-button"
                  @click="startVideo"
                >
                  <span class="play-text">Play</span>
                </div>   -->
            </div>

            <!-- Emoji Reactions -->
            <div class="emoji-reactions">
              <div class="emoji" @click="sendFiya">🔥</div>
              <div class="emoji" @click="sendHeart">❤️</div>
              <div class="emoji" @click="sendHeartEyes">😍</div>
              <div class="emoji" @click="sendThumbsUp">👍</div>
            </div>

            <!-- Toggle Comment Box Button -->
            <button class="toggle-comment-button" @click="toggleCommentBox">
              {{ showCommentBox ? "Hide Comment Box" : "Show Comment Box" }}
            </button>

            <!-- Comment Box -->
            <div v-if="showCommentBox" class="comment-box">
              <textarea placeholder="Add a comment..."></textarea>
              <button class="postButton" @click="submitComment">Post</button>
            </div>
          </div>

          <!-- Display for Image Content -->
          <div v-else-if="isImage" class="show-preview">
            <h2 class="channel-guide-title">{{ titleWithPrice }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <!-- Image Display Section -->
            <div class="image-preview">
              <div class="image-container">
                <img
                  :src="reconstructedUrl"
                  alt="Image Content"
                  class="image-display"
                />
              </div>
            </div>

            <!-- Emoji Reactions -->
            <div class="emoji-reactions">
              <div class="emoji" @click="sendFiya">🔥</div>
              <div class="emoji" @click="sendHeart">❤️</div>
              <div class="emoji" @click="sendHeartEyes">😍</div>
              <div class="emoji" @click="sendThumbsUp">👍</div>
            </div>

            <!-- Toggle Comment Box Button -->
            <button class="toggle-comment-button" @click="toggleCommentBox">
              {{ showCommentBox ? "Hide Comment Box" : "Show Comment Box" }}
            </button>

            <!-- Comment Box -->
            <div v-if="showCommentBox" class="comment-box">
              <textarea placeholder="Add a comment..."></textarea>
              <button class="postButton" @click="submitComment">Post</button>
            </div>
          </div>

          <!-- Display for Audio Content -->
          <div v-else-if="isAudio" class="show-preview">
            <h2 class="channel-guide-title">{{ titleWithPrice }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <AudioPlayer
              :previewUrl="previewUrl"
              :url="reconstructedUrl"
              :title="title"
              :description="description"
            />

            <!-- Emoji Reactions -->
            <div class="emoji-reactions">
              <div class="emoji" @click="sendFiya">🔥</div>
              <div class="emoji" @click="sendHeart">❤️</div>
              <div class="emoji" @click="sendHeartEyes">😍</div>
              <div class="emoji" @click="sendThumbsUp">👍</div>
            </div>

            <!-- Toggle Comment Box Button -->
            <button class="toggle-comment-button" @click="toggleCommentBox">
              {{ showCommentBox ? "Hide Comment Box" : "Show Comment Box" }}
            </button>

            <!-- Comment Box -->
            <div v-if="showCommentBox" class="comment-box">
              <textarea placeholder="Add a comment..."></textarea>
              <button class="postButton" @click="submitComment">Post</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Payment Popup -->
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
  </div>
</template>

<script setup>

import AudioPlayer from "@/components/AudioPlayer.vue";
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { VideoPlayer } from "vue-hls-video-player";

const props = defineProps([
  "title",
  "description",
  "timestamp",
  "category",
  "previewImageUrl",
  "videoUrl",
  "price",
]);

const route = useRoute();

const isLoading = ref(true);
const showPaymentPopup = ref(false);
const videoPlaying = ref(false);
const audioPlaying = ref(false);
const showCommentBox = ref(true);

const reconstructedUrl = ref("");
const title = ref(props.title);
const description = ref(props.description);
const price = ref(props.price);
const category = ref(props.category);
const url = ref(props.videoUrl);
const previewUrl = ref(props.previewImageUrl);
const isVideo = computed(() => category.value === "Videos");
const isImage = computed(() => category.value === "Images");
const isAudio = computed(() => category.value === "Audios");


// Computed property to check if videoUrl has .m3u8 extension
const isM3U8 = computed(
  () => props.videoUrl && props.videoUrl.endsWith(".m3u8")
);

const isPaidContent = computed(() => {
  return (
    price.value &&
    price.value !== "0.00" &&
    price.value !== "0" &&
    price.value !== "Free" &&
    price.value !== "0-00"
  );
});

const formattedPrice = computed(() => {
  if (
    price.value === "0.00" ||
    price.value === "0" ||
    price.value === "Free" ||
    price.value === "0-00"
  ) {
    return "Free";
  } else {
    return `$${price.value}`;
  }
});

const titleWithPrice = computed(() => {
  return isPaidContent.value ? `🔒${title.value}` : title.value;
});

const videoRef = ref(null);
const audioRef = ref(null);


function startVideo() {
  // Manually play the video by accessing it through a ref
  const videoElement = document.querySelector('.video-player video');
  if (videoElement) {
    videoElement.play();
  }
  videoPlaying.value = true; // Hide overlay
}

function closePopup() {
  showPaymentPopup.value = false;
}
function emitPlay() {
  console.log('Play event emitted from VideoPlayer');
  emit('play');
}

function emitPause() {
  console.log('Pause event emitted from VideoPlayer');
  emit('pause');
}

function handleVideoPlay() {
  console.log('Play event received in parent component');
  videoPlaying.value = true;
}

function handleVideoPause() {
  console.log('Pause event received in parent component');
  videoPlaying.value = false;
}
function handlePreviewClick() {
  const video = videoRef.value;
  const audio = audioRef.value;

  if (video) {
    if (videoPlaying.value) {
      video.pause();
    } else {
      video.play();
    }
  }

  if (audio) {
    if (audioPlaying.value) {
      audio.pause();
    } else {
      audio.play();
    }
    audioPlaying.value = !audioPlaying.value;
  }
}

function onPlay() {
  videoPlaying.value = true;
  audioPlaying.value = true;
}

function onPause() {
  videoPlaying.value = false;
  audioPlaying.value = false;
}

function onEnded() {
  videoPlaying.value = false;
  audioPlaying.value = false;
}

function sendFiya() {
  console.log("🔥 sent!");
}

function sendHeart() {
  console.log("❤️ sent!");
}

function sendHeartEyes() {
  console.log("😍 sent!");
}

function sendThumbsUp() {
  console.log("👍 sent!");
}

function submitComment() {
  console.log("Comment submitted!");
}

function toggleCommentBox() {
  showCommentBox.value = !showCommentBox.value;
}

onMounted(() => {
  title.value = props.title;
  description.value = props.description;
  price.value = props.price;
  category.value = props.category;
  previewUrl.value = props.previewImageUrl;

  // Set reconstructedUrl based on file type
  if (isVideo.value) {
    reconstructedUrl.value = props.videoUrl;
  } else if (isAudio.value) {
    reconstructedUrl.value = props.videoUrl;
  } else if (isImage.value) {
    reconstructedUrl.value = props.previewImageUrl;
  }

  isLoading.value = false;
});
</script>




<style scoped>
.video-container,
.image-container,
.audio-preview .image-container {
  position: relative;
  display: block;
  width: 80%;
  max-width: 720px;
  margin: 0 auto;
  background: linear-gradient(
    135deg,
    #6a1b9a,
    #ab47bc
  ); /* Gradient for a TV network feel */
  border-radius: 20px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.video-player,
.image-display,
.audio-player {
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 4px solid #333;
}

.cover-art-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  background: rgba(0, 0, 0, 0.6); /* Dark overlay for a polished look */
}

.cover-art-overlay img {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
}

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 50%;
  width: 70px;
  height: 70px;
  cursor: pointer;
  z-index: 2;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.7); /* Enhanced shadow */
}

.play-button.pause {
  background-color: rgba(255, 0, 0, 0.8);
}

.channel-guide {
  background-color: #1a1a1a;
  padding: 20px;
  color: #fff;
  font-family: "Roboto", sans-serif;
}

.channel-guide-content {
  margin: 0 auto;
  padding: 20px;
  max-width: 800px;
}

.channel-guide-item {
  border: 1px solid #333;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #212121, #424242); /* Sleek background */
}

.channel-guide-title {
  font-size: 24px;
  margin-bottom: 10px;
  text-align: center;
  color: #ffcc00; /* Golden title for visibility */
}

.show-description {
  margin-bottom: 20px;
  text-align: center;
  color: #b3b3b3; /* Subtle description color */
}

.emoji-reactions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.emoji {
  cursor: pointer;
  font-size: 24px;
  transition: transform 0.2s ease;
}

.emoji:hover {
  transform: scale(1.3);
}

.toggle-comment-button {
  margin: 20px auto;
  display: block;
  padding: 10px 20px;
  background-color: #6a1b9a;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.toggle-comment-button:hover {
  background-color: #ab47bc;
}

.comment-box {
  margin-top: 20px;
}

.comment-box textarea {
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 5px;
  border: 1px solid #999;
  background-color: #333;
  color: #fff;
  resize: none;
}

.postButton {
  display: block;
  margin: 0 auto;
  padding: 10px 20px;
  background-color: hsl(190, 95%, 30%);
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.postButton:hover {
  background-color: #0056b3;
}

.payment-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.9); /* Dark backdrop */
  padding: 20px;
  border-radius: 10px;
  z-index: 100;
}

.popup-content {
  background-color: #fff;
  padding: 20px;
  border-radius: 10px;
  color: #000;
}

.popup-scrollable-content {
  max-height: 300px;
  overflow-y: auto;
}

.stripe-container {
  margin: 20px 0;
}

.close-button {
  text-align: center;
  margin-top: 20px;
}

.close-button button {
  padding: 10px 20px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.close-button button:hover {
  background-color: #0056b3;
}

.loading-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: #fff;
}
</style>