//
//  NotificationService.swift
//  TwillyBroadcaster
//
//  Service to manage video processing notifications and inbox
//

import Foundation
import Combine

// Notification model
struct StreamNotification: Identifiable, Codable {
    let id: String
    let type: NotificationType
    let title: String
    let message: String
    let channelName: String
    let streamKey: String?
    let videoId: String?
    let createdAt: Date
    var isRead: Bool
    var actionUrl: String? // URL to navigate when notification is clicked
    var metadata: [String: String]? // Additional metadata for notifications
    
    enum NotificationType: String, Codable {
        case videoReady = "video_ready"
        case processing = "processing"
        case error = "error"
        case followRequest = "follow_request"
        case followAccepted = "follow_accepted"
        case followDeclined = "follow_declined"
        case commentReply = "comment_reply"
        case privateAccessGranted = "private_access_granted"
        case publicAccessGranted = "public_access_granted"
        case directStreamRequest = "direct_stream_request"
    }
}

// Notification Service
class NotificationService: ObservableObject {
    static let shared = NotificationService()
    
    @Published var notifications: [StreamNotification] = []
    @Published var unreadCount: Int = 0
    
    private let userDefaults = UserDefaults.standard
    private let notificationsKey = "StreamNotifications"
    
    // Background task for checking video readiness
    private var pollingTasks: [String: Task<Void, Never>] = [:]
    
    // Track when streams stopped to only match videos created after that time
    private var streamStopTimes: [String: Date] = [:]
    
    private init() {
        loadNotifications()
    }
    
    // MARK: - Notification Management
    
    func addNotification(_ notification: StreamNotification) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("📬 [NotificationService] Adding notification:")
            print("   📝 Type: \(notification.type.rawValue)")
            print("   📝 Title: \(notification.title)")
            print("   📝 Channel: \(notification.channelName)")
            print("   📝 StreamKey: \(notification.streamKey ?? "nil")")
            
            self.notifications.insert(notification, at: 0) // Add to top
            self.saveNotifications()
            self.updateUnreadCount()
            
            print("   ✅ Notification added. Total: \(self.notifications.count), Unread: \(self.unreadCount)")
        }
    }
    
    func markAsRead(_ notificationId: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let index = self.notifications.firstIndex(where: { $0.id == notificationId }) {
                self.notifications[index].isRead = true
                self.saveNotifications()
                self.updateUnreadCount()
            }
        }
    }
    
    func markAllAsRead() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            for index in self.notifications.indices {
                self.notifications[index].isRead = true
            }
            self.saveNotifications()
            self.updateUnreadCount()
        }
    }
    
    func deleteNotification(_ notificationId: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.notifications.removeAll { $0.id == notificationId }
            self.saveNotifications()
            self.updateUnreadCount()
        }
    }
    
    // MARK: - Video Processing Monitoring
    
    func startMonitoringVideo(
        streamKey: String,
        channelName: String,
        userEmail: String,
        videoId: String? = nil
    ) {
        // Cancel existing task for this stream if any
        pollingTasks[streamKey]?.cancel()
        
        // Record when monitoring started (stream just stopped)
        streamStopTimes[streamKey] = Date()
        print("📅 [NotificationService] Recording stream stop time for \(streamKey): \(streamStopTimes[streamKey]!)")
        
        // Create processing notification
        let processingNotification = StreamNotification(
            id: UUID().uuidString,
            type: .processing,
            title: "Video Processing",
            message: "Your video for \(channelName) is being processed. You'll be notified when it's ready.",
            channelName: channelName,
            streamKey: streamKey,
            videoId: videoId,
            createdAt: Date(),
            isRead: false,
            actionUrl: nil,
            metadata: nil
        )
        addNotification(processingNotification)
        
        // Start background polling
        print("🚀 [NotificationService] Starting background polling task for streamKey: \(streamKey)")
        let task = Task.detached(priority: .background) { [weak self] in
            guard let self = self else {
                print("⚠️ [NotificationService] Self is nil, cannot start polling")
                return
            }
            print("✅ [NotificationService] Background polling task started for streamKey: \(streamKey)")
            await self.pollVideoReadiness(
                streamKey: streamKey,
                channelName: channelName,
                userEmail: userEmail,
                videoId: videoId
            )
            print("🏁 [NotificationService] Background polling task completed for streamKey: \(streamKey)")
        }
        
        pollingTasks[streamKey] = task
        print("✅ [NotificationService] Polling task stored for streamKey: \(streamKey), total tasks: \(pollingTasks.count)")
    }
    
    func stopMonitoringVideo(streamKey: String) {
        print("🛑 [NotificationService] Stopping monitoring for streamKey: \(streamKey)")
        if let task = pollingTasks[streamKey] {
            print("   📊 Task exists, cancelling...")
            task.cancel()
            pollingTasks.removeValue(forKey: streamKey)
            print("   ✅ Task cancelled and removed")
        } else {
            print("   ⚠️ No task found for streamKey: \(streamKey)")
        }
        // Keep streamStopTime for a while in case we need to check again
        // Will be cleaned up after 1 hour
        DispatchQueue.main.asyncAfter(deadline: .now() + 3600) { [weak self] in
            self?.streamStopTimes.removeValue(forKey: streamKey)
        }
    }
    
    // One-time check if a video is ready (useful for refresh/retry)
    private func checkVideoReadinessOnce(
        streamKey: String,
        channelName: String,
        userEmail: String,
        videoId: String?
    ) async -> Bool {
        print("🔄 [NotificationService] Checking video readiness once")
        print("   📝 streamKey: \(streamKey)")
        print("   📝 channelName: \(channelName)")
        print("   📝 userEmail: \(userEmail)")
        
        do {
            guard let url = URL(string: "https://twilly.app/api/files/check-stream-file") else {
                print("   ⚠️ Invalid URL")
                return false
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "userEmail": userEmail,
                "streamKey": streamKey
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            print("   🌐 Making API request to check-stream-file...")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                print("   📊 HTTP Status: \(httpResponse.statusCode)")
                
                if httpResponse.statusCode == 200,
                   let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    
                    let exists = json["exists"] as? Bool ?? false
                    let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
                    let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
                    let isVisible = json["isVisible"] as? Bool ?? false
                    let fileId = json["fileId"] as? String
                    
                    print("   📊 API Response:")
                    print("      exists: \(exists)")
                    print("      hasHlsUrl: \(hasHlsUrl)")
                    print("      hasThumbnail: \(hasThumbnail)")
                    print("      isVisible: \(isVisible)")
                    print("      fileId: \(fileId ?? "nil")")
                    
                    if exists && hasHlsUrl && hasThumbnail {
                        // Video is ready via check-stream-file API
                        return await handleVideoReady(
                            streamKey: streamKey,
                            channelName: channelName,
                            userEmail: userEmail,
                            videoId: fileId ?? videoId
                        )
                    } else {
                        print("   ⏳ check-stream-file says video not ready yet:")
                        if !exists {
                            print("      - Video does not exist in database (checking channel content as fallback...)")
                            // Fallback: Check channel content API directly immediately
                            // This ensures we detect videos as soon as they appear in the channel
                            if let channelContent = try? await checkChannelContentForStream(
                                streamKey: streamKey,
                                channelName: channelName,
                                creatorEmail: userEmail
                            ) {
                                print("   ✅ Found video in channel content! Video is ready!")
                                return await handleVideoReady(
                                    streamKey: streamKey,
                                    channelName: channelName,
                                    userEmail: userEmail,
                                    videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                )
                            }
                        } else if !hasHlsUrl {
                            print("      - Video exists but HLS URL not ready (checking channel content as fallback...)")
                            // Also check channel content if HLS URL not ready - video might be ready in channel
                            if let channelContent = try? await checkChannelContentForStream(
                                streamKey: streamKey,
                                channelName: channelName,
                                creatorEmail: userEmail
                            ) {
                                print("   ✅ Found video in channel content with HLS! Video is ready!")
                                return await handleVideoReady(
                                    streamKey: streamKey,
                                    channelName: channelName,
                                    userEmail: userEmail,
                                    videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                )
                            }
                        } else if !hasThumbnail {
                            print("      - Video has HLS URL but thumbnail not ready (checking channel content as fallback...)")
                            // Also check channel content if thumbnail not ready - video might be ready in channel
                            if let channelContent = try? await checkChannelContentForStream(
                                streamKey: streamKey,
                                channelName: channelName,
                                creatorEmail: userEmail
                            ) {
                                print("   ✅ Found video in channel content with thumbnail! Video is ready!")
                                return await handleVideoReady(
                                    streamKey: streamKey,
                                    channelName: channelName,
                                    userEmail: userEmail,
                                    videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                )
                            }
                        }
                        return false
                    }
                } else {
                    print("   ⚠️ Invalid response format or non-200 status")
                    if let responseString = String(data: data, encoding: .utf8) {
                        print("   📝 Response body: \(responseString.prefix(200))")
                    }
                    return false
                }
            } else {
                print("   ⚠️ Invalid HTTP response type")
                return false
            }
        } catch {
            print("⚠️ [NotificationService] Error checking video: \(error.localizedDescription)")
            return false
        }
    }
    
    // Check channel content directly for a stream with the given streamKey
    private func checkChannelContentForStream(
        streamKey: String,
        channelName: String,
        creatorEmail: String
    ) async throws -> ChannelContent? {
        print("   🔄 Checking channel content for streamKey: \(streamKey)")
        
        // Get the stream stop time to only match videos created after that
        let streamStopTime = streamStopTimes[streamKey] ?? Date().addingTimeInterval(-900) // Default to 15 minutes ago if not tracked
        print("   📅 Stream stop time: \(streamStopTime)")
        print("   📅 Current time: \(Date())")
        
        // Fetch channel content
        let content = try await ChannelService.shared.fetchChannelContent(
            channelName: channelName,
            creatorEmail: creatorEmail,
            forceRefresh: true
        )
        
        print("   📊 Found \(content.count) items in channel")
        
        // Log all videos for debugging
        print("   📋 All videos in channel:")
        for (index, item) in content.prefix(5).enumerated() {
            print("      [\(index)] fileName=\(item.fileName), hlsUrl=\(item.hlsUrl != nil && !item.hlsUrl!.isEmpty ? "exists" : "nil"), thumbnailUrl=\(item.thumbnailUrl != nil && !item.thumbnailUrl!.isEmpty ? "exists" : "nil"), createdAt=\(item.createdAt ?? "nil")")
        }
        
        // Find content that matches the streamKey in fileName AND was created after stream stopped
        var matchingItems: [ChannelContent] = []
        
        for item in content {
            // Match by fileName containing streamKey
            if item.fileName.contains(streamKey) {
                print("   🔍 Found potential match by streamKey: \(item.fileName)")
                
                // CRITICAL: Only match videos created AFTER stream stopped
                // This prevents matching old videos from previous streams
                if let createdAtString = item.createdAt {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    
                    if let createdAt = formatter.date(from: createdAtString) ?? ISO8601DateFormatter().date(from: createdAtString) {
                        let timeDiff = createdAt.timeIntervalSince(streamStopTime)
                        print("      - createdAt: \(createdAt)")
                        print("      - streamStopTime: \(streamStopTime)")
                        print("      - time difference: \(timeDiff) seconds (positive = after stream stop, negative = before)")
                        
                        // CRITICAL: Only match videos created AFTER stream stopped
                        // The video must be created AFTER the stream stopped (positive timeDiff)
                        // Allow a small 10-second buffer for clock skew, but reject videos created significantly before
                        // Also reject videos created more than 10 minutes after (might be a different stream)
                        // This ensures we don't match old videos from previous streams
                        if timeDiff >= -10 && timeDiff <= 600 {
                            // Video created within 10 seconds before (clock skew) or up to 10 minutes after stream stop
                            print("      ✅ Video created after stream stopped (or within 10s buffer for clock skew)")
                            matchingItems.append(item)
                        } else if timeDiff < -10 {
                            // Video created more than 10 seconds before stream stopped - definitely an old video
                            print("      ⏭️ Video created before stream stopped (\(Int(timeDiff))s before) - skipping (old video)")
                            continue
                        } else {
                            // Video created more than 10 minutes after stream stop - might be a different stream
                            print("      ⏭️ Video created too long after stream stopped (\(Int(timeDiff))s) - might be different stream")
                            continue
                        }
                    } else {
                        print("      ⚠️ Could not parse createdAt timestamp - skipping to avoid false matches")
                        // Don't match if we can't verify timestamp - too risky
                        continue
                    }
                } else {
                    print("      ⚠️ No createdAt timestamp - skipping to avoid false matches")
                    // Don't match if no timestamp - too risky
                    continue
                }
            }
        }
        
        print("   📊 Found \(matchingItems.count) items matching streamKey AND timestamp filter")
        
        // If no matches, video is not ready yet
        if matchingItems.isEmpty {
            print("   ⚠️ No matching videos found - video not ready yet")
            return nil
        }
        
        // Find the most recent matching video that has BOTH HLS URL and thumbnail
        // Sort by createdAt (newest first)
        let sortedItems = matchingItems.sorted { item1, item2 in
            let date1 = item1.createdAt ?? ""
            let date2 = item2.createdAt ?? ""
            return date1 > date2 // Newest first
        }
        
        for item in sortedItems {
            print("   🔍 Checking: \(item.fileName)")
            print("      - hlsUrl: \(item.hlsUrl != nil && !item.hlsUrl!.isEmpty ? "exists" : "nil")")
            print("      - thumbnailUrl: \(item.thumbnailUrl != nil && !item.thumbnailUrl!.isEmpty ? "exists" : "nil")")
            print("      - createdAt: \(item.createdAt ?? "nil")")
            
            // CRITICAL: Only return video if it has BOTH HLS URL and thumbnail
            // Both are required for the video to be truly ready
            if let hlsUrl = item.hlsUrl, !hlsUrl.isEmpty,
               let thumbnailUrl = item.thumbnailUrl, !thumbnailUrl.isEmpty {
                print("   ✅ Video is ready in channel content! (has both HLS and thumbnail)")
                return item
            } else {
                print("   ⏳ Video found but missing hlsUrl or thumbnailUrl - not ready yet")
                if item.hlsUrl == nil || item.hlsUrl!.isEmpty {
                    print("      - Missing HLS URL")
                }
                if item.thumbnailUrl == nil || item.thumbnailUrl!.isEmpty {
                    print("      - Missing thumbnail URL")
                }
            }
        }
        
        print("   ⚠️ No ready video found in channel content for this stream (missing HLS or thumbnail)")
        return nil
    }
    
    // Handle video ready - update visibility, remove processing notification, create ready notification
    private func handleVideoReady(
        streamKey: String,
        channelName: String,
        userEmail: String,
        videoId: String?
    ) async -> Bool {
        print("✅ [NotificationService] Video is ready! Updating visibility...")
        
        // Update visibility to true
        if let videoId = videoId, !videoId.isEmpty {
            await updateVideoVisibility(
                fileId: videoId,
                userEmail: userEmail,
                isVisible: true
            )
        }
        
        // Remove processing notification
        let processingNotificationId = await MainActor.run {
            return notifications.first(where: {
                $0.streamKey == streamKey && $0.type == .processing
            })?.id
        }
        
        if let id = processingNotificationId {
            await MainActor.run {
                deleteNotification(id)
            }
        }
        
        // Create "video ready" notification
        print("   📬 Creating ready notification for: \(channelName)")
        let readyNotification = StreamNotification(
            id: UUID().uuidString,
            type: .videoReady,
            title: "Video Ready!",
            message: "Your video for \(channelName) is now available.",
            channelName: channelName,
            streamKey: streamKey,
            videoId: videoId,
            createdAt: Date(),
            isRead: false,
            actionUrl: "channel://\(channelName)",
            metadata: nil
        )
        
        await MainActor.run {
            print("   ✅ Adding ready notification to list")
            print("   📊 Current notifications count before add: \(self.notifications.count)")
            addNotification(readyNotification)
            print("   ✅ Ready notification added successfully")
            print("   📊 Current notifications count after add: \(self.notifications.count)")
            print("   📊 Unread count: \(self.unreadCount)")
        }
        
        // Stop polling if it's still running
        await MainActor.run {
            stopMonitoringVideo(streamKey: streamKey)
        }
        
        print("   ✅ Returning true from checkVideoReadinessOnce - video is ready!")
        return true
    }
    
    // Check all processing notifications to see if any are ready
    func refreshAllProcessingNotifications(userEmail: String) {
        print("🔄 [NotificationService] Refreshing all processing notifications")
        print("   📊 Total notifications: \(notifications.count)")
        
        let processingNotifications = notifications.filter { $0.type == .processing }
        print("   📊 Processing notifications found: \(processingNotifications.count)")
        
        if processingNotifications.isEmpty {
            print("   ℹ️ No processing notifications to refresh")
            return
        }
        
        for notification in processingNotifications {
            print("   🔍 Checking: channel=\(notification.channelName), streamKey=\(notification.streamKey ?? "nil")")
            
            if let streamKey = notification.streamKey {
                // Check once if video is ready
                Task {
                    print("   🎯 Starting check for: \(notification.channelName)")
                    let isReady = await checkVideoReadinessOnce(
                        streamKey: streamKey,
                        channelName: notification.channelName,
                        userEmail: userEmail,
                        videoId: notification.videoId
                    )
                    
                    print("   ✅ Check complete for \(notification.channelName): isReady=\(isReady)")
                    
                    // If not ready and no active polling task, restart monitoring
                    if !isReady {
                        await MainActor.run {
                            let task = pollingTasks[streamKey]
                            let isCancelled = task?.isCancelled ?? true
                            
                            print("   📊 Task status for \(streamKey): exists=\(task != nil), cancelled=\(isCancelled)")
                            
                            if task == nil || isCancelled {
                                print("   🔄 Restarting monitoring for: \(notification.channelName)")
                                startMonitoringVideo(
                                    streamKey: streamKey,
                                    channelName: notification.channelName,
                                    userEmail: userEmail,
                                    videoId: notification.videoId
                                )
                            } else {
                                print("   ℹ️ Polling task already active for: \(notification.channelName)")
                            }
                        }
                    } else {
                        print("   ✅ Video is ready! Notification should have been created.")
                    }
                }
            } else {
                print("   ⚠️ No streamKey for notification: \(notification.id)")
            }
        }
    }
    
    private func pollVideoReadiness(
        streamKey: String,
        channelName: String,
        userEmail: String,
        videoId: String?
    ) async {
        var attempts = 0
        let maxAttempts = 300 // Poll for up to 5 minutes
        
        // Wait 30 seconds before first check to give server time to process
        // This prevents false positives from matching old videos or videos that appear in DynamoDB
        // before processing is actually complete
        print("⏳ [NotificationService] Waiting 30 seconds before starting polling for streamKey: \(streamKey)")
        print("   This gives the server time to process the video and prevents false 'ready' notifications")
        try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
        print("✅ [NotificationService] Starting polling for streamKey: \(streamKey)")
        
        // Then check every 5 seconds for reasonable detection speed
        let pollInterval: UInt64 = 5_000_000_000 // 5 seconds
        
        while attempts < maxAttempts && !Task.isCancelled {
            do {
                // Wait between polls
                if attempts > 0 {
                    try await Task.sleep(nanoseconds: pollInterval)
                }
                attempts += 1
                
                print("🔄 [NotificationService] Poll attempt \(attempts) for streamKey: \(streamKey)")
                
                // ALWAYS check channel content first (channel content is source of truth)
                // This ensures we detect videos immediately when they appear in the channel
                // Start checking after attempt 3 (after initial 30s wait + 3 polls = ~45 seconds total)
                // This ensures video has had time to be fully processed
                if attempts >= 3 {
                    print("   🔄 [Poll attempt \(attempts)] Checking channel content directly (source of truth)...")
                    if let channelContent = try? await checkChannelContentForStream(
                        streamKey: streamKey,
                        channelName: channelName,
                        creatorEmail: userEmail
                    ) {
                        print("   ✅ Found video in channel content! Video is ready!")
                        let result = await handleVideoReady(
                            streamKey: streamKey,
                            channelName: channelName,
                            userEmail: userEmail,
                            videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                        )
                        if result {
                            print("   ✅ Polling complete - video is ready!")
                            break
                        }
                    } else {
                        print("   ⏳ Channel content check: video not ready yet")
                    }
                }
                
                // Check if video is ready via check-stream-file API
                guard let url = URL(string: "https://twilly.app/api/files/check-stream-file") else {
                    continue
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "userEmail": userEmail,
                    "streamKey": streamKey
                ]
                
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                if let httpResponse = response as? HTTPURLResponse {
                    print("🔍 [NotificationService] Poll attempt \(attempts): status=\(httpResponse.statusCode), streamKey=\(streamKey)")
                    
                    if httpResponse.statusCode == 200,
                       let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        let exists = json["exists"] as? Bool ?? false
                        let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
                        let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
                        let isVisible = json["isVisible"] as? Bool ?? false
                        let fileId = json["fileId"] as? String
                        
                        print("   📊 Response: exists=\(exists), hasHlsUrl=\(hasHlsUrl), hasThumbnail=\(hasThumbnail), isVisible=\(isVisible), fileId=\(fileId ?? "nil")")
                        
                        if exists && hasHlsUrl && hasThumbnail {
                            // Video is ready via check-stream-file API
                            let result = await handleVideoReady(
                                streamKey: streamKey,
                                channelName: channelName,
                                userEmail: userEmail,
                                videoId: fileId ?? videoId
                            )
                            if result {
                                break
                            }
                        } else {
                            // Log why video is not ready yet
                            if exists {
                                if !hasHlsUrl {
                                    print("   ⏳ Video exists but HLS URL not ready yet (checking channel content as fallback...)")
                                    // Check channel content - video might be ready there even if check-stream-file says HLS not ready
                                    if let channelContent = try? await checkChannelContentForStream(
                                        streamKey: streamKey,
                                        channelName: channelName,
                                        creatorEmail: userEmail
                                    ) {
                                        print("   ✅ Found video in channel content with HLS! Video is ready!")
                                        let result = await handleVideoReady(
                                            streamKey: streamKey,
                                            channelName: channelName,
                                            userEmail: userEmail,
                                            videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                        )
                                        if result {
                                            break
                                        }
                                    }
                                } else if !hasThumbnail {
                                    print("   ⏳ Video has HLS URL but thumbnail not ready yet (checking channel content as fallback...)")
                                    // Check channel content - video might be ready there even if check-stream-file says thumbnail not ready
                                    if let channelContent = try? await checkChannelContentForStream(
                                        streamKey: streamKey,
                                        channelName: channelName,
                                        creatorEmail: userEmail
                                    ) {
                                        print("   ✅ Found video in channel content with thumbnail! Video is ready!")
                                        let result = await handleVideoReady(
                                            streamKey: streamKey,
                                            channelName: channelName,
                                            userEmail: userEmail,
                                            videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                        )
                                        if result {
                                            break
                                        }
                                    }
                                }
                            } else {
                                print("   ⏳ check-stream-file says video does not exist (checking channel content immediately...)")
                                // Fallback: Check channel content API directly immediately
                                // Channel content API is the source of truth - if video appears there, it's ready
                                if let channelContent = try? await checkChannelContentForStream(
                                    streamKey: streamKey,
                                    channelName: channelName,
                                    creatorEmail: userEmail
                                ) {
                                    print("   ✅ Found video in channel content! Video is ready!")
                                    let result = await handleVideoReady(
                                        streamKey: streamKey,
                                        channelName: channelName,
                                        userEmail: userEmail,
                                        videoId: channelContent.SK.replacingOccurrences(of: "FILE#", with: "")
                                    )
                                    if result {
                                        break
                                    }
                                }
                            }
                        }
                    } else {
                        print("   ⚠️ Invalid response format or non-200 status")
                        if let responseString = String(data: data, encoding: .utf8) {
                            print("   📝 Response body: \(responseString)")
                        }
                    }
                } else {
                    print("   ⚠️ Invalid HTTP response type")
                    if let responseString = String(data: data, encoding: .utf8) {
                        print("   📝 Response: \(responseString)")
                    }
                }
            } catch {
                if !Task.isCancelled {
                    print("⚠️ [NotificationService] Error polling video (attempt \(attempts)): \(error.localizedDescription)")
                }
            }
        }
        
        // Timeout handling
        if attempts >= maxAttempts {
            await MainActor.run {
                // Remove processing notification
                if let processingNotification = notifications.first(where: {
                    $0.streamKey == streamKey && $0.type == .processing
                }) {
                    deleteNotification(processingNotification.id)
                }
                
                // Create error notification
                let errorNotification = StreamNotification(
                    id: UUID().uuidString,
                    type: .error,
                    title: "Processing Timeout",
                    message: "Video processing for \(channelName) is taking longer than expected. Please check back later.",
                    channelName: channelName,
                    streamKey: streamKey,
                    videoId: videoId,
                    createdAt: Date(),
                    isRead: false,
                    actionUrl: nil,
                    metadata: nil
                )
                addNotification(errorNotification)
                stopMonitoringVideo(streamKey: streamKey)
            }
        }
    }
    
    private func updateVideoVisibility(
        fileId: String,
        userEmail: String,
        isVisible: Bool
    ) async {
        do {
            guard let url = URL(string: "https://twilly.app/api/files/update-details") else {
                return
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "userId": userEmail,
                "fileId": fileId,
                "isVisible": isVisible
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                print("✅ [NotificationService] Video visibility updated successfully")
            }
        } catch {
            print("⚠️ [NotificationService] Error updating visibility: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Persistence
    
    private func saveNotifications() {
        if let encoded = try? JSONEncoder().encode(notifications) {
            userDefaults.set(encoded, forKey: notificationsKey)
        }
    }
    
    private func loadNotifications() {
        if let data = userDefaults.data(forKey: notificationsKey),
           let decoded = try? JSONDecoder().decode([StreamNotification].self, from: data) {
            notifications = decoded
            updateUnreadCount()
        }
    }
    
    private func updateUnreadCount() {
        // Binary indicator: 1 if ANY notification is unread, 0 if ALL are read
        // This ensures the inbox shows "1" until all usernames/conversations are cleared
        let hasAnyUnread = notifications.contains { !$0.isRead }
        unreadCount = hasAnyUnread ? 1 : 0
    }
    
    // MARK: - API Notification Fetching
    
    func fetchNotificationsFromAPI(userEmail: String) async {
        do {
            let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 50, unreadOnly: false)
            
            await MainActor.run {
                // Convert API notifications to StreamNotification format
                let apiNotifications = response.notifications ?? []
                var newNotifications: [StreamNotification] = []
                
                for apiNotif in apiNotifications {
                    // Determine notification type
                    var notificationType: StreamNotification.NotificationType = .videoReady
                    if apiNotif.type == "follow_request" {
                        notificationType = .followRequest
                    } else if apiNotif.type == "follow_accepted" {
                        notificationType = .followAccepted
                    } else if apiNotif.type == "follow_declined" {
                        notificationType = .followDeclined
                    } else if apiNotif.type == "video_ready" {
                        notificationType = .videoReady
                    } else if apiNotif.type == "processing" {
                        notificationType = .processing
                    } else if apiNotif.type == "error" {
                        notificationType = .error
                    } else if apiNotif.type == "comment_reply" {
                        notificationType = .commentReply
                    } else if apiNotif.type == "private_access_granted" {
                        notificationType = .privateAccessGranted
                    } else if apiNotif.type == "public_access_granted" {
                        notificationType = .publicAccessGranted
                    } else if apiNotif.type == "direct_stream_request" {
                        notificationType = .directStreamRequest
                    }
                    
                    // Parse createdAt date
                    let dateFormatter = ISO8601DateFormatter()
                    let createdAt = dateFormatter.date(from: apiNotif.createdAt) ?? Date()
                    
                    // Extract videoId and channelName from metadata for navigation
                    let videoId = apiNotif.metadata?["videoId"] ?? apiNotif.metadata?["fileId"]
                    let channelName = apiNotif.metadata?["channelName"] ?? "Twilly TV"
                    
                    // Build actionUrl for comment reply notifications to navigate to video
                    var actionUrl: String? = nil
                    if notificationType == .commentReply, let vidId = videoId {
                        // Format: video://videoId to navigate to the video
                        actionUrl = "video://\(vidId)"
                    } else if notificationType == .privateAccessGranted {
                        // For private access, navigate to the creator's channel
                        if let ownerUsername = apiNotif.metadata?["ownerUsername"] {
                            actionUrl = "channel://\(ownerUsername)"
                        }
                    } else if notificationType == .publicAccessGranted {
                        // For public access, navigate to the requester's channel (person who added them)
                        if let requesterUsername = apiNotif.metadata?["requesterUsername"] {
                            actionUrl = "channel://\(requesterUsername)"
                        }
                    }
                    
                    // Convert metadata to [String: String] format
                    var metadataDict: [String: String]? = nil
                    if let apiMetadata = apiNotif.metadata {
                        metadataDict = [:]
                        for (key, value) in apiMetadata {
                            metadataDict?[key] = String(describing: value)
                        }
                    }
                    
                    let streamNotif = StreamNotification(
                        id: apiNotif.id,
                        type: notificationType,
                        title: apiNotif.title ?? "Notification", // Provide default if title is missing
                        message: apiNotif.message,
                        channelName: channelName,
                        streamKey: nil,
                        videoId: videoId,
                        createdAt: createdAt,
                        isRead: apiNotif.isRead,
                        actionUrl: actionUrl,
                        metadata: metadataDict
                    )
                    
                    newNotifications.append(streamNotif)
                }
                
                // Merge with existing notifications (avoid duplicates)
                let existingIds = Set(notifications.map { $0.id })
                let uniqueNewNotifications = newNotifications.filter { !existingIds.contains($0.id) }
                
                if !uniqueNewNotifications.isEmpty {
                    notifications.append(contentsOf: uniqueNewNotifications)
                    saveNotifications()
                    updateUnreadCount()
                    print("✅ [NotificationService] Fetched \(uniqueNewNotifications.count) new notifications from API")
                    
                    // CRITICAL: Post notification if any new follow requests were received
                    let hasNewFollowRequest = uniqueNewNotifications.contains { $0.type == .followRequest }
                    if hasNewFollowRequest {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("NewFollowRequestReceived"),
                            object: nil
                        )
                        print("✅ [NotificationService] Posted NewFollowRequestReceived notification")
                    }
                }
            }
        } catch {
            print("❌ [NotificationService] Error fetching notifications from API: \(error.localizedDescription)")
        }
    }
    
    func markNotificationAsReadAPI(userEmail: String, notificationId: String) async {
        do {
            _ = try await ChannelService.shared.markNotificationRead(userEmail: userEmail, notificationId: notificationId)
            // Also mark locally
            await MainActor.run {
                markAsRead(notificationId)
            }
        } catch {
            print("❌ [NotificationService] Error marking notification as read: \(error.localizedDescription)")
        }
    }
}
