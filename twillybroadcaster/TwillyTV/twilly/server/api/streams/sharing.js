export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { userId } = query;

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // This would fetch stream collections and individual clips from your database
    // For now, return mock data
    const collections = [
      {
        id: 'collection_1',
        name: 'Dark Knights Event Collection',
        description: 'Complete collection from the Dark Knights event',
        thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Dark+Knights',
        createdAt: new Date().toISOString(),
        clips: [
          {
            id: 'clip1',
            title: 'Opening Ceremony',
            description: 'Live stream from the opening ceremony',
            duration: 1800,
            price: 5.99,
            hlsUrl: 'https://your-cloudfront.net/events/dark-knights-1/playlist.m3u8',
            thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Opening',
            createdAt: new Date().toISOString()
          },
          {
            id: 'clip2',
            title: 'Main Event',
            description: 'The main event highlights',
            duration: 3600,
            price: 9.99,
            hlsUrl: 'https://your-cloudfront.net/events/dark-knights-2/playlist.m3u8',
            thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Main+Event',
            createdAt: new Date().toISOString()
          }
        ]
      }
    ];

    const individualClips = [
      {
        id: 'individual1',
        title: 'Special Performance',
        description: 'Exclusive performance clip',
        duration: 900,
        price: 3.99,
        hlsUrl: 'https://your-cloudfront.net/events/special/playlist.m3u8',
        thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Special',
        createdAt: new Date().toISOString()
      }
    ];

    return {
      success: true,
      collections,
      individualClips
    };
  } catch (error) {
    console.error('Error fetching stream sharing data:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
}); 