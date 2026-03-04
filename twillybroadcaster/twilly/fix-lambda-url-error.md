# Lambda "url" Variable Error Fix

## Issue
The Lambda function `s3todynamo` in `us-east-2` has an error:
```
ReferenceError: Cannot access 'url' before initialization
```

## Root Cause
In the Lambda code, `url` is used in `updateVideoWithThumbnail` function (line 696) before it's defined (line 712).

## Fix Required
Move the `url` definition before the thumbnail check, or pass it as a parameter to `updateVideoWithThumbnail`.

## Location
The Lambda function is deployed in AWS as `s3todynamo` in region `us-east-2`.

## Code Pattern to Fix
```javascript
// CURRENT (BROKEN):
if (isThumbnail) {
  await updateVideoWithThumbnail(fileName, url, userEmail, uploadId); // ❌ url not defined yet
  continue;
}
// ... later ...
const url = `${cloudFrontBaseUrl}/${key}`; // ✅ url defined here

// FIXED:
const url = `${cloudFrontBaseUrl}/${key}`; // ✅ Define url first
if (isThumbnail) {
  await updateVideoWithThumbnail(fileName, url, userEmail, uploadId); // ✅ url is defined
  continue;
}
```

## Action Required
1. Locate the Lambda source code (may be in AWS or a deployment package)
2. Move `url` definition before thumbnail check
3. Redeploy Lambda to `s3todynamo` in `us-east-2`
