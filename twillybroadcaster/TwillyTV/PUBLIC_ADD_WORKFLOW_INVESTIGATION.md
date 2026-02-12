# Public Add Workflow Investigation

## Current Flow

### 1. User Searches for Username
- **UI**: `ChannelDetailView.swift` → `searchUsernamesInline()` 
- **API**: `/api/users/search-usernames`
- **Returns**: Array of `{username, email, userId}`

### 2. User Clicks "Add"
- **UI**: `ChannelDetailView.swift` → `addUsernameInline(username)`
- **API Call**: `ChannelService.requestFollow(requesterEmail, requestedUsername)`
- **API**: `/api/users/request-follow`
  - Looks up user by username (scan with FilterExpression)
  - If user is `public`, auto-accepts and creates `ADDED_USERNAME#` entry:
    ```javascript
    {
      PK: `USER#${requesterEmail}`,
      SK: `ADDED_USERNAME#${requestedUserEmail}`,
      status: 'active',
      streamerUsername: requestedUsername,  // ← KEY: This is what we match against
      streamerEmail: requestedUserEmail,
      streamerVisibility: 'public',
      autoAccepted: true
    }
    ```

### 3. Content Filtering
- **API**: `/api/channels/get-content`
- **Process**:
  1. Query for `ADDED_USERNAME#` entries with `status='active'`
  2. Add `streamerUsername.toLowerCase()` to `addedUsernames` Set
  3. For each video item:
     - Look up `creatorUsername` from streamKey mapping or user profile
     - Check if `item.creatorUsername.toLowerCase()` is in `addedUsernames` Set
     - If not, filter out the item

## Potential Issues

### Issue 1: Username Lookup in request-follow
**Location**: `request-follow.post.js` lines 28-40
```javascript
const usernameSearchParams = {
  TableName: table,
  FilterExpression: 'SK = :sk AND username = :username',
  ExpressionAttributeValues: {
    ':sk': 'PROFILE',
    ':username': requestedUsername
  }
};
```
**Problem**: This scan might not find users correctly if:
- User profile is stored with different PK format (e.g., `USER#email` vs `USER`)
- Username is stored in a different location

**Fix**: Should use the same lookup logic as `search-usernames` API

### Issue 2: Username Matching
**Location**: `get-content.post.js` line 991
```javascript
const isFromAddedUsername = addedUsernames.has(itemUsername);
```
**Problem**: 
- `addedUsernames` contains `streamerUsername.toLowerCase()` from `ADDED_USERNAME#` entry
- `itemUsername` is `item.creatorUsername.toLowerCase()` from video item
- These must match exactly (case-insensitive)

**Potential Mismatch**:
- If `request-follow` stores username as "MyUsername" but video has "myusername" → should match (both lowercased)
- If `request-follow` stores "MyUsername" but video has "MyUsername🔒" → won't match (lock icon issue)

### Issue 3: Username Lookup in get-content
**Location**: `get-content.post.js` lines 610-884
**Process**: 
1. Try to get username from streamKey mapping (`streamUsername` field)
2. If not found, lookup from user profile
3. Set `item.creatorUsername`

**Potential Issue**: If username lookup fails or is delayed, `creatorUsername` might be empty, causing item to be filtered out

## Testing Steps

1. **Test Search**:
   - Search for a known public username
   - Verify it returns correct username and email

2. **Test Add**:
   - Add a public username
   - Check DynamoDB for `ADDED_USERNAME#` entry:
     - Verify `streamerUsername` matches the searched username exactly
     - Verify `status='active'`
     - Verify `streamerEmail` is correct

3. **Test Content Display**:
   - After adding username, refresh Twilly TV channel
   - Check server logs for:
     - `addedUsernames` Set contents
     - `creatorUsername` for each video item
     - Whether items are filtered out or shown

4. **Debug Logs to Check**:
   - `✅ [get-content] Found X added usernames for Twilly TV filtering`
   - `✅ [get-content] Twilly TV: Item from added username: ...`
   - `🚫 [get-content] Twilly TV: Filtering out item - not from added username: ...`

## Next Steps

1. Fix `request-follow` to use proper username lookup (same as `search-usernames`)
2. Add more detailed logging in `get-content` to trace username matching
3. Test with a real public user account
