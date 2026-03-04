# Collaboration Streaming Flow - Complete Logic Verification

## Overview
This document verifies the complete flow for collaborator streaming to ensure files are stored correctly and appear in channel views.

## Flow Steps

### 1. User Accepts Invite (`accept-invite.post.js`)
**What happens:**
- Creates `COLLABORATOR_ROLE#channelName` record with:
  - `PK: USER#userId`
  - `SK: COLLABORATOR_ROLE#channelName`
  - `addedViaInvite: true` ✅
  - `status: 'active'`
  - `streamKey: generated_stream_key`

- Creates `STREAM_KEY#streamKey/MAPPING` record with:
  - `collaboratorEmail: userEmail` ✅
  - `creatorId: userId` ✅ (CRITICAL for username lookup)
  - `channelName: channelName`
  - `isCollaboratorKey: true`

**Status:** ✅ Working correctly

---

### 2. User Streams (`convert-to-post.post.js`)
**What happens:**
- Receives: `streamKey`, `channelName`, `userEmail` (optional)
- **CRITICAL FIX:** ALWAYS looks up streamKey mapping FIRST (even if userEmail provided)
- Uses `collaboratorEmail` from streamKey mapping for collaborator keys
- Creates file record with:
  - `PK: USER#collaboratorEmail` ✅
  - `SK: FILE#fileId`
  - `folderName: channelName` ✅
  - `streamKey: streamKey` ✅

**Status:** ✅ Fixed - Now always uses streamKey mapping as source of truth

---

### 3. Channel View (`get-content.post.js`)
**What happens:**
- Receives: `channelName`, `creatorEmail` (channel owner)
- Finds legitimate collaborators:
  - Scans for `COLLABORATOR_ROLE#channelName` where `addedViaInvite: true` ✅
  - Maps `userId` → `email` for each collaborator ✅
- Queries files from:
  - Channel owner: `USER#creatorEmail`
  - Legitimate collaborators: `USER#collaboratorEmail` ✅
- Filters files by:
  - `folderName === channelName` ✅
  - `isVisible !== false` ✅
  - Security check: file owner must be legitimate collaborator ✅
- Looks up username:
  - For collaborator videos: Uses `creatorId` from streamKey mapping ✅
  - Falls back to email lookup if needed

**Status:** ✅ Working correctly

---

## Critical Fixes Applied

### Fix 1: `convert-to-post.post.js`
**Problem:** Only checked streamKey mapping if `userEmail` was missing
**Solution:** ALWAYS check streamKey mapping first, use it as source of truth
**Impact:** Files now stored under correct collaborator email

### Fix 2: `accept-invite.post.js`
**Problem:** Missing `creatorId` in STREAM_KEY mapping
**Solution:** Added `creatorId: userId` to mapping
**Impact:** Username lookup now works correctly

### Fix 3: `get-content.post.js`
**Problem:** Only queried channel owner's files
**Solution:** Query files from all legitimate collaborators
**Impact:** Collaborator videos now appear in channel view

---

## Verification Checklist

- [x] Invite acceptance creates correct records
- [x] StreamKey mapping has both email and userId
- [x] Files stored under correct email (from streamKey mapping)
- [x] Files have correct folderName matching channelName
- [x] get-content queries all legitimate collaborators
- [x] Security check prevents unauthorized files
- [x] Username lookup works for collaborators

---

## Testing Scenarios

### Scenario 1: New Collaborator Streams
1. User accepts invite → Records created ✅
2. User streams → File stored under `USER#collaboratorEmail` ✅
3. Channel view → File appears with correct username ✅

### Scenario 2: Multiple Collaborators
1. Collaborator A streams → File under `USER#collaboratorA_email` ✅
2. Collaborator B streams → File under `USER#collaboratorB_email` ✅
3. Channel view → Both files appear with correct usernames ✅

### Scenario 3: Unauthorized User
1. User without invite tries to stream → File not created or rejected ✅
2. Channel view → Unauthorized files filtered out ✅

---

## Known Issues Fixed

1. ✅ Files stored under wrong email (dehyubuilds@gmail.com instead of dehsin365@gmail.com)
2. ✅ Missing creatorId in STREAM_KEY mappings
3. ✅ addedViaInvite: undefined for some collaborations
4. ✅ convert-to-post not checking streamKey mapping when userEmail provided

---

## Summary

The collaboration streaming logic is now working correctly:
- Files are stored under the correct email (from streamKey mapping)
- Only legitimate collaborators (addedViaInvite: true) can have their videos appear
- Username lookup works correctly for all videos
- Security checks prevent unauthorized access
