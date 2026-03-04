export default defineNuxtRouteMiddleware((to) => {
  // Twilly channel social media mappings
  const TWILLY_CHANNEL_SOCIAL = {
    'twilly-after-dark': {
      title: 'Twilly After Dark',
      description: 'Check out this series from DehSin365',
      image: '/assets/channels/icon-512.png'
    },
    'twilly-fit': {
      title: 'Twilly Fit',
      description: 'Check out this series from DehSin365',
      image: '/assets/twilly-fit-icon.png'
    },
    'twilly-game-zone': {
      title: 'Twilly Game Zone',
      description: 'Check out this series from DehSin365',
      image: '/assets/twilly-game-zone-icon.png'
    },
    'twilly-music-stream': {
      title: 'Twilly Music Stream',
      description: 'Check out this series from DehSin365',
      image: '/assets/twilly-music-stream-icon.png'
    },
    'twilly-tech-stream': {
      title: 'Twilly Tech Stream',
      description: 'Check out this series from DehSin365',
      image: '/assets/twilly-tech-stream-icon.png'
    }
  };

  // Handle clean channel URLs
  if (to.path.startsWith('/channel/')) {
    const { username, channel } = to.params;
    
    // Check if this is a Twilly channel
    if (TWILLY_CHANNEL_SOCIAL[channel]) {
      const channelData = TWILLY_CHANNEL_SOCIAL[channel];
      // Set server-side meta tags for Twilly channels
      useHead({
        title: channelData.title,
        meta: [
          { property: 'og:title', content: channelData.title },
          { property: 'og:description', content: channelData.description },
          { property: 'og:image', content: channelData.image },
          { property: 'og:image:width', content: '512' },
          { property: 'og:image:height', content: '512' },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:url', content: to.fullPath },
          { property: 'og:type', content: 'website' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: channelData.title },
          { name: 'twitter:description', content: channelData.description },
          { name: 'twitter:image', content: channelData.image },
          { name: 'twitter:image:alt', content: channelData.title }
        ]
      });
    }
  }
  
  // Handle legacy share pages
  if (to.path.startsWith('/menu/share/')) {
    const { username, series } = to.params;
    const { title, description } = to.query;
    
    // Check if this is a Twilly channel
    const seriesName = decodeURIComponent(series || '').toLowerCase();
    const twillyChannelMap = {
      'twilly after dark': 'twilly-after-dark',
      'twilly fit': 'twilly-fit',
      'twilly game zone': 'twilly-game-zone',
      'twilly music stream': 'twilly-music-stream',
      'twilly tech stream': 'twilly-tech-stream'
    };
    
    const channelSlug = twillyChannelMap[seriesName];
    
    if (channelSlug && TWILLY_CHANNEL_SOCIAL[channelSlug]) {
      const channelData = TWILLY_CHANNEL_SOCIAL[channelSlug];
      // Set server-side meta tags for Twilly channels
      useHead({
        title: title || channelData.title,
        meta: [
          { property: 'og:title', content: title || channelData.title },
          { property: 'og:description', content: description || channelData.description },
          { property: 'og:image', content: channelData.image },
          { property: 'og:image:width', content: '512' },
          { property: 'og:image:height', content: '512' },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:url', content: to.fullPath },
          { property: 'og:type', content: 'website' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: title || channelData.title },
          { name: 'twitter:description', content: description || channelData.description },
          { name: 'twitter:image', content: channelData.image },
          { name: 'twitter:image:alt', content: title || channelData.title }
        ]
      });
    }
  }
  
  // Handle talent request pages
  if (to.path.startsWith('/talent-request/')) {
    const { creatorUsername, channelId } = to.params;
    const { rid, title, description } = to.query;
    
    // Check if this is a Twilly channel
    const channelName = decodeURIComponent(channelId || '').toLowerCase();
    const twillyChannelMap = {
      'twilly after dark': 'twilly-after-dark',
      'twilly fit': 'twilly-fit',
      'twilly game zone': 'twilly-game-zone',
      'twilly music stream': 'twilly-music-stream',
      'twilly tech stream': 'twilly-tech-stream'
    };
    
    const channelSlug = twillyChannelMap[channelName];
    
    if (channelSlug && TWILLY_CHANNEL_SOCIAL[channelSlug]) {
      const channelData = TWILLY_CHANNEL_SOCIAL[channelSlug];
      
      // For talent request pages, let the page-specific useHead handle detailed meta tags
      // This middleware only sets basic fallback tags
      useHead({
        title: title || `${channelId} Talent Requests`,
        meta: [
          { property: 'og:type', content: 'website' },
          { property: 'og:url', content: to.fullPath },
          { name: 'twitter:card', content: 'summary_large_image' }
        ]
      });
    }
  }
});
