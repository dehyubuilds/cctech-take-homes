//
//  MessagingService.swift
//  TwillyBroadcaster
//
//  SEPARATE MESSAGING SERVICE - Completely isolated from video/content logic
//  Server is ALWAYS source of truth. Cache is only for optimistic updates during active session.
//

import Foundation
import Combine

class MessagingService: ObservableObject {
    static let shared = MessagingService()
    
    // MARK: - Published State (Server is Source of Truth)
    @Published var publicComments: [String: [Comment]] = [:] // videoId -> [Comment]
    @Published var privateThreads: [String: [String: [Comment]]] = [:] // videoId -> [parentCommentId -> [Comment]]
    @Published var unreadCounts: [String: Int] = [:] // videoId -> unreadCount
    @Published var threadUnreadStatus: [String: Bool] = [:] // "videoId_threadId" -> hasUnread
    @Published var cachedUserThreads: [String: [ThreadInfo]] = [:] // videoId -> [ThreadInfo]
    
    // MARK: - Private State
    private var websocketService = UnifiedWebSocketService.shared
    private var authService = AuthService.shared
    private var pollingTimers: [String: Timer] = [:] // videoId -> Timer
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        setupWebSocketHandlers()
        // CRITICAL: Clear unreadCounts on init - backend is source of truth, not cache
        // This prevents stale indicators from showing on app rebuild
        unreadCounts.removeAll()
        threadUnreadStatus.removeAll()
        print("🔴 [MessagingService] Cleared unreadCounts and threadUnreadStatus on init - backend will verify")
        
        // Load cached data on init (before server fetch for instant display)
        loadCachedData()
    }
    
    // MARK: - Public API
    
    /// Load messages for a video - SERVER IS SOURCE OF TRUTH
    func loadMessages(for videoId: String) async throws {
        guard let userId = authService.userId,
              let viewerEmail = authService.userEmail else {
            throw MessagingError.notAuthenticated
        }
        
        let response = try await ChannelService.shared.getCommentsWithThreads(
            videoId: videoId,
            userId: userId,
            viewerEmail: viewerEmail
        )
        
        await MainActor.run {
            // Process public comments - reverse once (server returns newest first)
            // MERGE with existing (don't overwrite) - same as general chat persistence
            let reversedPublic = Array(response.comments.filter { $0.isPrivate != true && $0.parentCommentId == nil }.reversed())
            // Merge: Keep existing if server returns empty, otherwise use server data
            if !reversedPublic.isEmpty {
                publicComments[videoId] = reversedPublic
            } else if publicComments[videoId] == nil {
                // Only set to empty if it doesn't exist yet (preserve cached data)
                publicComments[videoId] = []
            }
            
            // Process private threads - reverse each thread once
            // CRITICAL: MERGE with existing (don't overwrite) - same as general chat persistence
            var threads: [String: [Comment]] = [:]
            for (parentId, serverMessages) in response.threadsByParent {
                threads[parentId] = Array(serverMessages.reversed())
            }
            
            // CRITICAL: Load ALL threads from server (same as general chat loads all comments)
            // Server is source of truth - it has the full conversation history
            // Merge with existing cached threads, but prioritize server data (has full history)
            var mergedThreads = privateThreads[videoId] ?? [:]
            
            // Update with server data (server has full history for each thread)
            for (threadId, serverMessages) in threads {
                // Always use server data if available (it has the full thread history)
                if !serverMessages.isEmpty {
                    mergedThreads[threadId] = serverMessages
                } else if mergedThreads[threadId] == nil {
                    // Only set to empty if it doesn't exist yet
                    mergedThreads[threadId] = []
                }
            }
            // Note: We don't preserve cached threads that aren't in server response
            // because server is source of truth - if server doesn't return a thread,
            // it means it doesn't exist or user doesn't have access
            
            privateThreads[videoId] = mergedThreads
            
            // Update cached user threads immediately
            updateCachedUserThreads(for: videoId)
            
            // CRITICAL: Save to UserDefaults for persistence across app rebuilds
            saveToCache(for: videoId)
            
            print("✅ [MessagingService] Loaded \(reversedPublic.count) public comments and \(threads.count) private threads for \(videoId) (merged with existing)")
        }
        
        // Load unread counts
        try await loadUnreadCounts(for: videoId)
    }
    
    /// Update cached user threads for a video (for username scroll)
    /// CRITICAL: Always show the OTHER participant's username, never the current user's username
    private func updateCachedUserThreads(for videoId: String) {
        guard let userId = authService.userId,
              let currentUsername = authService.username else { return }
        
        var threads: [ThreadInfo] = []
        
        // Normalize current username for comparison
        let normalizeUsername: (String) -> String = { username in
            username.replacingOccurrences(of: "🔒", with: "")
                .trimmingCharacters(in: .whitespaces)
                .lowercased()
        }
        let normalizedCurrentUsername = normalizeUsername(currentUsername)
        
        // Get all public comments to find participants
        let publicCommentsList = publicComments[videoId] ?? []
        let threadsDict = privateThreads[videoId] ?? [:]
        
        // Map to track threadId -> other participant username
        var threadToOtherParticipant: [String: String] = [:]
        
        // STEP 1: Process private threads to find OTHER participants
        // CRITICAL: Never show threads where current user is the only participant (self-conversation)
        for (parentId, threadMessages) in threadsDict {
            // Find ALL unique participants in this thread
            var allParticipants: Set<String> = []
            for message in threadMessages {
                allParticipants.insert(normalizeUsername(message.username))
            }
            
            // Check parent comment for additional participants
            if let parentComment = publicCommentsList.first(where: { $0.id == parentId }) {
                allParticipants.insert(normalizeUsername(parentComment.username))
            }
            
            // CRITICAL: Skip if this is a self-conversation (only current user in thread)
            if allParticipants.count == 1 && allParticipants.contains(normalizedCurrentUsername) {
                print("⚠️ [MessagingService] Skipping self-conversation thread: \(parentId) (only current user: \(currentUsername))")
                continue
            }
            
            // Find the OTHER participant in this thread (not current user)
            var otherParticipant: String? = nil
            for message in threadMessages {
                let normalizedMessageUsername = normalizeUsername(message.username)
                if normalizedMessageUsername != normalizedCurrentUsername {
                    otherParticipant = message.username // Use original username (not normalized)
                    break
                }
            }
            
            // If no other participant found in messages, check parent comment
            if otherParticipant == nil {
                if let parentComment = publicCommentsList.first(where: { $0.id == parentId }) {
                    let normalizedParentUsername = normalizeUsername(parentComment.username)
                    if normalizedParentUsername != normalizedCurrentUsername {
                        otherParticipant = parentComment.username
                    }
                }
            }
            
            // CRITICAL: Only add thread if we found an OTHER participant (not current user)
            // This prevents self-conversations from appearing
            if let otherParticipant = otherParticipant {
                // Double-check: make sure otherParticipant is not the current user
                if normalizeUsername(otherParticipant) != normalizedCurrentUsername {
                    threadToOtherParticipant[parentId] = otherParticipant
                } else {
                    print("⚠️ [MessagingService] Skipping thread with self as other participant: \(parentId)")
                }
            } else {
                print("⚠️ [MessagingService] No other participant found in thread: \(parentId) - skipping")
            }
        }
        
        // STEP 2: Process public comments that don't have private threads yet
        // These represent potential conversations (show OTHER participants only)
        for comment in publicCommentsList {
            let normalizedCommentUsername = normalizeUsername(comment.username)
            
            // Skip if this is the current user's comment
            if normalizedCommentUsername == normalizedCurrentUsername {
                continue
            }
            
            // Skip if we already have a thread for this comment
            if let commentId = comment.id, threadToOtherParticipant[commentId] != nil {
                continue
            }
            
            // If this comment has a private thread, we already processed it above
            // If not, we can still show it as a potential conversation starter
            // But only if there are no private threads yet (to avoid duplicates)
            if let commentId = comment.id, threadsDict[commentId] == nil {
                threadToOtherParticipant[commentId] = comment.username
            }
        }
        
        // STEP 3: Create ThreadInfo for each thread (with OTHER participant's username)
        print("\n🔍 [MessagingService] ========== CREATING THREAD INFO ==========")
        print("   VideoId: \(videoId)")
        print("   Threads to process: \(threadToOtherParticipant.count)")
        print("   📋 Thread IDs from privateThreads: \(threadToOtherParticipant.keys.joined(separator: ", "))")
        print("   📋 Thread ID → Username mapping: \(threadToOtherParticipant.map { "\($0.key):\($0.value)" }.joined(separator: ", "))")
        
        // CRITICAL: Always use normalized videoId for threadUnreadStatus keys (consistent with backend)
        let normalizedVideoId = normalizeVideoId(videoId)
        let allThreadUnreadKeys = threadUnreadStatus.keys.filter { $0.hasPrefix("\(normalizedVideoId)_") }
        print("   🔑 Available threadUnreadStatus keys for this video: \(allThreadUnreadKeys.count)")
        print("   🔑 Looking for keys with prefix: '\(normalizedVideoId)_'")
        if !allThreadUnreadKeys.isEmpty {
            print("   🔑 Keys: \(allThreadUnreadKeys.joined(separator: ", "))")
            // Show values for each key
            for key in allThreadUnreadKeys {
                let value = threadUnreadStatus[key] ?? false
                print("      - \(key): \(value)")
            }
        } else {
            print("   ⚠️ NO threadUnreadStatus keys found for this video!")
            // Show all available keys for debugging
            let allKeys = Array(threadUnreadStatus.keys)
            if !allKeys.isEmpty {
                print("   🔍 All available threadUnreadStatus keys: \(allKeys.prefix(10).joined(separator: ", "))")
            }
        }
        
        // CRITICAL: Check for thread ID mismatches
        let expectedThreadIds = Set(threadToOtherParticipant.keys)
        let unreadThreadIds = Set(allThreadUnreadKeys.map { $0.replacingOccurrences(of: "\(normalizedVideoId)_", with: "") })
        let missingThreadIds = expectedThreadIds.subtracting(unreadThreadIds)
        let extraThreadIds = unreadThreadIds.subtracting(expectedThreadIds)
        if !missingThreadIds.isEmpty {
            print("   ⚠️ WARNING: Thread IDs in privateThreads but NOT in threadUnreadStatus: \(missingThreadIds.joined(separator: ", "))")
        }
        if !extraThreadIds.isEmpty {
            print("   ⚠️ WARNING: Thread IDs in threadUnreadStatus but NOT in privateThreads: \(extraThreadIds.joined(separator: ", "))")
        }
        
        for (threadId, otherParticipantUsername) in threadToOtherParticipant {
            // Always use normalized videoId for keys (consistent with backend)
            let key = "\(normalizedVideoId)_\(threadId)"
            let hasUnread = threadUnreadStatus[key] == true
            if hasUnread {
                print("   ✅ Thread \(threadId) (user: \(otherParticipantUsername)): HAS UNREAD (key: \(key))")
            } else {
                print("   ⚪ Thread \(threadId) (user: \(otherParticipantUsername)): NO UNREAD (key: \(key), value: \(threadUnreadStatus[key] ?? false))")
            }
            threads.append(ThreadInfo(id: threadId, username: otherParticipantUsername, hasUnread: hasUnread))
        }
        print("================================================\n")
        
        // Sort by unread first, then alphabetically
        threads.sort { first, second in
            if first.hasUnread != second.hasUnread {
                return first.hasUnread
            }
            return first.username < second.username
        }
        
        cachedUserThreads[videoId] = threads
    }
    
    struct ThreadInfo: Identifiable {
        let id: String
        let username: String
        let hasUnread: Bool
    }
    
    /// Post a message - OPTIMISTIC UPDATE + SERVER SYNC (feels immediate like general chat)
    func postMessage(videoId: String, text: String, threadId: String?, username: String) async throws -> Comment {
        // CRITICAL: Use userEmail instead of userId (UUID) - backend needs email for notifications
        guard let userEmail = authService.userEmail else {
            throw MessagingError.notAuthenticated
        }
        
        // Create optimistic comment for immediate UI feedback (same as general chat)
        let optimisticComment = Comment(
            id: "temp_\(Date().timeIntervalSince1970)",
            videoId: videoId,
            userId: userEmail, // Use email instead of UUID
            username: username,
            text: text,
            createdAt: Date(),
            likeCount: 0,
            isLiked: false,
            isPrivate: threadId != nil,
            parentCommentId: threadId,
            visibleTo: nil,
            mentionedUsername: nil
        )
        
        // OPTIMISTIC UPDATE: Add to UI IMMEDIATELY (synchronous, no await delay)
        // CRITICAL: Use MainActor.assumeIsolated for instant update (we're already on main thread from postComment)
        if Thread.isMainThread {
            // Already on main thread - update immediately (no delay)
            if let threadId = threadId {
                // Private thread message
                if privateThreads[videoId] == nil {
                    privateThreads[videoId] = [:]
                }
                if privateThreads[videoId]?[threadId] == nil {
                    privateThreads[videoId]?[threadId] = []
                }
                privateThreads[videoId]?[threadId]?.append(optimisticComment)
                
                // CRITICAL: Post CommentsViewed notification for RECIPIENT (not sender)
                // Backend will send notification to recipient, but we post here for immediate update
                // The notification will be received by the recipient's ContentCard and show the indicator
                let normalizedVideoId = normalizeVideoId(videoId)
                // Don't set unreadCounts here - recipient will get it via backend notification
                // Just log that message was posted
                print("📢 [MessagingService] Private message posted, recipient will receive indicator via backend notification, videoId: \(videoId)")
            } else {
                // Public comment (general chat)
                if publicComments[videoId] == nil {
                    publicComments[videoId] = []
                }
                publicComments[videoId]?.append(optimisticComment)
                
                // CRITICAL: Post NewCommentPosted notification IMMEDIATELY (optimistic update)
                // This ensures ContentCard updates count instantly, matching FloatingCommentView
                NotificationCenter.default.post(
                    name: NSNotification.Name("NewCommentPosted"),
                    object: nil,
                    userInfo: [
                        "videoId": videoId,
                        "isPrivate": false
                    ]
                )
                print("📢 [MessagingService] Posted NewCommentPosted notification IMMEDIATELY (optimistic) for videoId: \(videoId)")
            }
            
            // Update cached user threads immediately (no flash, no cache save - save after server response)
            updateCachedUserThreads(for: videoId)
        } else {
            // Not on main thread - use MainActor.run (but this should rarely happen)
            await MainActor.run {
                if let threadId = threadId {
                    if privateThreads[videoId] == nil {
                        privateThreads[videoId] = [:]
                    }
                    if privateThreads[videoId]?[threadId] == nil {
                        privateThreads[videoId]?[threadId] = []
                    }
                    privateThreads[videoId]?[threadId]?.append(optimisticComment)
                    
                    // CRITICAL: Post CommentsViewed notification for RECIPIENT (not sender)
                    // Backend will send notification to recipient, but we post here for immediate update
                    // The notification will be received by the recipient's ContentCard and show the indicator
                    let normalizedVideoId = normalizeVideoId(videoId)
                    // Don't set unreadCounts here - recipient will get it via backend notification
                    // Just log that message was posted
                    print("📢 [MessagingService] Private message posted, recipient will receive indicator via backend notification, videoId: \(videoId)")
                } else {
                    if publicComments[videoId] == nil {
                        publicComments[videoId] = []
                    }
                    publicComments[videoId]?.append(optimisticComment)
                    
                    // CRITICAL: Post NewCommentPosted notification IMMEDIATELY (optimistic update)
                    NotificationCenter.default.post(
                        name: NSNotification.Name("NewCommentPosted"),
                        object: nil,
                        userInfo: [
                            "videoId": videoId,
                            "isPrivate": false
                        ]
                    )
                    print("📢 [MessagingService] Posted NewCommentPosted notification IMMEDIATELY (optimistic) for videoId: \(videoId)")
                }
                updateCachedUserThreads(for: videoId)
            }
        }
        
        // Post to server in background (non-blocking)
        // CRITICAL: Send userEmail as userId - backend needs email for notifications and visibility
        let comment = try await ChannelService.shared.postComment(
            videoId: videoId,
            userId: userEmail, // Use email instead of UUID
            username: username,
            text: text,
            parentCommentId: threadId,
            creatorEmail: nil,
            commenterEmail: nil
        )
        
        // Replace optimistic comment with real one (silent replacement - no jitter)
        // SAME LOGIC for both general chat and private threads
        await MainActor.run {
            if let threadId = threadId {
                // Private thread - replace optimistic with real (same as general chat)
                if var thread = privateThreads[videoId]?[threadId] {
                    if let index = thread.firstIndex(where: { $0.id == optimisticComment.id }) {
                        thread[index] = comment
                        privateThreads[videoId]?[threadId] = thread
                    } else {
                        // Optimistic not found - add real one (same as general chat)
                        thread.append(comment)
                        privateThreads[videoId]?[threadId] = thread
                    }
                } else {
                    // Thread doesn't exist - create it (same as general chat)
                    if privateThreads[videoId] == nil {
                        privateThreads[videoId] = [:]
                    }
                    privateThreads[videoId]?[threadId] = [comment]
                }
            } else {
                // Public comment (general chat) - replace optimistic with real
                if var comments = publicComments[videoId] {
                    if let index = comments.firstIndex(where: { $0.id == optimisticComment.id }) {
                        comments[index] = comment
                        publicComments[videoId] = comments
                    } else {
                        // Optimistic not found - add real one
                        comments.append(comment)
                        publicComments[videoId] = comments
                    }
                } else {
                    // No comments yet - create array
                    publicComments[videoId] = [comment]
                }
                
                // NOTE: NewCommentPosted notification was already posted when optimistic comment was added
                // This ensures ContentCard updates immediately, matching FloatingCommentView
                // No need to post again here - it was posted optimistically above
            }
            
            // Update cached user threads
            updateCachedUserThreads(for: videoId)
        }
        
        // Reload from server in background (non-blocking) to ensure persistence
        // This happens silently in background - doesn't affect UI
        Task.detached { [weak self] in
            guard let self = self else { return }
            // Wait for server to process
            try? await Task.sleep(nanoseconds: 1500_000_000) // 1.5s delay
            // Reload to get persisted message (silent update)
            try? await self.loadMessages(for: videoId, useCache: false)
            await MainActor.run {
                self.updateCachedUserThreads(for: videoId)
                self.saveToCache(for: videoId)
            }
        }
        
        return comment
    }
    
    /// Like a message
    func likeMessage(commentId: String, videoId: String) async throws {
        guard let userId = authService.userId else {
            throw MessagingError.notAuthenticated
        }
        
        // Optimistic update
        await MainActor.run {
            if var comments = publicComments[videoId],
               let index = comments.firstIndex(where: { $0.id == commentId }) {
                comments[index].isLiked.toggle()
                comments[index].likeCount += comments[index].isLiked ? 1 : -1
                publicComments[videoId] = comments
            } else {
                // Check private threads
                if var threads = privateThreads[videoId] {
                    for (parentId, var thread) in threads {
                        if let index = thread.firstIndex(where: { $0.id == commentId }) {
                            thread[index].isLiked.toggle()
                            thread[index].likeCount += thread[index].isLiked ? 1 : -1
                            threads[parentId] = thread
                            privateThreads[videoId] = threads
                            break
                        }
                    }
                }
            }
        }
        
        // Update on server (WebSocket will confirm)
        _ = try await ChannelService.shared.likeComment(
            videoId: videoId,
            commentId: commentId,
            userId: userId,
            isLiked: await MainActor.run {
                // Get current state
                if let comments = publicComments[videoId],
                   let comment = comments.first(where: { $0.id == commentId }) {
                    return comment.isLiked
                }
                return false
            }
        )
    }
    
    /// Mark thread as read
    func markThreadRead(threadId: String, videoId: String) async throws {
        guard let viewerEmail = authService.userEmail else {
            throw MessagingError.notAuthenticated
        }
        
        // Optimistic update - immediate UI feedback
        await MainActor.run {
            // Always use normalized videoId for keys (consistent with backend)
            let normalizedVideoId = normalizeVideoId(videoId)
            let key = "\(normalizedVideoId)_\(threadId)"
            threadUnreadStatus[key] = false
            updateCachedUserThreads(for: videoId)
        }
        
        // Update on server
        _ = try await ChannelService.shared.markThreadAsRead(
            videoId: videoId,
            threadId: threadId,
            viewerEmail: viewerEmail
        )
        
        // Reload unread counts (will update badge)
        try await loadUnreadCounts(for: videoId)
    }
    
    /// Load unread counts for a video
    func loadUnreadCounts(for videoId: String) async throws {
        print("🔍 [MessagingService] ========== loadUnreadCounts CALLED ==========")
        print("   videoId: \(videoId)")
        
        guard let viewerEmail = authService.userEmail else {
            print("⚠️ [MessagingService] Cannot load unread counts - no user email")
            return
        }
        
        print("   viewerEmail: \(viewerEmail)")
        
        do {
            print("   📡 Calling getUnreadCommentCountsDetailed...")
            let counts = try await ChannelService.shared.getUnreadCommentCountsDetailed(
                videoIds: [videoId],
                viewerEmail: viewerEmail
            )
            
            print("   ✅ Received response from backend")
            print("   📦 Response keys: \(counts.keys.joined(separator: ", "))")
            print("   📦 Full response: \(counts)")
            
            await MainActor.run {
                // CRITICAL: Backend always normalizes videoId (strips FILE# and file- prefixes)
                // So we must normalize our lookup key to match
                let normalizedLookupKey = normalizeVideoId(videoId)
                
                print("   🔑 Original videoId: \(videoId)")
                print("   🔑 Normalized lookup key: \(normalizedLookupKey)")
                print("   🔑 Available keys in response: \(counts.keys.joined(separator: ", "))")
                
                // Backend returns response with normalized videoId as key
                guard let videoResponse = counts[normalizedLookupKey] else {
                    print("❌ [MessagingService] No response for normalized videoId: \(normalizedLookupKey)")
                    print("   Original videoId: \(videoId)")
                    print("   Available keys in counts: \(counts.keys.joined(separator: ", "))")
                    return
                }
                
                // Parse response
                // CRITICAL: Always use normalized videoId for unreadCounts keys (consistent with backend)
                let normalizedVideoIdForCounts = normalizeVideoId(videoId)
                
                if let intValue = videoResponse as? Int {
                    print("📊 [MessagingService] Unread count (Int format): \(intValue) for videoId: \(videoId) (normalized: \(normalizedVideoIdForCounts))")
                    unreadCounts[normalizedVideoIdForCounts] = intValue
                } else if let dictValue = videoResponse as? [String: Any] {
                    let total = dictValue["total"] as? Int ?? 0
                    unreadCounts[normalizedVideoIdForCounts] = total
                    print("📊 [MessagingService] Unread count (dict format): total=\(total) for videoId: \(videoId) (normalized: \(normalizedVideoIdForCounts))")
                    
                    // CRITICAL: Always process threads dictionary
                    print("\n📊 [MessagingService] ========== PARSING BACKEND RESPONSE ==========")
                    print("   videoId: \(videoId)")
                    print("   total: \(total)")
                    print("   dictValue keys: \(dictValue.keys.joined(separator: ", "))")
                    
                    if let threads = dictValue["threads"] as? [String: Int] {
                        print("   ✅ Found threads dictionary with \(threads.count) threads")
                        print("   📋 Thread IDs from backend: \(threads.keys.joined(separator: ", "))")
                        print("   📋 Thread counts from backend: \(threads.map { "\($0.key):\($0.value)" }.joined(separator: ", "))")
                        
                        if threads.isEmpty {
                            print("   ⚠️ WARNING: threads dictionary is EMPTY even though total=\(total)")
                        }
                        
                        // CRITICAL: Log what thread IDs we have in privateThreads for comparison
                        let privateThreadIds = Set((privateThreads[videoId] ?? [:]).keys)
                        print("   📋 Thread IDs in privateThreads: \(privateThreadIds.joined(separator: ", "))")
                        
                        // CRITICAL: Always use normalized videoId for threadUnreadStatus keys (consistent with backend)
                        let normalizedVideoId = normalizeVideoId(videoId)
                        
                        for (threadId, count) in threads {
                            // Always use normalized videoId for keys (backend normalizes, so we must too)
                            let key = "\(normalizedVideoId)_\(threadId)"
                            let previousValue = threadUnreadStatus[key]
                            threadUnreadStatus[key] = count > 0
                            
                            // Check if this threadId exists in privateThreads
                            let existsInPrivateThreads = privateThreadIds.contains(threadId)
                            if !existsInPrivateThreads {
                                print("   ⚠️ WARNING: Backend returned threadId '\(threadId)' that doesn't exist in privateThreads!")
                            }
                            
                            if count > 0 {
                                print("   🔴 Thread \(threadId): \(count) unread → key: \(key) (was: \(previousValue ?? false), exists in privateThreads: \(existsInPrivateThreads))")
                            } else {
                                print("   ⚪ Thread \(threadId): 0 unread → key: \(key) (was: \(previousValue ?? false), exists in privateThreads: \(existsInPrivateThreads))")
                            }
                        }
                        let matchingKeys = threadUnreadStatus.keys.filter { $0.hasPrefix("\(normalizedVideoId)_") }
                        print("   🔑 Total threadUnreadStatus keys after update: \(matchingKeys.count)")
                        if matchingKeys.count > 0 {
                            print("   🔑 Keys: \(matchingKeys.joined(separator: ", "))")
                            for key in matchingKeys {
                                print("      - \(key): \(threadUnreadStatus[key] ?? false)")
                            }
                        } else {
                            print("   ⚠️ WARNING: No threadUnreadStatus keys found after processing!")
                        }
                    } else {
                        print("   ⚠️ No 'threads' dictionary in response (or it's not [String: Int])")
                        print("   Response keys: \(dictValue.keys.joined(separator: ", "))")
                        if let threadsAny = dictValue["threads"] {
                            print("   threads type: \(type(of: threadsAny))")
                            print("   threads value: \(threadsAny)")
                        } else {
                            print("   ⚠️ 'threads' key does not exist in response!")
                        }
                    }
                    print("================================================\n")
                } else {
                    print("⚠️ [MessagingService] Unexpected response format for videoId: \(videoId), type: \(type(of: videoResponse))")
                }
                
                // CRITICAL: Update cached user threads AFTER threadUnreadStatus is populated
                // This ensures orange highlights appear/disappear correctly
                updateCachedUserThreads(for: videoId)
                print("✅ [MessagingService] Updated cached user threads after loading unread counts")
            }
        } catch {
            print("❌ [MessagingService] Error loading unread counts: \(error)")
            throw error
        }
        
        await MainActor.run {
            // CRITICAL: Update cached user threads after unread status changes
            updateCachedUserThreads(for: videoId)
            saveToCache(for: videoId)
            
            // Notify ContentCard (use normalized videoId for consistency)
            let normalizedVideoId = normalizeVideoId(videoId)
            NotificationCenter.default.post(
                name: NSNotification.Name("CommentsViewed"),
                object: nil,
                userInfo: [
                    "videoId": normalizedVideoId,
                    "unreadCount": unreadCounts[normalizedVideoId] ?? 0
                ]
            )
        }
    }
    
    // Helper to normalize videoId (consistent with ContentCard)
    // Helper to normalize videoId (matches backend exactly: strips FILE# first, then file-)
    private func normalizeVideoId(_ videoId: String) -> String {
        var normalized = videoId
        if normalized.hasPrefix("FILE#") {
            normalized = String(normalized.dropFirst(5)) // Remove "FILE#"
        }
        if normalized.hasPrefix("file-") {
            normalized = String(normalized.dropFirst(5)) // Remove "file-"
        }
        return normalized
    }
    
    /// Clear all cache - SERVER IS SOURCE OF TRUTH
    /// NOTE: This does NOT clear UserDefaults - data persists across app rebuilds
    /// Only clears in-memory cache for fresh server fetch
    func clearCache() {
        publicComments.removeAll()
        privateThreads.removeAll()
        unreadCounts.removeAll()
        threadUnreadStatus.removeAll()
        
        // DON'T clear UserDefaults - we want persistence across app rebuilds
        // UserDefaults will be loaded on init and overwritten by server data
        
        print("🗑️ [MessagingService] Cleared in-memory cache (UserDefaults preserved for persistence)")
    }
    
    // MARK: - Persistence (UserDefaults)
    
    /// Save comments to UserDefaults for persistence across app rebuilds
    private func saveToCache(for videoId: String) {
        let key = "messaging_cache_\(videoId)"
        
        struct CachedData: Codable {
            let publicComments: [Comment]
            let privateThreads: [String: [Comment]]
            let timestamp: Date
        }
        
        do {
            let cached = CachedData(
                publicComments: publicComments[videoId] ?? [],
                privateThreads: privateThreads[videoId] ?? [:],
                timestamp: Date()
            )
            
            let encoder = JSONEncoder()
            let data = try encoder.encode(cached)
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
            print("💾 [MessagingService] Saved cache for \(videoId): \(cached.publicComments.count) public, \(cached.privateThreads.count) private threads")
        } catch {
            print("❌ [MessagingService] Error saving cache for \(videoId): \(error)")
        }
    }
    
    /// Load cached data from UserDefaults (called on init for instant display)
    private func loadCachedData() {
        let defaults = UserDefaults.standard
        let keys = defaults.dictionaryRepresentation().keys
        
        struct CachedData: Codable {
            let publicComments: [Comment]
            let privateThreads: [String: [Comment]]
            let timestamp: Date
        }
        
        for key in keys {
            if key.hasPrefix("messaging_cache_") {
                guard let data = defaults.data(forKey: key) else { continue }
                
                do {
                    let decoder = JSONDecoder()
                    let cached = try decoder.decode(CachedData.self, from: data)
                    
                    // Extract videoId from key
                    let videoId = String(key.dropFirst("messaging_cache_".count))
                    
                    // Load into memory for instant display
                    publicComments[videoId] = cached.publicComments
                    privateThreads[videoId] = cached.privateThreads
                    
                    // Update cached user threads
                    updateCachedUserThreads(for: videoId)
                    
                    print("📂 [MessagingService] Loaded cached data for \(videoId): \(cached.publicComments.count) public, \(cached.privateThreads.count) private threads")
                } catch {
                    print("❌ [MessagingService] Error loading cache for \(key): \(error)")
                }
            }
        }
    }
    
    /// Get public comments for a video
    func getPublicComments(for videoId: String) -> [Comment] {
        return publicComments[videoId] ?? []
    }
    
    /// Get private thread for a video and threadId
    func getPrivateThread(for videoId: String, threadId: String) -> [Comment] {
        return privateThreads[videoId]?[threadId] ?? []
    }
    
    /// Get unread count for a video
    func getUnreadCount(for videoId: String) -> Int {
        // CRITICAL: Always use normalized videoId for lookup (consistent with how we store)
        let normalizedVideoId = normalizeVideoId(videoId)
        return unreadCounts[normalizedVideoId] ?? 0
    }
    
    /// Check if thread has unread messages
    func hasUnreadThread(videoId: String, threadId: String) -> Bool {
        // Always use normalized videoId for keys (consistent with backend)
        let normalizedVideoId = normalizeVideoId(videoId)
        let key = "\(normalizedVideoId)_\(threadId)"
        return threadUnreadStatus[key] == true
    }
    
    /// Get cached user threads for a video
    func getCachedUserThreads(for videoId: String) -> [ThreadInfo] {
        return cachedUserThreads[videoId] ?? []
    }
    
    /// Connect WebSocket for a video
    func connectWebSocket(for videoId: String) {
        guard let userEmail = authService.userEmail else { return }
        let websocketEndpoint = ChannelService.shared.websocketEndpoint
        websocketService.connect(userEmail: userEmail, websocketEndpoint: websocketEndpoint)
        
        // Start polling fallback if WebSocket not connected after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if !self.websocketService.isConnected {
                print("⚠️ [MessagingService] WebSocket not connected, starting polling fallback for \(videoId)")
                self.startPolling(for: videoId)
            }
        }
    }
    
    /// Disconnect and cleanup for a video
    func disconnect(for videoId: String) {
        stopPolling(for: videoId)
    }
    
    // MARK: - WebSocket Setup
    
    private func setupWebSocketHandlers() {
        // Handle new comment notifications
        websocketService.$commentNotification
            .compactMap { $0 }
            .sink { [weak self] notification in
                guard let self = self else { return }
                
                // PATTERN: FLOATINGCOMMENTVIEW PATTERN - Optimistic update for indicator
                // IMMEDIATE: Update indicator and highlight right away when receiving private message
                // This ensures bidirectional indicators - recipient sees it instantly
                if let isPrivate = notification.isPrivate, isPrivate,
                   let threadId = notification.threadId {
                    let videoId = notification.videoId
                    let normalizedVideoId = normalizeVideoId(videoId)
                    let key = "\(normalizedVideoId)_\(threadId)"
                    
                    // STEP 1: OPTIMISTIC UPDATE - Set indicator and highlight IMMEDIATELY (synchronous)
                    // Same pattern as when posting - appears instantly
                    DispatchQueue.main.async {
                        // Set indicator to 1 immediately (recipient has unread message)
                        self.unreadCounts[normalizedVideoId] = 1
                        
                        // Set highlight immediately (thread has unread)
                        self.threadUnreadStatus[key] = true
                        
                        // Update cached user threads immediately (reads from threadUnreadStatus)
                        self.updateCachedUserThreads(for: videoId)
                        
                        // Post notification IMMEDIATELY to update ContentCard
                        NotificationCenter.default.post(
                            name: NSNotification.Name("CommentsViewed"),
                            object: nil,
                            userInfo: [
                                "videoId": videoId,
                                "unreadCount": 1 // Optimistic: recipient has unread message
                            ]
                        )
                        
                        print("✅ [MessagingService] OPTIMISTIC: Updated indicator and highlight IMMEDIATELY on receive (videoId: \(videoId), threadId: \(threadId))")
                    }
                }
                
                // STEP 2: Load messages from server (silent update in background)
                // Same pattern as when posting - backend verifies silently
                Task {
                    try? await self.loadMessages(for: notification.videoId) // This will save to cache automatically
                    
                    // Verify with backend (silent update - doesn't affect UI if already correct)
                    try? await self.loadUnreadCounts(for: notification.videoId)
                    
                    await MainActor.run {
                        let normalizedVideoId = normalizeVideoId(notification.videoId)
                        let apiUnreadCount = self.getUnreadCount(for: notification.videoId)
                        let unreadCount = apiUnreadCount > 0 ? 1 : 0
                        
                        // CRITICAL: Don't clear optimistic update if backend says 0 (sender case)
                        // Only update if backend says there ARE unread messages (recipient case)
                        // This preserves bidirectional indicator - sender keeps seeing it
                        let currentIndicator = self.unreadCounts[normalizedVideoId] ?? 0
                        if unreadCount > 0 {
                            // Backend says there are unread - update to 1 (recipient case)
                            if currentIndicator != 1 {
                                self.unreadCounts[normalizedVideoId] = 1
                                
                                // Post notification to sync
                                NotificationCenter.default.post(
                                    name: NSNotification.Name("CommentsViewed"),
                                    object: nil,
                                    userInfo: [
                                        "videoId": notification.videoId,
                                        "unreadCount": 1
                                    ]
                                )
                                
                                print("✅ [MessagingService] VERIFIED: Indicator set to 1 (recipient has unread, API: \(apiUnreadCount))")
                            }
                        } else {
                            // Backend says 0 - keep current indicator (don't clear optimistic update for sender)
                            // This ensures bidirectional - sender keeps seeing indicator
                            if currentIndicator == 1 {
                                print("✅ [MessagingService] VERIFIED: Keeping indicator at 1 (sender case, API: \(apiUnreadCount))")
                            }
                        }
                    }
                }
            }
            .store(in: &cancellables)
        
        // Handle unread count updates
        websocketService.$unreadCountUpdateNotification
            .compactMap { $0 }
            .sink { [weak self] notification in
                Task {
                    try? await self?.loadUnreadCounts(for: notification.videoId)
                }
            }
            .store(in: &cancellables)
        
        // Handle like notifications
        websocketService.$likeNotification
            .compactMap { $0 }
            .sink { [weak self] notification in
                Task { @MainActor in
                    guard let self = self else { return }
                    if var comments = self.publicComments[notification.videoId],
                       let index = comments.firstIndex(where: { $0.id == notification.commentId }) {
                        comments[index].likeCount = notification.likeCount
                        comments[index].isLiked = notification.likedBy != nil
                        self.publicComments[notification.videoId] = comments
                    } else if var threads = self.privateThreads[notification.videoId] {
                        for (parentId, var thread) in threads {
                            if let index = thread.firstIndex(where: { $0.id == notification.commentId }) {
                                thread[index].likeCount = notification.likeCount
                                thread[index].isLiked = notification.likedBy != nil
                                threads[parentId] = thread
                                self.privateThreads[notification.videoId] = threads
                                break
                            }
                        }
                    }
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Polling Fallback
    
    func startPolling(for videoId: String) {
        stopPolling(for: videoId)
        
        pollingTimers[videoId] = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            guard let self = self, !self.websocketService.isConnected else {
                self?.stopPolling(for: videoId)
                return
            }
            Task {
                try? await self.loadMessages(for: videoId)
            }
        }
    }
    
    func stopPolling(for videoId: String) {
        pollingTimers[videoId]?.invalidate()
        pollingTimers[videoId] = nil
    }
}

enum MessagingError: Error {
    case notAuthenticated
    case invalidVideoId
    case networkError(String)
}
