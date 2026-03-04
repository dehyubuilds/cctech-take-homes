# Public/Private Username System Implementation Plan

## Overview
Implement a public/private username system where:
- **Public usernames**: Auto-accept when added to Twilly TV timeline
- **Private usernames**: Require approval (like Instagram follow request)

## Changes Required

### 1. ✅ Stream Screen (ContentView.swift) - COMPLETED
- Replace "{icon} Twilly TV" badge with "{icon} username"
- Status: DONE - Badge now shows username

### 2. Settings (StreamerSettingsView.swift) - IN PROGRESS
- Add public/private username toggle
- Hide/disable schedule and post automatically sections
- Store public/private status in DynamoDB

### 3. Channel Page (ChannelDetailView.swift) - PENDING
- Add username search/add functionality
- Show added usernames in filtered timeline
- Handle follow requests for private usernames

### 4. Backend API - PENDING
- Store public/private status in user profile (DynamoDB)
- Create follow request system (request/accept)
- Filter content based on added usernames
- API endpoint to get user's added usernames

### 5. Inbox View - PENDING
- Create inbox to manage follow requests
- Show pending requests
- Accept/decline functionality

## Database Schema Changes

### User Profile (DynamoDB)
```
PK: USER#<email>
SK: PROFILE
...
usernameVisibility: "public" | "private"  // NEW
```

### Follow Requests (DynamoDB)
```
PK: USER#<requestedUserEmail>
SK: FOLLOW_REQUEST#<requesterEmail>
status: "pending" | "accepted" | "declined"
requestedAt: timestamp
respondedAt: timestamp (optional)
```

### Added Usernames (DynamoDB)
```
PK: USER#<viewerEmail>
SK: ADDED_USERNAME#<streamerEmail>
status: "active" | "pending"
addedAt: timestamp
streamerUsername: string
streamerVisibility: "public" | "private"
```

## API Endpoints Needed

1. `POST /api/users/set-visibility` - Set username visibility (public/private)
2. `POST /api/users/request-follow` - Request to follow private username
3. `POST /api/users/accept-follow` - Accept follow request
4. `POST /api/users/decline-follow` - Decline follow request
5. `GET /api/users/follow-requests` - Get pending follow requests
6. `POST /api/users/add-username` - Add username to timeline (auto-accept if public)
7. `GET /api/users/added-usernames` - Get list of added usernames
8. `POST /api/channels/get-content-filtered` - Get content filtered by added usernames

## Implementation Steps

1. ✅ Replace Twilly TV badge with username (DONE)
2. Add public/private toggle to settings
3. Hide schedule/post automatically in settings
4. Create backend API for visibility setting
5. Create backend API for follow requests
6. Add username search/add to channel page
7. Update get-content API to filter by added usernames
8. Create inbox view for follow requests
9. Test end-to-end flow
