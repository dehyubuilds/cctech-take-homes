# Tracing Privacy Flow - All Code Paths

## Issue Found: isPrivateUsernameFromRequest is NULL for RTMP streams!

### Code Path Analysis:

1. **HTTP Upload Flow:**
   - `upload-video` endpoint receives `isPrivateUsernameFromRequest` from request body ✅
   - Passes it to `createVideoEntryImmediately(streamName, uploadId, uniquePrefix, userEmail, channelName, isPrivateUsernameFromRequest)` ✅
   - `createVideoEntryImmediately` checks global map FIRST ✅

2. **RTMP Stream Flow:**
   - `processStreamInternal` is called with `uploadId = NULL` ❌
   - `isPrivateUsernameFromRequest` is NOT passed (it's undefined) ❌
   - Line 1305: `createVideoEntryImmediately(streamName, finalUploadId, uniquePrefix, finalUserEmail, finalChannelName, isPrivateUsernameFromRequest)`
   - `isPrivateUsernameFromRequest` is `undefined` for RTMP streams! ❌

### The Bug:

For RTMP streams, `isPrivateUsernameFromRequest` is always `undefined`, so:
- Priority 1: Global map check (should work if setStreamUsernameType was called)
- Priority 2: Request body check (fails - undefined)
- Priority 3: StreamKey mapping check (should work as fallback)

BUT - if the global map check fails (maybe the immediate endpoint wasn't called), it falls back to streamKey mapping which might have eventual consistency issues.

### Fix Needed:

For RTMP streams, we should pass `null` explicitly and rely on global map + streamKey mapping. But we need to ensure the global map is ALWAYS set when setStreamUsernameType is called.
