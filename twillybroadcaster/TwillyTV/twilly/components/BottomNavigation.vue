<template>
  <nav class="bottom-nav">
    <div class="nav-container">
      <NuxtLink 
        to="/home" 
        class="nav-item"
        :class="{ 'active': $route.path === '/home' }"
        @click="handleNavClick"
      >
        <Icon name="heroicons:home" class="nav-icon" />
        <span class="nav-label">Home</span>
      </NuxtLink>
      
      <NuxtLink 
        to="/channel-guide" 
        class="nav-item"
        :class="{ 'active': $route.path === '/channel-guide' }"
        @click="handleNavClick"
      >
        <Icon name="heroicons:tv" class="nav-icon" />
        <span class="nav-label">Channels</span>
      </NuxtLink>
      
      <template v-if="authStore.authenticated">
        <NuxtLink 
          to="/account" 
          class="nav-item"
          :class="{ 'active': $route.path.startsWith('/account') }"
          @click="handleNavClick"
        >
          <Icon name="heroicons:user-circle" class="nav-icon" />
          <span class="nav-label">Profile</span>
        </NuxtLink>
      </template>
      <template v-else>
        <NuxtLink 
          to="/signin" 
          class="nav-item"
          :class="{ 'active': $route.path === '/signin' }"
          @click="handleNavClick"
        >
          <Icon name="heroicons:user" class="nav-icon" />
          <span class="nav-label">Sign In</span>
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

// Force scroll to top when navigation links are clicked
const handleNavClick = () => {
  console.log('🔝 Bottom nav click initiated')
  
  // Use nextTick to ensure DOM updates complete before scrolling
  nextTick(() => {
    // Wait for navigation to complete
    setTimeout(() => {
      const forceScrollToTop = () => {
        // Nuclear scroll reset - try everything
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        
        // Force the entire document to scroll to absolute top
        document.documentElement.scrollIntoView({ 
          block: 'start', 
          inline: 'start',
          behavior: 'instant' 
        })
        
        // Target any possible scroll containers
        const scrollContainers = [
          document.querySelector('#__nuxt'),
          document.querySelector('.nuxt-layout'),
          document.querySelector('main'),
          document.body,
          document.documentElement
        ]
        
        scrollContainers.forEach(el => {
          if (el) {
            el.scrollTop = 0
            if (el.scrollTo) {
              el.scrollTo(0, 0)
            }
          }
        })
        
        // Force all scrollable elements to 0
        const allElements = document.querySelectorAll('*')
        allElements.forEach(el => {
          if (el.scrollTop > 0) {
            el.scrollTop = 0
          }
        })
        
        console.log('🔝 Applied nuclear scroll reset, final position:', window.scrollY)
      }
      
      forceScrollToTop()
      
      // Additional checks to ensure it worked
      setTimeout(() => {
        if (window.scrollY > 0) {
          console.log('🔝 Scroll position not at top, forcing again:', window.scrollY)
          forceScrollToTop()
        }
      }, 100)
      
      setTimeout(() => {
        if (window.scrollY > 0) {
          console.log('🔝 Final scroll check, forcing again:', window.scrollY)
          forceScrollToTop()
        } else {
          console.log('✅ Scroll position confirmed at top')
        }
      }, 300)
      
    }, 100)
  })
}
</script>

<style scoped>
.bottom-nav {
  /* Fixed positioning - back to original bottom */
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100vw !important;
  z-index: 1000 !important;
  
  /* Background and border - back to original */
  background: rgba(0, 0, 0, 0.95) !important;
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(20, 184, 166, 0.3);
  
  /* Hide on desktop, show on mobile/tablet */
  display: none;
}

.nav-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 8px;
  max-width: 100%;
  margin: 0 auto;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: #9CA3AF;
  transition: all 0.2s ease;
  min-width: 60px;
  
  /* Ensure good touch targets */
  touch-action: manipulation;
}

.nav-item:hover,
.nav-item.active {
  color: #14B8A6;
  background: rgba(20, 184, 166, 0.1);
}

.nav-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
}

/* Show on mobile and tablet */
@media (max-width: 1279px) {
  .bottom-nav {
    display: block !important;
  }
}

/* Ensure it works on very small screens */
@media (max-width: 640px) {
  .nav-container {
    padding: 10px 4px;
  }
  
  .nav-item {
    padding: 6px 8px;
    min-width: 50px;
  }
  
  .nav-icon {
    width: 20px;
    height: 20px;
  }
  
  .nav-label {
    font-size: 10px;
  }
}

/* Add safe area support for iPhone notch */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .nav-container {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
