# Scalability Issues Found

## 🔴 CRITICAL: Lambda Path Parsing Bug (FIXED)

**Problem:** Lambda was extracting `streamName` from filename instead of using `streamKey` from path.

**Impact:** Files with format `clips/{streamKey}/{streamKey_timestamp_uploadId_master.m3u8}` were not processed because Lambda extracted wrong streamName.

**Fix Applied:** Lambda now uses `streamKey` from path directly (pathParts[1]).

## ⚠️ SCALABILITY ISSUES

### 1. Synchronous Processing
- **Issue:** Lambda processes files one by one sequentially
- **Impact:** Slow processing, timeout risk with many files
- **Recommendation:** Batch process or use SQS for queuing

### 2. No Retry Logic
- **Issue:** If Lambda fails, files are lost
- **Impact:** Data loss, no recovery mechanism
- **Recommendation:** Add dead letter queue, retry logic

### 3. Complex Path Parsing
- **Issue:** Multiple format checks, error-prone
- **Impact:** Bugs like the one we just fixed
- **Recommendation:** Standardize on one S3 path format

### 4. Streaming Service Issues

#### a. Sequential File Uploads
- **Issue:** Files uploaded one by one (line 1823-1866)
- **Impact:** Slow uploads, especially with many files
- **Recommendation:** Parallel uploads using Promise.all()

#### b. No Rate Limiting
- **Issue:** No throttling on FFmpeg processes
- **Impact:** Server overload with multiple streams
- **Current:** Has `activeFFmpegProcesses` tracking but no hard limit
- **Recommendation:** Add max concurrent FFmpeg processes limit

#### c. Memory Management
- **Issue:** Large video files processed in memory
- **Impact:** Memory exhaustion with large files
- **Recommendation:** Stream processing, chunked uploads

#### d. No Queue System
- **Issue:** All processing happens synchronously
- **Impact:** One slow stream blocks others
- **Recommendation:** Use SQS for async processing

### 5. Lambda Timeout Risk
- **Issue:** Lambda has 60s timeout, but processing can take longer
- **Impact:** Timeouts, incomplete processing
- **Recommendation:** Increase timeout or split into multiple Lambdas

## ✅ OPTIMIZATIONS NEEDED

1. **Standardize S3 Path Format**
   - Use: `clips/{streamKey}/{uploadId}/{filename}` consistently
   - Remove old format support after migration

2. **Add Retry Logic**
   - Exponential backoff for failed operations
   - Dead letter queue for failed events
   - Manual retry endpoint

3. **Parallel Processing**
   - Upload files in parallel
   - Process multiple streams concurrently
   - Use worker pools for FFmpeg

4. **Add Monitoring**
   - CloudWatch alarms for Lambda failures
   - S3 event tracking
   - Processing time metrics

5. **Optimize Lambda**
   - Reduce metadata retry attempts (currently 5)
   - Batch DynamoDB writes
   - Cache streamKey mappings
