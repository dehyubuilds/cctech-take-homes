export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, channelName } = body;

    if (!username || !channelName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: username, channelName'
      });
    }

    // Get channel data from the database
    let channelData = null;
    try {
      channelData = await $fetch('/api/creators/get-share-params', {
        method: 'POST',
        body: { username, series: channelName }
      });
    } catch (e) {
      console.error('Failed to get channel data:', e);
    }

    // Determine the best image to use for meta tags
    let metaImage = '';
    
    // Check if this is a Twilly channel (use local assets)
    const twillyAssets = {
      'twilly-after-dark': '/assets/channels/icon-512.png',
      'twilly-fit': '/assets/channels/twilly-fit-icon.png',
      'twilly-game-zone': '/assets/channels/twilly-game-zone-icon.png',
      'twilly-music-stream': '/assets/channels/twilly-music-stream-icon.png',
      'twilly-tech-stream': '/assets/channels/twilly-tech-stream-icon.png'
    };

    const isTwillyChannel = twillyAssets[channelName.toLowerCase()];
    
    if (isTwillyChannel) {
      // Use the specific Twilly asset
      metaImage = isTwillyChannel;
    } else if (channelData?.originalPosterUrl) {
      // Use the channel's custom poster
      metaImage = channelData.originalPosterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
    } else {
      // Fallback to default Twilly asset for guaranteed compatibility
      metaImage = '/assets/channels/icon-512.png';
    }

    // Generate meta tags
    const metaTags = {
      title: channelData?.title || channelName,
      description: channelData?.description || `Check out this series from ${username}`,
      image: metaImage,
      url: `https://twilly.app/${username}/${channelName}`,
      type: 'website',
      siteName: 'Twilly'
    };

    return {
      success: true,
      metaTags,
      message: 'Meta tags generated successfully'
    };

  } catch (error) {
    console.error('Error generating meta tags:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to generate meta tags'
    };
  }
});
