<template>
  <div class="channel-guide-content">
    <!-- Carousel Display when Offline -->
    <div v-if="isOffline" class="carousel">
      <div class="carousel-inner">
        <div v-for="item in orderedItems" :key="item.SK" class="carousel-item">
          <img
            :src="replaceS3WithCloudFront(item.previewImageUrl)"
            alt="Media Preview"
            class="carousel-image"
          />
          <div class="view-series-button" @click="toggleOfflineStatus">
            <span class="play-text">View Series</span>
          </div>
          <div class="title-overlay">
            <div class="item-title">{{ getItemTitle(item) }}</div>
            <!-- See more link with arrow -->
            <div class="see-more" @click.stop="toggleDrawer(item)">
              About Series
              <!-- <svg class="arrow-icon" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5H7z" />
              </svg> -->
            </div>
            <!-- <div class="qr-icon" @click="toggleQRScan">
              <svg class="qr-icon-svg" viewBox="0 0 24 24">
                <path d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4zM16 16h4v4h-4z" />
              </svg>
            </div> -->
            <div v-if="showDrawer" class="about-series-drawer">
              <div class="content">
                <button class="drawer-close" @click="toggleDrawer">×</button>
                <h3>About This Series</h3>
                <p>
                  Here you will see detailed information about the series...Stay
                  tuned.
                </p>
              </div>
            </div>
          </div>

          <!-- QR Code Icon and QRCodeScan Popup -->
          <div class="flex-container">
            <div class="qr-container">
              <QRCodeScan v-if="!showQRScanner" />
              <!-- Added text beneath QR Code Scan component -->
              <p v-if="!showQRScanner" class="share-instructions">
                Click or Scan to Share
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Media Display when Online -->
    <div v-if="!isOffline" class="media-display-container">
      <div @click="toggleOfflineStatus" class="online-indicator">ONLINE</div>
      <div class="media-display">
        <div
          v-for="item in orderedItems"
          :key="item.SK"
          class="media-display-wrapper"
        >
          <LazyMediaDisplay
            :title="getItemTitle(item)"
            :description="item.Description"
            :timestamp="item.timestamp"
            :category="item.category"
            :previewImageUrl="replaceS3WithCloudFront(item.previewImageUrl)"
            :videoUrl="replaceS3WithCloudFront(item.url)"
            :price="item.price"
          />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer v-if="isOffline" class="footer">
      <div class="footer-content">
        <div class="footer-logo"></div>
        <nav class="footer-nav">
          <div class="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useFileStore } from "@/stores/useFileStore";
import { useRoute } from "vue-router";
import { useMediaSocketStore } from "@/stores/MediaSocketStore";
const mediaSocketStore = useMediaSocketStore();

const fire = ref(mediaSocketStore.fire);
const isOffline = ref(true);
const heart = ref(null);
const heartEyes = ref(null);
const thumbsup = ref(null);
const showSeriesPopup = ref(false);
const errorMessage = ref("");
const fileStore = useFileStore();
const { videos, images, docs, audios, folders } = storeToRefs(fileStore);
const isLoading = ref(true);
const showPaymentPopup = ref(false);
const showDetailsPopup = ref(false);
const selectedItem = ref(null);
const currentIndex = ref(0);
const clickedItem = ref(null);
const route = useRoute();
const email = ref(route.params.email);
const folder = ref(route.params.folder);
const category = ref(route.params.category);
const ogImageUrl = ref(route.params.seriesPoster);

const showDrawer = ref(false);
const currentItem = ref(null);
const showQRScanner = ref(false);
console.log(folder.value)
console.log(ogImageUrl.value)


function toggleDrawer(item) {
  currentItem.value = currentItem.value === item ? null : item;
  showDrawer.value = !showDrawer.value;
}

function toggleQRScan() {
  showQRScanner.value = !showQRScanner.value;
}

let ws;
let statusWs;

const resetFire = () => {
  fire.value = null; // Reset the fire emoji
  nextTick(() => {
    fire.value = "🔥"; // Set the fire emoji to trigger animation
  });
};

const resetHeart = () => {
  heart.value = null; // Reset the heart emoji
  nextTick(() => {
    heart.value = true; // Set to true to trigger the animation
  });
};

const resetThumbsUp = () => {
  thumbsup.value = null; // Reset the thumbs up emoji
  nextTick(() => {
    thumbsup.value = true; // Set to true to trigger the animation
  });
};

const resetHeartEyes = () => {
  heartEyes.value = null; // Reset the heart eyes emoji
  nextTick(() => {
    heartEyes.value = true; // Set to true to trigger the animation
  });
};

const getItemTitle = (item) => {
  return item.Title === "notitle" ? "" : item.Title;
};

const computedOgImageUrl = computed(() => ogImageUrl.value);
const filteredItems = computed(() => {
  let videoItems = videos.value
    .filter((video) => video.folderName === folder.value)
    .map((video) => ({
      ...video,
      previewUrl: video.url.replace(/\.[^/.]+$/, ".gif"),
      previewImageUrl: video.previewImageUrl || video.previewUrl,
      isPlaying: false,
    }));

  let imageItems = images.value
    .filter((image) => image.folderName === folder.value)
    .map((image) => ({
      ...image,
      previewUrl: image.url,
      previewImageUrl: image.previewImageUrl || image.previewUrl,
      isPlaying: false,
    }));

  let audioItems = audios.value
    .filter((audio) => audio.folderName === folder.value)
    .map((audio) => ({
      ...audio,
      previewUrl: audio.url,
      previewImageUrl: audio.previewImageUrl || audio.previewUrl,
      isPlaying: false,
    }));

  // Combine video, image, and audio items
  videoItems = videoItems.concat(
    imageItems.map((image) => ({
      ...image,
      isImage: true,
    })),
    audioItems.map((audio) => ({
      ...audio,
      isAudio: true,
    }))
  );

  // Handle different categories
  switch (category.value) {
    case "Videos":
      return videoItems;
    case "Images":
      return imageItems;
    case "Audios":
      return audioItems;
    default:
      return [];
  }
});
const orderedItems = computed(() => {
  const seriesPoster = route.params.seriesPoster;

  if (isOffline.value && seriesPoster) {
    return [
      {
        Title: folder.value,
        previewImageUrl: seriesPoster,
        isPlaying: false,
        url: seriesPoster,
      },
    ];
  }

  let itemsList = filteredItems.value.map((item) => ({
    ...item,
    previewImageUrl: item.previewImageUrl || item.previewUrl,
    isPlaying: false,
  }));

  itemsList = itemsList.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  return itemsList;
});

// Watch for changes to the isOffline status
watch(isOffline, (newStatus) => {
  if (newStatus && route.params.seriesPoster) {
    currentIndex.value = 0;
  }
});

function nextItem() {
  if (!isOffline.value && currentIndex.value < orderedItems.value.length - 1) {
    currentIndex.value += 1;
  }
}

function prevItem() {
  if (!isOffline.value && currentIndex.value > 0) {
    currentIndex.value -= 1;
  }
}

onMounted(async () => {
  try {
    await fileStore.getFiles(route.params.email);
    isLoading.value = false;
  } catch (error) {
    console.error("Error in onMounted hook:", error);
    isLoading.value = false;
  }
});

const collectionsCloudFrontBaseUrl = "https://d26k8mraabzpiy.cloudfront.net";
const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";

function replaceS3WithCloudFront(url) {
  if (!url) return ""; // Return an empty string or handle accordingly if the URL is falsy

  if (url.includes("https://tpccollections.s3.amazonaws.com")) {
    return url.replace(
      "https://tpccollections.s3.amazonaws.com",
      collectionsCloudFrontBaseUrl
    );
  } else if (
    url.includes("https://theprivatecollection.s3.us-east-2.amazonaws.com") ||
    url.includes("https://theprivatecollection.s3.amazonaws.com")
  ) {
    return url.replace(
      /https:\/\/theprivatecollection\.s3(\.us-east-2)?\.amazonaws\.com/,
      cloudFrontBaseUrl
    );
  }

  return url;
}

async function isPortrait(url) {
  const video = document.createElement("video");
  video.src = url;

  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", () => {
      resolve(video.videoHeight > video.videoWidth);
    });
  });
}
async function handleItemClick(item, index) {
  // If the item is the series poster or an image, do nothing
  if (
    item.previewImageUrl === route.params.seriesPoster ||
    category.value === "Images"
  ) {
    return;
  }

  // If another item is already playing, stop it
  if (clickedItem.value && clickedItem.value !== item) {
    clickedItem.value.isPlaying = false;
  }

  // Toggle the clicked item's play state
  item.isPlaying = !item.isPlaying;

  // Update the clickedItem reference
  if (item.isPlaying) {
    clickedItem.value = item;
    item.isPortrait = await isPortrait(item.url); // Determine if the video is portrait
  } else {
    clickedItem.value = null;
  }

  // Update the current index
  currentIndex.value = index;
}

watch(currentIndex, () => {
  if (clickedItem.value) {
    clickedItem.value.isPlaying = false;
  }
});

function showDetails(item) {
  selectedItem.value = item;
  showDetailsPopup.value = true;
}

function sendHeart() {
  resetHeart();
}

function sendFiya() {
  resetFire();
}

function sendHeartEyes() {
  resetHeartEyes();
}

function sendThumbsUp() {
  resetThumbsUp();
}

function closeDetailsPopup() {
  showDetailsPopup.value = false;
}

function closePopup() {
  showPaymentPopup.value = false;
}

function handleMediaError(event) {
  console.error("Error loading media:", event.target.error);
}

function isVideo(url) {
  const videoExtensions = [
    "3gp",
    "mp4",
    "avi",
    "mkv",
    "mov",
    "wmv",
    "flv",
    "webm",
    "m3u8"
  ];
  const extension = url.split(".").pop();
  return videoExtensions.includes(extension);
}

function handleBackdropClick() {
  showSeriesPopup.value = false;
}

function toggleOfflineStatus() {
  isOffline.value = !isOffline.value;
}

function toggleOnlineStatus() {
  isOffline.value = true;
}

useHead(() => {
  return {
    title: folder.value,
    meta: [
      { hid: "og:title", property: "og:title", content: folder.value },
      { hid: "og:url", property: "og:url", content: ogImageUrl.value  },
      { hid: "og:site_name", property: "og:site_name", content: "Twilly" },

      {
        hid: "og:description",
        property: "og:description",
        content: folder.value,
      },
      { hid: "og:image", property: "og:image", content: ogImageUrl.value },
      { hid: "og:image:width", property: "og:image:width", content: "1280" },
      { hid: "og:image:height", property: "og:image:height", content: "720" },
      { hid: "og:image", property: "og:type", content: "image/jpeg" },

      { hid: "og:type", property: "og:type", content: "video.other" },
      { hid: "og:video:width", property: "og:image:width", content: "1280" },
      { hid: "og:video:height", property: "og:video:height", content: "720" },

      {
        hid: "twitter:url",
        name: "twitter:url",
        content: ogImageUrl.value,
      },
      {
        hid: "twitter:description",
        name: "twitter:description",
        content: folder.value,
      },
      {
        hid: "twitter:title",
        name: "twitter:title",
        content: folder.value,
      },
      {
        hid: "twitter:image",
        name: "twitter:image",
        content: ogImageUrl.value,
      },
    ],
  };
});
</script>

  <style scoped>
.view-series-button {
  position: absolute;
  top: 50%; /* Center vertically */
  left: 50%; /* Center horizontally */
  transform: translate(-50%, -50%); /* Correct centering with transform */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  padding: 5px 20px; /* Adjust padding to fit text */
  cursor: pointer;
  z-index: 2;
  white-space: nowrap; /* Prevent text from stacking */
  background-color: rgba(0, 0, 0, 0.5); /* Optional background */
  border-radius: 8px;
  margin-top: -90px; /* Optional rounded corners */
}
.see-more {
  background-color: #6200ea; /* Purple background */
  color: white; /* White text */
  font-size: 0.875rem; /* Text size */
  padding: 0.25rem 1.75rem; /* Decreased padding for tighter fit */
  border-radius: 0.25rem; /* Slightly rounded corners */
  cursor: pointer;
  display: inline-block;
  transition: background-color 0.2s ease-in-out;
}

.see-more:hover {
  background-color: #3700b3; /* Darker purple on hover */
}
.flex-container {
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.qr-container {
  display: flex;
  flex-direction: column; /* Stack children vertically */
  align-items: center;
  margin-top: -27px; /* Center children horizontally */
}

.qr-icon {
  cursor: pointer;
}

.qr-icon-svg {
  width: 24px;
  height: 24px;
  fill: #fff;
}

.share-instructions {
  margin-top: -5px; /* Space between QR code and text */
  color: #fff; /* Text color */
  text-align: center; /* Center text horizontally */
  font-size: 1rem; /* Font size */
  font-weight: bold; /* Text boldness */
}
.footer-links {
  display: flex;
  justify-content: center; /* Center items horizontally */
  gap: 20px; /* Space between items */
}

.footer-links a {
  color: hsl(190, 95%, 30%);
  text-decoration: none;
  font-weight: bold;
  transition: color 0.3s, transform 0.3s;
}

.footer-links a:hover {
  color: hsl(190, 95%, 60%);
  text-decoration: underline;
  transform: scale(1.05);
}

.footer {
  position: fixed;
  bottom: 0;
  width: 100%;
  background-color: black;
  color: #fff;
  padding: 10px 0; /* Adjusted padding for better footer height */
  margin-bottom: 0; /* Removed negative margin */
  text-align: center;
  font-size: 16px;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-logo {
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: hsl(190, 95%, 30%);
}

.footer-nav {
  display: flex;
  justify-content: center;
  margin: 10px 0;
}

.footer-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
}

.footer-nav li {
  margin: 0 25px; /* Space between links */
}

.footer-nav a {
  color: hsl(190, 95%, 30%);
  text-decoration: none;
  font-weight: bold;
  transition: color 0.3s, transform 0.3s;
}

.footer-nav a:hover {
  color: hsl(190, 95%, 60%);
  text-decoration: underline;
  transform: scale(1.05);
}

.footer-social {
  margin-top: 10px;
}

.social-icon {
  display: inline-block;
  margin: 0 10px;
  text-decoration: none;
  color: #fff;
  font-size: 1.5rem;
  transition: color 0.3s;
}

.social-icon:hover {
  color: hsl(190, 95%, 60%);
}

.arrow-icon {
  width: 24px;
  height: 24px;
  margin-left: 8px;
  fill: white;
  transition: transform 0.3s;
}

.see-more:hover .arrow-icon {
  transform: rotate(180deg);
}

.drawer-close {
  position: absolute;
  top: -10px;
  right: 2px;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
}

.about-series-drawer {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 125%;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  transition: bottom 0.3s ease;
  border-radius: 8px;
  border: 2px solid;
  border-image: linear-gradient(45deg, #ff007c, #590fb7, #00c6ff) 1;
  z-index: 5;
}

.about-series-drawer .content {
  padding: 15px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.6);
}

.about-series-drawer h3 {
  margin-top: 0;
}

.about-series-drawer p {
  margin: 10px 0 0;
}

/* Carousel styles */
.carousel-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.carousel-item {
  position: relative;
  width: 288px;
  height: 359px;
  margin-bottom: 20px;
}

.carousel-image {
  width: 100%;
  height: auto;
  object-fit: cover; /* Ensure the image covers the entire area */
  /* Light border around the image */
  border-radius: 8px;
  position: relative;
  /* Rounded corners */
}

.title-overlay {
  position: relative;
  text-align: center;
}

.item-title {
  font-size: 1.2rem;
  color: hsl(190, 95%, 30%);
  margin-bottom: 10px;
}

.online-indicator {
  width: 100%;
  height: 30px;
  background: hsl(190, 85%, 35%);
  color: white;
  text-align: center;
  line-height: 30px;
  font-weight: bold;
  font-size: 1rem;
}

/* Responsive styling */
@media (max-width: 768px) {
  .footer-links {
    display: flex;
    flex-direction: column;
  }

  .footer-links a {
    color: hsl(190, 95%, 30%);
    text-decoration: none;
    font-weight: bold;
    transition: color 0.3s, transform 0.3s;
    margin-bottom: -20px; /* Negative margin to reduce spacing between items */
  }

  .footer-links a:last-child {
    margin-bottom: 0; /* Remove margin for the last item */
  }
}

/* Ensure content is not obscured by footer */
.content {
  margin-bottom: 60px; /* Adjust this value to make sure footer doesn't cover content */
}
</style>