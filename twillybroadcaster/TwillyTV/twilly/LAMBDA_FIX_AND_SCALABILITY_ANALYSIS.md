# Lambda Fix and Scalability Analysis

## 🔴 CRITICAL BUG FOUND

### Problem: Lambda Path Parsing Issue

**S3 File Format:**
```
clips/twillytvdur4k9l2/twillytvdur4k9l2_2026-01-29T01-40-54-790Z_wpux9jqt_master.m3u8
```

**Lambda Logic:**
1. Extracts `streamKey = pathParts[1]` = `twillytvdur4k9l2` ✅ CORRECT
2. Extracts `streamName` from filename = `twillytvdur4k9l2_2026-01-29T01-40-54-790Z_wpux9jqt` ❌ WRONG
3. Uses `streamKey` (not `streamName`) to look up mapping ✅ CORRECT

**The Real Issue:**
- Lambda correctly uses `streamKey` from path
- But `streamName` extraction is wrong and might cause confusion
- **However, the actual bug is that Lambda uses `streamKey` correctly, so this shouldn't be the issue**

### Root Cause Analysis

The Lambda should work correctly because:
- Line 547: `const streamKey = pathParts[1];` - Gets streamKey from path ✅
- Line 674: `const userInfo = await getUserFromStreamKey(streamKey);` - Uses streamKey (not streamName) ✅

**Possible Issues:**
1. **Lambda not triggered** - S3 event not configured correctly
2. **Lambda timeout** - Processing takes too long
3. **Lambda error** - Error caught and logged but not visible
4. **StreamKey mapping lookup fails** - But we verified it exists

## 🔧 FIX: Improve Lambda Path Parsing

The Lambda should use `streamKey` from path directly, not extract from filename. The `streamName` extraction is unnecessary and error-prone.

**Current Code (Line 618-628):**
```javascript
if (foundExtension && extensionIndex > 0) {
  const beforeExtension = lastPart.substring(0, extensionIndex);
  const lastUnderscoreIndex = beforeExtension.lastIndexOf('_');
  if (lastUnderscoreIndex > 0) {
    streamName = beforeExtension.substring(0, lastUnderscoreIndex);
  } else {
    streamName = beforeExtension;
  }
}
```

**Fix:**
```javascript
// Use streamKey from path directly - it's already correct
streamName = streamKey; // streamKey is already extracted from pathParts[1]
```

## 📊 SCALABILITY ANALYSIS

### Current Architecture Issues

1. **Synchronous Processing**
   - Lambda processes files one by one
   - No batching or parallel processing
   - Timeout risk with many files

2. **No Retry Logic**
   - If Lambda fails, files are lost
   - No dead letter queue
   - No manual retry mechanism

3. **Inefficient Path Parsing**
   - Complex parsing logic for different formats
   - Should standardize on one format

4. **No Rate Limiting**
   - Lambda can be overwhelmed by many S3 events
   - No throttling or queuing

### Recommendations

1. **Fix Path Parsing**
   - Always use `streamKey` from path (pathParts[1])
   - Remove complex filename parsing
   - Standardize S3 path format

2. **Add Retry Logic**
   - Implement exponential backoff
   - Add dead letter queue for failed events
   - Add manual retry endpoint

3. **Optimize for Scale**
   - Batch process multiple files
   - Use SQS for event queuing
   - Add rate limiting

4. **Improve Error Handling**
   - Better logging
   - Error notifications
   - Monitoring and alerts
