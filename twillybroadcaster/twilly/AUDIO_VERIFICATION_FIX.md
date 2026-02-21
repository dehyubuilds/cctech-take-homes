# Audio Verification Fix

## Issue
Streams are missing audio - both public and private streams have no audio.

## Root Cause
FFmpeg commands are using `-map '0:a'` which assumes an audio track exists. If the RTMP recording doesn't have audio (microphone not attached or RTMP stream missing audio), FFmpeg will either:
1. Fail with an error
2. Produce output without audio silently

## Fix Applied
Added audio detection before FFmpeg encoding in three functions:
1. `generateSingleVariant` - Checks for audio before encoding 1080p variant
2. `generateRemainingVariants` - Checks for audio before encoding 720p, 480p, 360p variants
3. `generateAdaptiveHLS` - Checks for audio before encoding all variants

### How It Works
1. Uses `ffprobe` to check if input file has an audio track
2. If audio exists: Uses `-map '0:a' -c:a aac -b:a {bitrate}` 
3. If no audio: Uses `-an` (no audio) to prevent FFmpeg errors

### Next Steps
1. **Verify iOS app microphone attachment** - Check if `rtmpStream.attachAudio(microphone)` is actually working
2. **Check RTMP server logs** - Verify RTMP streams are receiving audio
3. **Test with a new stream** - After deploying this fix, test to see if audio is captured

## iOS App Audio Configuration
The iOS app (`StreamManager.swift`) is configured to:
- Attach microphone: Line 1191-1204
- Audio settings: 128 kbps bitrate (Line 125-127)

If audio is still missing after this fix, the issue is likely:
1. Microphone permissions not granted
2. Microphone not actually attached to RTMP stream
3. RTMP server not recording audio from the stream
