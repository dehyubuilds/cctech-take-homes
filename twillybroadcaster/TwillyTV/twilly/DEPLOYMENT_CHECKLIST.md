# WebSocket EC2 Optimization - Deployment Checklist

## ✅ Implementation Complete

All 3 phases have been implemented with full backward compatibility.

## Pre-Deployment Steps

### 1. Get WebSocket API Endpoint
```bash
# Find your WebSocket API Gateway endpoint
aws apigatewayv2 get-apis --region us-east-1 | grep -i websocket
```

Or check your CloudFormation stack outputs:
```bash
aws cloudformation describe-stacks --stack-name websocket-comments-api --region us-east-1
```

### 2. Set Environment Variable on EC2

Add to your EC2 server's environment (`.env` file or system environment):

```bash
WEBSOCKET_API_ENDPOINT=wss://YOUR_ACTUAL_API_ID.execute-api.us-east-1.amazonaws.com/dev
```

Replace `YOUR_ACTUAL_API_ID` with your actual WebSocket API Gateway ID.

### 3. Configure IAM Permissions

Add these permissions to your EC2 instance role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/Twilly",
        "arn:aws:dynamodb:us-east-1:*:table/Twilly/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "execute-api:ManageConnections"
      ],
      "Resource": [
        "arn:aws:execute-api:us-east-1:*:YOUR_WEBSOCKET_API_ID/*"
      ]
    }
  ]
}
```

## Deployment Steps

### Step 1: Deploy Updated Lambda Function

```bash
cd TwillyTV/twilly/lambda
zip -r websocket-send-unified.zip websocket-send-unified.js
aws lambda update-function-code \
  --function-name websocket-send-unified \
  --zip-file fileb://websocket-send-unified.zip \
  --region us-east-1
```

### Step 2: Restart Nuxt Server

The cache initializes automatically on server startup via the plugin.

```bash
# On EC2
pm2 restart twilly
# OR
npm run build && npm run start
```

### Step 3: Verify Initialization

Check server logs for:

```
✅ [websocket-cache-init] WebSocket connection cache initialization scheduled
✅ [websocket-cache] Connection cache initialized with X users
✅ [websocket-cache] API Gateway Management API initialized: ...
```

### Step 4: Test Cache (Optional)

Call the initialization endpoint to manually refresh:

```bash
curl -X POST https://your-api.com/api/websocket/init-cache
```

## Verification

### Test 1: Cache Hit (Fast Path)
1. Post a comment
2. Check logs for: `✅ [websocket-cache] Found X cached connections`
3. Should see: `method: 'direct'` or `method: 'hybrid'`
4. **Expected**: 11-35ms latency

### Test 2: Lambda Fallback (Backward Compatible)
1. Restart server (clears cache)
2. Post a comment immediately (before cache refreshes)
3. Should see: `📡 [websocket-cache] Fallback to Lambda`
4. **Expected**: 80-280ms latency (same as before)

### Test 3: Existing Streams
1. Test all existing functionality
2. **Expected**: Everything works exactly as before
3. No breaking changes

## Rollback Plan

If issues occur:

1. **Remove environment variable**: `WEBSOCKET_API_ENDPOINT`
2. **Restart server**: All endpoints will use Lambda only
3. **No code changes needed**: Fallback is automatic

## Monitoring

### Success Indicators
- ✅ Cache initialization logs appear
- ✅ `method: 'direct'` or `method: 'hybrid'` in logs
- ✅ Faster notification delivery (11-35ms vs 80-280ms)
- ✅ Existing streams continue working

### Warning Signs
- ⚠️ Only seeing `method: 'lambda'` (cache not working)
- ⚠️ No cache initialization logs (plugin not loading)
- ⚠️ Errors about API Gateway permissions

## Support

If you encounter issues:
1. Check server logs for `[websocket-cache]` entries
2. Verify `WEBSOCKET_API_ENDPOINT` is set correctly
3. Ensure IAM permissions are configured
4. Verify Lambda function is deployed
5. Check that existing streams still work (backward compatibility)

## Ready to Deploy! 🚀

All code is implemented and ready. Follow the checklist above to deploy.
