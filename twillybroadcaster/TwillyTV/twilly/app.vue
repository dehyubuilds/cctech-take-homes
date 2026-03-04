<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NotificationSystem />
  </div>
</template>

<style>
/* Force all pages to start at the top */
html {
  scroll-behavior: auto;
  /* Fix iOS momentum scrolling issues */
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
}

body {
  scroll-behavior: auto;
  /* Prevent horizontal scroll */
  overflow-x: hidden;
  /* Fix mobile scroll issues */
  -webkit-overflow-scrolling: touch;
  /* Ensure proper touch handling */
  touch-action: pan-y;
  /* Add bottom padding for mobile navigation */
  padding-bottom: 0;
}

/* Fixed mobile scroll for better momentum and no sticking */
@media (max-width: 768px) {
  html {
    /* Force height and prevent scroll issues */
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    /* Remove momentum scrolling from html */
    -webkit-overflow-scrolling: auto;
    /* Simple touch action */
    touch-action: pan-y;
    /* No overscroll bounce on html */
    overscroll-behavior: none;
  }
  
  body {
    /* Make body the main scroll container */
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    /* Enable momentum scrolling only on body */
    -webkit-overflow-scrolling: touch;
    /* Allow natural pan gestures */
    touch-action: pan-y;
    /* Allow natural bounce */
    overscroll-behavior-y: auto;
    overscroll-behavior-x: none;
    /* Remove any positioning that could interfere */
    position: relative;
  }
  
  /* Prevent scroll issues on mobile */
  .min-h-screen {
    min-height: 100vh;
    min-height: 100dvh;
  }
  
  /* Fix touch action for all elements */
  * {
    /* Only allow pan-y to prevent conflicts */
    touch-action: pan-y !important;
    /* Remove tap highlights that can interfere */
    -webkit-tap-highlight-color: transparent;
    /* Prevent touch callouts */
    -webkit-touch-callout: none;
  }
  
  /* Specific touch handling for interactive elements */
  button, a, [role="button"], input, textarea {
    /* Allow manipulation for buttons/links */
    touch-action: manipulation !important;
  }
  
  /* Ensure scroll containers don't conflict */
  div, main, section, article {
    /* Don't add momentum scrolling to nested containers */
    -webkit-overflow-scrolling: auto;
    /* Simple touch handling */
    touch-action: inherit;
  }
  
  /* Fix for main content container */
  #__nuxt {
    /* Ensure proper height */
    min-height: 100vh;
    /* Simple overflow handling */
    overflow-x: hidden;
    /* Don't interfere with body scrolling */
    -webkit-overflow-scrolling: auto;
  }
  
  /* No bottom padding needed since navigation was removed */
  body {
    padding-bottom: 0 !important;
  }
}

/* Ensure smooth page transitions start from top */
.page-enter-active,
.page-leave-active {
  scroll-behavior: auto;
  /* Fix transition scroll issues */
  -webkit-overflow-scrolling: touch;
}

.page-enter-from,
.page-leave-to {
  scroll-behavior: auto;
}

/* Force scroll to top on route change */
.page-enter-active {
  position: relative;
  top: 0;
}

/* Override any existing scroll restoration */
* {
  scroll-behavior: auto !important;
  /* Prevent webkit scroll issues */
  -webkit-transform: translateZ(0);
}

/* Fix mobile scroll container issues */
@media (max-width: 768px) {
  /* Ensure proper scrolling container */
  #__nuxt {
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }
  
  /* Fix body scroll issues */
  body {
    position: relative;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
  }
  
  /* Prevent iOS safari bounce */
  html {
    overscroll-behavior-y: contain;
  }
}

/* Fix potential layout shift issues */
.backdrop-blur-sm {
  will-change: auto;
  transform: translateZ(0);
}

/* Performance optimizations that don't interfere with scroll */
@media (max-width: 768px) {
  /* Remove problematic transforms but keep scroll working */
  .animate-pulse,
  .transition-all,
  .transition-transform {
    -webkit-transform: none !important;
    transform: none !important;
    will-change: auto !important;
    animation: none !important;
  }
  
  /* Don't override the scroll container settings above */
  /* html, body settings are handled in the scroll section */
  
  /* Disable expensive visual effects on mobile */
  .backdrop-blur-sm {
    backdrop-filter: none !important;
    background: rgba(0, 0, 0, 0.8) !important;
  }
  
  /* Simplify gradients for performance */
  .bg-gradient-to-br {
    background: #084d5d !important;
  }
  
  /* Ensure content containers don't interfere with body scrolling */
  .max-w-4xl, .max-w-lg, .container {
    /* Don't add their own scrolling */
    overflow: visible;
    /* Let body handle all scrolling */
    -webkit-overflow-scrolling: auto;
  }
  
  /* Optimize heavy elements */
  img, video {
    /* Reduce repaints */
    will-change: auto;
    /* Avoid transform issues */
    transform: none;
  }
}
</style>
