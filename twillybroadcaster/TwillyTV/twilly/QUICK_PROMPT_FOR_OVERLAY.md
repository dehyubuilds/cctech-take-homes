# Quick Prompt: Add Watermark Overlay to Backend Video Processing

## The Request

Add a watermark overlay to all videos during backend processing. The Twilly logo should appear at the bottom-right corner of all processed videos.

## What's Needed

1. **Watermark URL**: `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
2. **Position**: Bottom-right corner, 10px margin
3. **Size**: 10% of video width

## Files That May Need Updates

Check which files are actually processing your videos by looking at CloudWatch logs or server logs. Common files:

- `variant-processor-lambda.js` ✅ (just updated)
- `lambda/stream-processor.js` ✅ (already has it)
- `streaming-service-server.js` ✅ (already has it)

## Implementation Pattern

```javascript
// 1. Download watermark
const watermarkUrl = 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png';
const watermarkPath = '/tmp/twilly-watermark.png';
// ... download code ...

// 2. Calculate size (10% of video width)
// For 1080p (1920x1080): 192x108
// For 720p (1280x720): 128x72
// For 480p (854x480): 85x48
// For 360p (640x360): 64x36

// 3. Add to FFmpeg args
const ffmpegArgs = [
  '-i', inputPath,
  '-i', watermarkPath,  // Add watermark as second input
  '-filter_complex', '[1:v]scale=WIDTH:HEIGHT[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]',
  '-map', '[v]',  // Use filtered video
  '-map', '0:a',  // Use original audio
  // ... rest of encoding options
];
```

## After Changes

1. **Deploy the updated code** to AWS Lambda or EC2
2. **Process a test video** to verify
3. **Check logs** for "✅ Watermark downloaded successfully"
4. **View the processed video** - logo should be at bottom-right

