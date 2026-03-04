import videojs from 'video.js'
import 'video.js/dist/video-js.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('VideoJs', {
    props: {
      options: {
        type: Object,
        required: true
      }
    },
    render() {
      return h('video', {
        class: 'video-js vjs-default-skin vjs-big-play-centered',
        ref: 'video'
      })
    },
    mounted() {
      const player = videojs(this.$refs.video, this.options)
      this.$emit('ready', player)
    },
    beforeUnmount() {
      if (this.$refs.video && this.$refs.video.player) {
        this.$refs.video.player.dispose()
      }
    }
  })
}) 