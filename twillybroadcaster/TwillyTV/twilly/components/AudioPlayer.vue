<template>
    <div class="audio-preview">
      <!-- Image Preview with Overlay -->
      <div class="image-container">
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="Audio Cover"
          class="file-image"
          @click="handlePreviewClick"
        />
        <div v-else class="no-preview">
          <p>No preview available</p>
        </div>
  
        <!-- Play Button Overlay -->
        <div
          class="play-button"
          v-if="audioPlaying && isPlayed"
          @click="handlePreviewClick"
        >
          <span class="play-text">Pause</span>
        </div>
      </div>
  
      <!-- Audio Player Controls -->
      <div class="audio-controls" :class="{ 'show-controls': showControls }">
        <button class="control-button rewind" @click="rewindTrack">⏪</button>
        <button class="control-button play-pause" @click="toggleAudioPlayback">
          {{ audioPlaying ? '❚❚' : '▶️' }}
        </button>
        <button class="control-button forward" @click="forwardTrack">⏩</button>
      </div>
  
      <!-- Audio Player -->
      <audio
        ref="audioRef"
        :src="reconstructedUrl"
        controls
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
        class="audio-player"
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  
  const props = defineProps({
    previewUrl: String,
    url: String,
    title: String,
    description: String
  });
  
  const audioPlaying = ref(false);
  const isPlayed = ref(false);
  const showControls = ref(false);
  const audioRef = ref(null);
  
  let controlsTimeout;
  
  const reconstructedUrl = computed(() => props.url);
  
  function handlePreviewClick() {
    const audio = audioRef.value;
    if (audio) {
      if (!audioPlaying.value) {
        audio.play().then(() => {
          audioPlaying.value = true;
          isPlayed.value = true;
          showControls.value = true;
        }).catch(error => {
          console.error('Playback error:', error);
        });
      } else {
        audio.pause();
        audioPlaying.value = false;
        showControls.value = false;
      }
  
      // Reset the controls timeout
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        showControls.value = false;
      }, 3000);
    }
  }
  
  function toggleAudioPlayback() {
    const audio = audioRef.value;
    if (audio) {
      if (audioPlaying.value) {
        audio.pause();
        audioPlaying.value = false;
      } else {
        audio.play().then(() => {
          audioPlaying.value = true;
        }).catch(error => {
          console.error('Playback error:', error);
        });
      }
      showControls.value = true;
    }
  }
  
  function rewindTrack() {
    const audio = audioRef.value;
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
      showControls.value = true;
    }
  }
  
  function forwardTrack() {
    const audio = audioRef.value;
    if (audio) {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
      showControls.value = true;
    }
  }
  
  function onPlay() {
    audioPlaying.value = true;
    showControls.value = true;
  }
  
  function onPause() {
    audioPlaying.value = false;
  }
  
  function onEnded() {
    audioPlaying.value = false;
    showControls.value = false;
  }
  </script>
  
  <style scoped>
  .audio-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 1rem;
  }
  
  .image-container {
    position: relative;
    display: inline-block;
  }
  
  .file-image {
    max-width: 90%;
    height: auto;
    margin: auto;
    display: block;
    border: 4px solid #333;
    box-shadow: 0 0 20px #000000cc;
    border-radius: 10px;
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
  
  .audio-controls {
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
  
  .audio-player {
    display: none; /* Hide default controls */
  }
  </style>
  
  