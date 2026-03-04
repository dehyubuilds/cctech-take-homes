// Get the EC2 IP - use fallback if not available
const EC2_IP = '54.144.99.23';

export default {
  // EC2 Instance Configuration
  ec2: {
    ip: EC2_IP,
    region: 'us-east-1',
    ports: {
      rtmp: 1935,
      http: 80,
      https: 443,
      api: 3000
    }
  },

  // RTMP Configuration
  rtmp: {
    server: `rtmp://${EC2_IP}/live`,
    application: 'live',
    chunkSize: 4096
  },

  // HLS Configuration
  hls: {
    baseUrl: `http://${EC2_IP}/hls`,
    fragmentTime: 3,
    playlistLength: 60,
    variants: {
      '1080p': { resolution: '1920x1080', bandwidth: 5128000 },
      '720p': { resolution: '1280x720', bandwidth: 2628000 },
      '480p': { resolution: '854x480', bandwidth: 1128000 },
      '360p': { resolution: '640x360', bandwidth: 878000 },
      '240p': { resolution: '426x240', bandwidth: 528000 }
    }
  },

  // CloudFront Configuration (if using)
  cloudfront: {
    domain: null,
    baseUrl: `http://${EC2_IP}/hls`
  },

  // Stream Management
  streamManagement: {
    apiUrl: `http://${EC2_IP}:3000/api`,
    webhookUrl: `http://${EC2_IP}:3000/api/streams`
  },

  // Larix Broadcaster Settings
  larix: {
    server: `rtmp://${EC2_IP}/live`,
    streamKey: 'your-stream-key',
    videoSettings: {
      resolution: '1280x720',
      fps: 30,
      bitrate: 2500
    },
    audioSettings: {
      codec: 'AAC',
      bitrate: 128,
      sampleRate: 44100,
      channels: 2
    }
  },

  // Status and Monitoring
  monitoring: {
    statusUrl: `http://${EC2_IP}/status`,
    healthUrl: `http://${EC2_IP}/health`
  }
} 