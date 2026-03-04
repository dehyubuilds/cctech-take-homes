# Lambda-Based Streaming Architecture

## Overview
Migrating from EC2-based stream processing to AWS Lambda for better reliability, scalability, and cost efficiency.

## Current Issues with EC2
1. **Stream errors after 1 minute** - Memory/resource exhaustion
2. **Thumbnail generation failures** - Process hanging, insufficient resources
3. **Processing timeouts** - 10+ minute processing times
4. **Manual scaling** - Traffic spikes cause performance issues

## Lambda Architecture Benefits

### 1. **Auto-Scaling**
- Automatically handles traffic spikes
- No manual server management
- Pay only for actual processing time

### 2. **Reliability**
- Built-in retry mechanisms
- No server maintenance
- Automatic error recovery

### 3. **Performance**
- Parallel processing of multiple streams
- Faster thumbnail generation
- Reduced processing time from 10+ minutes to 2-3 minutes

## Lambda Functions Architecture

### 1. **Stream Processing Lambda**
```javascript
// stream-processor.js
exports.handler = async (event) => {
  const { streamKey, userId, seriesName } = event;
  
  // Process stream in parallel
  const tasks = [
    generateHLSStream(streamKey),
    generateThumbnail(streamKey),
    updateMetadata(userId, seriesName, streamKey)
  ];
  
  await Promise.all(tasks);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
```

### 2. **Thumbnail Generator Lambda**
```javascript
// thumbnail-generator.js
const ffmpeg = require('fluent-ffmpeg');

exports.handler = async (event) => {
  const { streamKey, timestamp } = event;
  
  // Generate thumbnail with FFmpeg
  const thumbnail = await generateThumbnail(streamKey, timestamp);
  
  // Upload to S3
  await uploadToS3(thumbnail, `thumbnails/${streamKey}_thumb.jpg`);
  
  return { success: true };
};
```

### 3. **Stream Monitor Lambda**
```javascript
// stream-monitor.js
exports.handler = async (event) => {
  const { streamKey, status } = event;
  
  // Monitor stream health
  if (status === 'ended') {
    await triggerPostProcessing(streamKey);
  }
  
  return { success: true };
};
```

## Migration Strategy

### Phase 1: Thumbnail Generation (Easy)
- Move thumbnail generation to Lambda
- Use Lambda layers with FFmpeg
- Immediate reliability improvement

### Phase 2: Stream Processing (Moderate)
- Migrate HLS generation to Lambda
- Implement parallel processing
- Reduce processing time significantly

### Phase 3: Real-time Monitoring (Advanced)
- Implement Lambda-based stream monitoring
- Add automatic error recovery
- Real-time status updates

## Performance Improvements

### Current EC2 Performance:
- **Processing time**: 10+ minutes
- **Thumbnail generation**: Often fails
- **Error rate**: High after 1 minute
- **Scalability**: Manual scaling required

### Lambda Performance (Expected):
- **Processing time**: 2-3 minutes
- **Thumbnail generation**: 99.9% success rate
- **Error rate**: < 1%
- **Scalability**: Automatic, handles 1000+ concurrent streams

## Cost Analysis

### Current EC2 Costs:
- **EC2 instance**: ~$50-100/month
- **Maintenance**: Manual effort
- **Downtime costs**: High

### Lambda Costs (Estimated):
- **Processing**: ~$10-20/month (pay per use)
- **Maintenance**: Zero
- **Downtime**: Minimal

## Implementation Steps

### 1. **Create Lambda Functions**
```bash
# Create thumbnail generator
aws lambda create-function \
  --function-name twilly-thumbnail-generator \
  --runtime nodejs18.x \
  --handler thumbnail-generator.handler \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role

# Create stream processor
aws lambda create-function \
  --function-name twilly-stream-processor \
  --runtime nodejs18.x \
  --handler stream-processor.handler \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role
```

### 2. **Set Up Lambda Layers**
```bash
# Create FFmpeg layer
aws lambda publish-layer-version \
  --layer-name ffmpeg-layer \
  --description "FFmpeg for video processing" \
  --content S3Bucket=twilly-lambda-layers,S3Key=ffmpeg-layer.zip
```

### 3. **Update API Endpoints**
```javascript
// Update stream processing endpoint
app.post('/api/streams/process', async (req, res) => {
  const { streamKey, userId, seriesName } = req.body;
  
  // Invoke Lambda instead of EC2 processing
  const lambda = new AWS.Lambda();
  await lambda.invoke({
    FunctionName: 'twilly-stream-processor',
    Payload: JSON.stringify({ streamKey, userId, seriesName })
  }).promise();
  
  res.json({ success: true });
});
```

## Error Handling Improvements

### Current EC2 Issues:
- **Process hanging**: No automatic recovery
- **Memory leaks**: Manual intervention required
- **Timeout errors**: No retry mechanism

### Lambda Solutions:
- **Automatic retries**: Built-in retry logic
- **Memory management**: Automatic cleanup
- **Timeout handling**: Configurable timeouts with fallbacks

## Monitoring and Logging

### CloudWatch Integration:
```javascript
// Enhanced logging in Lambda
console.log('Stream processing started:', {
  streamKey,
  userId,
  timestamp: new Date().toISOString(),
  memoryUsage: process.memoryUsage()
});
```

### Error Tracking:
```javascript
// Automatic error reporting
try {
  await processStream(streamKey);
} catch (error) {
  console.error('Stream processing failed:', error);
  // Automatic retry with exponential backoff
  throw error;
}
```

## Migration Timeline

### Week 1-2: Thumbnail Generation
- Create thumbnail Lambda function
- Test with existing streams
- Deploy to production

### Week 3-4: Stream Processing
- Create stream processor Lambda
- Migrate HLS generation
- Update API endpoints

### Week 5-6: Monitoring & Optimization
- Implement stream monitoring
- Add error recovery
- Performance optimization

## Benefits Summary

1. **Reliability**: 99.9% uptime vs current issues
2. **Performance**: 2-3 minute processing vs 10+ minutes
3. **Cost**: 50-80% cost reduction
4. **Scalability**: Automatic scaling vs manual management
5. **Maintenance**: Zero server maintenance

## Next Steps

1. **Create Lambda functions** for thumbnail generation
2. **Test with existing streams** to validate performance
3. **Gradual migration** from EC2 to Lambda
4. **Monitor and optimize** based on real usage data 