export default defineNuxtPlugin(() => {
  if (process.client) {
    const router = useRouter()
    
    // Enhanced scroll reset for all navigation types
    const forceScrollToTop = () => {
      // Multiple aggressive methods to ensure scroll reset works
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
      
      // Force window to position 0
      if (window.pageYOffset !== 0) {
        window.pageYOffset = 0
      }
      
      // Force scroll container to 0
      const scrollContainer = document.querySelector('#__nuxt') || document.body
      scrollContainer.scrollTop = 0
      
      // Nuclear option - force everything to 0
      const allScrollableElements = document.querySelectorAll('*')
      allScrollableElements.forEach(el => {
        if (el.scrollTop > 0) {
          el.scrollTop = 0
        }
      })
    }
    
    // Scroll to top on all route changes
    router.beforeEach((to, from) => {
      // Immediate scroll reset before navigation
      forceScrollToTop()
    })
    
    router.afterEach((to, from) => {
      // Ensure scroll reset after DOM updates
      nextTick(() => {
        forceScrollToTop()
        
        // More aggressive checking for navigation issues
        setTimeout(() => {
          if (window.scrollY > 0) {
            console.log('🔝 Scroll not at top after navigation, forcing:', window.scrollY)
            forceScrollToTop()
          }
        }, 50)
        
        setTimeout(() => {
          if (window.scrollY > 0) {
            console.log('🔝 Second scroll check, forcing:', window.scrollY)
            forceScrollToTop()
          }
        }, 150)
        
        setTimeout(() => {
          if (window.scrollY > 0) {
            console.log('🔝 Final scroll check, forcing:', window.scrollY)
            forceScrollToTop()
            
            // If still not at top, try scrolling above 0 to force reset
            setTimeout(() => {
              if (window.scrollY > 0) {
                console.log('🔝 Emergency scroll - trying negative offset')
                window.scrollTo(0, -100)
                setTimeout(() => {
                  window.scrollTo(0, 0)
                }, 50)
              }
            }, 100)
          } else {
            console.log('✅ Page loaded at top position')
          }
        }, 300)
      })
    })
    
    // Handle programmatic navigation
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      setTimeout(forceScrollToTop, 50)
    }
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      setTimeout(forceScrollToTop, 50)
    }
    
    console.log('🔝 Enhanced scroll reset plugin initialized')
  }
})

