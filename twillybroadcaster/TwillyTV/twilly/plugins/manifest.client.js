export default defineNuxtPlugin(() => {
  if (process.client) {
    console.log('🔧 Manifest Plugin: Initializing...')
    
    // Function to ensure manifest link exists
    const ensureManifestLink = () => {
      // Check if manifest link already exists
      let manifestLink = document.querySelector('link[rel="manifest"]')
      
      if (!manifestLink) {
        console.log('🔧 Manifest Plugin: Creating manifest link...')
        
        // Create new manifest link
        manifestLink = document.createElement('link')
        manifestLink.rel = 'manifest'
        manifestLink.href = '/site.webmanifest'
        manifestLink.type = 'application/manifest+json'
        
        // Add to head
        document.head.appendChild(manifestLink)
        
        console.log('✅ Manifest Plugin: Manifest link created and added to head')
        console.log('🔧 Manifest Plugin: Link href:', manifestLink.href)
        console.log('🔧 Manifest Plugin: Link rel:', manifestLink.rel)
      } else {
        console.log('✅ Manifest Plugin: Manifest link already exists')
        console.log('🔧 Manifest Plugin: Link href:', manifestLink.href)
      }
      
      return manifestLink
    }
    
    // Ensure manifest link exists immediately
    ensureManifestLink()
    
    // Also ensure it exists after DOM is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureManifestLink)
    }
    
    // Ensure it exists after a short delay (for dynamic content)
    setTimeout(ensureManifestLink, 100)
    setTimeout(ensureManifestLink, 500)
    setTimeout(ensureManifestLink, 1000)
    
    console.log('✅ Manifest Plugin: Initialized successfully')
  }
})
