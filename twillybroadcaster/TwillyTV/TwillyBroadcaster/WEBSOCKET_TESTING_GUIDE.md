# WebSocket Testing Guide - Mobile App

**Purpose:** Comprehensive testing checklist to verify all WebSocket real-time features are working correctly.

## Prerequisites

1. **Deploy WebSocket Infrastructure First**
   ```bash
   cd TwillyTV/twilly/infrastructure
   ./deploy-websocket-comments.sh dev us-east-1
   ```

2. **Update iOS App Configuration**
   - Get WebSocket endpoint from deployment output
   - Update `ChannelService.swift` `websocketEndpoint` property

3. **Have Two Test Accounts Ready**
   - Account A: Primary tester (e.g., Twilly TV)
   - Account B: Secondary tester (e.g., dehyuusername)
   - Both accounts should be logged in on separate devices (or use TestFlight on two devices)

---

## Test 1: WebSocket Connection ✅

### Steps:
1. **Launch the app** on Device A (Account A)
2. **Check Xcode console** for connection logs:
   ```
   🔌 [UnifiedWebSocket] Connecting to: wss://...
   ✅ [UnifiedWebSocket] Connected
   💓 [UnifiedWebSocket] Heartbeat ping successful
   ```

### Expected Result:
- ✅ Connection log appears within 1-2 seconds of app launch
- ✅ Heartbeat pings every 30 seconds
- ✅ No connection errors

### If Failed:
- Check WebSocket endpoint URL in `ChannelService.swift`
- Verify user is logged in (`authService.userEmail` exists)
- Check network connectivity

---

## Test 2: Real-Time Comment Notifications 💬

### Setup:
- Device A: Account A viewing a video
- Device B: Account B (different account)

### Steps:
1. **On Device A:** Open a video and expand comments section
2. **On Device B:** Post a comment on the same video
3. **On Device A:** Watch for real-time update

### Expected Result:
- ✅ **Within 100ms:** New comment appears at bottom of comment list
- ✅ **Within 100ms:** Unread count badge updates (if private thread)
- ✅ **Within 100ms:** Username highlight appears (orange) if it's a private thread response
- ✅ **No polling delay:** Comment appears instantly, not after 2 seconds

### What to Check:
- [ ] Comment appears immediately (no 2-second delay)
- [ ] Comment appears at bottom (not top)
- [ ] Unread count updates instantly
- [ ] Username highlight appears (if private thread)
- [ ] Xcode console shows: `📬 [FloatingCommentView] Received WebSocket notification`

### If Failed:
- Check Xcode console for WebSocket message logs
- Verify backend `comments/post.post.js` is calling `websocket-send-unified` Lambda
- Check Lambda CloudWatch logs

---

## Test 3: Real-Time Comment Likes ❤️

### Setup:
- Device A: Account A viewing a video with comments
- Device B: Account B (different account)

### Steps:
1. **On Device A:** Open a video, expand comments, note a comment's like count
2. **On Device B:** Like that same comment
3. **On Device A:** Watch for real-time like count update

### Expected Result:
- ✅ **Within 100ms:** Like count increments immediately
- ✅ **No refresh needed:** Update happens without manual refresh
- ✅ **Xcode console:** Shows `❤️ [FloatingCommentView] Received WebSocket like notification`

### What to Check:
- [ ] Like count updates instantly (no delay)
- [ ] Update happens without refreshing comments
- [ ] Multiple likes from different users update correctly

### If Failed:
- Check `comments/like.post.js` is calling WebSocket Lambda
- Verify WebSocket message is being received (check console)

---

## Test 4: Real-Time Inbox Notifications 📬

### Setup:
- Device A: Account A (recipient)
- Device B: Account B (sender)

### Steps:
1. **On Device A:** Open Inbox view (keep it open)
2. **On Device B:** Perform an action that creates a notification:
   - Send a follow request
   - Accept a follow request
   - Post a comment reply
3. **On Device A:** Watch inbox for real-time update

### Expected Result:
- ✅ **Within 100ms:** New notification appears in inbox
- ✅ **Within 100ms:** Unread count badge updates
- ✅ **No manual refresh needed:** Notification appears automatically

### What to Check:
- [ ] Notification appears instantly (no delay)
- [ ] Unread count badge updates
- [ ] Notification appears at top of list (newest first)
- [ ] Xcode console shows: `📬 [InboxView] Received WebSocket inbox notification`

### If Failed:
- Check which notification type failed
- Verify corresponding backend endpoint is calling WebSocket Lambda
- Check Lambda CloudWatch logs

---

## Test 5: Real-Time Follow Request Notifications 👥

### Setup:
- Device A: Account A (will receive follow request)
- Device B: Account B (will send follow request)

### Steps:
1. **On Device A:** Open Inbox view (keep it open)
2. **On Device B:** Send a follow request to Account A
3. **On Device A:** Watch for real-time follow request notification

### Expected Result:
- ✅ **Within 100ms:** Follow request appears in inbox
- ✅ **Within 100ms:** Unread count badge updates
- ✅ **Follow request card appears:** Shows accept/decline buttons

### What to Check:
- [ ] Follow request appears instantly
- [ ] Follow request card shows correct username
- [ ] Unread count updates
- [ ] Xcode console shows: `📬 [InboxView] Received WebSocket follow request`

### If Failed:
- Check `users/request-follow.post.js` is calling WebSocket Lambda
- Verify user emails are correct

---

## Test 6: Real-Time Follow Response Notifications ✅

### Setup:
- Device A: Account A (sent follow request, waiting for response)
- Device B: Account B (will accept/decline)

### Steps:
1. **On Device A:** Open Inbox view (keep it open)
2. **On Device B:** Accept or decline the follow request
3. **On Device A:** Watch for real-time response notification

### Expected Result:
- ✅ **Within 100ms:** Follow response notification appears
- ✅ **Status updates:** Shows "accepted" or "declined"
- ✅ **Unread count updates**

### What to Check:
- [ ] Response notification appears instantly
- [ ] Correct status shown (accepted/declined)
- [ ] Unread count updates
- [ ] Xcode console shows: `📬 [InboxView] Received WebSocket follow response`

### If Failed:
- Check `users/accept-follow.post.js` or `users/decline-follow.post.js`
- Verify WebSocket Lambda is being called

---

## Test 7: Real-Time Stream Processing Updates 📡

### Setup:
- Device A: Account A (streaming)
- Device B: Account A (viewing My Streams)

### Steps:
1. **On Device A:** Start a stream, then navigate to "My Streams" view
2. **Wait for stream processing to complete** (Lambda processes the stream)
3. **Watch My Streams view** for real-time status update

### Expected Result:
- ✅ **Within 100ms:** Stream status changes from "Processing" to "Ready"
- ✅ **HLS URL appears:** Stream becomes playable
- ✅ **Thumbnail appears:** Thumbnail loads
- ✅ **No polling needed:** Update happens automatically

### What to Check:
- [ ] Status updates from "Processing" to "Ready" instantly
- [ ] No 1-second polling delay
- [ ] Stream becomes playable immediately
- [ ] Xcode console shows: `📡 [MyStreamsView] Received WebSocket stream processing notification`

### If Failed:
- Check `lambda/stream-processor.js` or `lambda/s3todynamo-fixed.js` is calling WebSocket Lambda
- Verify stream processing Lambda has WebSocket integration (may need to add)

---

## Test 8: WebSocket Reconnection 🔄

### Steps:
1. **Launch app** and verify WebSocket connects
2. **Turn on Airplane Mode** for 5 seconds
3. **Turn off Airplane Mode**
4. **Watch Xcode console** for reconnection logs

### Expected Result:
- ✅ **Connection error logged:** `❌ [UnifiedWebSocket] Receive error: ...`
- ✅ **Reconnection scheduled:** `🔄 [UnifiedWebSocket] Scheduling reconnect attempt 1/5`
- ✅ **Reconnection successful:** `✅ [UnifiedWebSocket] Connected`
- ✅ **Notifications resume:** Real-time notifications work again

### What to Check:
- [ ] Reconnection happens automatically
- [ ] Exponential backoff (delays: 2s, 4s, 8s, 16s, 30s)
- [ ] Max 5 reconnection attempts
- [ ] Notifications resume after reconnection

### If Failed:
- Check reconnection logic in `UnifiedWebSocketService.swift`
- Verify `isManuallyDisconnected` flag is not set

---

## Test 9: WebSocket Disconnect on Background 📱

### Steps:
1. **Launch app** and verify WebSocket connects
2. **Background the app** (press home button or switch apps)
3. **Wait 30 seconds**
4. **Check Xcode console** for disconnect log

### Expected Result:
- ✅ **After 30 seconds:** `✅ [UnifiedWebSocket] Disconnected`
- ✅ **Battery efficient:** Connection closes when app is backgrounded
- ✅ **Reconnects on foreground:** When app becomes active again

### What to Check:
- [ ] Disconnect happens after 30 seconds in background
- [ ] Connection closes cleanly
- [ ] Reconnects when app becomes active

### If Failed:
- Check `TwillyBroadcasterApp.swift` background handling
- Verify 30-second delay is working

---

## Test 10: Fallback to Polling (WebSocket Unavailable) 🔄

### Steps:
1. **Temporarily break WebSocket endpoint** (wrong URL or offline)
2. **Launch app**
3. **Verify polling still works** (2-second interval for comments)

### Expected Result:
- ✅ **WebSocket fails gracefully:** Connection error logged
- ✅ **Polling activates:** 2-second polling continues to work
- ✅ **No app crash:** App continues to function normally
- ✅ **Notifications still work:** Via polling instead of WebSocket

### What to Check:
- [ ] App doesn't crash when WebSocket fails
- [ ] Polling continues to work
- [ ] User experience is maintained (slower but functional)

---

## Test 11: Multiple Notification Types Simultaneously 🎯

### Setup:
- Device A: Account A (receiving notifications)
- Device B: Account B (sending notifications)

### Steps:
1. **On Device A:** Have Inbox view and a video's comment section open
2. **On Device B:** Rapidly perform multiple actions:
   - Like a comment
   - Post a new comment
   - Send a follow request
3. **On Device A:** Watch for all notifications to arrive

### Expected Result:
- ✅ **All notifications arrive:** Within 100ms each
- ✅ **No missed notifications:** All actions are reflected
- ✅ **UI updates correctly:** All views update simultaneously
- ✅ **No conflicts:** Multiple notifications don't interfere with each other

### What to Check:
- [ ] All notification types work simultaneously
- [ ] No race conditions
- [ ] UI updates correctly for all notifications

---

## Test 12: Battery & Data Usage 📊

### Steps:
1. **Before WebSocket:** Note battery level and data usage
2. **Use app for 30 minutes** with WebSocket active
3. **Compare battery/data usage** to previous polling behavior

### Expected Result:
- ✅ **Battery usage:** 70-80% less than polling
- ✅ **Data usage:** 80-90% less than polling
- ✅ **Single connection:** Only one WebSocket connection active

### What to Check:
- [ ] Battery drains slower than before
- [ ] Data usage is significantly lower
- [ ] Only one WebSocket connection in network logs

---

## Debugging Tips 🔍

### Check Xcode Console Logs:
Look for these log patterns:
- `🔌 [UnifiedWebSocket] Connecting` - Connection attempt
- `✅ [UnifiedWebSocket] Connected` - Successful connection
- `📨 [UnifiedWebSocket] Received message` - Message received
- `❌ [UnifiedWebSocket] Receive error` - Connection error
- `🔄 [UnifiedWebSocket] Scheduling reconnect` - Reconnection attempt
- `💓 [UnifiedWebSocket] Heartbeat ping` - Heartbeat working

### Check Backend Logs (CloudWatch):
- Lambda function logs: `websocket-send-unified`
- API Gateway logs: WebSocket API
- Backend API logs: Comment post, like, follow endpoints

### Common Issues:

1. **WebSocket not connecting:**
   - Check endpoint URL in `ChannelService.swift`
   - Verify user is logged in
   - Check network connectivity

2. **Notifications not arriving:**
   - Check backend endpoint is calling Lambda
   - Verify Lambda function exists and is deployed
   - Check CloudWatch logs for errors

3. **Notifications delayed:**
   - WebSocket might not be connected
   - Check if fallback polling is active
   - Verify Lambda invocation is async (`InvocationType: 'Event'`)

---

## Success Criteria ✅

All tests pass if:
- ✅ WebSocket connects on app launch
- ✅ All notification types arrive within 100ms
- ✅ No manual refresh needed for any feature
- ✅ Reconnection works automatically
- ✅ Battery/data usage is significantly reduced
- ✅ Fallback to polling works if WebSocket fails

---

## Quick Test Checklist (5-Minute Version) ⚡

If you're short on time, test these critical features:

1. ✅ **Comment Notification:** Post comment from Device B, see it instantly on Device A
2. ✅ **Like Notification:** Like comment from Device B, see count update instantly on Device A
3. ✅ **Inbox Notification:** Send follow request from Device B, see it instantly in Device A's inbox
4. ✅ **Reconnection:** Turn airplane mode on/off, verify reconnection works
5. ✅ **Background:** Background app for 30s, verify disconnect, then foreground and verify reconnect

If these 5 tests pass, the core WebSocket functionality is working! 🎉

---

**Happy Testing!** 🚀
