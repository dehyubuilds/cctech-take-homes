export default defineNuxtRouteMiddleware((to, from) => {
  // Only run on client side
  if (process.client) {
    // Force scroll to top on every navigation
    window.scrollTo(0, 0);
    
    // Also reset body and document element scroll positions
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    
    // Additional safety check after navigation
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  }
}); 