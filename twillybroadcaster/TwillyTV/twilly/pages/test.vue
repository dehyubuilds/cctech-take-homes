<template>
    <ContentDisplay/>
    <!-- <div class="channel-guide">
      <section class="channel-guide-content">
        <div class="carousel">
          <button class="carousel-control left" @click.stop="prevItem">
            &#10094;
          </button>
          
          <div class="carousel-wrapper">
            <div
              class="carousel-item"
              :class="{
                'non-clickable':
                  item.previewImageUrl === route.params.seriesPoster,
              }"
              v-for="(item, index) in orderedItems"
              :key="item.SK"
              v-show="index === currentIndex"
            >
              <div
                class="title-overlay"
                :style="{ display: getItemTitle(item) === '' ? 'none' : 'block' }"
              >
                {{ getItemTitle(item) }}
              </div>
              <div v-if="isLoading" class="loading-indicator"></div>
              <div v-else class="show-preview">
                <div class="media-preview">
                  <img
                    v-if="!item.isPlaying"
                    :src="item.previewImageUrl"
                    alt="Media Preview"
                    class="file-image"
                    @click="handleItemClick(item, index)"
                  />
                  <video
                    v-if="
                      clickedItem &&
                      clickedItem.isPlaying &&
                      index === currentIndex
                    "
                    autoplay
                    controls
                    preload="metadata"
                    :src="clickedItem.url"
                    class="file-player"
                    @error="handleMediaError"
                  ></video>
                  <button
                    v-if="!item.isPlaying"
                    class="play-button"
                    @click="handleItemClick(item, index)"
                  >
                    &#9658;
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button class="carousel-control right" @click.stop="nextItem">
            &#10095;
          </button>
        </div>
  
        <section v-if="orderedItems[currentIndex]?.previewImageUrl === route.params.seriesPoster" class="about-series-button">
          <button @click="showSeriesPopup = true">About Series</button>
        </section>
      </section>
  
      <div v-if="showSeriesPopup" class="series-popup">
        <div class="series-content">
          <button class="close-button" @click="showSeriesPopup = false">×</button>
          <h3>Series Information</h3>
          <p>This is the about section for the series. Here you can add detailed information about the series, including its background, key features, and anything else relevant to provide more context to the viewers.</p>
        </div>
      </div>
    </div> -->
  </template>
  
  
  
  <script setup>
  import { ref, computed, onMounted, watch } from "vue";
  import { storeToRefs } from "pinia";
  import { useFileStore } from "@/stores/useFileStore";
  import { useRoute } from "vue-router";
  
  
  const showSeriesPopup = ref(false); // Manage visibility of the series popup
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
  const getItemTitle = (item) => {
    return item.Title === "notitle" ? "" : item.Title;
  };
  
  const computedOgImageUrl = computed(() => ogImageUrl.value);
  
  const filteredItems = computed(() => {
    switch (category.value) {
      case "Videos":
        return videos.value
          .filter((video) => video.folderName === folder.value)
          .map((video) => ({
            ...video,
            previewUrl: video.url.replace(/\.[^/.]+$/, ".gif"),
            previewImageUrl: video.previewImageUrl || video.previewUrl,
            isPlaying: false,
          }));
      case "Images":
        return images.value
          .filter((image) => image.folderName === folder.value)
          .map((image) => ({
            ...image,
            previewUrl: image.url,
            previewImageUrl: image.previewImageUrl || image.previewUrl,
            isPlaying: false,
          }));
      default:
        return [];
    }
  });
  
  const orderedItems = computed(() => {
    const seriesPoster = route.params.seriesPoster;
  
    let itemsList = filteredItems.value.map((item) => ({
      ...item,
      previewImageUrl: item.previewImageUrl || item.previewUrl,
      isPlaying: false,
    }));
  
    if (seriesPoster) {
      itemsList = [
        {
          Title: folder.value,
          previewImageUrl: seriesPoster,
          isPlaying: false,
          url: seriesPoster,
        },
        ...itemsList,
      ];
    }
  
    return itemsList;
  });
  
  onMounted(async () => {
    try {
      await fileStore.getFiles(route.params.email);
      isLoading.value = false;
    } catch (error) {
      console.error("Error in onMounted hook:", error);
      isLoading.value = false;
    }
  });
  
  function handleItemClick(item, index) {
    if (item.url === route.params.seriesPoster) {
      return;
    }
  
    if (clickedItem.value && clickedItem.value !== item) {
      clickedItem.value.isPlaying = false;
    }
  
    if (category.value === "Images") {
      item.isPlaying = false;
      clickedItem.value.isPlaying = false;
    }
  
    item.isPlaying = !item.isPlaying;
    clickedItem.value = item;
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
  
  function closeDetailsPopup() {
    showDetailsPopup.value = false;
  }
  
  function closePopup() {
    showPaymentPopup.value = false;
  }
  
  function handleMediaError(event) {
    console.error("Error loading media:", event.target.error);
  }
  
  function prevItem() {
    currentIndex.value =
      (currentIndex.value - 1 + orderedItems.value.length) %
      orderedItems.value.length;
  }
  
  function nextItem() {
    currentIndex.value = (currentIndex.value + 1) % orderedItems.value.length;
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
  
  useHead({
    title: folder.value,
    meta: [
      { hid: "og:title", property: "og:title", content: folder.value },
      { hid: "og:url", property: "og:url", content: "" },
      { hid: "og:site_name", property: "og:site_name", content: "Twilly" },
      {
        hid: "og:description",
        property: "og:description",
        content: folder.value,
      },
      { hid: "og:image", property: "og:image", content: ogImageUrl.value },
      { hid: "og:image:width", property: "og:image:width", content: "1280" },
      { hid: "og:image:height", property: "og:image:height", content: "720" },
      { hid: "og:type", property: "og:type", content: "video.other" },
      { hid: "og:video:width", property: "og:video:width", content: "1280" },
      { hid: "og:video:height", property: "og:video:height", content: "720" },
      { hid: "twitter:url", name: "twitter:url", content: "" },
      {
        hid: "twitter:description",
        name: "twitter:description",
        content: folder.value,
      },
      { hid: "twitter:title", name: "twitter:title", content: folder.value },
      { hid: "twitter:image", name: "twitter:image", content: ogImageUrl.value },
    ],
  });
  </script>
  
  <style scoped>
  .series-content {
    background: #fff;
    padding: 20px;
    border-radius: 10px;
    max-width: 600px;
    width: 100%;
  }
  .series-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:white;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .about-series-button {
    background: hsl(190, 95%, 20%); /* Gradient background */
    color: white; /* White text for contrast */
    border: 2px solid hsl(190, 95%, 20%); /* Matching border color with gradient */
    padding: 8px 20px; /* Adequate padding for a button */
    border-radius: 12px; /* More rounded corners for a modern touch */
    font-size: 1.2rem; /* Larger text for better readability */
    font-weight: bold; /* Bold text for emphasis */
    text-transform: uppercase; /* Uppercase text for style */
    cursor: pointer; /* Pointer cursor to indicate it's clickable */
    transition: all 0.3s ease; /* Smooth transition for hover effects */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); /* Subtle shadow for depth */
  }
  
  .about-series-button:hover {
    background: hsl(190, 95%, 20%); /* Brighter gradient on hover */
    color: #fff; /* Keep text color white */
    border-color: hsl(190, 95%, 20%); /* Lighter border on hover */
    transform: translateY(-4px); /* More pronounced lift effect on hover */
  }
  
  .about-series-button:active {
    background: linear-gradient(135deg, hsl(190, 95%, 30%) 0%, hsl(190, 95%, 20%) 100%); /* Darker gradient when pressed */
    border-color: hsl(190, 95%, 30%); /* Match border color */
    transform: translateY(1px); /* Slightly depress button on click */
  }
  .non-clickable {
    cursor: default; /* Make the cursor indicate that the item is not clickable */
    pointer-events: none; /* Disable click events */
  }
  
  .show-preview {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }
  
  .details-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 50;
  }
  
  .details-content {
    background-color: white;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    max-width: 500px;
    width: 90%;
  }
  
  .details-popup .close-button,
  .payment-popup .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #ff5a5f;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .price-tag {
    background-color: #ff5a5f;
    color: #fff;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 1rem;
  }
  
  .channel-guide-content {
    display: flex;
    flex-direction: column; /* Changed to column to stack children vertically */
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f9f9f9;
  }
  
  .carousel {
    position: relative;
    width: 80%;
    max-width: 800px;
    overflow: hidden;
  }
  
  .carousel-wrapper {
    display: flex;
    transition: transform 0.5s ease;
    margin-bottom: 20px;
  }
  
  .carousel-item {
    position: relative;
    flex: 0 0 100%;
    box-sizing: border-box;
    padding: 0 10px;
  }
  
  .item-title {
    padding-bottom: 10px;
    font-size: 2rem;
    color: hsl(190, 95%, 30%);
    text-align: center;
    margin: -10px 0;
    font-weight: bold;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
  }
  
  .carousel-control {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: hsl(190, 95%, 30%);
    border: none;
    padding: 10px;
    cursor: pointer;
    z-index: 1;
    width: auto;
    height: auto;
    border-radius: 50%;
    font-size: 2rem;
  }
  
  .carousel-control.left {
    left: 150px;
  }
  
  .carousel-control.right {
    right: 150px;
  }
  
  .media-preview {
    position: relative;
    cursor: pointer;
    overflow: hidden;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
  
  .file-image,
  .file-player {
    width: 50%;
    max-height: 620px;
    object-fit: cover;
    border: 1px solid #000;
    box-shadow: 0 0 20px #000000cc;
    border-radius: 10px;
  }
  
  .play-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    border: 1px solid black; /* Added border style */
    padding: 10px 15px;
    border-radius: 50%;
    font-size: 2.5rem;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0; /* Make the button invisible */
    pointer-events: none; /* Prevents the button from being clickable */
    transition: opacity 0.3s ease; /* Smooth transition for visibility changes */
  }
  
  .play-button.visible {
    opacity: 1; /* Make the button visible when the 'visible' class is added */
    pointer-events: auto; /* Re-enable clicks when the 'visible' class is added */
  }
  
  .play-button:hover {
    background: hsla(190, 95%, 30%, 1);
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
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 100;
  }
  
  .payment-popup .popup-content {
    background-color: white;
    padding: 2rem;
    border-radius: 10px;
    max-width: 500px;
    width: 90%;
  }
  
  .payment-popup .popup-scrollable-content {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .stripe-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
  
  .loading-indicator {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 2s linear infinite;
    margin: 10px auto;
  }
  
  .error-message {
    color: red;
    text-align: center;
    margin-top: 20px;
  }
  
  .title-overlay {
    position: absolute;
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px;
    border-radius: 5px;
    font-size: 1.2rem;
    text-align: center;
    z-index: 10;
  }
  
  /* Media queries */
  @media (max-width: 600px) {
    .carousel {
      position: relative;
      width: 80%;
      max-width: 800px;
      overflow: visible; /* Allows controls to be visible outside */
      margin-top: -200px;
    }
  
    .carousel-wrapper {
      display: flex;
      transition: transform 0.5s ease;
    }
  
    .channel-guide-content {
      display: flex;
      flex-direction: column; /* Ensure vertical stacking */
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f9f9f9;
    }
  
    .carousel-control.left {
      left: -40px; /* Increased space on the left */
    }
  
    .carousel-control.right {
      right: -40px; /* Increased space on the right */
    }
  
    .title-overlay {
      position: absolute;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      background-color: rgba(0, 0, 0, 0.5);
      padding: 5px;
      border-radius: 5px;
      font-size: 1.2rem;
      text-align: center;
      z-index: 10; /* Ensure it's above other content */
    }
  
    .item-title {
      font-size: 1.2rem;
      margin-top: -5px;
    }
  
    .carousel-control {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      color: hsl(190, 95%, 30%);
      border: none;
      padding: 10px;
      cursor: pointer;
      z-index: 1;
      width: auto;
      height: auto;
      border-radius: 50%;
      font-size: 2.5rem;
    }
  
    .file-image,
    .file-player {
      width: 90%;
      max-height: 100%;
      object-fit: cover;
      border: 1px solid #000;
      box-shadow: 0 0 20px #000000cc;
      border-radius: 10px;
    }
  
    .details-content,
    .payment-popup .popup-content {
      padding: 1rem;
    }
  }
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  </style>