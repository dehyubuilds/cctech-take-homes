# Stream Processing Fixes - 15-Minute Videos & Thumbnail Issues

## Issues Found

### 1. **FFmpeg Timeout Too Short** ❌
- **Problem:** FFmpeg timeout was set to 10 minutes (600000ms)
- **Impact:** 15-minute videos were timing out during processing, causing incomplete HLS generation
- **Fix:** Increased all FFmpeg timeouts to 30 minutes (1800000ms)
- **Locations Fixed:**
  - `generateSingleVariant()` - Line 1595
  - `generateRemainingVariants()` - Line 1693
  - `generateAdaptiveHLS()` - Line 1867

### 2. **Lambda Timeout Too Low** ❌
- **Problem:** Lambda function `s3todynamo` had only 60-second timeout
- **Impact:** Lambda was timing out before processing 15-minute videos
- **Fix:** Increased Lambda timeout to 900 seconds (15 minutes - max allowed)
- **Command:** `./twilly/update-lambda-config.sh`

### 3. **Lambda Memory Too Low** ❌
- **Problem:** Lambda had only 128MB memory
- **Impact:** Insufficient memory for processing large video files
- **Fix:** Increased Lambda memory to 1024MB
- **Command:** `./twilly/update-lambda-config.sh`

### 4. **Thumbnail Generation Failing for Short Videos** ❌
- **Problem:** Early thumbnail generation used `select=eq(n\,0)` which tries to get frame 0
- **Impact:** For very short videos (13 seconds), the file might not be fully written, causing thumbnail generation to fail
- **Fix:** Changed to use `-ss 1` to seek to 1 second instead of trying to get frame 0
- **Locations Fixed:**
  - Early thumbnail generation (Line 479-486)
  - Regular thumbnail generation (Line 1276-1283)

### 5. **No Stream Duration Limits on Server** ✅
- **Status:** Confirmed - No duration limits found on server
- **Note:** Mobile app enforces 15-minute limit, server accepts any duration

## Summary of Changes

### Server Changes (`streaming-service-server.js`):
1. ✅ Increased FFmpeg timeout from 10 minutes to 30 minutes (3 locations)
2. ✅ Fixed early thumbnail generation to use `-ss 1` instead of `select=eq(n\,0)`
3. ✅ Fixed regular thumbnail generation to use `-ss 1` instead of `-ss 00:00:05`

### Lambda Changes (`s3todynamo` in `us-east-2`):
1. ✅ Increased timeout from 60 seconds to 900 seconds (15 minutes)
2. ✅ Increased memory from 128MB to 1024MB

## Next Steps

1. **Deploy server changes:**
   ```bash
   cd twilly
   ./deploy-ec2-server.sh
   ```

2. **Verify Lambda configuration:**
   ```bash
   aws lambda get-function-configuration --function-name s3todynamo --region us-east-2
   ```

3. **Test with 15-minute video:**
   - Stream a 15-minute video from mobile
   - Verify it processes completely
   - Check that thumbnail is generated

4. **Test with short video:**
   - Stream a 10-15 second video
   - Verify thumbnail is generated correctly

## Expected Behavior After Fixes

- ✅ 15-minute videos should process completely without timeout
- ✅ Short videos (13 seconds) should generate thumbnails correctly
- ✅ Lambda should have enough time and memory to process large videos
- ✅ FFmpeg should not timeout during HLS generation for long videos

## Monitoring

Watch for these in logs:
- `⏰ FFmpeg timeout` - Should not appear for videos < 30 minutes
- `❌ EARLY: Thumbnail generation failed` - Should be rare now
- Lambda timeout errors in CloudWatch - Should not occur for videos < 15 minutes
