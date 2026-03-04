# Lambda Timeout Analysis & Recommendations

## Current Configuration

- **Lambda Timeout**: 900 seconds (15 minutes) - **AWS MAXIMUM**
- **Mobile App Limit**: 15 minutes (14:59 max)
- **Processing Time**: Typically 2-5 minutes for 15-minute streams

## Key Insight: Processing Time ≠ Stream Duration

### Processing Time Estimates

| Stream Duration | Processing Time | Lambda Timeout Needed |
|----------------|-----------------|----------------------|
| 15 minutes     | 2-5 minutes    | ✅ 15 min (enough)   |
| 30 minutes     | 5-10 minutes    | ⚠️ 15 min (tight)    |
| 60 minutes     | 10-15 minutes   | ❌ 15 min (will fail) |

**Processing is typically 20-30% of stream duration** (faster than real-time).

## Recommendation: Keep 15 Minutes

### Why NOT reduce to 12 minutes:
- ❌ **No benefit**: Processing takes 2-5 minutes, not 12-15
- ❌ **Reduces safety margin**: If processing takes 6-8 minutes (rare), would fail
- ❌ **Won't help with longer streams**: Desktop/IRL streams still need 15 minutes

### Why keep 15 minutes:
- ✅ **AWS maximum**: Can't go higher anyway
- ✅ **Plenty of buffer**: 2-5 min processing vs 15 min timeout = 3-7x safety margin
- ✅ **Handles edge cases**: Can process 30-45 minute streams if needed

## What Happens with Longer Streams?

### Scenario 1: Desktop/IRL Stream (30 minutes)
```
Stream Duration: 30 minutes
Processing Time: ~6-10 minutes
Lambda Timeout: 15 minutes
Result: ✅ Should succeed (6-10 min < 15 min)
```

### Scenario 2: Very Long Stream (60+ minutes)
```
Stream Duration: 60 minutes
Processing Time: ~12-15 minutes
Lambda Timeout: 15 minutes
Result: ⚠️ May timeout (12-15 min ≈ 15 min limit)
```

### If Lambda Times Out:
1. **Stream is already recorded** ✅ (FLV file exists in S3)
2. **Processing fails** ❌ (HLS not generated)
3. **Video won't appear** ❌ (No DynamoDB entry)
4. **Manual retry needed** ⚠️ (Re-upload or re-process)

## Solutions for Longer Streams

### Option 1: Monitor & Alert (Recommended First Step)
- Set up CloudWatch alarms for Lambda timeouts
- Alert when processing exceeds 10 minutes
- Manually process failed streams if needed

### Option 2: Chunked Processing (For 60+ minute streams)
- Split long videos into 15-minute chunks
- Process each chunk separately
- Combine HLS playlists
- **Complexity**: High, requires code changes

### Option 3: Step Functions (For production)
- Use AWS Step Functions to orchestrate multiple Lambda invocations
- Each Lambda processes 15 minutes
- Step Functions chains them together
- **Complexity**: Medium, requires infrastructure changes

### Option 4: EC2 Fallback (Current backup)
- If Lambda times out, EC2 can still process locally
- Keep EC2 processing code as fallback
- **Complexity**: Low, already have code

## Current Status

✅ **15-minute streams**: Will work perfectly (2-5 min processing)
✅ **30-minute streams**: Should work (6-10 min processing)
⚠️ **60+ minute streams**: May timeout (12-15 min processing)

## Action Items

1. ✅ **Keep timeout at 15 minutes** (AWS max)
2. ⏳ **Monitor CloudWatch logs** for first few streams
3. ⏳ **Set up CloudWatch alarms** for timeouts
4. ⏳ **Track processing times** to identify patterns
5. ⏳ **Consider Step Functions** if many long streams

## Monitoring Commands

```bash
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=stream-processor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1

# Check for timeouts
aws logs filter-log-events \
  --log-group-name /aws/lambda/stream-processor \
  --filter-pattern "Task timed out" \
  --region us-east-1
```

## Summary

**Keep 15 minutes** - it's the maximum and provides plenty of buffer for typical processing times. Monitor for edge cases and consider Step Functions if you see many long streams.
