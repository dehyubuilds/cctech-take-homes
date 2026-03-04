export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type');
  
  // For now, return mock data to demonstrate the WebSocket integration
  // In production, this would fetch from DynamoDB or other data sources
  
  switch (type) {
    case 'channels':
      return [
        { id: 'channel1', name: 'Sample Channel 1', description: 'A sample channel for testing' },
        { id: 'channel2', name: 'Sample Channel 2', description: 'Another sample channel' }
      ];
      
    case 'featured':
      return [
        { id: 'featured1', title: 'Featured Content 1', type: 'video' },
        { id: 'featured2', title: 'Featured Content 2', type: 'image' }
      ];
      
    case 'live':
      return [
        { id: 'live1', title: 'Live Stream 1', viewers: 150, status: 'live' },
        { id: 'live2', title: 'Live Stream 2', viewers: 89, status: 'live' }
      ];
      
    case 'episodes':
      return [
        { id: 'episode1', title: 'Episode 1', series: 'Sample Series', duration: '45:00' },
        { id: 'episode2', title: 'Episode 2', series: 'Sample Series', duration: '42:30' }
      ];
      
    case 'series':
      return [
        { id: 'series1', name: 'Sample Series 1', episodeCount: 12, status: 'ongoing' },
        { id: 'series2', name: 'Sample Series 2', episodeCount: 8, status: 'completed' }
      ];
      
    case 'fire':
      return [
        { id: 'fire1', title: 'Fire Content 1', category: 'trending' },
        { id: 'fire2', title: 'Fire Content 2', category: 'hot' }
      ];
      
    default:
      return [];
  }
});
