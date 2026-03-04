# Backend Endpoints Summary - Public/Private Username System

## ✅ Created Endpoints

### 1. Username Visibility
- **POST `/api/users/set-visibility`** - Set username visibility (public/private)
  - Body: `{ userEmail, isPublic }`
  - Returns: `{ success, message, usernameVisibility }`

- **POST `/api/users/get-visibility`** - Get username visibility
  - Body: `{ userEmail }`
  - Returns: `{ success, usernameVisibility, isPublic }`

### 2. Follow Requests
- **POST `/api/users/request-follow`** - Request to follow private username
  - Body: `{ requesterEmail, requestedUsername }`
  - Returns: `{ success, message, status, autoAccepted? }`
  - Auto-accepts if user is public

- **POST `/api/users/accept-follow`** - Accept follow request
  - Body: `{ userEmail, requesterEmail }`
  - Returns: `{ success, message, status }`

- **POST `/api/users/decline-follow`** - Decline follow request
  - Body: `{ userEmail, requesterEmail }`
  - Returns: `{ success, message, status }`

- **POST `/api/users/follow-requests`** - Get follow requests
  - Body: `{ userEmail, status? }` (status defaults to 'pending')
  - Returns: `{ success, requests[], count }`

### 3. Added Usernames
- **POST `/api/users/added-usernames`** - Get list of added usernames
  - Body: `{ userEmail }`
  - Returns: `{ success, addedUsernames[], count }`

### 4. Content Filtering
- **POST `/api/channels/get-content`** - Updated to filter by added usernames
  - Body: `{ channelName, creatorEmail, viewerEmail?, limit?, nextToken? }`
  - For Twilly TV channel, filters content by viewer's added usernames
  - Returns: `{ success, content[], count, nextToken, hasMore }`

## Database Schema

### User Profile (existing, updated)
```
PK: USER#<email>
SK: PROFILE
...
usernameVisibility: "public" | "private"  // NEW
```

### Follow Requests
```
PK: USER#<requestedUserEmail>
SK: FOLLOW_REQUEST#<requesterEmail>
status: "pending" | "accepted" | "declined"
requestedAt: ISO timestamp
respondedAt: ISO timestamp (optional)
requesterEmail: string
requestedUsername: string
```

### Added Usernames
```
PK: USER#<viewerEmail>
SK: ADDED_USERNAME#<streamerEmail>
status: "active"
addedAt: ISO timestamp
streamerUsername: string
streamerEmail: string
streamerVisibility: "public" | "private"
autoAccepted: boolean (optional)
acceptedAt: ISO timestamp (optional)
```

## Next Steps

1. ✅ Backend endpoints created
2. ⏳ Update Swift code to call new endpoints
3. ⏳ Add username search/add UI to channel page
4. ⏳ Create inbox view for follow requests
5. ⏳ Test end-to-end flow
