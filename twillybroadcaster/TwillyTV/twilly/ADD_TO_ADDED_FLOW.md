# Flow: When Username Status Changes from "Add" to "Added" and Persists

## Complete Flow Diagram

```
1. USER CLICKS "Add" BUTTON
   ↓
2. Frontend: addUsernameInline() called
   - Extracts cleanUsername (removes 🔒)
   - Sets isPrivate = false (public request)
   - Calls ChannelService.requestFollow()
   ↓
3. Backend: request-follow.post.js
   - Looks up user via GSI (UsernameSearchIndex)
   - Checks visibility (should be "public")
   - Creates ADDED_USERNAME entry in DynamoDB:
     {
       PK: "USER#requesterEmail",
       SK: "ADDED_USERNAME#requestedUserEmail",
       status: "active",
       streamerUsername: "username",
       streamerEmail: "email",
       streamerVisibility: "public",
       autoAccepted: true
     }
   - Returns: { success: true, autoAccepted: true, status: "active" }
   ↓
4. Frontend: Receives Response
   - response.autoAccepted == true
   - response.status == "active"
   ↓
5. Frontend: Optimistic UI Update (ChannelDetailView.swift:2924-2971)
   - Creates newAddedUsername object:
     AddedUsername(
       streamerEmail: email,
       streamerUsername: cleanUsername,
       addedAt: ISO8601DateFormatter().string(from: Date()),
       streamerVisibility: "public"
     )
   - Adds to addedUsernames array (or updates existing)
   - Removes from removedUsernames set (if previously removed)
   - Saves to UserDefaults via saveAddedUsernamesToUserDefaults()
   ↓
6. Frontend: Server Sync (ChannelDetailView.swift:2978-2989)
   - Waits 1 second for backend to process
   - Calls loadAddedUsernames(mergeWithExisting: true)
   - Merges server data with optimistic update
   ↓
7. UI Update: Button Shows "Added"
   - publicAccountButton() checks isUsernameAdded(username, visibility: "public")
   - isUsernameAdded() checks if username exists in addedUsernames array
   - If found with matching visibility, shows "Added" button
   ↓
8. Persistence: On App Reload/Navigation
   - loadAddedUsernames() called in onAppear
   - Loads from UserDefaults cache first (line 2177)
   - Then fetches from server API (added-usernames.post.js)
   - Merges cache + server data (preserves optimistic updates)
   - Saves merged result back to UserDefaults
   ↓
9. Content Filtering: get-content.post.js
   - Queries ADDED_USERNAME entries for viewer
   - Adds usernames to addedUsernamesPublic Set
   - Filters content by checking if creatorUsername is in Set
   - Only shows content from added usernames
```

## Key Components

### 1. Optimistic Update (Immediate UI Change)
**Location:** `ChannelDetailView.swift:2932-2971`
- Updates `addedUsernames` array immediately
- Saves to UserDefaults for persistence
- Button changes from "Add" to "Added" instantly

### 2. Persistence (UserDefaults)
**Location:** `ChannelDetailView.swift:2014-2028`
- Saves `addedUsernames` array to UserDefaults
- Key: `addedUsernames_{userEmail}`
- Persists across app restarts

### 3. Server Sync (Background)
**Location:** `ChannelDetailView.swift:2981-2989`
- Waits 1 second for backend to process
- Calls `loadAddedUsernames(mergeWithExisting: true)`
- Merges server data with optimistic update

### 4. Button State Check
**Location:** `ChannelDetailView.swift:3280-3297`
- `isUsernameAdded(username, visibility: "public")` function
- Checks if username exists in `addedUsernames` array
- Matches by username AND visibility

### 5. Content Filtering
**Location:** `get-content.post.js:78-122`
- Queries ADDED_USERNAME entries from DynamoDB
- Creates `addedUsernamesPublic` Set
- Filters content by checking if `creatorUsername` is in Set

## What Happens When Status Persists

1. **Immediate:** Button shows "Added" (optimistic update)
2. **1 Second Later:** Server sync confirms entry exists
3. **On Reload:** UserDefaults cache loaded first, then merged with server
4. **Content Appears:** get-content.post.js filters content by addedUsernamesPublic Set
5. **Persistence:** UserDefaults ensures status survives app restarts

## Potential Issues

1. **Backend doesn't create entry:** Button shows "Added" but content won't appear
2. **Cache not saved:** Status won't persist on reload
3. **Server sync fails:** Optimistic update remains, but might be stale
4. **Username mismatch:** Content won't show if creatorUsername doesn't match
