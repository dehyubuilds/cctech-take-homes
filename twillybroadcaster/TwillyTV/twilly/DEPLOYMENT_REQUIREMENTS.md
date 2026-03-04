# Deployment Requirements for Overlay Feature

## Summary

Yes, you need to deploy code. Here's what was changed and where it needs to be deployed:

## Files Changed

### 1. Nuxt Server API Routes (Frontend/Backend API)
**Location**: `server/api/streams/`
- ✅ **NEW**: `server/api/streams/overlay.post.js`
- ✅ **NEW**: `server/api/streams/overlay/clear.post.js`

**Deployment**: These are part of your Nuxt application and need to be deployed with the Nuxt app.

**Where**: Deploy to wherever your Nuxt app is hosted (likely Netlify, AWS Amplify, or similar)

**How**: 
- If using Git-based deployment (Netlify/Amplify): Just push to your repository and it will auto-deploy
- If manual deployment: Build and deploy your Nuxt app:
  ```bash
  npm run build
  # Then deploy the .output directory to your hosting service
  ```

### 2. EC2 Streaming Service (Backend Processing)
**Location**: Root directory
- ✅ **MODIFIED**: `streaming-service-server.js`

**Deployment**: This runs separately on your EC2 instance and needs to be manually deployed.

**Where**: Deploy to your EC2 instance (e.g., `54.160.229.57` based on RTMP URL)

**How**: SSH into your EC2 instance and update the file:
```bash
# 1. SSH into EC2
ssh -i ~/.ssh/your-key.pem ec2-user@54.160.229.57

# 2. Navigate to the streaming service directory
cd /opt/twilly-streaming
# OR wherever streaming-service-server.js is located

# 3. Copy the updated file (from your local machine)
# On your local machine:
scp -i ~/.ssh/your-key.pem streaming-service-server.js ec2-user@54.160.229.57:/opt/twilly-streaming/

# 4. Restart the service (on EC2)
sudo systemctl restart twilly-streaming
# OR if it's a different service name:
sudo systemctl restart streaming-service
```

**Alternative**: If the file is in a different location, check where it's running:
```bash
# On EC2, check where the service is running from
sudo systemctl status twilly-streaming
# Look for the ExecStart path to find the file location
```

### 3. Lambda Function (Optional - Already Updated)
**Location**: Root directory
- ✅ **MODIFIED**: `variant-processor-lambda.js` (already updated earlier for overlay)

**Deployment**: If you're using this Lambda function, it needs to be deployed separately.

**How**:
```bash
# Create deployment package
zip variant-processor-lambda.zip variant-processor-lambda.js

# Deploy to AWS Lambda
aws lambda update-function-code \
  --function-name variant-processor-lambda \
  --zip-file fileb://variant-processor-lambda.zip \
  --region us-east-1
```

## Deployment Checklist

- [ ] **Nuxt API Endpoints**: Deploy Nuxt app (push to repo if auto-deploy, or build and deploy manually)
- [ ] **EC2 Streaming Service**: Copy `streaming-service-server.js` to EC2 and restart service
- [ ] **Lambda Function** (if used): Deploy `variant-processor-lambda.js` to AWS Lambda
- [ ] **Test**: After deployment, test the overlay endpoints:
  ```bash
  curl -X POST https://twilly.app/api/streams/overlay \
    -H "Content-Type: application/json" \
    -d '{"streamKey":"sk_test123","overlay":{"imageName":"TwillyWatermark","position":{"horizontal":"right","vertical":"bottom"}}}'
  ```

## Important Notes

1. **API Endpoints**: The new API endpoints (`/api/streams/overlay` and `/api/streams/overlay/clear`) are part of the Nuxt app, so they'll be available at `https://twilly.app/api/streams/overlay` once the Nuxt app is deployed.

2. **EC2 Service**: The `streaming-service-server.js` changes are critical - this is what actually processes the videos and applies the overlay. Make sure this is updated on EC2.

3. **No Frontend Changes**: Actually, there are NO frontend UI changes needed. The API endpoints are backend-only. The mobile app will call these endpoints directly.

4. **DynamoDB**: The overlay metadata is stored in DynamoDB table `Twilly` - no changes needed to DynamoDB, the code handles it.

## Quick Deploy Commands

### For Nuxt (if using Git):
```bash
git add server/api/streams/overlay.post.js server/api/streams/overlay/clear.post.js
git commit -m "Add overlay metadata API endpoints"
git push
# Wait for auto-deployment
```

### For EC2 (manual):
```bash
# From your local machine
scp -i ~/.ssh/your-key.pem streaming-service-server.js ec2-user@54.160.229.57:/opt/twilly-streaming/

# Then SSH and restart
ssh -i ~/.ssh/your-key.pem ec2-user@54.160.229.57
sudo systemctl restart twilly-streaming
sudo systemctl status twilly-streaming  # Verify it's running
```

