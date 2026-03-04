const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// AWS Configuration
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const sqs = new AWS.SQS();

// SQS Queue URL - using existing coordinator queue
const COORDINATOR_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/142770202579/streaming-coordinator-queue';

// Default 5 HLS variants for adaptive streaming
const DEFAULT_VARIANTS = [
  { bitrate: 2400, resolution: "1920x1080" },
  { bitrate: 1200, resolution: "1280x720" },
  { bitrate: 800, resolution: "960x540" },
  { bitrate: 500, resolution: "640x360" },
  { bitrate: 300, resolution: "480x270" }
];

// Start Stream Endpoint
app.post('/start-stream', async (req, res) => {
  try {
    const { streamId, inputUrl, outputUrl, variants = DEFAULT_VARIANTS } = req.body;
    
    if (!streamId || !inputUrl || !outputUrl) {
      return res.status(400).json({ 
        error: 'Missing required parameters: streamId, inputUrl, outputUrl' 
  });
    }

    console.log(`Starting stream: ${streamId}`);
    console.log(`Input URL: ${inputUrl}`);
    console.log(`Output URL: ${outputUrl}`);
    console.log(`Variants: ${JSON.stringify(variants)}`);

    // Send message to coordinator queue
    const message = {
      streamId,
      inputUrl,
      outputUrl,
      variants,
      action: 'start'
    };

    await sqs.sendMessage({
      QueueUrl: COORDINATOR_QUEUE_URL,
      MessageBody: JSON.stringify(message)
    }).promise();
    
    console.log(`Stream ${streamId} started successfully`);
    res.json({ 
      success: true, 
      message: `Stream ${streamId} started successfully`,
      streamId,
      variants: variants.length
    });
    
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ 
      error: 'Failed to start stream',
      details: error.message 
    });
  }
});
  
// Stop Stream Endpoint
app.post('/stop-stream', async (req, res) => {
  try {
    const { streamId } = req.body;
    
    if (!streamId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: streamId' 
      });
    }

    console.log(`Stopping stream: ${streamId}`);

    // Send stop message to coordinator queue
    const message = {
      streamId,
      action: 'stop'
    };

    await sqs.sendMessage({
      QueueUrl: COORDINATOR_QUEUE_URL,
      MessageBody: JSON.stringify(message)
        }).promise();
        
    console.log(`Stream ${streamId} stop requested successfully`);
    res.json({ 
      success: true, 
      message: `Stream ${streamId} stop requested successfully`,
      streamId 
    });
    
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ 
      error: 'Failed to stop stream',
      details: error.message 
    });
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'streaming-service-server',
    coordinatorQueue: COORDINATOR_QUEUE_URL,
    defaultVariants: DEFAULT_VARIANTS.length
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Streaming service server running on port ${PORT}`);
  console.log(`Coordinator queue: ${COORDINATOR_QUEUE_URL}`);
  console.log(`Default variants: ${DEFAULT_VARIANTS.length}`);
});

module.exports = app; 