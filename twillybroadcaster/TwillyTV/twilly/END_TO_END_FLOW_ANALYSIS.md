# End-to-End Flow: dehswizzy adds Twilly TV to Private

## Step-by-Step Flow

### 1. **dehswizzy logs in and navigates to Twilly TV's profile**
   - Opens ChannelDetailView or PrivateUsernameManagementView
   - Searches for "Twilly TV"
   - Clicks "Add to Private" button

### 2. **Frontend: Mobile App (ChannelDetailView.swift or PrivateUsernameManagementView.swift)**
   - Calls: `ChannelService.addPrivateViewer(ownerEmail: dehswizzy, viewerEmail: Twilly TV)`
   - Sends authenticated user email for security verification
   - **Expected**: API call succeeds

### 3. **Backend: add-private-viewer.post.js**
   - **Step 3.1**: Resolves ownerEmail (dehswizzy) and viewerEmail (Twilly TV)
   - **Step 3.2**: Creates ADDED_USERNAME entry:
     ```
     PK: USER#TwillyTV (viewer's account)
     SK: ADDED_USERNAME#dehswizzy#private (owner's email in SK)
     streamerEmail: dehswizzy
     streamerVisibility: 'private'
     status: 'active'
     addedByOwner: true
     ```
   - **Step 3.3**: Calls `populateTimelineOnAdd(viewerEmail=TwillyTV, addedUserEmail=dehswizzy, visibility='private')`
   - **Step 3.4**: Creates notification for Twilly TV:
     ```
     type: 'private_access_granted'
     message: "You were added to dehswizzy private"
     metadata: { ownerEmail: dehswizzy, ownerUsername: 'dehswizzy' }
     ```
   - **Expected**: Entry created, timeline populated, notification created

### 4. **populateTimelineOnAdd (timeline-utils.js)**
   - **Step 4.1**: Queries all files from dehswizzy's account:
     ```
     PK: USER#dehswizzy
     SK: begins_with('FILE#')
     ```
   - **Step 4.2**: Filters files by visibility:
     ```javascript
     const isPrivate = visibility === 'private';
     const relevantFiles = files.filter(file => {
       const fileIsPrivate = file.isPrivateUsername === true || 
                           (file.creatorUsername && file.creatorUsername.includes('🔒'));
       return isPrivate ? fileIsPrivate : !fileIsPrivate;
     });
     ```
   - **Step 4.3**: Creates timeline entries for each relevant file:
     ```
     PK: USER#TwillyTV
     SK: TIMELINE#timestamp#fileId#dehswizzy
     ```
   - **Expected**: All dehswizzy's private files added to Twilly TV's timeline

### 5. **When Twilly TV views their private timeline**
   - **Step 5.1**: get-content API is called with `viewerEmail=TwillyTV, showPrivateContent=true`
   - **Step 5.2**: Normal lookup: Queries ADDED_USERNAME entries where Twilly TV added users
   - **Step 5.3**: Reverse lookup: Scans for entries where PK = Twilly TV's email
     - Finds: `PK=USER#TwillyTV, SK=ADDED_USERNAME#dehswizzy#private`
     - Extracts creator email from SK: `dehswizzy`
     - Adds "dehswizzy" to `addedUsernamesPrivate` set
   - **Step 5.4**: Queries timeline entries for Twilly TV
   - **Step 5.5**: Filters content to show:
     - Twilly TV's own private streams
     - Private streams from users in `addedUsernamesPrivate` (including dehswizzy)
   - **Expected**: Twilly TV sees their own private streams + dehswizzy's private streams

### 6. **Notification appears in Twilly TV's inbox**
   - **Step 6.1**: Twilly TV opens Private Access Inbox
   - **Step 6.2**: Loads notifications with `type='private_access_granted'`
   - **Step 6.3**: Displays notification: "You were added to dehswizzy private"
   - **Expected**: Notification appears in inbox

## Potential Bugs Identified

### ✅ Bug 1: Notification Message Clarity
**Location**: `add-private-viewer.post.js:419`
**Issue**: Message says "You were added to {ownerUsername} private" - missing "to" or should be "to {ownerUsername}'s private"
**Fix**: Change to: `"You were added to ${ownerUsernameFinal}'s private timeline"`

### ✅ Bug 2: File Visibility Filtering
**Location**: `timeline-utils.js:158-161`
**Issue**: Filter checks `isPrivateUsername === true` OR `creatorUsername.includes('🔒')`
**Potential Issue**: What if a file is marked private but doesn't have the lock emoji?
**Check**: Need to verify all private files have `isPrivateUsername === true`

### ✅ Bug 3: Reverse Lookup Email Extraction
**Location**: `get-content.post.js:177-190`
**Issue**: Extracts creator email from SK, but what if SK format is different?
**Current Logic**: 
- New format: `ADDED_USERNAME#creatorEmail#private` → extracts `skParts[1]`
- Fallback: Uses `entry.streamerEmail`
**Status**: ✅ Looks correct - handles both formats

### ✅ Bug 4: Timeline Entry Creation Race Condition
**Location**: `timeline-utils.js:45-49`
**Issue**: Uses `ConditionExpression` to prevent duplicates - ✅ Good
**Status**: ✅ Already fixed with ConditionExpression

### ✅ Bug 5: Case Sensitivity in Email Comparison
**Location**: `get-content.post.js:169-170`
**Issue**: Compares `entryPK === normalizedViewerEmail` - both should be lowercase
**Status**: ✅ Both are normalized to lowercase

## Testing Checklist

- [ ] dehswizzy can successfully add Twilly TV to private
- [ ] ADDED_USERNAME entry is created with correct structure
- [ ] Timeline entries are created for Twilly TV with dehswizzy's private files
- [ ] Twilly TV sees dehswizzy's private streams in their private timeline
- [ ] Notification appears in Twilly TV's inbox
- [ ] Notification message is clear and readable
- [ ] No duplicate timeline entries are created
- [ ] Reverse lookup correctly identifies dehswizzy as creator
