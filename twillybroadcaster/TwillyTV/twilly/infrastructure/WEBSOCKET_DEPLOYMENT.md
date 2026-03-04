# WebSocket API Deployment Guide

This guide explains how to deploy and configure the AWS WebSocket API for real-time comment notifications.

## Overview

The WebSocket API enables **immediate** inbox notifications and username highlights when someone posts a comment. Instead of polling every 2 seconds, recipients receive instant notifications via WebSocket.

## Architecture

```
Comment Posted → Lambda (post.post.js) → Invoke websocket-comments-send → 
  → Query DynamoDB for active connections → Send WebSocket message → 
  → iOS app receives notification → Updates UI immediately
```

## Deployment Steps

### 1. Deploy WebSocket API Infrastructure

```bash
cd TwillyTV/twilly/infrastructure
./deploy-websocket-comments.sh dev us-east-1
```

This will:
- Create AWS API Gateway WebSocket API
- Create Lambda functions (connect, disconnect, send)
- Set up IAM roles and permissions
- Output the WebSocket endpoint URL

### 2. Update iOS App Configuration

After deployment, you'll get a WebSocket endpoint like:
```
wss://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

Update `ChannelService.swift`:

```swift
var websocketEndpoint: String {
    return "wss://YOUR_ACTUAL_API_ID.execute-api.us-east-1.amazonaws.com/dev"
}
```

Replace `YOUR_ACTUAL_API_ID` with the actual API ID from the deployment output.

### 3. Verify Deployment

Check that all Lambda functions are deployed:

```bash
aws lambda list-functions --region us-east-1 | grep websocket-comments
```

You should see:
- `dev-websocket-comments-connect`
- `dev-websocket-comments-disconnect`
- `websocket-comments-send`

### 4. Test WebSocket Connection

The iOS app will automatically connect when:
- User opens the comment view
- App comes to foreground

Check CloudWatch logs for connection events:
```bash
aws logs tail /aws/lambda/dev-websocket-comments-connect --follow
```

## How It Works

### Connection Flow

1. **User opens comment view** → iOS app connects to WebSocket with `userEmail` query parameter
2. **Lambda (connect)** → Stores connection in DynamoDB: `WEBSOCKET#userEmail -> CONNECTION#connectionId`
3. **User closes view** → Lambda (disconnect) removes connection from DynamoDB

### Notification Flow

1. **User posts comment** → `post.post.js` identifies recipients
2. **Invoke Lambda** → Calls `websocket-comments-send` with recipient emails
3. **Lambda queries DynamoDB** → Finds all active connections for recipients
4. **Send WebSocket messages** → Uses API Gateway Management API to send to each connection
5. **iOS app receives** → Updates unread counts and highlights immediately

## DynamoDB Schema

Connections are stored as:
```
PK: WEBSOCKET#user@example.com
SK: CONNECTION#connection-id-123
connectionId: connection-id-123
userEmail: user@example.com
connectedAt: 2024-01-01T12:00:00Z
ttl: 1735689600 (24 hours from now)
```

## Troubleshooting

### WebSocket Not Connecting

1. Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/dev-websocket-comments-connect --follow
```

2. Verify IAM permissions:
```bash
aws iam get-role-policy --role-name dev-websocket-comments-lambda-role --policy-name ApiGatewayManagementApiAccess
```

### Notifications Not Received

1. Check if connection exists in DynamoDB:
```bash
aws dynamodb query \
  --table-name Twilly \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"WEBSOCKET#user@example.com"}}'
```

2. Check send Lambda logs:
```bash
aws logs tail /aws/lambda/websocket-comments-send --follow
```

3. Verify API Gateway Management API endpoint:
- Should be: `https://API_ID.execute-api.us-east-1.amazonaws.com/dev`
- Not: `wss://...` (use HTTP endpoint for Management API)

### iOS App Not Receiving Messages

1. Check WebSocket connection status in Xcode console
2. Verify `websocketEndpoint` in `ChannelService.swift` matches deployment output
3. Check that `userEmail` is being passed correctly

## Cost Considerations

- **API Gateway WebSocket**: $1.00 per million messages + $0.25 per million connection minutes
- **Lambda**: Free tier (1M requests/month), then $0.20 per million requests
- **DynamoDB**: On-demand pricing (very low for connection storage)

For 1000 active users with 10 comments/hour:
- ~10,000 WebSocket messages/day = ~$0.01/day
- ~24,000 connection hours/day = ~$0.006/day
- **Total: ~$0.50/month**

## Fallback Behavior

If WebSocket fails or is unavailable:
- iOS app falls back to 2-second polling (already implemented)
- No functionality is lost
- WebSocket is purely for performance improvement

## Next Steps

1. Deploy the infrastructure
2. Update iOS app with WebSocket endpoint
3. Test with two devices/accounts
4. Monitor CloudWatch logs for any issues
5. Adjust reconnection logic if needed
