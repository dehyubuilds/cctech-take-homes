// Updated Streaming Service for Serverless Architecture
// This service detects stream start/stop events and sends messages to Lambda coordinator

const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: 'us-east-1' });

// Configure AWS credentials (you'll need to set these on your EC2 instance)
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
});

async function handleStreamStart(streamId, recordingUrl, bucketName, objectKey) {
    console.log(`🚀 Stream started: ${streamId}`);
    
    try {
        // Send to Lambda coordinator
        const coordinatorMessage = {
            streamId: streamId,
            recordingUrl: recordingUrl,
            bucketName: bucketName,
            objectKey: objectKey,
            timestamp: new Date().toISOString()
        };
        
        await sqs.sendMessage({
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/142770202579/twilly-coordinator',
            MessageBody: JSON.stringify(coordinatorMessage)
        }).promise();
        
        console.log(`✅ Sent to coordinator: ${streamId}`);
        
    } catch (error) {
        console.error(`❌ Error sending to coordinator: ${error.message}`);
    }
}

async function handleStreamStop(streamId) {
    console.log(`🛑 Stream stopped: ${streamId}`);
    
    // For now, we'll just log the stop event
    // You can add additional processing here if needed
    console.log(`✅ Stream stop logged: ${streamId}`);
}

// Example usage:
// handleStreamStart('test-stream-123', 'https://s3.amazonaws.com/bucket/video.mp4', 'twilly-streaming-bucket', 'recordings/video.mp4');
// handleStreamStop('test-stream-123');

module.exports = {
    handleStreamStart,
    handleStreamStop
}; 