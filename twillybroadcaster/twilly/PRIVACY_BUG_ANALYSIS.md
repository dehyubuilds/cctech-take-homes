# Privacy Bug Analysis: isPrivateUsername Not Being Set Correctly

## Problem Statement

**Both videos were streamed as PRIVATE, but the 15-minute video is appearing in PUBLIC view.**

### Evidence:
- StreamKey mapping has `isPrivateUsername: TRUE` ✅
- Video is appearing in PUBLIC view ❌
- Video entry likely missing or has incorrect `isPrivateUsername` value

## Code Flow Analysis

### Step 1: User Selects Private
- Mobile app calls `setStreamUsernameType` API
- API sets `isPrivateUsername: true` in streamKey mapping ✅
- **Status**: WORKING (confirmed in DynamoDB)

### Step 2: Video Upload & Processing
- `createVideoEntryImmediately` is called (line 2316)
- It reads `isPrivateUsername` from streamKey mapping (lines 2620-2741)
- Has extensive retry logic with ConsistentRead: true
- Sets `videoItem.isPrivateUsername = isPrivateUsername` (line 2743)
- Saves to DynamoDB using DocumentClient (line 2776)
- **Status**: SHOULD WORK - but field might not be persisting

### Step 3: Lambda Processing (S3 Event)
- Lambda is triggered when HLS files are uploaded
- Lambda reads existing video entry (line 809-813)
- Lambda checks if `isPrivateUsername` exists in existing entry (line 817)
- If exists, preserves it (line 831)
- If NOT exists, reads from streamKey mapping (line 833-840)
- If streamKey mapping read fails, defaults to PUBLIC (line 843)
- **Status**: POTENTIAL BUG HERE

## Root Cause Hypothesis

### Issue 1: DocumentClient vs Low-Level Client Format Mismatch
- `createVideoEntryImmediately` uses DocumentClient (saves boolean as boolean)
- Lambda uses low-level client (reads as `{ BOOL: true }` format)
- Lambda's check at line 817 might fail to detect DocumentClient boolean format
- **Fix**: Lambda's check should handle DocumentClient format (it does at line 824, but might have a bug)

### Issue 2: Lambda Overwrites with Wrong Value
- If Lambda's check fails, it reads from streamKey mapping
- If streamKey mapping read fails or returns wrong format, it defaults to PUBLIC
- **Fix**: Ensure Lambda correctly reads and preserves the value

### Issue 3: Field Missing from Video Entry
- `createVideoEntryImmediately` might not be setting the field correctly
- Or DocumentClient might be omitting the field if it's `undefined` at some point
- **Fix**: Ensure field is ALWAYS set before saving

## The Actual Bug

Looking at Lambda code (line 817-832):
```javascript
if (existingResult.Item && existingResult.Item.isPrivateUsername !== undefined) {
  // Preserve existing value
} else if (isPrivateUsername !== undefined && isPrivateUsername !== null) {
  // Read from streamKey mapping
} else {
  // Default to public
}
```

**The problem**: If `createVideoEntryImmediately` saves the field but Lambda's check fails (format mismatch), Lambda will try to read from streamKey mapping. But if that read also fails or returns wrong format, it defaults to PUBLIC.

## Permanent Fix Required

1. **Ensure `createVideoEntryImmediately` ALWAYS sets the field** - even if it's false
2. **Fix Lambda's format detection** - ensure it correctly detects DocumentClient boolean format
3. **Add fallback in Lambda** - if existing entry check fails, still try to read from streamKey mapping correctly
4. **Add logging** - log the actual value being saved and read to debug

## Specific Code Issues

### Issue in `createVideoEntryImmediately`:
- Line 2743: Sets `videoItem.isPrivateUsername = isPrivateUsername`
- But if `isPrivateUsername` is `undefined` at this point, the field won't be set
- Need to ensure it's ALWAYS set (even if false)

### Issue in Lambda:
- Line 817: Check might fail if DocumentClient format isn't recognized
- Line 824: Should handle `typeof rawValue === 'boolean'` but might have edge case
- Need to ensure the check is robust

## Recommended Fix

1. **In `createVideoEntryImmediately`**: Ensure `isPrivateUsername` is ALWAYS set (never undefined)
2. **In Lambda**: Improve format detection to handle all cases
3. **Add validation**: Log the value before and after save to verify persistence
