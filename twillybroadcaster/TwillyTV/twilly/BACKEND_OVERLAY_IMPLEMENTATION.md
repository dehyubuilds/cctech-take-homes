# Backend Video Overlay Implementation Guide

## Overview
This guide explains how to add a watermark overlay to videos during server-side processing.

## Files That Need Overlay Processing

### 1. Lambda Functions (AWS)
- **File**: `lambda/stream-processor.js`
- **Function**: `generateAdaptiveHLS()`
- **Status**: ✅ Already updated

### 2. EC2 Streaming Service
- **File**: `streaming-service-server.js`
- **Function**: `generateAdaptiveHLS()`
- **Status**: ✅ Already updated

### 3. Variant Processor Lambda (if separate)
- **File**: `variant-processor-lambda.js`
- **Status**: ⚠️ May need update

## Implementation Details

### Watermark Source
- **URL**: `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
- **Location**: Bottom-right corner
- **Size**: 10% of video width
- **Margin**: 10px from edges

### FFmpeg Filter Syntax

For processing variants separately (like in `lambda/stream-processor.js`):
```bash
# Download watermark first
# Then for each variant:
-i input.mp4 -i watermark.png \
-filter_complex "[1:v]scale=WIDTH:HEIGHT[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]" \
-map "[v]" -map 0:a ...
```

For processing all variants at once (like in `streaming-service-server.js`):
```bash
# Download watermark first
# Then:
-i input.mp4 -i watermark.png \
-filter_complex "[1:v]scale=192:108[wm1080];[1:v]scale=128:72[wm720];[1:v]scale=85:48[wm480];[1:v]scale=64:36[wm360];[0:v]split=4[v1][v2][v3][v4];[v1]scale=1920:1080[v1_s];[v1_s][wm1080]overlay=W-w-10:H-h-10[v1_scaled];[v2]scale=1280:720[v2_s];[v2_s][wm720]overlay=W-w-10:H-h-10[v2_scaled];[v3]scale=854:480[v3_s];[v3_s][wm480]overlay=W-w-10:H-h-10[v3_scaled];[v4]scale=640:360[v4_s];[v4_s][wm360]overlay=W-w-10:H-h-10[v4_scaled]" \
-map "[v1_scaled]" -map 0:a ...
```

## Testing the Implementation

### 1. Check if watermark downloads successfully
Look for these log messages:
```
📥 Downloading watermark from https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png...
✅ Watermark downloaded successfully
```

### 2. Check FFmpeg command includes overlay
The FFmpeg command should include:
- `-i watermark.png` (second input)
- `-filter_complex` with overlay filters
- `[wm]` or `[wm1080]`, `[wm720]`, etc. filter labels

### 3. Verify processed videos
- Process a test video
- Check the output video file
- Look for Twilly logo at bottom-right corner

## Troubleshooting

### Watermark not appearing?

1. **Check watermark download**:
   ```bash
   # In Lambda/EC2, check if file exists
   ls -la /tmp/twilly-watermark.png
   ```

2. **Check FFmpeg logs**:
   - Look for filter_complex in the command
   - Check for overlay errors in stderr

3. **Verify filter syntax**:
   - Ensure watermark input (`-i watermark.png`) is before filter_complex
   - Check overlay coordinates are correct: `overlay=W-w-10:H-h-10`

4. **Check file permissions**:
   - Watermark file must be readable by FFmpeg process
   - Use absolute path: `/tmp/twilly-watermark.png`

### Common Issues

1. **Watermark too large/small**: Adjust scale values (currently 10% of width)
2. **Watermark in wrong position**: Adjust overlay coordinates
3. **Watermark not downloaded**: Check network connectivity, URL accessibility
4. **Filter errors**: Check FFmpeg version supports overlay filter

## Alternative: Pre-download Watermark

If downloading during processing causes issues, you can:
1. Include watermark in Lambda deployment package
2. Store watermark in S3 and download once
3. Use a local file path if running on EC2

## Code Pattern to Add

```javascript
// Download watermark
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
        resolve();
      });
    }).on('error', (err) => {
      console.log(`Could not download watermark: ${err.message}`);
      resolve();
    });
  });
} catch (error) {
  console.log(`Error downloading watermark: ${error.message}`);
}

// Then in FFmpeg args:
const ffmpegArgs = [
  '-i', inputPath,
  ...(hasWatermark ? ['-i', watermarkPath] : []),
  ...(hasWatermark ? ['-filter_complex', 'YOUR_OVERLAY_FILTER'] : []),
  // ... rest of args
];
```

