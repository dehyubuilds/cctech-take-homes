<template>
  <div id="webviewer" ref="viewer"></div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  path: String,
  url: String
});

const viewer = ref(null);

onMounted(async () => {
  const { default: WebViewer } = await import('@pdftron/webviewer');

  // Function to set dynamic height
  const setViewerHeight = () => {
    // Set height to window inner height to account for dynamic viewport changes
    viewer.value.style.height = `${window.innerHeight}px`;
  };

  // Initialize WebViewer
  WebViewer({
    path: props.path,
    initialDoc: props.url, 
    licenseKey: 'demo:1726196513523:7e28f89c03000000003e098b56ae784e09599c541cc6e14c099d73261f',
  }, viewer.value).then((instance) => {
    let documentViewer = instance.Core.documentViewer;
    let annotationManager = instance.Core.annotationManager; 
    annotationManager.disableReadOnlyMode();

    // Set initial height
    setViewerHeight();

    // Adjust height on window resize
    window.addEventListener('resize', setViewerHeight);

    documentViewer.addEventListener('documentLoaded', () => {
      // Optional: Additional adjustments if needed
    });
  });
});
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Prevent body scrolling */
  touch-action: pan-y; /* Improve touch behavior */
}

#app {
  height: 100vh; /* Full height of viewport */
  overflow: hidden; /* Prevent scrolling in app */
}


#webviewer {
  height: calc(env(safe-area-inset-bottom) + 100vh); /* Adjust for bottom safe area */
  width: 100vw; /* Full width of viewport */
  overflow: auto; /* Enable scrolling */
  -webkit-overflow-scrolling: touch; /* Smooth scrolling for iOS */
}

/* Additional media query for mobile */
@media (max-width: 768px) {
  #webviewer {
    height: calc(env(safe-area-inset-bottom) + 100vh); /* Adjust for bottom safe area */
    width: 100vw; /* Ensure full width on mobile */
    -webkit-overflow-scrolling: touch; /* Smooth scrolling for iOS */
  }
}
</style>