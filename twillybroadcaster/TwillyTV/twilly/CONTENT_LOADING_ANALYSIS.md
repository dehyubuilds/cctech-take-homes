# Content Loading Analysis & Improvement Plan

## Current Behavior

### How Content Loading Works Now

1. **Backend Flow (`get-content.post.js`):**
   - Fetches all video items from DynamoDB (stored under master account for Twilly TV)
   - For each item, performs async username lookup (lines 755-1100+):
     - Tries streamKey mapping first
     - Falls back to USER#email/PROFILE
     - Falls back to PK=USER, SK=userId (source of truth)
     - Multiple fallback methods
   - **CRITICAL FILTERING** (lines 1203-1336):
     - For Twilly TV, filters items based on `addedUsernamesPublic` and `addedUsernamesPrivate` sets
     - **Early filtering** happens BEFORE username is set (line 1311-1313):
       - If `itemUsername` is missing, item is filtered out immediately
       - This prevents items from showing until username is determined
   - Sets `creatorUsername` on item (line 1034-1113)
   - Returns filtered items

2. **Frontend Flow (`ChannelDetailView.swift`):**
   - Shows cached content immediately (Instagram/TikTok pattern)
   - Fetches fresh content in background
   - When new content arrives, merges with existing content
   - Applies additional filtering (own content, public/private separation)
   - Updates UI

### Problems Identified

#### Issue 1: New Videos Appearing Then Vanishing in Public View

**Root Cause:**
- When a new video is created, it might not have `creatorUsername` set immediately
- Backend filters items WITHOUT username early (line 1311-1313): `if (!itemUsername) return null`
- Frontend might show item from cache or partial response
- When backend refresh happens, item gets filtered out because username still isn't set
- Result: Item appears briefly, then disappears

**Why This Happens:**
- Username lookup is async and can fail or be delayed
- New videos might not have streamKey mapping yet
- Username might not be in PROFILE yet
- Multiple fallback lookups can take time

#### Issue 2: Content from Public Added User Not Appearing

**Root Cause:**
- Username matching is case-sensitive and exact (line 1318): `addedUsernamesPublic.has(itemUsername)`
- If username lookup returns different case or has whitespace, match fails
- If username lookup fails entirely, item is filtered out
- If user was added but username isn't in the set yet, item is filtered out

**Why This Happens:**
- Username might be stored with different casing in PROFILE vs ADDED_USERNAME
- Whitespace differences (trailing spaces, etc.)
- Username lookup might fail for new users
- Race condition: User added but username not yet in `addedUsernamesPublic` set

## Improvement Plan

### Fix 1: Make Username Lookup More Robust

**Changes:**
1. **Normalize usernames** before comparison (lowercase, trim whitespace)
2. **Cache username lookups** to avoid repeated queries
3. **Retry failed lookups** with exponential backoff
4. **Set username on item BEFORE filtering** (move filtering after username assignment)

### Fix 2: Improve Filtering Logic

**Changes:**
1. **Don't filter items immediately if username is missing** - give it a grace period
2. **Use fuzzy matching** for usernames (case-insensitive, trim whitespace)
3. **Log detailed reasons** for filtering (username mismatch, not in set, etc.)
4. **Handle edge cases** (empty username, null username, whitespace-only)

### Fix 3: Fix Race Conditions

**Changes:**
1. **Ensure `addedUsernamesPublic` is populated BEFORE filtering**
2. **Refresh added usernames** if filtering fails unexpectedly
3. **Add retry logic** for items that should be shown but aren't

### Fix 4: Better Frontend Handling

**Changes:**
1. **Don't remove items immediately** - wait for server confirmation
2. **Show items optimistically** if they match expected criteria
3. **Re-validate items** after username lookup completes
4. **Add loading states** for items with pending username lookup

## Recommended Implementation Order

1. **Phase 1: Normalize username matching** (quick fix) ✅ IMPLEMENTED
   - Make all username comparisons case-insensitive
   - Trim whitespace before comparison
   - This should fix most "content not appearing" issues

2. **Phase 2: Improve username lookup** (medium effort)
   - Cache username lookups
   - Add retry logic
   - Better error handling

3. **Phase 3: Fix filtering order** (requires refactoring) ✅ IMPLEMENTED
   - Move filtering to AFTER username assignment
   - Add grace period for missing usernames
   - Better logging
   - Added final filter pass after username lookup completes

4. **Phase 4: Frontend improvements** (polish)
   - Optimistic rendering
   - Better loading states
   - Re-validation logic

## Fixes Implemented

### Fix 1: Normalized Username Matching ✅
- All username comparisons now use `.toLowerCase().trim()` for both sides
- Prevents case-sensitivity and whitespace issues
- Added debug logging to show normalized usernames

### Fix 2: Improved Filtering Logic ✅
- Items without username no longer filtered immediately
- Added final filter pass AFTER username lookup completes
- Items pass through initial filter if username is missing, then get filtered in final pass
- This prevents items from appearing then disappearing

### Fix 3: Better Logging ✅
- Added detailed logging for username matching
- Shows normalized usernames in all log messages
- Logs available usernames when match fails
- Detects and warns about close matches (suggests normalization issues)

## Remaining Issues to Address

1. **Username lookup can still fail** - Need to add retry logic or caching
2. **Race conditions** - Frontend might show items before backend filters them
3. **Performance** - Multiple username lookups per item can be slow
