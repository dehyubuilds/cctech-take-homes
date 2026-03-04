# Overlay Troubleshooting Guide

## Issue: Streamed video didn't have overlay

### Step 1: Verify Overlay Metadata Was Sent

**Check if the mobile app sent overlay metadata BEFORE streaming:**

```bash
# Check DynamoDB for overlay metadata
aws dynamodb get-item \
  --table-name Twilly \
  --key '{"PK": {"S": "STREAM_OVERLAY#YOUR_STREAM_KEY"}, "SK": {"S": "metadata"}}' \
  --region us-east-1
```

**Replace `YOUR_STREAM_KEY` with the actual stream key used (e.g., `sk_vnzweq4hpnksev4m`)**

**Expected Result**: Should return an item with `overlay` field containing the metadata.

**If NOT found**: The mobile app didn't send the overlay metadata, or it was sent with wrong streamKey.

### Step 2: Check EC2 Server Logs

**SSH into your EC2 instance and check logs:**

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ec2-user@54.160.229.57

# Check streaming service logs
sudo journalctl -u twilly-streaming -n 100 --no-pager
# OR if different service name:
sudo journalctl -u streaming-service -n 100 --no-pager

# Or check the log file directly (if logging to file)
tail -f /var/log/streaming-service.log
```

**Look for these log messages:**
- `📋 Found overlay metadata for streamKey: sk_...` ✅ (metadata found)
- `ℹ️ No overlay metadata found for streamKey: sk_..., using default` ⚠️ (no metadata, using default)
- `📥 Downloading overlay image from https://...` ✅ (downloading)
- `✅ Overlay image downloaded successfully` ✅ (download succeeded)
- `⚠️ Could not download overlay image: ...` ❌ (download failed)
- `🎥 Running FFmpeg for adaptive HLS generation...` (check if includes `-i watermark.png`)

### Step 3: Verify Code Was Deployed

**Check if the updated `streaming-service-server.js` is on EC2:**

```bash
# On EC2, check if the file has the overlay functions
grep -n "getOverlayMetadata" /opt/twilly-streaming/streaming-service-server.js
# OR wherever your file is located

# Should return line numbers if function exists
```

**If not found**: The code wasn't deployed. Deploy it:
```bash
# From your local machine
scp -i ~/.ssh/your-key.pem streaming-service-server.js ec2-user@54.160.229.57:/opt/twilly-streaming/
ssh -i ~/.ssh/your-key.pem ec2-user@54.160.229.57
sudo systemctl restart twilly-streaming
```

### Step 4: Check FFmpeg Command

**In the EC2 logs, find the FFmpeg command that was run:**

Look for: `📝 Command: ffmpeg ...`

**The command should include:**
- `-i /path/to/watermark.png` (second input - the overlay image)
- `-filter_complex` with overlay filters
- `overlay=...` in the filter_complex

**If missing**: The overlay wasn't applied.

### Step 5: Verify Image File Exists

**Check if the overlay image file was created:**

```bash
# On EC2
ls -la /tmp/overlay-*
ls -la /tmp/twilly-watermark.png

# Check file size (should be > 0)
stat /tmp/twilly-watermark.png
```

**If file doesn't exist or is 0 bytes**: Image download failed.

### Step 6: Test Overlay API Endpoint

**Verify the API endpoint is working:**

```bash
# Test storing overlay metadata
curl -X POST https://twilly.app/api/streams/overlay \
  -H "Content-Type: application/json" \
  -d '{
    "streamKey": "sk_test123",
    "overlay": {
      "overlayName": "Test Overlay",
      "imageName": "TwillyWatermark",
      "position": {"horizontal": "right", "vertical": "bottom"},
      "size": {"width": 200, "height": 60}
    }
  }'
```

**Expected**: `{"success": true, "message": "Overlay metadata stored successfully"}`

### Step 7: Common Issues

#### Issue: "No overlay metadata found"
**Cause**: Mobile app didn't call `/api/streams/overlay` before streaming, or streamKey mismatch.

**Fix**: 
1. Ensure mobile app calls API BEFORE `rtmpStream.publish()`
2. Verify streamKey in API call matches streamKey in RTMP URL exactly

#### Issue: "Could not download overlay image"
**Cause**: Network issue, invalid URL, or image doesn't exist.

**Fix**:
1. Check if image URL is accessible: `curl https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
2. Verify imageName mapping is correct
3. Check EC2 has internet access

#### Issue: "FFmpeg command doesn't include overlay"
**Cause**: `hasWatermark` is false or `watermarkPath` doesn't exist.

**Fix**:
1. Check logs for download success/failure
2. Verify file exists: `ls -la /tmp/twilly-watermark.png`
3. Check file permissions

#### Issue: "Overlay appears in logs but not in video"
**Cause**: FFmpeg filter syntax error or overlay position is off-screen.

**Fix**:
1. Check FFmpeg stderr in logs for errors
2. Verify overlay position coordinates are valid
3. Test with a simple overlay position (bottom-right)

### Step 8: Manual Test

**Test the overlay manually on EC2:**

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ec2-user@54.160.229.57

# Download test image
curl -o /tmp/test-watermark.png https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png

# Test FFmpeg overlay on a test video
ffmpeg -i /var/www/recordings/TEST_STREAM.flv \
  -i /tmp/test-watermark.png \
  -filter_complex "[1:v]scale=192:108[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]" \
  -map "[v]" -map 0:a \
  -c:v libx264 -c:a aac \
  -t 10 \
  /tmp/test-output.mp4

# Check if overlay appears
# (You'll need to download and view the file)
```

## Quick Debug Checklist

- [ ] Mobile app called `/api/streams/overlay` BEFORE streaming
- [ ] StreamKey in API call matches streamKey in RTMP URL exactly
- [ ] Overlay metadata exists in DynamoDB
- [ ] Updated `streaming-service-server.js` is deployed on EC2
- [ ] EC2 service was restarted after deployment
- [ ] EC2 logs show "Found overlay metadata"
- [ ] EC2 logs show "Overlay image downloaded successfully"
- [ ] FFmpeg command includes `-i watermark.png`
- [ ] FFmpeg command includes overlay in filter_complex
- [ ] No FFmpeg errors in stderr

## Next Steps

1. **Check EC2 logs first** - This will tell you exactly what happened
2. **Verify DynamoDB** - Confirm metadata was stored
3. **Test API endpoint** - Make sure it's working
4. **Check deployment** - Ensure code is on EC2


