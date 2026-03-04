import { VideoPlayer } from 'vue-hls-video-player'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('VideoPlayer', VideoPlayer)
}) 