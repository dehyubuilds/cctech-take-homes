# 1-Hour RTMP Stream Analysis

## Current System Limitations

### ❌ **Critical Blockers for 1-Hour Streams**

#### 1. **FFmpeg Timeout (30 minutes)**
- **Current:** 30 minutes (1800000ms)
- **Problem:** A 1-hour video would timeout during HLS generation
- **Impact:** FFmpeg process would be killed after 30 minutes, leaving incomplete HLS files
- **Location:** Lines 1595, 1694, 1869 in `streaming-service-server.js`

#### 2. **Lambda Timeout (15 minutes - MAX)**
- **Current:** 15 minutes (900 seconds) - This is AWS Lambda's maximum timeout
- **Problem:** Lambda cannot process a 1-hour video - it will timeout
- **Impact:** S3 events for 1-hour videos would not be processed by Lambda
- **Note:** AWS Lambda has a hard limit of 15 minutes - cannot be increased

#### 3. **File Size Limit (2GB)**
- **Current:** 2GB max file size for uploads (multer limit)
- **Problem:** A 1-hour stream at typical bitrates:
  - 1080p @ 5Mbps = ~2.25GB
  - 720p @ 3Mbps = ~1.35GB
  - 480p @ 1.5Mbps = ~675MB
- **Impact:** Higher quality 1-hour streams would exceed the 2GB limit
- **Location:** Line 18 in `streaming-service-server.js`

### ⚠️ **Potential Issues**

#### 4. **Processing Time**
- **Estimate:** Processing a 1-hour video into HLS variants:
  - 1080p variant: ~15-20 minutes
  - Remaining variants (720p, 480p, 360p): ~20-30 minutes each
  - **Total:** ~1-2 hours of processing time
- **Impact:** Server would be tied up processing one stream for a long time

#### 5. **Disk Space**
- **EC2 Instance:** Need to store:
  - Original recording: ~2-4GB
  - HLS segments: ~2-4GB per variant
  - **Total:** ~10-20GB per 1-hour stream
- **Impact:** Could fill up disk space quickly with multiple streams

#### 6. **Memory Usage**
- **Current:** System checks for 85% memory usage
- **Problem:** Processing large videos requires significant memory
- **Impact:** Could cause memory pressure, especially with multiple concurrent streams

#### 7. **S3 Storage Costs**
- **Estimate:** A 1-hour stream would generate:
  - ~600 HLS segments (6-second segments)
  - ~2-4GB per variant
  - **Total:** ~8-16GB per stream
- **Impact:** Significant S3 storage and bandwidth costs

## What Would Actually Happen

### Scenario: 1-Hour RTMP Stream

1. **Stream Recording** ✅
   - RTMP stream would be recorded successfully
   - File would be saved to `/var/www/recordings` or `/tmp/recordings`
   - File size: ~2-4GB (depending on bitrate)

2. **Processing Starts** ⚠️
   - `processStreamInternal()` would be called
   - FFmpeg would start generating 1080p variant
   - **After 30 minutes:** FFmpeg would timeout and be killed
   - **Result:** Incomplete HLS files, no master playlist

3. **Lambda Processing** ❌
   - S3 events would trigger Lambda
   - Lambda would start processing
   - **After 15 minutes:** Lambda would timeout (hard AWS limit)
   - **Result:** No DynamoDB entries created, videos not visible

4. **Storage** ⚠️
   - Incomplete files would remain in S3
   - Disk space on EC2 would be consumed
   - No cleanup of failed processing

## Solutions for 1-Hour Streams

### Option 1: **Increase FFmpeg Timeout** (Partial Fix)
```javascript
// Change from 30 minutes to 2 hours
}, 7200000); // 2 hours
```
- **Pros:** Would allow processing to complete
- **Cons:** Still limited by Lambda timeout (15 min max)
- **Status:** Can be done, but Lambda is still a blocker

### Option 2: **Remove File Size Limit** (Partial Fix)
```javascript
fileSize: 10 * 1024 * 1024 * 1024 // 10GB max
```
- **Pros:** Would allow larger files
- **Cons:** Still limited by timeouts
- **Status:** Can be done, but other issues remain

### Option 3: **Use Step Functions for Lambda** (Best Solution)
- **Problem:** Lambda has 15-minute hard limit
- **Solution:** Use AWS Step Functions to orchestrate multiple Lambda invocations
- **How it works:**
  1. Lambda processes first 15 minutes of video
  2. Step Function triggers next Lambda for next 15 minutes
  3. Repeat until entire video is processed
- **Pros:** Can handle videos of any length
- **Cons:** More complex architecture, higher costs

### Option 4: **Use ECS/Fargate Instead of Lambda** (Best for Long Videos)
- **Problem:** Lambda timeout is hard limit
- **Solution:** Use ECS/Fargate containers that can run for hours
- **How it works:**
  1. S3 event triggers ECS task
  2. Container processes entire video (no timeout limit)
  3. Container can run for hours if needed
- **Pros:** No timeout limits, can handle any video length
- **Cons:** More expensive, more complex setup

### Option 5: **Chunked Processing** (Hybrid Solution)
- **Problem:** Processing entire video at once is slow
- **Solution:** Process video in chunks
- **How it works:**
  1. Split 1-hour video into 10-minute chunks
  2. Process each chunk separately
  3. Combine HLS playlists at the end
- **Pros:** Faster processing, can use Lambda
- **Cons:** More complex, requires chunking logic

## Recommendations

### For Current System (15-minute limit):
✅ **Keep current limits** - System is optimized for 15-minute streams
- FFmpeg timeout: 30 minutes (good buffer)
- Lambda timeout: 15 minutes (max allowed)
- File size: 2GB (sufficient for 15-minute streams)

### For 1-Hour Streams:
🔧 **Architecture Changes Required:**
1. **Increase FFmpeg timeout to 2+ hours**
2. **Remove or increase file size limit to 10GB**
3. **Replace Lambda with ECS/Fargate** for processing
   - Or use Step Functions to chain Lambda invocations
4. **Implement chunked processing** for faster turnaround
5. **Add disk space monitoring** and cleanup
6. **Consider S3 lifecycle policies** for old segments

### Cost Considerations:
- **Current (15 min):** ~$0.10-0.50 per stream
- **1-hour stream:** ~$0.50-2.00 per stream (4x processing time)
- **Storage:** ~$0.20-0.40 per GB/month in S3

## Conclusion

**Current System: ❌ Cannot handle 1-hour streams**

**Blockers:**
1. FFmpeg timeout (30 min) - Can be increased
2. Lambda timeout (15 min) - **Hard AWS limit, cannot be increased**
3. File size limit (2GB) - Can be increased

**To Support 1-Hour Streams:**
- Must replace Lambda with ECS/Fargate OR use Step Functions
- Must increase FFmpeg timeout to 2+ hours
- Must increase file size limit to 10GB
- Must add disk space management
- Must optimize processing for longer videos

**Recommendation:** Keep 15-minute limit for now, or implement ECS/Fargate solution for longer streams.
