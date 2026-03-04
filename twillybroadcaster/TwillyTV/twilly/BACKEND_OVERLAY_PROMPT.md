# Prompt: Add Watermark Overlay to Backend Video Processing

## Request
Add a watermark overlay (logo) to all videos during backend processing. The watermark should appear at the bottom-right corner of all processed videos.

## Requirements

1. **Watermark Source**: 
   - URL: `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
   - Download to: `/tmp/twilly-watermark.png`
   - Size: Scale to 10% of video width
   - Position: Bottom-right corner with 10px margin from edges

2. **Files That Need Updates**:
   - `variant-processor-lambda.js` - Function: `generateHLSVariant()` (currently missing overlay)
   - Any other video processing functions that generate HLS or MP4 files

3. **Implementation Pattern**:
   - Download watermark before processing
   - Add watermark as second input to FFmpeg: `-i /tmp/twilly-watermark.png`
   - Use filter_complex to scale and overlay: `[1:v]scale=WIDTH:HEIGHT[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]`
   - Map the filtered video: `-map "[v]"` instead of `-map "0:v"`

4. **Example for Single Variant Processing** (like variant-processor-lambda.js):
```javascript
// Download watermark first
const watermarkUrl = 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png';
const watermarkPath = '/tmp/twilly-watermark.png';
let hasWatermark = false;

try {
  const https = require('https');
  await new Promise((resolve) => {
    const file = fs.createWriteStream(watermarkPath);
    https.get(watermarkUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        hasWatermark = fs.existsSync(watermarkPath);
        if (hasWatermark) {
          console.log(`✅ Watermark downloaded successfully`);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.log(`⚠️ Could not download watermark: ${err.message}`);
      resolve(); // Continue without watermark
    });
  });
} catch (error) {
  console.log(`⚠️ Error downloading watermark: ${error.message}`);
}

// Calculate watermark size (10% of output width)
// For example, if output is 1920x1080, watermark should be 192x108
const wmWidth = Math.floor(outputWidth * 0.1);
const wmHeight = Math.floor(outputHeight * 0.1); // Maintain aspect ratio

// In FFmpeg args:
const ffmpegArgs = [
  '-i', inputUrl,
  ...(hasWatermark && fs.existsSync(watermarkPath) ? ['-i', watermarkPath] : []),
  ...(hasWatermark && fs.existsSync(watermarkPath) ? [
    '-filter_complex', 
    `[1:v]scale=${wmWidth}:${wmHeight}[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]`,
    '-map', '[v]'
  ] : ['-map', '0:v']),
  '-map', '0:a',
  // ... rest of encoding options
];
```

5. **Testing**:
   - Process a test video
   - Check CloudWatch logs for "✅ Watermark downloaded successfully"
   - Verify the processed video has the logo at bottom-right
   - Check FFmpeg command in logs includes `-i watermark.png` and `-filter_complex`

6. **Important Notes**:
   - Download watermark once before processing all variants
   - Handle download failures gracefully (continue without watermark)
   - Use absolute path `/tmp/twilly-watermark.png`
   - Scale watermark appropriately for each resolution (10% of width)
   - Position: `overlay=W-w-10:H-h-10` means: right edge minus watermark width minus 10px, bottom edge minus watermark height minus 10px

## Current Status
- ✅ `lambda/stream-processor.js` - Already has overlay
- ✅ `streaming-service-server.js` - Already has overlay  
- ✅ `variant-processor-lambda.js` - **JUST UPDATED** with overlay support

## Important: Deployment Required

After making changes, you need to:
1. **Deploy Lambda functions** - Update the `variant-processor-lambda` Lambda function in AWS
2. **Redeploy EC2 server** - If using `streaming-service-server.js`, restart/redeploy the service
3. **Test with a new stream** - Process a new video to see the overlay

## Quick Check: Which Processing Path Are You Using?

Check your CloudWatch logs or EC2 logs to see which file is actually processing videos:
- `lambda/stream-processor.js` → Look for "🎬 Generating HLS variants..."
- `variant-processor-lambda.js` → Look for "Variant Processor Lambda triggered"
- `streaming-service-server.js` → Look for "🎥 Running FFmpeg for adaptive HLS generation..."

