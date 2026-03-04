# Investigation: 15-Minute Stream Not Appearing

## What to Check

### 1. Check Server Logs
SSH into your EC2 instance and check:
```bash
# Check streaming service logs
tail -n 500 /var/log/streaming-service.log | grep -i "upload\|process\|error\|15\|minute"

# Or if using PM2
pm2 logs streaming-service --lines 500 | grep -i "upload\|process\|error"
```

### 2. Check DynamoDB for Recent Videos
Run this query in AWS Console or use AWS CLI:

```bash
aws dynamodb query \
  --table-name Twilly \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "USER#dehyu.sinyan@gmail.com"},
    ":sk": {"S": "FILE#"}
  }' \
  --limit 10 \
  --scan-index-forward false \
  --region us-east-1
```

### 3. Check S3 for Uploaded Files
```bash
# List recent uploads
aws s3 ls s3://theprivatecollection/clips/ --recursive --human-readable | tail -20

# Check for incomplete uploads
aws s3 ls s3://theprivatecollection/clips/ --recursive | grep "sk_"
```

### 4. Check Mobile App Logs
On your iPhone:
- Settings → Privacy & Security → Analytics & Improvements → Analytics Data
- Look for "TwillyBroadcaster" entries around the time you streamed
- Check for errors or warnings

### 5. Possible Issues

#### Issue 1: Phone Went to Sleep During Upload
- **Symptom**: Stream stopped, upload never completed
- **Check**: Look for partial files in S3 or recording directory
- **Solution**: Ensure phone stays awake during upload (already implemented with `UIApplication.shared.isIdleTimerDisabled = true`)

#### Issue 2: Upload Failed Silently
- **Symptom**: Video recorded but never uploaded
- **Check**: Look for local video files on phone (if accessible)
- **Solution**: Check upload retry logic

#### Issue 3: Processing Queue Backed Up
- **Symptom**: Video uploaded but not processed
- **Check**: EC2 instance CPU/memory usage, processing queue depth
- **Solution**: Check if other videos are processing

#### Issue 4: DynamoDB Entry Not Created
- **Symptom**: Video processed but not visible
- **Check**: Look for video in DynamoDB with `isVisible: false`
- **Solution**: Check `createVideoEntryImmediately` logs

### 6. What to Look For

1. **Upload Start Time**: When did upload begin?
2. **Upload Completion**: Did upload complete successfully?
3. **Processing Start**: Did FFmpeg start processing?
4. **Thumbnail Generation**: Was thumbnail created?
5. **DynamoDB Entry**: Was video entry created?
6. **S3 Files**: Are HLS files in S3?

### 7. Quick Checks

```bash
# On EC2 server - check for recent recording files
ls -lth /var/www/recordings/ | head -10
ls -lth /tmp/recordings/ | head -10

# Check processing queue
# (if you have access to the Node.js process)
# Check active FFmpeg processes
ps aux | grep ffmpeg

# Check disk space
df -h
```

## Expected Timeline for 15-Minute Video

- **0-60 seconds**: Upload completes
- **0-5 seconds**: Thumbnail generated
- **5-10 seconds**: DynamoDB entry created → Video appears
- **3-5 minutes**: 1080p HLS ready → Video playable
- **10-15 minutes**: All variants complete

## If Video Never Appeared

1. Check if upload completed (S3 files)
2. Check if processing started (FFmpeg logs)
3. Check if DynamoDB entry exists (even if `isVisible: false`)
4. Check for errors in server logs
5. Check mobile app logs for upload errors
