# Accurate Backend Stream Processing Flow

## Current Backend Implementation

### How Streams Are Processed:

1. **RTMP Streaming Phase**:
   - Mobile app streams to: `rtmp://54.160.229.57:1935/live/sk_vnzweq4hpnksev4m`
   - The `streamKey` (e.g., `sk_vnzweq4hpnksev4m`) is part of the RTMP URL path
   - NGINX RTMP server **records** the stream to `/var/www/recordings/{streamKey}.flv` (or `{streamKey}-timestamp.flv`)
   - Stream is already encoded (H.264 video + AAC audio) when it arrives

2. **Recording Complete Phase**:
   - When stream stops, NGINX calls webhook: `/api/streams/stop` with `streamName` (which equals the `streamKey`)
   - This triggers backend processing of the **recorded file**

3. **Backend Processing Phase** (what you need to understand):
   - Backend processes the **RECORDED `.flv` file** (NOT the live RTMP stream)
   - Location: `streaming-service-server.js` → `processStream(streamName, schedulerId)`
   - The `streamName` parameter **IS the streamKey** (e.g., `sk_vnzweq4hpnksev4m`)
   - Processing flow:
     ```
     Recorded FLV file → FFmpeg decodes → Adds overlay → Re-encodes to HLS variants → Uploads to S3
     ```

### What's Currently Missing:

- ❌ **NO API endpoint** for storing overlay metadata (`/api/stream/overlay`)
- ❌ **NO API endpoint** for clearing overlay metadata (`/api/stream/overlay/clear`)
- ❌ **NO storage system** for overlay metadata keyed by streamKey
- ✅ Overlay is currently **hardcoded** (uses fixed watermark URL: `https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png`)

## What Needs to Be Implemented:

### 1. Create API Endpoints:

**POST `/api/streams/overlay`**
- Store overlay metadata in DynamoDB keyed by `streamKey`
- Store until stream is processed (then can be cleaned up)

**POST `/api/streams/overlay/clear`** (optional)
- Remove overlay metadata for a streamKey

### 2. Update Processing Code:

**In `streaming-service-server.js` → `generateAdaptiveHLS()`**:
- Before processing, **look up overlay metadata** using `streamName` (which is the streamKey)
- Use metadata to determine:
  - Which overlay image to use
  - Position (horizontal: left/center/right, vertical: top/center/bottom)
  - Size (width, height)
- Apply overlay during FFmpeg processing

### 3. Storage Options:

**Option A: DynamoDB** (Recommended)
- Table: `Twilly`
- Key: `PK: STREAM_OVERLAY#{streamKey}`, `SK: metadata`
- Store: overlay config JSON
- TTL: Set expiration for cleanup (e.g., 24 hours after stream ends)

**Option B: In-Memory Map** (Simple but not persistent)
- Store in `activeStreams` Map in `streaming-service-server.js`
- Only works if metadata is sent before streaming starts

## Accurate Flow for Mobile App:

```
1. User selects overlay in mobile app
2. BEFORE rtmpStream.publish():
   → POST /api/streams/overlay
   → Body: { streamKey: "sk_vnzweq4hpnksev4m", overlay: {...} }
   → Backend stores in DynamoDB

3. Mobile app starts RTMP stream:
   → rtmpStream.publish(rtmp://server/live/{streamKey})
   → NGINX records to /var/www/recordings/{streamKey}.flv

4. User stops streaming
   → NGINX calls /api/streams/stop with streamName={streamKey}
   → Backend processes recorded file:
      a. Lookup overlay metadata for streamKey
      b. Decode FLV → Add overlay → Re-encode to HLS
      c. Upload to S3

5. Overlay metadata can be cleaned up after processing (or use TTL)
```

## Key Differences from Your Description:

| Your Description | Actual Backend |
|-----------------|----------------|
| Backend processes "RTMP stream" | Backend processes **recorded FLV file** |
| Stream metadata sent during stream | Metadata must be sent **BEFORE** stream starts |
| Stream key → stream name conversion | **streamName = streamKey** (they're the same) |
| "Backend uses FFmpeg to decode RTMP" | FFmpeg decodes **recorded file**, not live RTMP |

## What You Need to Tell Mobile App Developer:

1. **Send overlay metadata BEFORE starting RTMP stream**
2. Use endpoint: `POST /api/streams/overlay`
3. The `streamKey` in the API call must match the `streamKey` used in RTMP URL
4. Backend will process the overlay **after streaming ends** (when processing the recorded file)
5. Overlay will appear in the **processed/recorded videos**, not in live stream

