//
//  ChannelDetailView.swift
//  TwillyBroadcaster
//
//  View showing content for a specific channel
//

import SwiftUI
import AVKit
import AVFoundation
import UIKit
import WebKit

struct ChannelDetailView: View {
    let channel: DiscoverableChannel
    let forceRefresh: Bool // Force refresh content when true (e.g., after upload)
    let canStream: Bool // Whether user can stream to this channel
    let collaboratorChannels: [Channel] // Channels user can stream to
    let onInviteCodeAccepted: (() -> Void)? // Callback when invite code is accepted
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var userRoleService = UserRoleService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var currentChannel: DiscoverableChannel // Mutable channel for live updates
    @State private var content: [ChannelContent] = []
    @State private var isLoading = false
    @State private var isLoadingMore = false // Loading more items (pagination)
    @State private var errorMessage: String?
    @State private var selectedContent: ChannelContent?
    @State private var showingPlayer = false
    @State private var hasLoaded = false
    @State private var initialContentCount = 0 // Track initial count to detect new videos
    @State private var localVideoContent: ChannelContent? = nil // Local video shown immediately
    @State private var nextToken: String? = nil // Pagination token
    @State private var hasMoreContent = true // Whether there's more content to load
    @State private var isPollingForThumbnail = false // Whether we're polling for thumbnail
    @State private var thumbnailPollTask: Task<Void, Never>? = nil // Task for polling
    @State private var isUploadComplete = false // Whether upload is fully processed
    @State private var showingInviteCodeEntry = false // Show invite code entry sheet
    @State private var showingSettings = false // Show streamer settings
    @State private var showingUsernameSearch = false // Show username search/add sheet
    @State private var addedUsernames: [AddedUsername] = [] // List of added usernames for Twilly TV
    @State private var isLoadingAddedUsernames = false
    @State private var usernameSearchText = "" // Search text for inline search
    @State private var usernameSearchResults: [UsernameSearchResult] = [] // Search results
    @State private var isSearchingUsernames = false // Whether search is in progress
    @State private var showSearchDropdown = false // Show search results dropdown
    @State private var searchTask: Task<Void, Never>? = nil // Debounce task for search
    @State private var showAddedUsernamesDropdown = false // Show added usernames dropdown
    @State private var addingUsernames: Set<String> = [] // Track which usernames are currently being added
    @State private var searchVisibilityFilter: String = "public" // Filter: "all", "public", "private" (default: "public")
    @State private var sentFollowRequests: [SentFollowRequest] = [] // Track follow requests sent by current user
    @State private var isLoadingSentRequests = false
    @State private var addedUsernamesSearchText = "" // Search text for filtering added usernames
    @State private var addedUsernamesVisibilityFilter: String = "public" // Filter: "all", "public", "private" (default: "public")
    @State private var autoRefreshTask: Task<Void, Never>? = nil // Task for auto-refreshing content
    @State private var hasSelectedTimeslot = false // Whether user has selected a timeslot
    @State private var allTimeslotsFilled = false // Whether all timeslots are filled
    @State private var refreshMessage: String? = nil // Message to show after refresh
    @State private var creatorAirSchedule: [String: (day: String, time: String)] = [:] // Map of creatorEmail -> (airDay, airTime)
    @State private var userScheduleLocked = false // Whether current user has schedule locked
    @State private var userSchedulePaused = false // Whether current user's schedule is paused
    @State private var userPostAutomatically = false // Whether current user has post automatically enabled
    @State private var showOnlyOwnContent = false // Filter to show only user's own content
    @State private var showPrivateContent = false // Filter to show private content (default: show public)
    @State private var isFilteringContent = false // Loading state when filtering content
    @State private var originalUnfilteredContent: [ChannelContent] = [] // Store original content for instant filter toggle
    @State private var filteredOwnContent: [ChannelContent] = [] // Separate list for owner's videos - always maintained
    @State private var contentToDelete: ChannelContent? = nil // Content item to delete
    @State private var showingDeleteConfirmation = false // Show delete confirmation alert
    @State private var isDeleting = false // Whether delete is in progress
    @State private var showingEditModal = false // Show edit modal
    @State private var editingContent: ChannelContent? = nil // Content being edited
    @State private var editingTitle: String = "" // Title being edited
    @State private var isUpdatingContent = false // Whether update is in progress
    @State private var showingContentManagementPopup = false // Show content management popup (title + delete)
    @State private var managingContent: ChannelContent? = nil // Content being managed
    @State private var showingTitleField = false // Whether to show the title input field
    // Removed placeholder and polling logic - using notification system instead
    // Removed scheduling - only done from web app
    
    init(
        channel: DiscoverableChannel,
        forceRefresh: Bool = false,
        canStream: Bool = true,
        collaboratorChannels: [Channel] = [],
        onInviteCodeAccepted: (() -> Void)? = nil
    ) {
        self.channel = channel
        self._currentChannel = State(initialValue: channel) // Initialize state with channel
        self.forceRefresh = forceRefresh
        self.canStream = canStream
        self.collaboratorChannels = collaboratorChannels
        self.onInviteCodeAccepted = onInviteCodeAccepted
        
        // Log channel details when view is initialized
        print("🎬 [ChannelDetailView] Initialized with channel:")
        print("   Channel Name: \(channel.channelName)")
        print("   Channel ID: \(channel.channelId)")
        print("   Creator Email: \(channel.creatorEmail)")
        print("   Creator Username: \(channel.creatorUsername)")
        print("   Poster URL: \(channel.posterUrl.isEmpty ? "EMPTY" : channel.posterUrl)")
        if !channel.posterUrl.isEmpty {
            print("   Poster URL length: \(channel.posterUrl.count) characters")
            if let url = URL(string: channel.posterUrl) {
                print("   ✅ Poster URL is valid")
                print("   URL scheme: \(url.scheme ?? "nil")")
                print("   URL host: \(url.host ?? "nil")")
            } else {
                print("   ❌ Poster URL is INVALID - cannot parse")
            }
        }
    }
    
    var body: some View {
        ZStack {
            backgroundGradient
            VStack(spacing: 0) {
                // Fixed header section (poster + search bar)
                fixedHeaderSection
                    .background(
                        ZStack {
                            backgroundGradient
                            Color.black.opacity(0.95) // Solid background to cover scrolling content
                        }
                    )
                    .zIndex(1) // Ensure it stays on top
                    .frame(maxWidth: .infinity, alignment: .top)
                
                // Scrollable content section (videos)
                scrollableContentSection
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(currentChannel.channelName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarLeading) {
                // Filter icon - only show for Twilly TV channel
                if currentChannel.channelName.lowercased() == "twilly tv" {
                    Button(action: {
                        withAnimation {
                            showOnlyOwnContent.toggle()
                        }
                        // Instantly switch between filtered and unfiltered lists
        if showOnlyOwnContent {
            filteredSortedContent = filteredOwnContent
            print("🔍 [ChannelDetailView] Filtering to own content: \(filteredSortedContent.count) items")
        }
        }
        
        // CRITICAL: Preserve titles from existing content when server version is nil/empty
        // This prevents titles from disappearing after being edited
        let contentWithPreservedTitles = filteredSortedContent.map { serverItem -> ChannelContent in
            // Find matching item in existing content by SK
            if let existingItem = content.first(where: { $0.SK == serverItem.SK }) {
                // If existing item has a title and server item doesn't, preserve the existing title
                let existingTitle = existingItem.title?.trimmingCharacters(in: .whitespaces) ?? ""
                let serverTitle = serverItem.title?.trimmingCharacters(in: .whitespaces) ?? ""
                
                if !existingTitle.isEmpty && serverTitle.isEmpty {
                    // Preserve existing title - server hasn't updated yet
                    print("🔒 [ChannelDetailView] Preserving existing title '\(existingTitle)' for \(serverItem.fileName) (server title is empty)")
                    return ChannelContent(
                        SK: serverItem.SK,
                        fileName: serverItem.fileName,
                        title: existingItem.title, // Preserve existing title
                        description: serverItem.description ?? existingItem.description,
                        hlsUrl: serverItem.hlsUrl ?? existingItem.hlsUrl,
                        thumbnailUrl: serverItem.thumbnailUrl ?? existingItem.thumbnailUrl,
                        createdAt: serverItem.createdAt ?? existingItem.createdAt,
                        isVisible: serverItem.isVisible ?? existingItem.isVisible,
                        price: serverItem.price ?? existingItem.price,
                        category: serverItem.category ?? existingItem.category,
                        uploadId: serverItem.uploadId ?? existingItem.uploadId,
                        fileId: serverItem.fileId ?? existingItem.fileId,
                        airdate: serverItem.airdate ?? existingItem.airdate,
                        creatorUsername: serverItem.creatorUsername ?? existingItem.creatorUsername,
                        isPrivateUsername: serverItem.isPrivateUsername ?? existingItem.isPrivateUsername,
                        localFileURL: serverItem.localFileURL ?? existingItem.localFileURL
                    )
                }
            }
            // No existing item or server has a title - use server item as-is
            return serverItem
        }
        
        content = contentWithPreservedTitles
        isLoading = false
        hasLoaded = true
        
        print("✅ [ChannelDetailView] ========== FINAL CONTENT STATE ==========")
        print("✅ [ChannelDetailView] content.count: \(content.count)")
        print("✅ [ChannelDetailView] isLoading: \(isLoading), hasLoaded: \(hasLoaded)")
        
        // Log final sorted order (newest first)
        print("📋 [ChannelDetailView] Final sorted order (newest first):")
        for (index, item) in sortedContent.enumerated() {
            let dateStr = item.airdate ?? item.createdAt ?? "NO DATE"
            print("   [\(index)] \(item.fileName) - date: \(dateStr)")
        }
        
        // Summary: Show what videos are displayed and why
        if content.count > 1 {
            print("📊 [ChannelDetailView] SUMMARY: Showing \(content.count) different videos:")
            for (index, item) in content.enumerated() {
                let dateStr = item.createdAt ?? "unknown date"
                let isNew = index == 0 ? " (🆕 NEWEST)" : ""
                print("   \(index + 1). \(item.fileName) - Created: \(dateStr)\(isNew)")
            }
            print("   ℹ️ These are \(content.count) DIFFERENT videos, not duplicates.")
            print("   ℹ️ Each has a unique ID: \(content.map { $0.id }.joined(separator: ", "))")
        } else if content.count == 1 {
            print("📊 [ChannelDetailView] SUMMARY: Showing 1 video: \(content[0].fileName)")
        } else {
            print("📊 [ChannelDetailView] SUMMARY: No videos to display")
        }
        
        // Check for duplicates in final content array
        var seenIdsFinal = Set<String>()
        var duplicateIdsFinal: [String] = []
        var duplicateFileNamesFinal: [String] = []
        var seenFileNamesFinal = Set<String>()
        
        for item in content {
            // Check duplicate IDs
            if seenIdsFinal.contains(item.id) {
                duplicateIdsFinal.append(item.id)
                print("⚠️ [ChannelDetailView] DUPLICATE ID in final content array: \(item.id) (fileName: \(item.fileName))")
            } else {
                seenIdsFinal.insert(item.id)
            }
            
            // Check duplicate fileNames (might indicate same video with different IDs)
            if seenFileNamesFinal.contains(item.fileName) {
                duplicateFileNamesFinal.append(item.fileName)
                print("⚠️ [ChannelDetailView] DUPLICATE FILENAME in final content array: \(item.fileName) (SK: \(item.SK))")
            } else {
                seenFileNamesFinal.insert(item.fileName)
            }
        }
        
        if !duplicateIdsFinal.isEmpty {
            print("⚠️ [ChannelDetailView] ⚠️⚠️⚠️ FOUND \(duplicateIdsFinal.count) DUPLICATE ID(S) IN FINAL CONTENT: \(duplicateIdsFinal)")
        }
        if !duplicateFileNamesFinal.isEmpty {
            print("⚠️ [ChannelDetailView] ⚠️⚠️⚠️ FOUND \(duplicateFileNamesFinal.count) DUPLICATE FILENAME(S) IN FINAL CONTENT: \(duplicateFileNamesFinal)")
        }
        
        if content.isEmpty {
            print("❌ [ChannelDetailView] CRITICAL: content array is EMPTY after updateContentWith!")
            print("   filteredFetchedContent.count: \(filteredFetchedContent.count)")
            print("   localVideoContent: \(localVideoContent != nil ? "exists" : "nil")")
            if !filteredFetchedContent.isEmpty {
                print("   First filtered item: \(filteredFetchedContent[0].fileName)")
            }
        } else {
            print("✅ [ChannelDetailView] Content array has \(content.count) items")
            print("📋 [ChannelDetailView] === FINAL CONTENT LIST (as displayed) ===")
            // Log all final content items with full details
            for (index, item) in content.enumerated() {
                let isNew = index == 0 ? "🆕 NEW" : ""
                print("   [\(index)] \(isNew) \(item.fileName)")
                print("       SK/id: \(item.SK) / \(item.id)")
                print("       hlsUrl: \(item.hlsUrl != nil && !item.hlsUrl!.isEmpty ? "✅ \(item.hlsUrl!.prefix(50))..." : "❌ nil")")
                print("       thumbnailUrl: \(item.thumbnailUrl != nil && !item.thumbnailUrl!.isEmpty ? "✅" : "❌ nil")")
                print("       createdAt: \(item.createdAt ?? "nil")")
                print("       isVisible: \(item.isVisible ?? true)")
                print("       category: \(item.category ?? "nil")")
                print("       creatorUsername: \(item.creatorUsername ?? "nil")")
                print("       uploadId: \(item.uploadId ?? "nil")")
                print("       fileId: \(item.fileId ?? "nil")")
                print("       localFileURL: \(item.localFileURL != nil ? "✅" : "nil")")
                print("       ---")
            }
        }
        print("🔄 [ChannelDetailView] ========== UPDATE CONTENT END ==========")
    }
    
    // Start polling for thumbnail and HLS availability
    private func startThumbnailPolling() {
        guard let localContent = localVideoContent else {
            // No local content to poll for
            return
        }
        
        // Only start polling if we don't already have both thumbnail and HLS
        if localContent.thumbnailUrl != nil && localContent.hlsUrl != nil {
            // Already has both - no need to poll
            return
        }
        
        // Cancel any existing polling task
        thumbnailPollTask?.cancel()
        
        print("🔄 [ChannelDetailView] Starting thumbnail polling for local video...")
        isPollingForThumbnail = true
        
        thumbnailPollTask = Task {
            var attempts = 0
            let maxAttempts = 120 // Poll for up to 2 minutes (HLS processing can take time)
            
            // CRITICAL: Check immediately first (don't wait 1 second) - thumbnail might already be ready
            var shouldWait = false
            
            while attempts < maxAttempts && !Task.isCancelled {
                do {
                    // Wait 1 second between polls (but not before first check)
                    if shouldWait {
                        try await Task.sleep(nanoseconds: 1_000_000_000)
                    }
                    shouldWait = true
                    
                    // Fetch content to check if thumbnail is available
                    // For Twilly TV, pass viewerEmail to filter by added usernames
                    let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
                    let result = try await channelService.fetchChannelContent(
                        channelName: currentChannel.channelName,
                        creatorEmail: currentChannel.creatorEmail,
                        viewerEmail: viewerEmail,
                        limit: 5, // Only fetch first few items
                        nextToken: nil,
                        showPrivateContent: showPrivateContent
                    )
                    
                    // Check if server has our video
                    // Match by uploadId/fileId first (most reliable), then by title/description/price, then by most recent
                    let serverVideo: ChannelContent? = {
                        // First, try to match by uploadId/fileId if we have it stored
                        // (We don't store uploadId in localContent, but we can check if server video has it)
                        
                        // Second, try to match by title/description/price (with proper nil/empty/whitespace handling)
                        if let match = result.content.first(where: { serverItem in
                            // Normalize strings for comparison (handle nil, empty, and whitespace)
                            let localTitle = (localContent.title ?? "").trimmingCharacters(in: .whitespaces)
                            let serverTitle = (serverItem.title ?? "").trimmingCharacters(in: .whitespaces)
                            let localDesc = (localContent.description ?? "").trimmingCharacters(in: .whitespaces)
                            let serverDesc = (serverItem.description ?? "").trimmingCharacters(in: .whitespaces)
                            
                            let titleMatch = localTitle.isEmpty && serverTitle.isEmpty || localTitle == serverTitle
                            let descMatch = localDesc.isEmpty && serverDesc.isEmpty || localDesc == serverDesc
                            let priceMatch = (localContent.price == nil && serverItem.price == nil) || serverItem.price == localContent.price
                            
                            let isMatch = titleMatch && descMatch && priceMatch
                            
                            if isMatch {
                                print("🎯 [ChannelDetailView] Found matching video in polling - title: '\(serverTitle)', desc: '\(serverDesc.prefix(20))...', price: \(serverItem.price ?? 0)")
                            }
                            
                            return isMatch
                        }) {
                            return match
                        }
                        
                        // Third, if all metadata is nil/empty, match by most recent video with thumbnail
                        let localHasNoMetadata = (localContent.title == nil || localContent.title!.isEmpty) &&
                                               (localContent.description == nil || localContent.description!.isEmpty) &&
                                               localContent.price == nil
                        
                        if localHasNoMetadata {
                            // Find most recent video with thumbnail (likely our upload)
                            return result.content
                                .filter { $0.thumbnailUrl != nil && !$0.thumbnailUrl!.isEmpty }
                                .sorted { item1, item2 in
                                    // Sort by createdAt (newest first)
                                    let date1 = item1.createdAt ?? ""
                                    let date2 = item2.createdAt ?? ""
                                    return date1 > date2
                                }
                                .first
                        }
                        
                        return nil
                    }()
                    
                    // Debug: Log what we're looking for and what we found
                    if serverVideo == nil {
                        print("⚠️ [ChannelDetailView] No matching server video found in polling attempt \(attempts)")
                        print("   - Looking for local video with:")
                        print("     title: '\(localContent.title ?? "nil")'")
                        print("     description: '\(localContent.description?.prefix(30) ?? "nil")...'")
                        print("     price: \(localContent.price ?? 0)")
                        print("   - Server returned \(result.content.count) videos:")
                        for (index, item) in result.content.enumerated() {
                            print("     [\(index)] title: '\(item.title ?? "nil")', desc: '\(item.description?.prefix(20) ?? "nil")...', price: \(item.price ?? 0), hasThumbnail: \(item.thumbnailUrl != nil)")
                        }
                    }
                    
                    if let serverVideo = serverVideo {
                        let hasThumbnail = serverVideo.thumbnailUrl != nil && !serverVideo.thumbnailUrl!.isEmpty
                        let hasHLS = serverVideo.hlsUrl != nil && !serverVideo.hlsUrl!.isEmpty
                        
                        print("🔍 [ChannelDetailView] Polling found server video - hasThumbnail: \(hasThumbnail), hasHLS: \(hasHLS)")
                        print("   - Server title: '\(serverVideo.title ?? "nil")'")
                        print("   - Server description: '\(serverVideo.description?.prefix(30) ?? "nil")...'")
                        print("   - Server price: \(serverVideo.price ?? 0)")
                        print("   - Server thumbnailUrl: \(serverVideo.thumbnailUrl ?? "nil")")
                        
                        // Update if we have thumbnail (even if HLS isn't ready yet)
                        if hasThumbnail {
                            // Thumbnail is available! Update local content with thumbnail
                            await MainActor.run {
                                // Always update local content with thumbnail first (keep local file for playback)
                                // CRITICAL: Keep the same SK/id so SwiftUI recognizes it as the same item
                                var updatedContent = ChannelContent(
                                    SK: localContent.SK, // Keep original SK to maintain same id
                                    fileName: localContent.fileName, // Keep original fileName
                                    title: serverVideo.title ?? localContent.title,
                                    description: serverVideo.description ?? localContent.description,
                                    hlsUrl: serverVideo.hlsUrl,
                                    thumbnailUrl: serverVideo.thumbnailUrl, // Update thumbnail
                                    createdAt: localContent.createdAt, // Keep original createdAt
                                    isVisible: localContent.isVisible ?? true,
                                    price: serverVideo.price ?? localContent.price,
                                    category: localContent.category ?? "Videos",
                                    localFileURL: localContent.localFileURL // Keep local file URL for playback
                                )
                                localVideoContent = updatedContent
                                
                                // Update content array - force UI refresh by replacing entire array
                                if let index = content.firstIndex(where: { $0.id == localContent.id }) {
                                    var updatedArray = content
                                    updatedArray[index] = updatedContent
                                    content = updatedArray // Update array - SwiftUI should detect change
                                    print("✅ [ChannelDetailView] Content updated with thumbnail in polling - UI should refresh")
                                    print("   - Updated thumbnailUrl: \(updatedContent.thumbnailUrl ?? "nil")")
                                    print("   - Content array count: \(content.count)")
                                } else {
                                    print("⚠️ [ChannelDetailView] Could not find local content in array to update!")
                                }
                                
                                // Check if HLS is ready - if so, remove local version and use server version
                                if hasHLS {
                                    // HLS is ready - remove local version and use server version
                                    print("✅ [ChannelDetailView] HLS is ready - removing local version, using server version")
                                    
                                    // Remove local video from content array
                                    content = content.filter { $0.id != localContent.id }
                                    
                                    // Delete local file
                                    if let localURL = localContent.localFileURL {
                                        try? FileManager.default.removeItem(at: localURL)
                                        print("🗑️ [ChannelDetailView] Deleted local video file: \(localURL.lastPathComponent)")
                                    }
                                    
                                    // Clear local video content
                                    localVideoContent = nil
                                    
                                    // Add server video to content if not already present
                                    if !content.contains(where: { $0.id == serverVideo.id }) {
                                        content.insert(serverVideo, at: 0) // Insert at top
                                    }
                                    
                                    isUploadComplete = true
                                    isPollingForThumbnail = false
                                    print("✅ [ChannelDetailView] Upload complete! Video has HLS URL and thumbnail")
                                } else {
                                    print("✅ [ChannelDetailView] Thumbnail found and updated! Waiting for HLS to process...")
                                }
                            }
                            
                            // If HLS is ready, stop polling. Otherwise, continue polling for HLS
                            if hasHLS {
                                return // Stop polling - everything is ready
                            }
                            // Continue polling for HLS
                        }
                    } else {
                        // Video not found on server yet - continue polling
                        print("⏳ [ChannelDetailView] Video not found on server yet (attempt \(attempts)/\(maxAttempts))...")
                    }
                    
                    attempts += 1
                } catch {
                    if !Task.isCancelled {
                        print("❌ [ChannelDetailView] Error polling for thumbnail: \(error.localizedDescription)")
                    }
                    break
                }
            }
            
            // Polling finished (timeout or cancelled)
            await MainActor.run {
                isPollingForThumbnail = false
                if attempts >= maxAttempts {
                    print("⏰ [ChannelDetailView] Thumbnail polling timeout - thumbnail may appear later")
                }
            }
        }
    }
    
    // Clean up polling when view disappears
    private func stopThumbnailPolling() {
        thumbnailPollTask?.cancel()
        thumbnailPollTask = nil
        isPollingForThumbnail = false
    }
    
    // Auto-refresh content and channel metadata to check for new videos and poster updates
    private func startAutoRefresh() {
        // Cancel existing task if any
        autoRefreshTask?.cancel()
        
        autoRefreshTask = Task {
            // Wait 10 seconds before first refresh (give backend time to process)
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            
            // Then refresh every 15 seconds
            while !Task.isCancelled {
                await MainActor.run {
                    print("🔄 [ChannelDetailView] Auto-refreshing content and channel metadata...")
                    // Refresh both content and channel metadata without showing loading spinner
                    let previousCount = content.count
                    Task {
                        do {
                            // Refresh channel metadata (poster) and content in parallel
                            async let channelTask = refreshChannelMetadata()
                            async let contentTask = refreshChannelContent()
                            
                            let channelUpdated = try await channelTask
                            let contentResult = try await contentTask
                            
                            await MainActor.run {
                                if channelUpdated {
                                    print("✅ [ChannelDetailView] Channel poster updated via auto-refresh")
                                }
                                
                                if let result = contentResult {
                                    let newCount = result.content.count
                                    if newCount > previousCount {
                                        print("✅ [ChannelDetailView] Found \(newCount - previousCount) new video(s)")
                                    }
                                    updateContentWith(result.content, replaceLocal: false)
                                    nextToken = result.nextToken
                                    hasMoreContent = result.hasMore
                                }
                            }
                        } catch {
                            print("⚠️ [ChannelDetailView] Auto-refresh error: \(error.localizedDescription)")
                        }
                    }
                }
                
                // Wait 15 seconds before next refresh
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
    }
    
    private func stopAutoRefresh() {
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
    }
    
    // Check and delete videos under 6 seconds
    private func checkAndDeleteShortVideos() async {
        guard let userEmail = authService.userEmail else {
            print("❌ [ChannelDetailView] Cannot check short videos - missing user email")
            return
        }
        
        print("🔍 [ChannelDetailView] Checking for short videos to delete...")
        
        // Check each video's duration and delete if < 6 seconds
        for item in content {
            // Only check video content
            guard item.category == "Videos" || item.category == nil else { continue }
            
            // Skip if no HLS URL (can't check duration)
            guard let hlsUrl = item.hlsUrl, !hlsUrl.isEmpty, let url = URL(string: hlsUrl) else { continue }
            
            // Get video duration
            let asset = AVAsset(url: url)
            do {
                let duration = try await asset.load(.duration)
                let durationSeconds = CMTimeGetSeconds(duration)
                
                if durationSeconds < 6.0 {
                    print("🚫 [ChannelDetailView] Found short video: \(item.fileName), duration: \(String(format: "%.2f", durationSeconds))s - deleting permanently")
                    
                    // Delete the video
                    do {
                        let response = try await ChannelService.shared.deleteFile(
                            userId: userEmail,
                            fileId: item.SK,
                            fileName: item.fileName,
                            folderName: nil
                        )
                        
                        if response.success {
                            print("✅ [ChannelDetailView] Successfully deleted short video: \(item.fileName)")
                            // Remove from local content array immediately
                            await MainActor.run {
                                content.removeAll { $0.id == item.id }
                            }
                        } else {
                            print("❌ [ChannelDetailView] Failed to delete short video: \(response.message ?? "Unknown error")")
                        }
                    } catch {
                        print("❌ [ChannelDetailView] Error deleting short video: \(error.localizedDescription)")
                    }
                }
            } catch {
                print("⚠️ [ChannelDetailView] Could not load duration for \(item.fileName): \(error.localizedDescription)")
                // Continue checking other videos
            }
        }
    }
    
    // Delete content - ensures only one item is deleted at a time
    private func deleteContent(item: ChannelContent) {
        // Prevent multiple simultaneous deletions
        guard !isDeleting else {
            print("⚠️ [ChannelDetailView] Delete already in progress, ignoring duplicate request")
            return
        }
        
        guard let userEmail = authService.userEmail else {
            print("❌ [ChannelDetailView] Cannot delete - missing user email")
            return
        }
        
        // Validate required fields
        guard !item.SK.isEmpty, !item.fileName.isEmpty else {
            print("❌ [ChannelDetailView] Cannot delete - missing fileId or fileName")
            errorMessage = "Invalid video data - cannot delete"
            return
        }
        
        // SK and fileName are non-optional in ChannelContent
        let fileId = item.SK
        let fileName = item.fileName
        let itemId = item.id // Store unique ID to ensure we only remove the exact item
        
        print("🗑️ [ChannelDetailView] Starting delete for: \(fileName) (ID: \(itemId), fileId: \(fileId))")
        
        isDeleting = true
        contentToDelete = item // Set this to prevent UI from allowing another delete
        
        Task {
            do {
                let response = try await ChannelService.shared.deleteFile(
                    userId: userEmail,
                    fileId: fileId,
                    fileName: fileName,
                    folderName: nil // folderName is optional - ChannelContent doesn't have this property
                )
                
                await MainActor.run {
                    isDeleting = false
                    
                    if response.success {
                        // Remove ONLY the specific item by its unique ID
                        let beforeCount = content.count
                        content.removeAll { $0.id == itemId }
                        let afterCount = content.count
                        
                        if beforeCount == afterCount {
                            print("⚠️ [ChannelDetailView] Item not found in content array after delete - may have already been removed")
                        } else {
                            print("✅ [ChannelDetailView] Deleted content: \(fileName) (removed \(beforeCount - afterCount) item(s))")
                        }
                        
                        contentToDelete = nil
                        
                        // Refresh content to get updated list from server
                        Task {
                            try? await refreshChannelContent()
                        }
                    } else {
                        print("❌ [ChannelDetailView] Delete failed: \(response.message ?? "Unknown error")")
                        errorMessage = response.message ?? "Failed to delete video"
                        contentToDelete = nil
                    }
                }
            } catch {
                await MainActor.run {
                    isDeleting = false
                    contentToDelete = nil
                    
                    // Better error handling
                    if let channelError = error as? ChannelServiceError {
                        switch channelError {
                        case .invalidURL:
                            errorMessage = "Invalid server URL - please check your connection"
                        case .invalidResponse:
                            errorMessage = "Server error - please try again later"
                        case .serverError(let message):
                            errorMessage = message
                        }
                    } else if let nsError = error as? NSError {
                        // Handle NSError with specific error codes
                        if nsError.domain == "ChannelService" {
                            errorMessage = nsError.localizedDescription
                        } else {
                            errorMessage = "Error deleting video: \(nsError.localizedDescription)"
                        }
                    } else {
                        errorMessage = "Error deleting video: \(error.localizedDescription)"
                    }
                    
                    print("❌ [ChannelDetailView] Delete error: \(error.localizedDescription)")
                    print("   Error type: \(type(of: error))")
                }
            }
        }
    }
    
    // Edit content modal
    private var editContentModal: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Header
                        VStack(spacing: 8) {
                            Text("Edit Video Title")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            
                            if let content = editingContent {
                                // Never show raw m3u8 filename - show cleaned title or fallback
                                let displayName = (content.title?.trimmingCharacters(in: .whitespaces).isEmpty == false) 
                                    ? ContentCard.cleanTitle(content.title ?? "") 
                                    : "Untitled Video"
                                Text(displayName)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.top, 20)
                        
                        // Form
                        VStack(spacing: 20) {
                            // Title field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Title")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                TextField("Enter title", text: $editingTitle)
                                    .textFieldStyle(.plain)
                                    .padding(12)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(8)
                                    .foregroundColor(.white)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                                    )
                                    .onChange(of: editingTitle) { newValue in
                                        // Limit to 50 characters to fit on one line
                                        if newValue.count > 50 {
                                            editingTitle = String(newValue.prefix(50))
                                        }
                                    }
                            }
                            
                        }
                        .padding(.horizontal, 20)
                        
                        // Save button
                        Button(action: {
                            updateContentDetails()
                        }) {
                            HStack {
                                if isUpdatingContent {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Save Changes")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                LinearGradient(
                                    colors: [.twillyTeal, .twillyCyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isUpdatingContent || editingTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(isUpdatingContent || editingTitle.trimmingCharacters(in: .whitespaces).isEmpty ? 0.6 : 1.0)
                        .padding(.horizontal, 20)
                        .padding(.top, 10)
                    }
                    .padding(.bottom, 40)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showingEditModal = false
                        editingContent = nil
                        editingTitle = ""
                    }
                    .foregroundColor(.white)
                }
            }
        }
    }
    
    // Content Management Popup (Title + Delete) - Simple popup style
    private var contentManagementPopup: some View {
        ZStack {
            // Semi-transparent background overlay
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    showingContentManagementPopup = false
                    managingContent = nil
                    editingTitle = ""
                    showingTitleField = false
                }
            
            // Popup card
            VStack(spacing: 0) {
                // Header with close button
                HStack {
                    // Show title if it exists, otherwise show nothing
                    if let title = managingContent?.title, !title.isEmpty {
                        Text(title)
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        showingContentManagementPopup = false
                        managingContent = nil
                        editingTitle = ""
                        showingTitleField = false
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.gray)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 16)
                
                Divider()
                    .background(Color.white.opacity(0.2))
                
                // Content
                VStack(spacing: 20) {
                    // Title field - always shown when popup is open
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Enter title...", text: $editingTitle)
                            .foregroundColor(.white)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 16)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(10)
                            .padding(.horizontal, 20)
                            .onChange(of: editingTitle) { newValue in
                                // Limit to 50 characters
                                if newValue.count > 50 {
                                    editingTitle = String(newValue.prefix(50))
                                }
                            }
                    }
                    .padding(.top, 20)
                    
                    // Action buttons
                    VStack(spacing: 12) {
                        // Save button
                        Button(action: {
                            saveContentTitle()
                        }) {
                            HStack {
                                if isUpdatingContent {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Save Title")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                LinearGradient(
                                    colors: [.twillyTeal, .twillyCyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isUpdatingContent || editingTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(isUpdatingContent || editingTitle.trimmingCharacters(in: .whitespaces).isEmpty ? 0.6 : 1.0)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
            }
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 0.1, green: 0.1, blue: 0.15),
                        Color.black
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(20)
            .padding(.horizontal, 24)
            .frame(maxWidth: 400)
        }
    }
    
    // Save content title (optimistic update)
    private func saveContentTitle() {
        guard let content = managingContent,
              let userEmail = authService.userEmail else {
            print("❌ [ChannelDetailView] Cannot save - missing content or user email")
            return
        }
        
        let trimmedTitle = editingTitle.trimmingCharacters(in: .whitespaces)
        
        // OPTIMISTIC UPDATE: Update UI immediately before API call
        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
            let updatedItem = ChannelContent(
                SK: self.content[index].SK,
                fileName: self.content[index].fileName,
                title: trimmedTitle.isEmpty ? nil : trimmedTitle,
                description: self.content[index].description,
                hlsUrl: self.content[index].hlsUrl,
                thumbnailUrl: self.content[index].thumbnailUrl,
                createdAt: self.content[index].createdAt,
                isVisible: self.content[index].isVisible,
                price: self.content[index].price,
                category: self.content[index].category,
                uploadId: self.content[index].uploadId,
                fileId: self.content[index].fileId,
                airdate: self.content[index].airdate,
                creatorUsername: self.content[index].creatorUsername,
                localFileURL: self.content[index].localFileURL
            )
            self.content[index] = updatedItem
            print("✅ [ChannelDetailView] Optimistic update - showing title immediately: '\(trimmedTitle)'")
        }
        
        // Close popup immediately so user sees the update
        showingContentManagementPopup = false
        managingContent = nil
        editingTitle = ""
        showingTitleField = false
        
        isUpdatingContent = true
        
        Task {
            do {
                let response = try await ChannelService.shared.updateFileDetails(
                    fileId: content.SK,
                    userId: userEmail,
                    title: trimmedTitle.isEmpty ? nil : trimmedTitle,
                    description: nil,
                    price: nil,
                    isVisible: nil,
                    airdate: nil
                )
                
                await MainActor.run {
                    isUpdatingContent = false
                    
                    if response.success {
                        // Update with confirmed data from server
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            let serverTitle: String?
                            if let data = response.data, let titleValue = data["title"] {
                                if let stringValue = titleValue.value as? String, !stringValue.isEmpty {
                                    serverTitle = stringValue
                                } else {
                                    serverTitle = trimmedTitle.isEmpty ? nil : trimmedTitle
                                }
                            } else {
                                serverTitle = trimmedTitle.isEmpty ? nil : trimmedTitle
                            }
                            
                            let confirmedItem = ChannelContent(
                                SK: self.content[index].SK,
                                fileName: self.content[index].fileName,
                                title: serverTitle,
                                description: self.content[index].description,
                                hlsUrl: self.content[index].hlsUrl,
                                thumbnailUrl: self.content[index].thumbnailUrl,
                                createdAt: self.content[index].createdAt,
                                isVisible: self.content[index].isVisible,
                                price: self.content[index].price,
                                category: self.content[index].category,
                                uploadId: self.content[index].uploadId,
                                fileId: self.content[index].fileId,
                                airdate: self.content[index].airdate,
                                creatorUsername: self.content[index].creatorUsername,
                                localFileURL: self.content[index].localFileURL
                            )
                            self.content[index] = confirmedItem
                            print("✅ [ChannelDetailView] Confirmed update from server - title: '\(serverTitle ?? "nil")'")
                        }
                    } else {
                        print("❌ [ChannelDetailView] Update failed: \(response.message ?? "Unknown error")")
                        // Revert optimistic update on failure
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            let revertedItem = ChannelContent(
                                SK: self.content[index].SK,
                                fileName: self.content[index].fileName,
                                title: content.title,
                                description: self.content[index].description,
                                hlsUrl: self.content[index].hlsUrl,
                                thumbnailUrl: self.content[index].thumbnailUrl,
                                createdAt: self.content[index].createdAt,
                                isVisible: self.content[index].isVisible,
                                price: self.content[index].price,
                                category: self.content[index].category,
                                uploadId: self.content[index].uploadId,
                                fileId: self.content[index].fileId,
                                airdate: self.content[index].airdate,
                                creatorUsername: self.content[index].creatorUsername,
                                localFileURL: self.content[index].localFileURL
                            )
                            self.content[index] = revertedItem
                        }
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error updating content: \(error.localizedDescription)")
                await MainActor.run {
                    isUpdatingContent = false
                    // Revert optimistic update on error
                    if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                        let revertedItem = ChannelContent(
                            SK: self.content[index].SK,
                            fileName: self.content[index].fileName,
                            title: content.title,
                            description: self.content[index].description,
                            hlsUrl: self.content[index].hlsUrl,
                            thumbnailUrl: self.content[index].thumbnailUrl,
                            createdAt: self.content[index].createdAt,
                            isVisible: self.content[index].isVisible,
                            price: self.content[index].price,
                            category: self.content[index].category,
                            uploadId: self.content[index].uploadId,
                            fileId: self.content[index].fileId,
                            airdate: self.content[index].airdate,
                            creatorUsername: self.content[index].creatorUsername,
                            localFileURL: self.content[index].localFileURL
                        )
                        self.content[index] = revertedItem
                    }
                }
            }
        }
    }
    
    // Update content details
    private func updateContentDetails() {
        guard let content = editingContent,
              let userEmail = authService.userEmail else {
            print("❌ [ChannelDetailView] Cannot update - missing content or user email")
            return
        }
        
        let trimmedTitle = editingTitle.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else {
            print("❌ [ChannelDetailView] Title cannot be empty")
            return
        }
        
        // OPTIMISTIC UPDATE: Update UI immediately before API call
        // Save locally so editor can see the update right away
        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
            // Create updated ChannelContent with new title (optimistic update)
            let updatedItem = ChannelContent(
                SK: self.content[index].SK,
                fileName: self.content[index].fileName,
                title: trimmedTitle, // Save locally immediately
                description: self.content[index].description, // Keep existing description
                hlsUrl: self.content[index].hlsUrl,
                thumbnailUrl: self.content[index].thumbnailUrl,
                createdAt: self.content[index].createdAt,
                isVisible: self.content[index].isVisible,
                price: self.content[index].price,
                category: self.content[index].category,
                uploadId: self.content[index].uploadId,
                fileId: self.content[index].fileId,
                airdate: self.content[index].airdate,
                creatorUsername: self.content[index].creatorUsername,
                localFileURL: self.content[index].localFileURL
            )
            self.content[index] = updatedItem
            print("✅ [ChannelDetailView] Optimistic update - showing title immediately: '\(trimmedTitle)'")
        } else {
            print("⚠️ [ChannelDetailView] Could not find content item for optimistic update (SK: \(content.SK))")
        }
        
        // Close modal immediately so user sees the update
        showingEditModal = false
        editingContent = nil
        editingTitle = ""
        
        // Deselect the filter toggle so user sees their changes in the full timeline
        if showOnlyOwnContent {
            filteredSortedContent = filteredOwnContent
            print("🔍 [ChannelDetailView] Filtering to own content: \(filteredSortedContent.count) items")
        }
