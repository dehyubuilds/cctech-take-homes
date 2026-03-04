export default defineEventHandler(async (event) => {
  const method = event.method;
  
  try {
    switch (method) {
      case 'GET':
        return await getClips(event);
      case 'POST':
        return await createClip(event);
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error(`Error in clips API (${method}):`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});

async function getClips(event) {
  const query = getQuery(event);
  const { userId } = query;

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    });
  }

  // This would fetch clips from your database
  // For now, return mock data
  const clips = [
    {
      id: '1',
      title: 'Dark Knights Event - Opening',
      description: 'Live stream from the opening ceremony',
      duration: 1800,
      price: 5.99,
      hlsUrl: 'https://your-cloudfront.net/events/dark-knights-1/playlist.m3u8',
      thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Stream+Clip',
      status: 'completed',
      createdAt: new Date().toISOString(),
      userId
    }
  ];

  return {
    success: true,
    clips
  };
}

async function createClip(event) {
  const body = await readBody(event);
  const { title, description, price, hlsUrl, userId } = body;

  if (!title || !hlsUrl || !userId) {
    throw createError({
      statusCode: 400,
      message: 'Title, HLS URL, and User ID are required'
    });
  }

  // This would save the clip to your database
  const newClip = {
    id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    description: description || '',
    price: parseFloat(price) || 0,
    hlsUrl,
    thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Stream+Clip',
    status: 'completed',
    createdAt: new Date().toISOString(),
    userId
  };

  console.log('Creating new clip:', newClip);

  return {
    success: true,
    clip: newClip
  };
} 