# Private Timeline Logic Explanation

## How Private Streams Are Displayed

There are **two ways** a viewer can see another user's private streams:

### 1. Viewer Added Creator for Private (Normal Case)
- **What it means**: Viewer explicitly added the creator to their private timeline
- **DynamoDB Entry**: `PK=USER#viewerEmail, SK=ADDED_USERNAME#creatorEmail#private`
- **How it works**: Viewer searches for creator, adds them for private visibility
- **Result**: Viewer sees creator's private streams

### 2. Creator Added Viewer to Their Private Timeline (Reverse Relationship)
- **What it means**: Creator added the viewer to THEIR private timeline
- **DynamoDB Entry**: `PK=USER#creatorEmail, SK=ADDED_USERNAME#viewerEmail#private`
- **How it works**: Creator goes to their private settings, adds viewer as a private viewer
- **Result**: Viewer sees creator's private streams (even though viewer didn't add creator)

## Code Implementation

### Early Reverse Lookup (Lines 131-195)
```javascript
// Scans for entries where creator added viewer to their private timeline
// Format: PK=USER#creatorEmail, SK=ADDED_USERNAME#viewerEmail#private
// Finds all creators who added the viewer to their private timeline
// Adds their usernames to addedUsernamesPrivate set
```

### Per-Item Check in Final Filter (Lines 1954-1973)
```javascript
// For each private stream, checks if creator added viewer
// Checks: PK=USER#creatorEmail, SK=ADDED_USERNAME#viewerEmail#private
// If entry exists and status='active', shows the private stream
```

## Why You're Seeing Streams from Another User

If you're seeing private streams from User X in your private timeline, it means:

**User X added YOU to their private timeline**

This happens when:
1. User X goes to their private settings
2. User X adds your username/email to their private viewers list
3. User X's private streams now appear in YOUR private timeline

## To Verify

Check DynamoDB for:
- `PK=USER#<otherUserEmail>`
- `SK=ADDED_USERNAME#<yourEmail>#private`
- If this entry exists with `status='active'`, that's why you're seeing their streams

## To Remove

The other user needs to remove you from their private viewers list, OR you can request removal through the private access management system.
