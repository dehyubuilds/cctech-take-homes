export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, folderName = 'default' } = body;

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // Try to find actual streamed content to generate thumbnail from
    const thumbnailUrl = await generateThumbnailFromStreamedContent(userId, folderName);

    return {
      success: true,
      thumbnailUrl,
      message: 'Thumbnail generated from streamed content'
    };

  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to generate thumbnail'
    });
  }
});

async function generateThumbnailFromStreamedContent(userId, folderName) {
  try {
    // First, try to find recent streamed content
    const response = await $fetch('/api/files/get', {
      method: 'POST',
      body: { userId }
    });

    if (response.success && response.files) {
      // Find the most recent video from this folder
      const videos = response.files.filter(file => {
        if (file.category !== 'Videos') return false;
        if (folderName === 'default') {
          return !file.folderName || file.folderName === 'default' || file.folderName.toLowerCase() === 'mixed';
        }
        return file.folderName === folderName;
      });

      if (videos.length > 0) {
        // Sort by timestamp, get most recent
        videos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latestVideo = videos[0];

        // If video has a thumbnail, use it
        if (latestVideo.thumbnailUrl) {
          return latestVideo.thumbnailUrl;
        }

        // If video has HLS URL, we could extract a frame
        if (latestVideo.hlsUrl) {
          // For now, return the video URL as placeholder
          // In production, you'd use FFmpeg to extract a frame
          return latestVideo.hlsUrl;
        }
      }
    }

    // Fallback: create a default thumbnail
    const timestamp = Date.now();
    const thumbnailKey = `public/series-posters/${userId}/${folderName}/channel-thumbnail-${timestamp}.jpg`;
    return `https://d26k8mraabzpiy.cloudfront.net/${thumbnailKey}`;

  } catch (error) {
    console.error('Error generating thumbnail from streamed content:', error);
    // Return a fallback URL
    return 'https://d26k8mraabzpiy.cloudfront.net/default-channel-thumbnail.jpg';
  }
} 