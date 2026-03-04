# Overlay Metadata Implementation Summary

## ✅ Completed Implementation

### 1. API Endpoints Created

#### POST `/api/streams/overlay`
- **Location**: `server/api/streams/overlay.post.js`
- **Purpose**: Store overlay metadata in DynamoDB
- **Request Body**:
  ```json
  {
    "streamKey": "sk_vnzweq4hpnksev4m",
    "overlay": {
      "overlayId": "...",
      "overlayName": "Twilly Watermark",
      "imageName": "TwillyWatermark",  // Or use imageUrl or imageBase64
      "imageUrl": "https://...",
      "imageBase64": "data:image/png;base64,...",
      "position": {
        "horizontal": "right",  // left, center, right
        "vertical": "bottom"    // top, center, bottom
      },
      "size": {
        "width": 200,
        "height": 60
      }
    }
  }
  ```
- **Storage**: DynamoDB table `Twilly`
  - PK: `STREAM_OVERLAY#{streamKey}`
  - SK: `metadata`
  - TTL: 24 hours (auto-cleanup)

#### POST `/api/streams/overlay/clear`
- **Location**: `server/api/streams/overlay/clear.post.js`
- **Purpose**: Manually clear overlay metadata for a streamKey
- **Request Body**:
  ```json
  {
    "streamKey": "sk_vnzweq4hpnksev4m"
  }
  ```

### 2. Backend Processing Updates

#### `streaming-service-server.js` Updates

**Added Functions:**
- `getOverlayMetadata(streamKey)` - Looks up overlay metadata from DynamoDB
- `downloadOverlayImage(imageUrl, outputPath)` - Downloads overlay image (supports HTTP/HTTPS)

**Updated Function:**
- `generateAdaptiveHLS(inputPath, outputDir, streamName)` - Now:
  1. Looks up overlay metadata using `streamName` (which equals `streamKey`)
  2. Downloads overlay image based on metadata (imageName, imageUrl, or imageBase64)
  3. Falls back to default watermark if no metadata or download fails
  4. Applies overlay with correct position (from metadata or default bottom-right)
  5. Applies overlay with correct size (from metadata or default 10% of width)

**Overlay Position Support:**
- All 9 positions: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right
- Default: bottom-right

**Overlay Size Support:**
- Uses `size.width` and `size.height` from metadata if provided
- Proportionally scales for each variant (1080p, 720p, 480p, 360p)
- Falls back to 10% of video width if not specified

## How It Works

### Flow:

1. **Mobile App** sends overlay metadata:
   ```
   POST /api/streams/overlay
   { streamKey: "sk_...", overlay: {...} }
   ```

2. **Backend** stores in DynamoDB with 24-hour TTL

3. **Mobile App** starts RTMP stream:
   ```
   rtmp://54.160.229.57:1935/live/sk_...
   ```

4. **NGINX** records stream to `/var/www/recordings/{streamKey}.flv`

5. **Stream stops** → NGINX calls `/api/streams/stop` with `streamName={streamKey}`

6. **Backend processing** (`streaming-service-server.js`):
   - `processStream(streamName, schedulerId)` is called
   - `generateAdaptiveHLS()` looks up overlay metadata for `streamName`
   - Downloads overlay image (from metadata or default)
   - Applies overlay during FFmpeg encoding
   - Uploads processed HLS files to S3

## Image Source Priority:

1. `overlay.imageBase64` - Base64 encoded image (saved to file)
2. `overlay.imageUrl` - Direct URL to image
3. `overlay.imageName` - Maps to predefined URLs:
   - `"TwillyWatermark"` → `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
   - `"twilly-logo"` → `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`
4. **Fallback**: Default watermark URL

## Testing

### Test API Endpoint:
```bash
curl -X POST http://your-api-url/api/streams/overlay \
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

### Verify in DynamoDB:
- Table: `Twilly`
- Query: PK = `STREAM_OVERLAY#sk_test123`, SK = `metadata`

### Test Clear:
```bash
curl -X POST http://your-api-url/api/streams/overlay/clear \
  -H "Content-Type: application/json" \
  -d '{"streamKey": "sk_test123"}'
```

## Notes

- Overlay metadata has 24-hour TTL for automatic cleanup
- If no metadata found, defaults to Twilly logo at bottom-right (10% width)
- Position and size are applied proportionally across all variants (1080p, 720p, 480p, 360p)
- Processing happens **after stream ends** when recording is processed
- Overlay is **burned into the video** (permanently part of the video file)

