# Twilly WebSocket Brain 🧠

A centralized WebSocket brain system that handles all WebSocket interactions for the Twilly platform, providing real-time communication, content updates, and connection management.

## Overview

The WebSocket Brain is a Lambda function that serves as the central hub for all WebSocket communications. It handles:

- **Connection Management**: WebSocket connections, disconnections, and reconnections
- **Message Routing**: Routes messages to appropriate handlers based on message type
- **Content Updates**: Real-time updates for channels, featured content, live streams, and episodes
- **User Interactions**: Reactions, subscriptions, and status updates
- **Broadcasting**: Sends messages to multiple connected clients

## Architecture

```
Frontend (Nuxt.js) ←→ API Gateway ←→ Lambda (WebSocket Brain) ←→ DynamoDB
     ↑                    ↑                    ↑                    ↑
  WebSocket           WebSocket API        Message Handler      Data Storage
  Store               Routes               Content Logic        User Data
```

## Features

### 🔌 Connection Management
- Automatic connection handling (`$connect`, `$disconnect`)
- Connection status tracking
- Heartbeat monitoring
- Reconnection logic with exponential backoff

### 📡 Message Routing
- **Content**: Channel information, featured content, live streams
- **User**: Subscriptions, reactions, status updates
- **System**: Heartbeat, error handling, notifications
- **Series**: Episode updates, series information

### 🚀 Performance Benefits
- **Instant Page Loads**: Pre-load content via WebSocket
- **Real-time Updates**: Live content updates without page refresh
- **Reduced API Calls**: Single WebSocket connection vs multiple HTTP requests
- **Better UX**: Smooth, responsive user experience

## Message Types

### Subscribe/Unsubscribe
```json
{
  "type": "subscribe",
  "targetType": "channels|featured|live|episodes|series|fire"
}
```

### Content Requests
```json
{
  "type": "request",
  "targetType": "channels",
  "userId": "user123"
}
```

### User Interactions
```json
{
  "type": "reaction",
  "contentId": "content123",
  "reaction": "like",
  "userId": "user123"
}
```

### Status Updates
```json
{
  "type": "status",
  "userId": "user123",
  "status": "online|offline|away"
}
```

## Deployment

### Prerequisites
- AWS CLI installed and configured
- Appropriate AWS permissions
- Node.js 18+ (for local testing)

### Quick Deploy
```bash
cd lambda
./deploy-websocket-brain.sh
```

### Manual Deployment
1. **Install Dependencies**
   ```bash
   npm install --production
   ```

2. **Create Deployment Package**
   ```bash
   zip -r websocket-brain.zip . -x "*.git*" "*.md" "*.sh"
   ```

3. **Deploy to AWS**
   ```bash
   aws lambda create-function \
     --function-name twilly-websocket-brain \
     --runtime nodejs18.x \
     --role arn:aws:iam::ACCOUNT:role/lambda-role \
     --handler websocket-brain.handler \
     --zip-file fileb://websocket-brain.zip
   ```

## Configuration

### Environment Variables
The Lambda function uses hardcoded AWS credentials for deployment compatibility:

```javascript
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
})
```

### DynamoDB Table
- **Table Name**: `Twilly`
- **Required Fields**: Various content types and user data
- **Access**: Full CRUD operations

### API Gateway
- **Protocol**: WebSocket
- **Routes**: `$connect`, `$disconnect`, `$default`
- **Integration**: Lambda proxy integration

## Frontend Integration

### WebSocket Store
Use the `WebSocketBrain` store in your Nuxt.js components:

```javascript
import { useWebSocketBrain } from '~/stores/WebSocketBrain'

export default {
  setup() {
    const wsBrain = useWebSocketBrain()
    
    // Initialize connection
    wsBrain.initialize()
    
    // Subscribe to content
    wsBrain.subscribe('channels')
    
    // Send messages
    wsBrain.sendMessage({
      type: 'reaction',
      contentId: 'content123',
      reaction: 'like'
    })
    
    return { wsBrain }
  }
}
```

### Connection Status
Monitor connection status in your components:

```vue
<template>
  <div>
    <div v-if="wsBrain.isConnected" class="status connected">
      🟢 Connected
    </div>
    <div v-else class="status disconnected">
      🔴 Disconnected
    </div>
  </div>
</template>
```

## Monitoring & Logging

### CloudWatch Logs
```bash
aws logs tail /aws/lambda/twilly-websocket-brain --follow
```

### Metrics to Monitor
- **Connection Count**: Number of active WebSocket connections
- **Message Volume**: Messages processed per minute
- **Error Rate**: Failed message processing
- **Latency**: Response time for message handling

### Alarms
Set up CloudWatch alarms for:
- High error rates
- Connection drops
- High latency
- Memory/CPU usage

## Testing

### Local Testing
```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Test connection
wscat -c wss://API_ID.execute-api.us-east-1.amazonaws.com/production

# Send test message
{"type": "subscribe", "targetType": "channels"}
```

### Load Testing
Use tools like Artillery or k6 to test:
- Connection limits
- Message throughput
- Concurrent user handling

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check Lambda timeout settings
   - Verify API Gateway configuration
   - Monitor CloudWatch logs

2. **Permission Errors**
   - Verify IAM role permissions
   - Check DynamoDB table access
   - Ensure API Gateway integration

3. **Message Routing Issues**
   - Verify message format
   - Check handler registration
   - Monitor error logs

### Debug Mode
Enable detailed logging by setting the `DEBUG` environment variable in Lambda:

```javascript
const DEBUG = process.env.DEBUG === 'true'
if (DEBUG) {
  console.log('Message received:', JSON.stringify(event, null, 2))
}
```

## Performance Optimization

### Lambda Configuration
- **Memory**: 512MB (adjust based on usage)
- **Timeout**: 30 seconds
- **Concurrency**: Set appropriate limits

### Connection Management
- Implement connection pooling
- Use connection reuse
- Monitor connection lifecycle

### Message Batching
- Batch similar messages
- Implement rate limiting
- Use compression for large payloads

## Security

### Authentication
- Implement JWT validation
- Use Cognito integration
- Verify user permissions

### Rate Limiting
- Implement per-user rate limits
- Use API Gateway throttling
- Monitor abuse patterns

### Data Validation
- Validate all incoming messages
- Sanitize user inputs
- Implement input size limits

## Future Enhancements

### Planned Features
- **Redis Integration**: For better connection management
- **GraphQL Support**: Real-time GraphQL subscriptions
- **Analytics**: User behavior tracking
- **A/B Testing**: Feature flag support

### Scalability Improvements
- **Multi-region**: Global WebSocket endpoints
- **Load Balancing**: Distribute connections
- **Caching**: Redis/MemoryDB integration

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review this documentation
3. Test with wscat
4. Monitor AWS service status

## License

MIT License - see LICENSE file for details.
