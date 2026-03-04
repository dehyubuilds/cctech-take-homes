# Collaborator Invite Implementation with Metadata

## Overview
This document outlines the implementation of collaborator invites with rich metadata support, matching the functionality of affiliate invites.

## Changes Made

### 1. New Collaborator Page Structure
**File:** `/pages/collaborator/[inviteCode]/[channelName].vue`

- **URL Structure:** Changed from `/collaborator/{inviteCode}` to `/collaborator/{inviteCode}/{channelName}`
- **Metadata Support:** Now extracts and displays title, description, creator, and poster from query parameters
- **Rich UI:** Added poster image display and formatted channel information
- **Consistent Design:** Matches the affiliate page design and functionality

### 2. Updated API Endpoints

#### A. Enhanced Accept Invite API
**File:** `/server/api/collaborations/accept-invite.post.js`

**Changes:**
- Added support for metadata parameters (title, description, creator, poster)
- Added support for channelName from request body
- Added handling for unauthenticated users (returns requiresAuth flag)
- Store metadata in collaborator records
- Use finalChannelName consistently throughout

**New Parameters:**
```javascript
{
  inviteCode: string,
  channelName?: string,
  title?: string,
  description?: string,
  creator?: string,
  poster?: string,
  userId?: string,
  userEmail?: string
}
```

#### B. New Store Invite with Metadata API
**File:** `/server/api/collaborations/store-invite-with-metadata.post.js`

**Purpose:** Create collaborator invites with rich metadata

**Parameters:**
```javascript
{
  channelName: string,
  channelOwnerEmail: string,
  channelOwnerId: string,
  title?: string,
  description?: string,
  creator?: string,
  poster?: string,
  expiresAt?: string
}
```

### 3. Updated Signin Page
**File:** `/pages/signin.vue`

**Changes:**
- Added support for `pendingCollaboratorInvite` in sessionStorage
- Auto-accept collaborator invites after authentication
- Redirect to profile with collaborator invite flag
- Handle both affiliate and collaborator pending invites

### 4. URL Structure Comparison

#### Before (Collaborator)
```
/collaborator/b4e246b6-ab71-4a11-a5e7-e9de75a32627?title=Twilly+TV&description=Join+as+a+collaborator&creator=DehSin365&poster=https://...
```

#### After (Collaborator)
```
/collaborator/b4e246b6-ab71-4a11-a5e7-e9de75a32627/Twilly%20TV?title=Twilly+TV&description=Join+as+a+collaborator&creator=DehSin365&poster=https://...
```

#### Affiliate (Reference)
```
/affiliate/09c2ef9a-6be9-431d-8e1c-914aea740a25/Twilly%20TV?title=Twilly+TV&description=Join+as+an+affiliate&creator=DehSin365&poster=https://...
```

## Key Features

### 1. Rich Metadata Display
- **Poster Image:** Displays channel poster if provided
- **Channel Title:** Shows formatted channel name
- **Description:** Displays invite description
- **Creator Info:** Shows who created the channel
- **Consistent Styling:** Matches affiliate page design

### 2. Authentication Flow
- **Unauthenticated Users:** Redirected to signin with invite data stored
- **Authenticated Users:** Auto-accept invite and activate creator persona
- **Pending Invites:** Handled in signin page for both affiliate and collaborator

### 3. Database Storage
- **Metadata Storage:** Title, description, creator, poster stored in collaborator records
- **Consistent Keys:** Uses finalChannelName throughout
- **Backward Compatibility:** Works with existing invite records

## Usage Examples

### Creating a Collaborator Invite with Metadata
```javascript
const response = await fetch('/api/collaborations/store-invite-with-metadata', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channelName: 'Twilly TV',
    channelOwnerEmail: 'creator@example.com',
    channelOwnerId: 'user123',
    title: 'Twilly TV',
    description: 'Join as a collaborator and stream on Twilly TV!',
    creator: 'DehSin365',
    poster: 'https://example.com/poster.png'
  })
});
```

### Generated URL
```
http://localhost:3000/collaborator/b4e246b6-ab71-4a11-a5e7-e9de75a32627/Twilly%20TV?title=Twilly+TV&description=Join+as+a+collaborator+and+stream+on+Twilly+TV!&creator=DehSin365&poster=https://example.com/poster.png
```

## Testing

Use the provided test script:
```bash
node test-collaborator-invite.js
```

This will:
1. Create a collaborator invite with metadata
2. Generate the invite URL
3. Show the comparison with affiliate URLs
4. Display the key differences

## Benefits

1. **Consistent Experience:** Collaborator invites now match affiliate invite functionality
2. **Rich Metadata:** Support for posters, descriptions, and creator information
3. **Better UX:** Users see rich information before accepting invites
4. **Unified Structure:** Both affiliate and collaborator invites use the same URL pattern
5. **Backward Compatibility:** Existing invites continue to work

## Migration Notes

- Existing collaborator invites will continue to work
- New invites should use the metadata-enabled API
- The old `/collaborator/[inviteCode]` route is deprecated in favor of `/collaborator/[inviteCode]/[channelName]`
- All new collaborator pages should use the new structure
