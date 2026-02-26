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
import Combine

struct ChannelDetailView: View {
    let channel: DiscoverableChannel
    let forceRefresh: Bool // Force refresh content when true (e.g., after upload)
    let canStream: Bool // Whether user can stream to this channel
    let collaboratorChannels: [Channel] // Channels user can stream to
    let onInviteCodeAccepted: (() -> Void)? // Callback when invite code is accepted
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var userRoleService = UserRoleService.shared
    @ObservedObject private var websocketService = UnifiedWebSocketService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var currentChannel: DiscoverableChannel // Mutable channel for live updates
    @State private var content: [ChannelContent] = []
    @State private var isLoading = false // Only true when fetching AND no cached content
    @State private var isLoadingMore = false // Loading more items (pagination)
    @State private var errorMessage: String?
    @State private var selectedContent: ChannelContent?
    @State private var showingPlayer = false
    @State private var hasLoadedOnce = false // Track if we've successfully loaded at least once
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
    @State private var showingPrivateInbox = false // Show private access notifications inbox
    @State private var showingPrivateManagement = false // Show private username management
    @State private var unreadAccessInboxCount = 0 // Unread count for access inbox notifications
    @State private var inboxPollTask: Task<Void, Never>? = nil // Task for polling inbox
    @State private var accessInboxNotifications: [AccessInboxNotification] = [] // Access inbox notifications
    @State private var accessInboxNotificationData: [String: AppNotification] = [:] // Store full notification data by ID
    @State private var isLoadingAccessInbox = false // Loading state for access inbox
    @State private var privateManagementSearchText = "" // Search text for private management
    @State private var privateManagementSearchResults: [UsernameSearchResult] = [] // Search results for private management
    @State private var isSearchingPrivateManagement = false // Whether private management search is in progress
    @State private var privateManagementSearchTask: Task<Void, Never>? = nil // Task for debounced private management search
    @State private var addingPrivateUsernames: Set<String> = [] // Track usernames being added to private
    @State private var removingPrivateUsernames: Set<String> = [] // Track usernames being removed from private
    @State private var addedUsernames: [AddedUsername] = [] // List of added usernames for Twilly TV (public only)
    @State private var addedPrivateUsernames: [AddedUsername] = [] // List of private usernames (separate cache)
    @State private var isLoadingAddedUsernames = false
    @State private var usernameSearchText = "" // Search text for inline search
    @State private var usernameSearchResults: [UsernameSearchResult] = [] // Search results
    @State private var isSearchingUsernames = false // Whether search is in progress
    @State private var showSearchDropdown = false // Show search results dropdown
    @State private var showAddedUsernamesDropdown = false // Show added usernames dropdown
    @State private var showEmptyMessage = false // Show flash message when all usernames are removed
    @State private var removedUsernames: Set<String> = [] // Track usernames that were explicitly removed (format: "username:visibility" or "username" for backward compatibility)
    @State private var addingUsernames: Set<String> = [] // Track which usernames are currently being added
    @State private var searchVisibilityFilter: String = "all" // Always show all results (public and private together)
    @State private var sentFollowRequests: [SentFollowRequest] = [] // Track follow requests sent by current user
    @State private var isLoadingSentRequests = false
    @State private var searchTask: Task<Void, Never>? = nil // Task for debounced search
    @State private var searchCache: [String: [UsernameSearchResult]] = [:] // Cache search results locally
    @FocusState private var isSearchFieldFocused: Bool // Track search field focus for keyboard dismissal
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
    @State private var showFavoritesOnly = false // Filter to show only favorited content
    @State private var favoriteContentIds: Set<String> = [] // Set of favorited content SK IDs
    @State private var isFilteringContent = false // Loading state when filtering content
    @State private var isCurrentUserPrivate = false // Track if current user has private account
    @State private var hasConfirmedNoContent = false // Only show "no content" after confirming there's truly none
    @State private var previousContentBeforeFilter: [ChannelContent] = [] // Keep previous content visible during filter
    @State private var cachedUnfilteredContent: [ChannelContent] = [] // Cache full content when filters are applied
    @State private var cachedNextToken: String? = nil // Cache pagination token
    @State private var cachedHasMoreContent = false // Cache hasMore flag
    // Separate arrays for public and private content (loaded simultaneously for instant toggle)
    @State private var publicContent: [ChannelContent] = [] // Public content cache
    @State private var privateContent: [ChannelContent] = [] // Private content cache
    @State private var publicNextToken: String? = nil // Public pagination token
    @State private var privateNextToken: String? = nil // Private pagination token
    @State private var publicHasMore = false // Public hasMore flag
    @State private var privateHasMore = false // Private hasMore flag
    @State private var bothViewsLoaded = false // Track if both views have been loaded
    @State private var scrollToTopTrigger = UUID() // Trigger to scroll to top when toggling views
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
    @State private var showingPremiumAlert = false // Show premium content alert
    @State private var premiumContentItem: ChannelContent? = nil // Premium content item that requires payment
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
    
    // MARK: - Body View Helpers (Breaking up complex expression for compiler)
    
    private var baseContentView: some View {
        ZStack {
            backgroundGradient
            mainScrollView
        }
    }
    
    @ViewBuilder
    private var viewWithNavigation: some View {
        if #available(iOS 16.0, *) {
            baseContentView
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        } else {
            baseContentView
                .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private var viewWithPrincipalToolbar: some View {
        viewWithNavigation
        .toolbar {
            ToolbarItem(placement: .principal) {
                // Show navigation title for non-Twilly TV channels
                if currentChannel.channelName.lowercased() != "twilly tv" {
                    navigationTitleView
                } else {
                    EmptyView()
                }
            }
        }
    }
    
    private var viewWithLeadingToolbar: some View {
        viewWithPrincipalToolbar
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarLeading) {
                leadingToolbarItems
                }
            }
            }
            
    private var viewWithNavigationAndToolbar: some View {
        viewWithLeadingToolbar
            .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                trailingToolbarItems
            }
        }
    }
    
    private var viewWithSheetsAndAlerts: some View {
        viewWithNavigationAndToolbar
        .sheet(isPresented: $showingSettings) {
            StreamerSettingsView()
        }
        .onChange(of: showingSettings) { isShowing in
            // When settings is dismissed, post notification to reload premium enabled
            if !isShowing {
                NotificationCenter.default.post(name: NSNotification.Name("PremiumEnabledChanged"), object: nil)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NavigateToVideo"))) { notification in
            if let videoId = notification.userInfo?["videoId"] as? String,
               let openComments = notification.userInfo?["openComments"] as? Bool {
                print("🔔 [ChannelDetailView] NavigateToVideo notification received: \(videoId), openComments: \(openComments)")
                
                // Find the video in content array
                let fileId = videoId.replacingOccurrences(of: "FILE#", with: "")
                let matchingContent = content.first { contentItem in
                    // Match by SK (which is FILE#fileId) or fileId field
                    let contentSK = contentItem.id.replacingOccurrences(of: "FILE#", with: "")
                    return contentSK == fileId || contentItem.id == videoId
                }
                
                if let foundContent = matchingContent {
                    print("✅ [ChannelDetailView] Found video, opening player")
                    selectedContent = foundContent
                    showingPlayer = true
                    
                    // If openComments is true, we'll need to open comments after player appears
                    // This will be handled by FloatingCommentView's initial state
                } else {
                    print("⚠️ [ChannelDetailView] Video not found in content array, refreshing...")
                    // Video might not be loaded yet, refresh content
                    Task {
                        try? await refreshChannelContent()
                        // Try again after refresh
                        let refreshedMatching = content.first { contentItem in
                            let contentSK = contentItem.id.replacingOccurrences(of: "FILE#", with: "")
                            return contentSK == fileId || contentItem.id == videoId
                        }
                        if let refreshedContent = refreshedMatching {
                            await MainActor.run {
                                selectedContent = refreshedContent
                                showingPlayer = true
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingPrivateInbox) {
            privateAccessInboxView
        }
        .sheet(isPresented: $showingPrivateManagement) {
            privateManagementView
        }
        .sheet(isPresented: $showingUsernameSearch) {
            UsernameSearchView(
                channelName: currentChannel.channelName,
                onUsernameAdded: {
                    // Reload added usernames and refresh content (merge to preserve optimistic updates)
                    loadAddedUsernames(mergeWithExisting: true)
                    Task {
                        try? await refreshChannelContent()
                    }
                }
            )
        }
        .alert("Delete Video", isPresented: $showingDeleteConfirmation, presenting: contentToDelete) { item in
            Button("Cancel", role: .cancel) {
                contentToDelete = nil
            }
            Button("Delete", role: .destructive) {
                // Prevent multiple taps
                guard !isDeleting else {
                    print("⚠️ [ChannelDetailView] Delete already in progress, ignoring tap")
                    return
                }
                deleteContent(item: item)
            }
        } message: { item in
            // Never show raw m3u8 filename - show cleaned title or fallback
            let displayName = (item.title?.trimmingCharacters(in: .whitespaces).isEmpty == false) 
                ? ContentCard.cleanTitle(item.title ?? "") 
                : "this video"
            Text("Are you sure you want to delete \"\(displayName)\"? This action cannot be undone.")
        }
        .alert("Premium Content", isPresented: $showingPremiumAlert, presenting: premiumContentItem) { item in
            Button("OK", role: .cancel) {
                premiumContentItem = nil
            }
        } message: { item in
            // Get creator username for the message
            let creatorName = item.creatorUsername?.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespacesAndNewlines) ?? "this creator"
            Text("This is a premium video from \(creatorName). You need to purchase access to unlock this content.")
        }
        .sheet(isPresented: $showingEditModal) {
            editContentModal
        }
        .sheet(isPresented: $showingContentManagementPopup) {
            contentManagementPopup
        }
    }
    
    private var viewWithLifecycleHandlers: some View {
        viewWithSheetsAndAlerts
            .onDisappear {
                // CRITICAL: Clean up all background tasks when view disappears
                // Stop polling when view disappears
                stopThumbnailPolling()
                
                // Stop auto-refresh task
                stopAutoRefresh()
                
                // Cancel inbox polling
                inboxPollTask?.cancel()
                
                // Cancel any pending content loading tasks
                // (Tasks are automatically cancelled when view disappears, but explicit cancellation is safer)
            }
        .onAppear {
            
            // Load cached search results from UserDefaults for instant results
            loadSearchCacheFromUserDefaults()
                
                // Load favorites from UserDefaults
                loadFavoritesFromUserDefaults()
                
                // CRITICAL: Load sent follow requests from UserDefaults to restore optimistic updates
                // This ensures "Requested" state persists across view reloads
                loadSentFollowRequestsFromUserDefaults()
            
            // Load user's schedule and post automatically status (for admin stream button visibility)
            if isAdminUser {
                loadUserScheduleStatus()
                loadUserPostAutomatically()
            }
            
            // Load current user's account visibility (to determine if they can add private viewers)
            loadCurrentUserVisibility()
            
            // Load inbox count from cache immediately for instant display
            loadUnreadAccessInboxCountFromCache()
            
            // Then refresh from server in background
            loadUnreadAccessInboxCount()
            // WebSocket handles real-time updates - polling is fallback only
            // Reduced polling interval to 30 seconds as fallback (WebSocket is primary)
            startInboxPolling()
            
            // Listen for inbox count refresh requests (when thread is marked as read)
            // This is handled via .onReceive below
            
            // Load added usernames for Twilly TV and auto-add own username
            if currentChannel.channelName.lowercased() == "twilly tv" {
                loadAddedUsernames()
                // Load private usernames separately (for "Add to Private" button state)
                loadAddedPrivateUsernames(mergeWithExisting: true)
                // Auto-add user's own username to see their own content
                autoAddOwnUsername()
                // CRITICAL: Load sent follow requests with merge=true to preserve optimistic updates
                // This ensures "Requested" state persists even if server hasn't processed the request yet
                // Public "Add" and private "Request" are COMPLETELY INDEPENDENT
                loadSentFollowRequests(mergeWithExisting: true) // Always merge to preserve optimistic updates
            }
            
            // Check for local video info to show immediately
            if let localInfo = globalLocalVideoInfo, localInfo.channelName == currentChannel.channelName {
                let localContent = ChannelContent(
                    SK: "local-\(UUID().uuidString)",
                    fileName: localInfo.url.lastPathComponent,
                    title: localInfo.title,
                    description: localInfo.description,
                    hlsUrl: nil,
                    thumbnailUrl: nil,
                    createdAt: Date().ISO8601Format(),
                    isVisible: true,
                    price: localInfo.price,
                    category: "Videos",
                    creatorUsername: authService.username,
                    localFileURL: localInfo.url
                )
                localVideoContent = localContent
                content = [localContent] // Show local video immediately
                isLoading = false // Don't show loading spinner - we have content
                
                // Start polling for thumbnail immediately
                startThumbnailPolling()
                
                // Clear global info after using it
                globalLocalVideoInfo = nil
            }
            
                // Show cached content immediately if available
                let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                let hasCachedContent = isTwillyTV ? (!publicContent.isEmpty || !privateContent.isEmpty) : !content.isEmpty
                
                if hasCachedContent {
                    // INSTAGRAM/TIKTOK PATTERN: Show cached content immediately, fetch fresh in background
                    if isTwillyTV {
                        // Restore from cached arrays
                        if showPrivateContent {
                            content = privateContent
                            nextToken = privateNextToken
                            hasMoreContent = privateHasMore
                        } else {
                            content = publicContent
                            nextToken = publicNextToken
                            hasMoreContent = publicHasMore
                        }
                        bothViewsLoaded = true
                    }
                    // CRITICAL: Mark as loaded and stop loading spinner immediately
                    hasLoadedOnce = true
                    isLoading = false
                    hasConfirmedNoContent = false // Reset - we have content
                }
                
                // Always fetch new content in background (unless forceRefresh, then show loading)
                let needsBothViewsReload = isTwillyTV && (!bothViewsLoaded || (publicContent.isEmpty && privateContent.isEmpty))
                let needsReload = content.isEmpty && !isLoading
                
                if !hasCachedContent && (!hasLoadedOnce || forceRefresh || needsBothViewsReload || needsReload) {
                    // CRITICAL: Only show loading spinner if we have NO cached content
                    // This matches Instagram/TikTok behavior - never show loading if you have something to show
                    if localVideoContent == nil {
                        isLoading = true
                        if forceRefresh {
                            content = [] // Clear content on force refresh
                            hasConfirmedNoContent = false // Reset confirmation on refresh
                        }
                        errorMessage = nil
                    }
                    loadContent()
                } else if hasCachedContent {
                    // We have cached content - fetch new content in background silently
                    Task {
                        do {
                            if isTwillyTV {
                                // Fetch both views in background
                                // Use forceRefresh: false to use cache if available (background refresh shouldn't block)
                                let viewerEmail = authService.userEmail
                                // Send added usernames to backend as fallback
                                let clientAddedUsernames = addedUsernames.map { $0.streamerUsername }
                                let bothViews = try await channelService.fetchBothViewsContent(
                                    channelName: currentChannel.channelName,
                                    creatorEmail: currentChannel.creatorEmail,
                                    viewerEmail: viewerEmail,
                                    limit: 20,
                                    forceRefresh: false, // Use cache for background refresh to avoid blocking
                                    clientAddedUsernames: clientAddedUsernames
                                )
                                
                                await MainActor.run {
                                    // Update cached arrays silently
                                    // CRITICAL: Include owner videos in both arrays (use email as source of truth)
                                    let viewerEmail = authService.userEmail?.lowercased()
                                    let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
                                    
                                    // Helper to normalize username
                                    func normalizeUsername(_ username: String?) -> String? {
                                        guard let username = username else { return nil }
                                        return username.replacingOccurrences(of: "🔒", with: "")
                                            .trimmingCharacters(in: CharacterSet.whitespaces)
                                            .lowercased()
                                    }
                                    
                                    // Helper to check if item is owner video
                                    func isOwnerVideo(_ item: ChannelContent) -> Bool {
                                        if channelCreatorEmail == viewerEmail {
                                            return true
                                        }
                                        if let viewerUsername = authService.username?.lowercased().trimmingCharacters(in: .whitespaces),
                                           let normalizedCreatorUsername = normalizeUsername(item.creatorUsername),
                                           normalizedCreatorUsername == viewerUsername {
                                            return true
                                        }
                                        return false
                                    }
                                    
                                    let strictlyPublic = bothViews.publicContent.filter { item in
                                        let isOwner = isOwnerVideo(item)
                                        let isPrivate = item.isPrivateUsername == true
                                        return !isPrivate || isOwner // Include if public OR owner video
                                    }
                                    
                                    let strictlyPrivate = bothViews.privateContent.filter { item in
                                        let isOwner = isOwnerVideo(item)
                                        let isPrivate = item.isPrivateUsername == true
                                        return isPrivate || isOwner // Include if private OR owner video
                                    }
                                    
                                    // CRITICAL: Merge with existing content instead of replacing to prevent flashing
                                    // Only add new items that don't already exist
                                    var seenPublicSKs = Set(publicContent.map { $0.SK })
                                    var seenPrivateSKs = Set(privateContent.map { $0.SK })
                                    
                                    // Add new public items
                                    for item in strictlyPublic where !seenPublicSKs.contains(item.SK) {
                                        publicContent.append(item)
                                        seenPublicSKs.insert(item.SK)
                                    }
                                    
                                    // Add new private items
                                    for item in strictlyPrivate where !seenPrivateSKs.contains(item.SK) {
                                        privateContent.append(item)
                                        seenPrivateSKs.insert(item.SK)
                                    }
                                    
                                    publicNextToken = bothViews.publicNextToken
                                    privateNextToken = bothViews.privateNextToken
                                    publicHasMore = bothViews.publicHasMore
                                    privateHasMore = bothViews.privateHasMore
                                    bothViewsLoaded = true
                                    
                                    // CRITICAL: Background refresh - ONLY update arrays silently, don't update displayed content
                                    // This prevents flashing when user is viewing or toggling content
                                    // The arrays are updated silently, and content will be updated on next toggle or explicit refresh
                                    // This ensures private and public remain completely separate and prevents flash during toggle
                                    
                                    // Don't update displayed content during background refresh
                                    // Content is only updated on explicit toggle or initial load
                                    // This prevents any flash of wrong content when toggling
                                    
                                    cachedUnfilteredContent = publicContent + privateContent
                                }
                            } else {
                                // Non-Twilly TV - use single view refresh
                                if let result = try? await refreshChannelContent() {
                                    await MainActor.run {
                                        updateContentWith(result.content, replaceLocal: false)
                                        nextToken = result.nextToken
                                        hasMoreContent = result.hasMore
                                    }
                                }
                            }
                        } catch {
                            print("⚠️ [ChannelDetailView] Background refresh failed (non-critical): \(error.localizedDescription)")
                        }
                    }
            } else {
            }
            
            // Start auto-refresh to check for new videos
            startAutoRefresh()
        }
            .onChange(of: showingPlayer) { newValue in
                print("🔄 [ChannelDetailView] showingPlayer changed to: \(newValue)")
                if newValue {
                    print("   - selectedContent at change: \(selectedContent?.fileName ?? "nil")")
                }
            }
    }
    
    private var viewWithNotificationsAndGestures: some View {
        viewWithLifecycleHandlers
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RefreshInboxCount"))) { _ in
            // Refresh inbox count when thread is marked as read
            loadUnreadAccessInboxCount()
        }
        .onReceive(websocketService.$inboxNotification) { notification in
            // Handle real-time inbox notifications via WebSocket - SUPER FAST updates
            if let notification = notification {
                
                // Check if this is a private_access_granted notification
                if notification.notificationType == "private_access_granted" {
                    // Update count immediately (optimistic update) - already on main actor
                    unreadAccessInboxCount += 1
                    saveUnreadAccessInboxCountToCache(count: unreadAccessInboxCount)
                    // Then refresh from server to get accurate count
                    loadUnreadAccessInboxCount()
                } else {
                    // For other notification types, just refresh
                    loadUnreadAccessInboxCount()
                }
            }
        }
        .onReceive(websocketService.$timelineUpdateNotification) { notification in
            // Handle real-time timeline updates via WebSocket
            if let notification = notification {
                
                // Only process if this is for Twilly TV (main timeline)
                guard currentChannel.channelName.lowercased() == "twilly tv" else {
                    return
                }
                
                // Convert notification to ChannelContent
                let newContent = ChannelContent(
                    SK: "FILE#\(notification.fileId)",
                    fileName: notification.fileName,
                    title: notification.title,
                    description: notification.description,
                    hlsUrl: notification.hlsUrl,
                    thumbnailUrl: notification.thumbnailUrl,
                    createdAt: notification.createdAt,
                    isVisible: true,
                    price: notification.price ?? 0,
                    category: notification.category,
                    fileId: notification.fileId,
                    creatorUsername: notification.creatorUsername,
                    isPrivateUsername: notification.isPrivateUsername ?? false,
                    isPremium: notification.isPremium ?? false
                )
                
                // Check if content already exists (prevent duplicates)
                let contentExists = content.contains { $0.id == newContent.id }
                if !contentExists {
                    // Prepend new content to timeline (newest first in UI)
                    withAnimation(.easeInOut(duration: 0.3)) {
                        content.insert(newContent, at: 0)
                        
                        // Also update public/private content arrays if applicable
                        let isPrivate = notification.isPrivateUsername ?? false
                        if isPrivate {
                            privateContent.insert(newContent, at: 0)
                        } else {
                            publicContent.insert(newContent, at: 0)
                        }
                    }
                    
                    print("✅ [ChannelDetailView] Added new timeline content: \(notification.fileName)")
                } else {
                    print("⚠️ [ChannelDetailView] Timeline content already exists, skipping: \(notification.fileName)")
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RefreshTwillyTVContent"))) { _ in
            // CRITICAL: When a follow request is accepted, refresh everything to show private content
            guard currentChannel.channelName.lowercased() == "twilly tv" else { return }
            
            // Refresh added usernames to get the newly accepted private username
            loadAddedUsernames(mergeWithExisting: true)
            
            // Refresh sent follow requests to update status from "pending" to "accepted"
            // Use merge to preserve any optimistic updates
            loadSentFollowRequests(mergeWithExisting: true)
            
            // Refresh content to show private content from the accepted user
            Task {
                do {
                    try? await Task.sleep(nanoseconds: 500_000_000) // Wait 0.5s for addedUsernames to load
                    try? await refreshChannelContent()
                } catch {
                    print("❌ [ChannelDetailView] Error refreshing content after acceptance: \(error.localizedDescription)")
                }
            }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 20)
                .onEnded { value in
                    let horizontalMovement = abs(value.translation.width)
                    let verticalMovement = abs(value.translation.height)
                    
                    // Swipe down to dismiss
                    if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                        dismiss()
                        return
                    }
                    
                    // Swipe RIGHT (from left to right, positive width) to go to stream screen
                    // Only process as swipe if horizontal movement is significant and greater than vertical
                    if horizontalMovement > 50 && horizontalMovement > verticalMovement {
                        if value.translation.width > 80 || value.predictedEndTranslation.width > 150 {
                            // Post notification to show stream screen
                            NotificationCenter.default.post(
                                name: NSNotification.Name("ShowStreamScreen"),
                                object: nil
                            )
                            // Dismiss channel view to show stream screen
                            dismiss()
                        }
                    }
                }
        )
    }
    
    private var videoPlayerFullScreenCover: some View {
            Group {
                
                if let content = selectedContent {
                    // Check for local file first, then HLS URL
                    if let localURL = content.localFileURL {
                        let _ = print("✅ [ChannelDetailView] Opening video player with LOCAL file: \(localURL.path)")
                        VideoPlayerView(url: localURL, content: content, channelCreatorEmail: currentChannel.creatorEmail)
                    } else if let hlsUrl = content.hlsUrl, !hlsUrl.isEmpty, let url = URL(string: hlsUrl) {
                        let _ = print("✅ [ChannelDetailView] Opening video player with HLS URL: \(hlsUrl)")
                        let _ = print("   - Thumbnail URL: \(content.thumbnailUrl ?? "none")")
                        VideoPlayerView(url: url, content: content, channelCreatorEmail: currentChannel.creatorEmail)
                } else {
                    let _ = print("❌ [ChannelDetailView] Cannot open video player - missing content or hlsUrl")
                    let _ = print("   - selectedContent exists: \(selectedContent != nil)")
                    let _ = print("   - selectedContent fileName: \(selectedContent?.fileName ?? "nil")")
                    let _ = print("   - selectedContent hlsUrl: \(selectedContent?.hlsUrl ?? "nil")")
                    let _ = print("   - hlsUrl isEmpty: \(selectedContent?.hlsUrl?.isEmpty ?? true)")
                    let _ = print("   - URL creation: \(selectedContent?.hlsUrl != nil ? (URL(string: selectedContent!.hlsUrl!) != nil ? "success" : "failed") : "hlsUrl is nil")")
                    
                    ZStack {
                        Color.black.ignoresSafeArea()
                        
                        VStack(spacing: 20) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 50))
                                .foregroundStyle(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyTeal,
                                            Color.twillyCyan
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                            
                            Text("Cannot Load Video")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            
                            Text("This video is not available for playback")
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                            
                            Button(action: {
                                showingPlayer = false
                            }) {
                                HStack {
                                    Image(systemName: "xmark.circle.fill")
                                    Text("Close")
                                }
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 12)
                                .background(Color.blue)
                                .cornerRadius(10)
                            }
                            .padding(.top, 20)
                        }
                    }
                    .overlay(alignment: .topTrailing) {
                        // Close button in top corner (same as video player)
                        Button(action: {
                            showingPlayer = false
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.white.opacity(0.8))
                                .background(Color.black.opacity(0.5))
                                .clipShape(Circle())
                        }
                        .padding()
                    }
                }
                } else {
                    // Fallback if selectedContent is nil
                    ZStack {
                        Color.black.ignoresSafeArea()
                        VStack(spacing: 20) {
                            Text("No video selected")
                                .foregroundColor(.white)
                            Button("Close") {
                                showingPlayer = false
                            }
                        }
                    }
                }
            }
        }
    
    var body: some View {
        viewWithNotificationsAndGestures
            .fullScreenCover(isPresented: $showingPlayer) {
                videoPlayerFullScreenCover
        }
        .onAppear {
            // LOCK TO PORTRAIT: Channel page must stay in portrait
            AppDelegate.orientationLock = .portrait
            
            // Force portrait orientation (iOS 16+)
            if #available(iOS 16.0, *) {
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                    windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                        if let error = error {
                            print("❌ [ChannelDetailView] Failed to lock to portrait: \(error.localizedDescription)")
                        } else {
                            print("✅ [ChannelDetailView] Locked to portrait mode")
                        }
                    }
                }
            } else {
                // iOS < 16: Use UIDevice
                UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
                print("✅ [ChannelDetailView] Locked to portrait mode (iOS < 16)")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            // When device rotates to landscape, force back to portrait
            let currentOrientation = UIDevice.current.orientation
            if currentOrientation.isLandscape {
                ensurePortraitOrientation()
            }
        }
        .onChange(of: showingPlayer) { isShowing in
            // Ensure portrait when player closes
            if !isShowing {
                ensurePortraitOrientation()
            }
        }
        .onDisappear {
            // Keep portrait lock when leaving (don't unlock)
            // This ensures consistent portrait experience
        }
    }
    
    // MARK: - Orientation Helper
    // LOCK TO PORTRAIT: Force portrait orientation
    private func ensurePortraitOrientation() {
        // Lock to portrait globally
        AppDelegate.orientationLock = .portrait
        
        // Force portrait orientation
        if #available(iOS 16.0, *) {
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                if !windowScene.interfaceOrientation.isPortrait {
                    windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                        if let error = error {
                            print("❌ [ChannelDetailView] Failed to lock to portrait: \(error.localizedDescription)")
                        } else {
                            print("✅ [ChannelDetailView] Locked to portrait mode")
                        }
                    }
                }
            }
        } else {
            // iOS < 16: Use UIDevice
            let currentOrientation = UIDevice.current.orientation
            if currentOrientation.isLandscape {
                UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
                print("✅ [ChannelDetailView] Locked to portrait mode (iOS < 16)")
            }
        }
    }
    
    // MARK: - View Components
    
    // MARK: - Navigation Title
    @ViewBuilder
    private var navigationTitleView: some View {
        // For Twilly TV, show empty title since it's on the poster
        // For other channels, show channel name
        if currentChannel.channelName.lowercased() == "twilly tv" {
            EmptyView()
        } else {
            Text(currentChannel.channelName)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)
        }
    }
    
    // MARK: - Toolbar Items
    @ViewBuilder
    private var leadingToolbarItems: some View {
        // Twilly TV specific toolbar items
        if currentChannel.channelName.lowercased() == "twilly tv" {
            HStack(spacing: 12) {
                // Public/Private toggle (first, on the left)
            privateToggleButton
                
                // Twilly logo button to toggle filter (my content vs all content)
                twillyLogoFilterButton
                
                // Favorites star button
                favoritesButton
            }
            .padding(.leading, 8)
        }
    }
    
    @ViewBuilder
    private var trailingToolbarItems: some View {
        // Private access inbox button (for notifications when added to private)
        Button(action: {
            showingPrivateInbox = true
        }) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
                
                // Unread badge
                if unreadAccessInboxCount > 0 {
                    Text("\(unreadAccessInboxCount > 99 ? "99+" : "\(unreadAccessInboxCount)")")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(4)
                        .background(Color.red)
                        .clipShape(Circle())
                        .offset(x: 8, y: -8)
                }
            }
        }
        
        // Private username management button (person icon)
        Button(action: {
            showingPrivateManagement = true
        }) {
            Image(systemName: "person.circle")
                .font(.system(size: 20))
                .foregroundColor(.white)
        }
        
        // Settings button
        Button(action: {
            showingSettings = true
        }) {
            Image(systemName: "gear")
                .font(.system(size: 20))
                .foregroundColor(.white)
        }
    }
    
    private var twillyLogoFilterButton: some View {
        Button(action: handleFilterToggle) {
            HStack(spacing: 4) {
                // Filter label
                Text(showOnlyOwnContent ? "My" : "All")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(showOnlyOwnContent ? .twillyCyan : .white.opacity(0.8))
                
                // Filter indicator icon - use square.grid.2x2 for "All" view
                Image(systemName: showOnlyOwnContent ? "person.fill" : "square.grid.2x2")
                    .font(.system(size: 20))
                    .foregroundColor(showOnlyOwnContent ? .twillyCyan : .white)
            }
        }
    }
    
    private var filterButton: some View {
        Button(action: handleFilterToggle) {
            Image(systemName: showOnlyOwnContent ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .foregroundColor(showOnlyOwnContent ? .twillyCyan : .white)
        }
    }
    
    private var favoritesButton: some View {
        Button(action: handleFavoritesToggle) {
            Image(systemName: showFavoritesOnly ? "star.fill" : "star")
                .font(.system(size: 20))
                .foregroundColor(showFavoritesOnly ? .yellow : .white)
        }
    }
    
    private var privateToggleButton: some View {
        Button(action: handlePrivateToggle) {
            privateToggleButtonContent
        }
    }
    
    // MARK: - Helper Functions
    
    // Helper to normalize username (matches backend normalization exactly)
    // Backend does: replace('🔒', '').trim().toLowerCase() OR toLowerCase().trim().replace(/🔒/g, '')
    // Order: Remove lock emoji, trim whitespace, lowercase (matches backend pattern)
    private func normalizeUsername(_ username: String?) -> String? {
        guard let username = username, !username.isEmpty else { return nil }
        // Match backend: remove all lock emojis, trim whitespace, lowercase
        // This handles all variations: "Twilly TV", "Twilly TV🔒", "🔒Twilly TV", "  Twilly TV  ", etc.
        return username.replacingOccurrences(of: "🔒", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }
    
    // Helper to normalize viewer username (same as normalizeUsername but for viewer's username)
    // This ensures viewer username is normalized the same way as item usernames
    private func normalizeViewerUsername(_ username: String?) -> String? {
        guard let username = username, !username.isEmpty else { return nil }
        // Same normalization as normalizeUsername - must match exactly
        return username.replacingOccurrences(of: "🔒", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }
    
    // Helper to detect owner videos (uses normalized username comparison and email)
    // CRITICAL: Both usernames must be normalized the SAME way for comparison to work
    private func isOwnerVideo(_ item: ChannelContent) -> Bool {
        let viewerEmail = authService.userEmail?.lowercased()
        let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
        
        // Primary: Check if channel creator email matches viewer email
        if channelCreatorEmail == viewerEmail {
            return true
        }
        
        // Fallback: Check username (normalized - remove lock symbols and whitespace)
        // CRITICAL: Normalize BOTH usernames the same way for accurate comparison
        let normalizedViewerUsername = normalizeViewerUsername(authService.username)
        let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
        
        if let normalizedViewerUsername = normalizedViewerUsername,
           let normalizedCreatorUsername = normalizedCreatorUsername,
           normalizedCreatorUsername == normalizedViewerUsername {
            return true
        }
        
        return false
    }
    
    private var privateToggleButtonContent: some View {
        HStack(spacing: 4) {
            Image(systemName: showPrivateContent ? "lock.fill" : "lock.open.fill")
                .font(.system(size: 20))
            Text(showPrivateContent ? "Private" : "Public")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundColor(showPrivateContent ? .orange : .twillyCyan)
    }
    
    // MARK: - Action Handlers
    private func handleFilterToggle() {
        let wasFiltered = showOnlyOwnContent
        withAnimation {
            showOnlyOwnContent.toggle()
        }
        // When enabling "show only own content", filter from existing cache (same as public view)
        // CRITICAL: Don't refresh from server - this would reorder content and break the instant toggle
        // Just filter from existing privateContent/publicContent arrays to preserve order
        if showOnlyOwnContent {
            let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
            
            // CRITICAL: "My" filter should only match videos where creatorUsername matches viewer's username
            // NOT all videos in a channel owned by the viewer
            // Use class-level helper functions for consistency
            if isTwillyTV {
                // CRITICAL: Filter from existing arrays directly (same logic as public view)
                // Filter by creator username matching viewer username (normalized)
                // This preserves order and is instant - no server refresh needed
                if showPrivateContent {
                    // Filter from privateContent array - preserve original order
                    // Only include videos where creatorUsername (normalized) matches viewer username
                    let viewerUsernameRaw = authService.username
                    let normalizedViewerUsername = normalizeViewerUsername(viewerUsernameRaw)
                    
                    content = privateContent.filter { item in
                        let creatorUsernameRaw = item.creatorUsername
                        let normalizedCreatorUsername = normalizeUsername(creatorUsernameRaw)
                        
                        let isMatch: Bool
                        if let viewerUsername = normalizedViewerUsername,
                           let creatorUsername = normalizedCreatorUsername {
                            isMatch = creatorUsername == viewerUsername
                        } else {
                            isMatch = false
                        }
                        
                        // Debug logging for videos that should match but don't
                        if !isMatch && creatorUsernameRaw != nil {
                            let viewerLower = viewerUsernameRaw?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                            let creatorLower = creatorUsernameRaw?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                            if viewerLower.contains("twilly") && creatorLower.contains("twilly") {
                                print("⚠️ [ChannelDetailView] My filter (handleFilterToggle): Video NOT matched")
                                print("   Viewer username (raw): '\(viewerUsernameRaw ?? "nil")'")
                                print("   Viewer username (normalized): '\(normalizedViewerUsername ?? "nil")'")
                                print("   Creator username (raw): '\(creatorUsernameRaw ?? "nil")'")
                                print("   Creator username (normalized): '\(normalizedCreatorUsername ?? "nil")'")
                                print("   FileName: \(item.fileName)")
                                print("   Category: \(item.category ?? "nil")")
                                print("   isPrivateUsername: \(item.isPrivateUsername ?? false)")
                            }
                        }
                        
                        return isMatch
                    }
                    // Keep same pagination tokens (filtered content uses same tokens)
                    nextToken = privateNextToken
                    hasMoreContent = privateHasMore
                    } else {
                    // Filter from publicContent array - preserve original order
                    // Only include videos where creatorUsername (normalized) matches viewer username
                    content = publicContent.filter { item in
                        let normalizedViewerUsername = normalizeViewerUsername(authService.username)
                        let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
                        
                        if let viewerUsername = normalizedViewerUsername,
                           let creatorUsername = normalizedCreatorUsername {
                            return creatorUsername == viewerUsername
                        }
                        return false
                    }
                    // Keep same pagination tokens (filtered content uses same tokens)
                    nextToken = publicNextToken
                    hasMoreContent = publicHasMore
                }
                
                // Apply favorites filter if active
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                
                print("⚡ [ChannelDetailView] Filtered to own content from \(showPrivateContent ? "private" : "public") array: \(content.count) items (preserved order, same as public view)")
            } else {
                // For non-Twilly TV channels, filter from existing content
                // Only include videos where creatorUsername (normalized) matches viewer username
                var filtered = content.filter { item in
                    let normalizedViewerUsername = normalizeViewerUsername(authService.username)
                    let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
                    
                    if let viewerUsername = normalizedViewerUsername,
                       let creatorUsername = normalizedCreatorUsername {
                        return creatorUsername == viewerUsername
                    }
                    return false
                }
            
            // Also apply visibility filter if active
            if showPrivateContent {
                filtered = filtered.filter { item in
                    item.isPrivateUsername == true
                }
            } else {
                filtered = filtered.filter { item in
                    item.isPrivateUsername != true
                }
            }
            
            content = filtered
            
            // Apply favorites filter if active
            if showFavoritesOnly {
                content = content.filter { item in
                    favoriteContentIds.contains(item.SK)
                }
            }
            
                print("⚡ [ChannelDetailView] Filtered to own content: \(content.count) items")
            }
        } else if wasFiltered {
            // Restore from cache instead of reloading from server
            // CRITICAL: Make this instant like public view - use cached arrays directly
            let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
            
            if isTwillyTV {
                // INSTANT: Use cached arrays directly (like public view) - no filtering needed
                // This preserves order and is instant
                if showPrivateContent {
                    // Use privateContent directly - same logic as public view
                    if !privateContent.isEmpty {
                        content = privateContent
                        nextToken = privateNextToken
                        hasMoreContent = privateHasMore
                        
                        // Apply favorites filter if active
                        if showFavoritesOnly {
                            content = content.filter { item in
                                favoriteContentIds.contains(item.SK)
                            }
                        }
                        
                        print("⚡ [ChannelDetailView] Instantly restored ALL private content from cache: \(content.count) items (preserved order)")
                    } else {
                        // Fallback: reload if cache is empty
                        print("⚠️ [ChannelDetailView] Private cache empty, reloading from server")
                        Task {
                            try? await refreshChannelContent()
                        }
                    }
                } else {
                    // Use publicContent directly - already filtered and sorted
                    if !publicContent.isEmpty {
                        content = publicContent
                        nextToken = publicNextToken
                        hasMoreContent = publicHasMore
                        
                        // Apply favorites filter if active
                        if showFavoritesOnly {
                            content = content.filter { item in
                                favoriteContentIds.contains(item.SK)
                            }
                        }
                        
                        print("⚡ [ChannelDetailView] Instantly restored ALL public content from cache: \(content.count) items (preserved order)")
                    } else {
                        // Fallback: reload if cache is empty
                        print("⚠️ [ChannelDetailView] Public cache empty, reloading from server")
                        Task {
                            try? await refreshChannelContent()
                        }
                    }
                }
            } else {
                // For non-Twilly TV channels, use cachedUnfilteredContent
            if !cachedUnfilteredContent.isEmpty {
                // Apply visibility filter if needed
                if showPrivateContent {
                    content = cachedUnfilteredContent.filter { item in
                        item.isPrivateUsername == true
                    }
                } else {
                    content = cachedUnfilteredContent.filter { item in
                        item.isPrivateUsername != true
                    }
                }
                nextToken = cachedNextToken
                hasMoreContent = cachedHasMoreContent
                
                // Apply favorites filter if active
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                
                print("💾 [ChannelDetailView] Restored unfiltered content from cache: \(content.count) items")
            } else {
                // Fallback: reload if cache is empty
                print("⚠️ [ChannelDetailView] Cache empty, reloading from server")
                Task {
                    try? await refreshChannelContent()
                    }
                }
            }
        }
    }
    
    private func handlePrivateToggle() {
        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
        
        // CRITICAL: Determine target state BEFORE toggling to set content correctly
        let willBePrivate = !showPrivateContent
        
        // CRITICAL: For Twilly TV, private and public MUST read from completely separate arrays
        // Never mix or filter between them - they are completely independent
        if isTwillyTV {
            // CRITICAL: Set content from the correct array IMMEDIATELY before toggling state
            // This prevents any flash of wrong content
            if willBePrivate {
                // Switching TO private: Use privateContent array immediately
                // This is completely separate from publicContent - no mixing, no filtering
                content = privateContent
                nextToken = privateNextToken
                hasMoreContent = privateHasMore
                
                // Apply filters if active (after setting from correct array)
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                if showOnlyOwnContent {
                    content = content.filter { item in
                        isOwnerVideo(item)
                    }
                }
                
                print("🔒 [ChannelDetailView] Switching to PRIVATE view - \(content.count) items from privateContent array (completely separate)")
            } else {
                // Switching TO public: Use publicContent array immediately
                // This is completely separate from privateContent - no mixing, no filtering
                content = publicContent
                nextToken = publicNextToken
                hasMoreContent = publicHasMore
                
                // Apply filters if active (after setting from correct array)
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                if showOnlyOwnContent {
                    content = content.filter { item in
                        isOwnerVideo(item)
                    }
                }
                
                print("🌐 [ChannelDetailView] Switching to PUBLIC view - \(content.count) items from publicContent array (completely separate)")
            }
            
            // Mark as loaded if we have content
            if !content.isEmpty {
                hasLoadedOnce = true
                isLoading = false
                hasConfirmedNoContent = false
            } else {
                // If no content, show loading and trigger load
                isLoading = true
                loadContent()
            }
        } else {
            // Non-Twilly TV: Use filtering approach
            let hasCachedToFilter = !cachedUnfilteredContent.isEmpty || !content.isEmpty
            if !hasCachedToFilter {
                isLoading = true
            }
            applyVisibilityFilterInstantly()
            if content.isEmpty && previousContentBeforeFilter.isEmpty && !hasCachedToFilter {
                isLoading = true
            } else if !content.isEmpty {
                isLoading = false
            }
        }
        
        // CRITICAL: Toggle state AFTER content is set to prevent any flash
        // This ensures the UI reflects the correct state immediately
        // Use transaction to update icon immediately without animation delay
        var transaction = Transaction(animation: .none)
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            showPrivateContent.toggle()
        }
        
        // Trigger scroll to top immediately - this ensures we always start at top when toggling
        scrollToTopTrigger = UUID()
    }
    
    // MARK: - Favorites Functionality
    
    private func handleFavoritesToggle() {
        withAnimation {
            showFavoritesOnly.toggle()
        }
        
        // Apply favorites filter
        applyFavoritesFilter()
        
        // Trigger scroll to top
        scrollToTopTrigger = UUID()
    }
    
    private func applyFavoritesFilter() {
        if showFavoritesOnly {
            // Filter to show only favorites based on current view (public or private)
            let sourceContent: [ChannelContent]
            if bothViewsLoaded && currentChannel.channelName.lowercased() == "twilly tv" {
                // Use cached content for instant filtering
                sourceContent = showPrivateContent ? privateContent : publicContent
            } else {
                // Fallback to current content
                sourceContent = content
            }
            
            var filtered = sourceContent.filter { item in
                favoriteContentIds.contains(item.SK)
            }
            
            // Also apply "my content" filter if active
            if showOnlyOwnContent {
                filtered = filtered.filter { item in
                    isOwnerVideo(item)
                }
            }
            
            content = filtered
            print("⭐ [ChannelDetailView] Filtered to favorites\(showOnlyOwnContent ? " + own" : ""): \(filtered.count) items")
        } else {
            // Restore content based on current filters
            if bothViewsLoaded && currentChannel.channelName.lowercased() == "twilly tv" {
                // Use cached content
                if showPrivateContent {
                    content = privateContent
                    nextToken = privateNextToken
                    hasMoreContent = privateHasMore
                } else {
                    content = publicContent
                    nextToken = publicNextToken
                    hasMoreContent = publicHasMore
                }
                
                // Apply "my content" filter if active
                if showOnlyOwnContent {
                    content = content.filter { item in
                        isOwnerVideo(item)
                    }
                }
            } else {
                // Fallback: reload if cache not available
                Task {
                    try? await refreshChannelContent()
                }
            }
            print("⭐ [ChannelDetailView] Removed favorites filter, showing all content: \(content.count) items")
        }
    }
    
    private func toggleFavorite(for item: ChannelContent) {
        if favoriteContentIds.contains(item.SK) {
            favoriteContentIds.remove(item.SK)
            print("⭐ [ChannelDetailView] Removed from favorites: \(item.fileName)")
        } else {
            favoriteContentIds.insert(item.SK)
            print("⭐ [ChannelDetailView] Added to favorites: \(item.fileName)")
        }
        
        // Save favorites to UserDefaults
        saveFavoritesToUserDefaults()
        
        // If favorites filter is active, update the displayed content
        if showFavoritesOnly {
            applyFavoritesFilter()
        }
    }
    
    private func isFavorite(_ item: ChannelContent) -> Bool {
        return favoriteContentIds.contains(item.SK)
    }
    
    private func favoritesKey(for userEmail: String) -> String {
        return "favorites_\(userEmail)"
    }
    
    private func loadCurrentUserVisibility() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load user visibility - no user email")
            return
        }
        
        Task {
            do {
                let response = try await ChannelService.shared.getUsernameVisibility(userEmail: userEmail)
                await MainActor.run {
                    isCurrentUserPrivate = !(response.isPublic ?? true) // Default to public if not set
                    print("✅ [ChannelDetailView] Loaded current user visibility: \(isCurrentUserPrivate ? "private" : "public")")
                    print("   🔍 isCurrentUserPrivate state updated to: \(isCurrentUserPrivate)")
                    print("   🔍 This will trigger button re-render to show 'Add to Private' instead of 'Request🔒'")
                }
            } catch {
                await MainActor.run {
                    print("❌ [ChannelDetailView] Error loading user visibility: \(error)")
                    isCurrentUserPrivate = false // Default to public on error
                }
            }
        }
    }
    
    private func loadFavoritesFromUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load favorites - no user email")
            return
        }
        
        let key = favoritesKey(for: userEmail)
        if let data = UserDefaults.standard.data(forKey: key),
           let favorites = try? JSONDecoder().decode(Set<String>.self, from: data) {
            favoriteContentIds = favorites
            print("✅ [ChannelDetailView] Loaded \(favorites.count) favorites from UserDefaults")
        } else {
            favoriteContentIds = []
            print("ℹ️ [ChannelDetailView] No favorites found in UserDefaults")
        }
    }
    
    private func saveFavoritesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save favorites - no user email")
            return
        }
        
        let key = favoritesKey(for: userEmail)
        if let data = try? JSONEncoder().encode(favoriteContentIds) {
            UserDefaults.standard.set(data, forKey: key)
            print("✅ [ChannelDetailView] Saved \(favoriteContentIds.count) favorites to UserDefaults")
        } else {
            print("❌ [ChannelDetailView] Failed to encode favorites")
        }
    }
    
    private var backgroundGradient: some View {
        ZStack {
            // Base gradient
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.black,
                    Color(red: 0.08, green: 0.08, blue: 0.12),
                    Color(red: 0.1, green: 0.1, blue: 0.15)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            
            // Overlay gradient mesh for depth (only for Twilly TV)
            if currentChannel.channelName.lowercased() == "twilly tv" {
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.twillyTeal.opacity(0.08),
                        Color.clear,
                        Color.twillyCyan.opacity(0.06),
                        Color.clear
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                
                // Secondary diagonal gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.clear,
                        Color.twillyCyan.opacity(0.04),
                        Color.clear
                    ]),
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
            }
        }
        .ignoresSafeArea()
    }
    
    private var mainScrollView: some View {
        GeometryReader { geometry in
            ScrollViewReader { scrollReader in
                ZStack(alignment: .top) {
                    // Fixed header: poster + channel info + search box (everything up to search)
                    VStack(spacing: 0) {
                        // Poster that stays fixed
                        channelPoster
                            .frame(height: 200)
                            .frame(maxWidth: .infinity)
                            .clipped()
                        
                        // Channel info (includes search box for Twilly TV) - fixed up to search box
                        channelInfoFixed
                            .background(backgroundGradient)
                    }
                    .background(Color.black) // Solid opaque background to completely hide scrolling content behind
                    .zIndex(1)
                    
                    // Scrollable: divider + content cards
                    ScrollView {
                        VStack(spacing: 0) {
                            // Top anchors for scrolling - both always present for reliable scrolling
                            // Must be at the very top to scroll to absolute beginning
                            ZStack {
                                // Public anchor (always present)
                                Color.clear
                                    .frame(height: 1)
                                    .id("top-public")
                                
                                // Private anchor (always present, overlays public)
                                Color.clear
                                    .frame(height: 1)
                                    .id("top-private")
                            }
                            
                            // Spacer to account for fixed header height
                            // Poster (200) + channelInfo up to search box (~200-250)
                            // TIGHT spacing - content starts immediately after search box
                            Spacer()
                                .frame(height: 200 + 230) // Even tighter - content right at border
                            
                            // Divider and content scroll together - balanced spacing
                            VStack(spacing: 0) {
                                Divider()
                                    .background(Color.white.opacity(0.2))
                                    .padding(.vertical, 8) // Comfortable divider padding
                                
                                contentSection
                                    .padding(.top, 12) // Small space below border for breathing room
                            }
                            .id("content-\(showPrivateContent ? "private" : "public")")
                        }
                    }
                    .coordinateSpace(name: "scroll")
                    .refreshable {
                        await refreshContent()
                    }
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 20)
                            .onEnded { value in
                                let horizontalMovement = abs(value.translation.width)
                                let verticalMovement = abs(value.translation.height)
                                
                                // Swipe RIGHT (from left to right, positive width) to go to stream screen
                                // Only process as swipe if horizontal movement is significant and greater than vertical
                                if horizontalMovement > 50 && horizontalMovement > verticalMovement {
                                    if value.translation.width > 80 || value.predictedEndTranslation.width > 150 {
                                        // Post notification to show stream screen
                                        print("✅ [ChannelDetailView] Swipe RIGHT detected on ScrollView → Going to Stream screen")
                                        NotificationCenter.default.post(
                                            name: NSNotification.Name("ShowStreamScreen"),
                                            object: nil
                                        )
                                        // Dismiss channel view to show stream screen
                                        dismiss()
                                    }
                                }
                            }
                    )
                    .onAppear {
                        // Reset scroll position to top when view appears
                        let anchorId = "top-\(showPrivateContent ? "private" : "public")"
                        DispatchQueue.main.async {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                        // Also try after a short delay to ensure it works
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                    }
                    .onChange(of: scrollToTopTrigger) { _ in
                        // Reset scroll position to top when trigger changes
                        let anchorId = "top-\(showPrivateContent ? "private" : "public")"
                        // Use DispatchQueue to ensure scroll happens after view updates
                        DispatchQueue.main.async {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                        // Also try after a short delay to ensure it works
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                    }
                    .onChange(of: showPrivateContent) { newValue in
                        // Always scroll to top when toggling between public and private
                        // This ensures independent scroll positions for public and private views
                        // The separate top anchors ensure each view starts at its own top position
                        let anchorId = "top-\(newValue ? "private" : "public")"
                        // Use DispatchQueue to ensure scroll happens after view updates
                        DispatchQueue.main.async {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                        // Also try after a short delay to ensure it works
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            scrollReader.scrollTo(anchorId, anchor: .top)
                        }
                    }
                }
            }
        }
    }
    
    // Channel info fixed part (up to and including search box)
    private var channelInfoFixed: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Hide channel name for Twilly TV
            if currentChannel.channelName.lowercased() != "twilly tv" {
                Text(currentChannel.channelName)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
            
            if !currentChannel.description.isEmpty {
                Text(currentChannel.description)
                    .font(.body)
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.top, currentChannel.channelName.lowercased() == "twilly tv" ? 0 : 4)
            }
            
            // Show badges and buttons based on user role
            VStack(alignment: .leading, spacing: 8) {
                // Collaborator badge
                if canStream {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                        Text("Collaborator")
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.twillyCyan)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.twillyTeal.opacity(0.3),
                                Color.twillyCyan.opacity(0.2)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(8)
                }
                
                // Stream button
                if canStream {
                    Button(action: {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("StartStreamingFromChannel"),
                            object: nil,
                            userInfo: [
                                "channelName": currentChannel.channelName,
                                "channelId": currentChannel.channelId
                            ]
                        )
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: "video.fill")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Stream")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.twillyTeal,
                                    Color.twillyCyan
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                        .shadow(color: Color.twillyCyan.opacity(0.4), radius: 8, x: 0, y: 4)
                    }
                }
                
                // For Twilly TV, show inline username search bar - THIS IS THE FIXED PART
                if currentChannel.channelName.lowercased() == "twilly tv" {
                    VStack(alignment: .leading, spacing: 8) {
                        // Search bar
                        HStack(spacing: 12) {
                            // Toggle added usernames dropdown
                            Button(action: {
                                withAnimation {
                                    // If search is active, exit search instead of showing dropdown
                                    if showSearchDropdown || !usernameSearchText.isEmpty {
                                        // Exit search
                                        usernameSearchText = ""
                                        usernameSearchResults = []
                                        showSearchDropdown = false
                                        isSearchFieldFocused = false
                                    } else {
                                        // Show added usernames dropdown
                                        showAddedUsernamesDropdown.toggle()
                                        if showAddedUsernamesDropdown {
                                            showSearchDropdown = false
                                            usernameSearchResults = []
                                        }
                                    }
                                }
                            }) {
                                ZStack(alignment: .topTrailing) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "person.2.fill")
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal,
                                                Color.twillyCyan
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .cornerRadius(8)
                                    
                                    let totalUsernamesCount = getAllUsernamesForDropdown().count
                                    if totalUsernamesCount > 0 {
                                        Text("\(totalUsernamesCount)")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 2)
                                            .background(Color.orange)
                                            .clipShape(Capsule())
                                            .offset(x: 8, y: -8)
                                    }
                                }
                            }
                            
                            TextField("Add Streamers to your timeline", text: $usernameSearchText)
                                .foregroundColor(.white)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .submitLabel(.done)
                                .focused($isSearchFieldFocused)
                                .onChange(of: usernameSearchText) { newValue in
                                    handleSearchTextChange(newValue: newValue)
                                }
                                .onSubmit {
                                    // Dismiss keyboard when user presses done
                                    isSearchFieldFocused = false
                                }
                            
                            if !usernameSearchText.isEmpty {
                                Button(action: {
                                    usernameSearchText = ""
                                    usernameSearchResults = []
                                    showSearchDropdown = false
                                    isSearchFieldFocused = false // Dismiss keyboard
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white.opacity(0.6))
                                }
                            }
                            
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.6))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Search results dropdown - fixed (stays with search box)
                        if showSearchDropdown {
                            searchResultsDropdown
                        }
                        
                        // Added usernames dropdown - fixed (stays with search box)
                        if showAddedUsernamesDropdown {
                            addedUsernamesDropdown
                        }
                    }
                    .padding(.top, 8)
                    .onTapGesture {
                        // Dismiss keyboard when tapping outside search field
                        isSearchFieldFocused = false
                    }
                    .gesture(
                        DragGesture(minimumDistance: 50, coordinateSpace: .local)
                            .onEnded { value in
                                // Swipe up to exit search
                                if value.translation.height < -50 && (showSearchDropdown || !usernameSearchText.isEmpty) {
                                    withAnimation {
                                        usernameSearchText = ""
                                        usernameSearchResults = []
                                        showSearchDropdown = false
                                        isSearchFieldFocused = false
                                    }
                                }
                            }
                    )
                }
                
                // Viewer badge
                if !canStream && currentChannel.channelName.lowercased() != "twilly tv" {
                    HStack(spacing: 4) {
                        Image(systemName: "eye.fill")
                            .font(.caption2)
                        Text("Viewer")
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.white.opacity(0.15),
                                Color.white.opacity(0.1)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(8)
                }
                
                // Show refresh message if no new content
                if let message = refreshMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.top, 4)
                }
            }
            .padding(.top, 8)
        }
        .padding(.horizontal)
        .padding(.top, 12)
    }
    
    // Added usernames dropdown (extracted for reuse)
    // Shows ONLY public added usernames with deselection buttons
    // CRITICAL: Does NOT show follow requests - those are for private accounts only
    private var addedUsernamesDropdown: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Get public added usernames only
            let allUsernames = getAllUsernamesForDropdown()
            
            if allUsernames.isEmpty {
                if showEmptyMessage {
                    Text("All usernames removed")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.twillyCyan)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .transition(.opacity.combined(with: .scale))
                        .animation(.easeInOut(duration: 0.3), value: showEmptyMessage)
                } else {
                    Text("No added usernames")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                }
            } else {
                let filteredUsernames = allUsernames.filter { item in
                    if usernameSearchText.isEmpty {
                        return true
                    }
                    return item.username.lowercased().contains(usernameSearchText.lowercased())
                }
                
                if filteredUsernames.isEmpty {
                    Text("No usernames found")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                } else {
                    ForEach(filteredUsernames) { item in
                        HStack {
                            // Icon - only show checkmark for added (public) usernames
                            // CRITICAL: This dropdown only shows public added usernames, no follow requests
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.twillyCyan)
                            
                            Text(item.username)
                                .font(.body) // Fixed font size for all usernames
                                .foregroundColor(.white)
                                .lineLimit(1)
                                .truncationMode(.tail) // Truncate with ellipsis if too long
                            
                            Spacer()
                            
                            // Deselection buttons - both say "Remove"
                            HStack(spacing: 8) {
                                // "Remove" button for added - only show if added
                                // CRITICAL: Pass visibility to ensure we remove the correct entry (public vs private)
                                if item.isAdded {
                                    Button(action: {
                                        print("🟡 [ChannelDetailView] Removing Added from dropdown: \(item.username) (visibility: \(item.addedVisibility ?? "public"))")
                                        deselectAddedUsername(item.username, email: item.email, visibility: item.addedVisibility)
                                    }) {
                                        Text("Remove")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.twillyCyan)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(Color.twillyCyan.opacity(0.2))
                                            .cornerRadius(6)
                                    }
                                }
                                
                                // "Remove" button removed - private follow requests no longer supported
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.05))
                        
                        if item.id != filteredUsernames.last?.id {
                            Divider()
                                .background(Color.white.opacity(0.1))
                        }
                    }
                }
            }
        }
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
        .padding(.top, 4)
    }
    
    // Check if all usernames are empty and auto-close dropdown with flash message
    private func checkAndAutoCloseIfEmpty() {
        let allUsernames = getAllUsernamesForDropdown()
        
        if allUsernames.isEmpty && showAddedUsernamesDropdown {
            // Show flash message
            showEmptyMessage = true
            
            // After 1.5 seconds, close dropdown and focus search field
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds
                
                await MainActor.run {
                    withAnimation {
                        showAddedUsernamesDropdown = false
                        showEmptyMessage = false
                        // Focus the search field
                        isSearchFieldFocused = true
                    }
                }
            }
        }
    }
    
    // Helper struct for dropdown items
    private struct UsernameDropdownItem: Identifiable {
        let id: String
        let username: String
        let email: String?
        let isAdded: Bool
        let isRequested: Bool
        let addedVisibility: String? // Track visibility for added entries (public/private)
    }
    
    // Get all usernames for dropdown display
    // CRITICAL: ONLY show public added usernames - NO follow requests, NO private usernames
    private func getAllUsernamesForDropdown() -> [UsernameDropdownItem] {
        var usernameMap: [String: UsernameDropdownItem] = [:]
        
        // Add all added usernames (filter out empty usernames, private usernames, and locks)
        // CRITICAL: Only show public usernames in the dropdown
        for addedUsername in addedUsernames {
            let cleanUsername = addedUsername.streamerUsername.trimmingCharacters(in: .whitespaces)
            // Skip empty usernames
            guard !cleanUsername.isEmpty else {
                print("⚠️ [ChannelDetailView] Skipping empty username in addedUsernames")
                continue
            }
            
            // CRITICAL: Filter out private usernames and usernames with locks
            let visibility = addedUsername.streamerVisibility?.lowercased() ?? "public"
            if visibility == "private" || addedUsername.streamerUsername.contains("🔒") {
                continue
            }
            
            let usernameLower = cleanUsername.lowercased()
            
            // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
            if let currentUsername = authService.username?.lowercased(), usernameLower == currentUsername {
                print("🚫 [ChannelDetailView] Filtering out user's own username '\(cleanUsername)' from added usernames dropdown")
                continue
            }
            
            // Use visibility in the key (but we only show public now)
            let key = "\(usernameLower):public"
            
            usernameMap[key] = UsernameDropdownItem(
                id: "added-\(usernameLower)-public",
                username: cleanUsername,
                email: addedUsername.streamerEmail,
                isAdded: true,
                isRequested: false,
                addedVisibility: "public"
            )
        }
        
        // CRITICAL: DO NOT include sentFollowRequests in the public dropdown
        // Follow requests are for private accounts and should NOT appear in the public added usernames list
        // The public dropdown should ONLY show public added usernames
        
        // Filter out any items with empty usernames (safety check)
        let validItems = Array(usernameMap.values).filter { !$0.username.trimmingCharacters(in: .whitespaces).isEmpty }
        
        return validItems.sorted { $0.username.lowercased() < $1.username.lowercased() }
    }
    
    private var channelHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            channelPoster
            channelInfo
        }
        .padding(.top)
    }
    
    private var channelPoster: some View {
        Group {
            if !currentChannel.posterUrl.isEmpty {
                // Validate URL before creating
                if let url = URL(string: currentChannel.posterUrl) {
                    // Check if it's an SVG file
                    if currentChannel.posterUrl.lowercased().hasSuffix(".svg") {
                        // Use SVG view for SVG files
                        ZStack {
                            SVGImageView(url: url)
                                .scaledToFill()
                            
                            // Overlay gradient mesh for depth
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.twillyTeal.opacity(0.15),
                                    Color.clear,
                                    Color.twillyCyan.opacity(0.1)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            
                            // Diagonal accent line
                            GeometryReader { geometry in
                                Path { path in
                                    path.move(to: CGPoint(x: 0, y: geometry.size.height * 0.3))
                                    path.addLine(to: CGPoint(x: geometry.size.width * 0.4, y: 0))
                                }
                                .stroke(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyCyan.opacity(0.6),
                                            Color.clear
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    lineWidth: 2
                                )
                            }
                        }
                        .onAppear {
                            print("✅ [ChannelDetailView] Loading SVG poster")
                            print("   URL: \(currentChannel.posterUrl)")
                        }
                    } else {
                        // Use AsyncImage for raster images (PNG, JPEG, etc.)
                        ZStack {
                            AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFill()
                                    .onAppear {
                                        print("✅ [ChannelDetailView] Successfully loaded poster image")
                                        print("   URL: \(currentChannel.posterUrl)")
                                    }
                            case .failure(let error):
                                posterPlaceholder
                                    .onAppear {
                                        print("❌ [ChannelDetailView] Failed to load poster image")
                                        print("   Error: \(error.localizedDescription)")
                                        print("   Error type: \(type(of: error))")
                                        if let urlError = error as? URLError {
                                            print("   URL Error code: \(urlError.code.rawValue)")
                                            print("   URL Error description: \(urlError.localizedDescription)")
                                        }
                                        print("   Poster URL: \(currentChannel.posterUrl)")
                                        print("   Channel: \(currentChannel.channelName)")
                                        print("   Creator Email: \(currentChannel.creatorEmail)")
                                    }
                            case .empty:
                                posterPlaceholder
                                    .onAppear {
                                        print("⏳ [ChannelDetailView] Poster image is loading (empty state)")
                                        print("   URL: \(currentChannel.posterUrl)")
                                    }
                            @unknown default:
                                posterPlaceholder
                                    .onAppear {
                                        print("⚠️ [ChannelDetailView] Unknown AsyncImage phase")
                                        print("   URL: \(currentChannel.posterUrl)")
                                    }
                            }
                            }
                            
                            // Overlay gradient mesh for depth and atmosphere
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.twillyTeal.opacity(0.2),
                                    Color.clear,
                                    Color.twillyCyan.opacity(0.15),
                                    Color.clear
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            
                            // Diagonal accent line for visual interest
                            GeometryReader { geometry in
                                Path { path in
                                    path.move(to: CGPoint(x: 0, y: geometry.size.height * 0.25))
                                    path.addLine(to: CGPoint(x: geometry.size.width * 0.35, y: 0))
                                }
                                .stroke(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyCyan.opacity(0.7),
                                            Color.clear
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    lineWidth: 2.5
                                )
                            }
                        }
                    }
                } else {
                    posterPlaceholder
                        .onAppear {
                            print("❌ [ChannelDetailView] Invalid poster URL - cannot create URL object")
                            print("   Raw posterUrl string: '\(currentChannel.posterUrl)'")
                            print("   Channel: \(currentChannel.channelName)")
                            print("   Creator Email: \(currentChannel.creatorEmail)")
                        }
                }
            } else {
                posterPlaceholder
                    .onAppear {
                        print("⚠️ [ChannelDetailView] Poster URL is empty for channel: \(currentChannel.channelName)")
                        print("   Creator Email: \(currentChannel.creatorEmail)")
                        print("   Channel ID: \(currentChannel.channelId)")
                    }
            }
        }
        .background(Color.black) // Solid opaque background to completely hide content behind poster
        .frame(maxWidth: .infinity)
        .frame(height: currentChannel.channelName.lowercased() == "twilly tv" ? 240 : 200) // Taller for Twilly TV
        .clipped()
        .cornerRadius(currentChannel.channelName.lowercased() == "twilly tv" ? 20 : 12) // More rounded for Twilly TV
        .overlay(
            RoundedRectangle(cornerRadius: currentChannel.channelName.lowercased() == "twilly tv" ? 20 : 12)
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.twillyTeal.opacity(0.4),
                            Color.twillyCyan.opacity(0.3),
                            Color.twillyTeal.opacity(0.4)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
        )
        .shadow(color: Color.twillyCyan.opacity(0.3), radius: 16, x: 0, y: 8)
        .shadow(color: Color.black.opacity(0.4), radius: 8, x: 0, y: 4)
        .onAppear {
            print("🖼️ [ChannelDetailView] ChannelPoster onAppear")
            print("   Channel: \(currentChannel.channelName)")
            print("   Channel ID: \(currentChannel.channelId)")
            print("   Creator Email: \(currentChannel.creatorEmail)")
            print("   Creator Username: \(currentChannel.creatorUsername)")
            print("   Poster URL: \(currentChannel.posterUrl.isEmpty ? "EMPTY" : currentChannel.posterUrl)")
            print("   Poster URL length: \(currentChannel.posterUrl.count) characters")
            if !currentChannel.posterUrl.isEmpty {
                if let url = URL(string: currentChannel.posterUrl) {
                    print("   ✅ URL is valid")
                    print("   URL scheme: \(url.scheme ?? "nil")")
                    print("   URL host: \(url.host ?? "nil")")
                    print("   URL path: \(url.path)")
                } else {
                    print("   ❌ URL is INVALID - cannot parse")
                }
            }
        }
    }
    
    private var posterPlaceholder: some View {
        ZStack {
            // Multi-layer gradient mesh for depth
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.twillyTeal.opacity(0.3),
                    Color.twillyCyan.opacity(0.2),
                    Color.twillyTeal.opacity(0.15)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Secondary gradient overlay
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.clear,
                    Color.twillyCyan.opacity(0.1),
                    Color.clear
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            
            // Geometric pattern overlay
            GeometryReader { geometry in
                Path { path in
                    // Diagonal lines for visual interest
                    for i in 0..<5 {
                        let offset = CGFloat(i) * 40
                        path.move(to: CGPoint(x: -20 + offset, y: 0))
                        path.addLine(to: CGPoint(x: geometry.size.width + 20 + offset, y: geometry.size.height))
                    }
                }
                .stroke(
                    Color.twillyCyan.opacity(0.1),
                    lineWidth: 1
                )
            }
            
            Image(systemName: "tv.fill")
                .font(.system(size: 70, weight: .ultraLight))
                .foregroundStyle(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.twillyTeal.opacity(0.8),
                            Color.twillyCyan.opacity(0.9),
                            Color.twillyTeal.opacity(0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: Color.twillyCyan.opacity(0.5), radius: 12)
        }
    }
    
    // Check if current user is admin
    private var isAdminUser: Bool {
        guard let userEmail = authService.userEmail else {
            return false
        }
        return userRoleService.isAdmin(userEmail: userEmail)
    }
    
    // Load creator's air schedule for displaying labels
    private func loadCreatorAirSchedule() {
        Task {
            do {
                let response = try await ChannelService.shared.getAirSchedule(userEmail: currentChannel.creatorEmail)
                if let schedule = response.schedule,
                   let day = schedule.airDay,
                   let time = schedule.airTime {
                    await MainActor.run {
                        creatorAirSchedule[currentChannel.creatorEmail] = (day: day, time: time)
                    }
                }
            } catch {
                print("⚠️ [ChannelDetailView] Could not load creator air schedule: \(error.localizedDescription)")
            }
        }
    }
    
    // Load current user's schedule status (for admin stream button visibility)
    private func loadUserScheduleStatus() {
        Task {
            guard let userEmail = authService.userEmail else {
                return
            }
            
            do {
                let response = try await ChannelService.shared.getAirSchedule(userEmail: userEmail)
                if let schedule = response.schedule {
                    await MainActor.run {
                        userScheduleLocked = schedule.isLocked ?? false
                        userSchedulePaused = schedule.isPaused ?? false
                        print("✅ [ChannelDetailView] User schedule status - locked: \(userScheduleLocked), paused: \(userSchedulePaused)")
                    }
                }
            } catch {
                print("⚠️ [ChannelDetailView] Could not load user schedule status: \(error.localizedDescription)")
            }
        }
    }
    
    // Load current user's post automatically status (for admin stream button visibility)
    private func loadUserPostAutomatically() {
        Task {
            guard let userEmail = authService.userEmail else {
                return
            }
            
            do {
                let postAuto = try await ChannelService.shared.getPostAutomatically(userEmail: userEmail)
                await MainActor.run {
                    userPostAutomatically = postAuto
                    print("✅ [ChannelDetailView] User post automatically: \(userPostAutomatically)")
                }
            } catch {
                print("⚠️ [ChannelDetailView] Could not load post automatically status: \(error.localizedDescription)")
            }
        }
    }
    
    // UserDefaults key for persisting added usernames
    private func addedUsernamesKey(for userEmail: String) -> String {
        return "addedUsernames_\(userEmail)"
    }
    
    private func addedPrivateUsernamesKey(for userEmail: String) -> String {
        return "addedPrivateUsernames_\(userEmail)"
    }
    
    private func saveAddedPrivateUsernamesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save private usernames to UserDefaults - userEmail is nil")
            return
        }
        
        let key = addedPrivateUsernamesKey(for: userEmail)
        print("🔑 [ChannelDetailView] Saving private usernames to UserDefaults with key: \(key)")
        
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(addedPrivateUsernames)
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
            print("💾 [ChannelDetailView] Saved \(addedPrivateUsernames.count) private usernames to UserDefaults (key: \(key))")
        } catch {
            print("❌ [ChannelDetailView] Error saving private usernames to UserDefaults: \(error)")
        }
    }
    
    private func loadAddedPrivateUsernamesFromUserDefaults() -> [AddedUsername] {
        guard let userEmail = authService.userEmail else {
            return []
        }
        
        let key = addedPrivateUsernamesKey(for: userEmail)
        guard let data = UserDefaults.standard.data(forKey: key) else {
            return []
        }
        
        do {
            let decoder = JSONDecoder()
            return try decoder.decode([AddedUsername].self, from: data)
        } catch {
            print("❌ [ChannelDetailView] Error loading private usernames from UserDefaults: \(error)")
            return []
        }
    }
    
    // Cache key for inbox count
    private func inboxCountCacheKey(for userEmail: String) -> String {
        return "inboxCount_\(userEmail)"
    }
    
    // Load inbox count from cache immediately
    private func loadUnreadAccessInboxCountFromCache() {
        guard let userEmail = authService.userEmail else { return }
        
        let key = inboxCountCacheKey(for: userEmail)
        if let cachedCount = UserDefaults.standard.object(forKey: key) as? Int {
            unreadAccessInboxCount = cachedCount
            print("📬 [ChannelDetailView] Loaded inbox count from cache: \(cachedCount)")
        }
    }
    
    // Save inbox count to cache
    private func saveUnreadAccessInboxCountToCache(count: Int) {
        guard let userEmail = authService.userEmail else { return }
        
        let key = inboxCountCacheKey(for: userEmail)
        UserDefaults.standard.set(count, forKey: key)
        UserDefaults.standard.synchronize()
    }
    
    private func loadUnreadAccessInboxCount() {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                // Get ALL notifications (not just unread) to filter properly
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                await MainActor.run {
                    let allNotifications = response.notifications ?? []
                    
                    // Count only unread private_access_granted notifications
                    let unreadPrivateAccess = allNotifications.filter { notification in
                        notification.type == "private_access_granted" && !notification.isRead
                    }
                    
                    let newCount = unreadPrivateAccess.count
                    unreadAccessInboxCount = newCount
                    // Save to cache for instant display on next load
                    saveUnreadAccessInboxCountToCache(count: newCount)
                    print("📬 [ChannelDetailView] Unread access inbox count: \(newCount) (from \(allNotifications.count) total notifications)")
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading unread access inbox count: \(error)")
                await MainActor.run {
                    unreadAccessInboxCount = 0
                }
            }
        }
    }
    
    private func startInboxPolling() {
        // Cancel existing polling task
        inboxPollTask?.cancel()
        
        // WebSocket is primary - polling is fallback only (30 seconds)
        // This ensures inbox updates even if WebSocket temporarily disconnects
        inboxPollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds (reduced from 10s since WebSocket is primary)
                if !Task.isCancelled {
                    loadUnreadAccessInboxCount()
                }
            }
        }
    }
    
    private func loadAccessInboxNotifications() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load access inbox notifications - userEmail is nil")
            return
        }
        
        isLoadingAccessInbox = true
        Task {
            do {
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                await MainActor.run {
                    // Filter to only show private_access_granted notifications
                    let privateAccessNotifications = (response.notifications ?? []).filter { notification in
                        notification.type == "private_access_granted"
                    }
                    
                    // Convert AppNotification to AccessInboxNotification and store full data
                    var notificationMap: [String: AppNotification] = [:]
                    accessInboxNotifications = privateAccessNotifications.map { notification in
                        let ownerUsername = notification.metadata?["ownerUsername"] ?? "Unknown"
                        let dateFormatter = ISO8601DateFormatter()
                        let date = dateFormatter.date(from: notification.createdAt) ?? Date()
                        
                        // Store full notification data for mark as read/delete operations
                        // Ensure SK is set correctly for delete operations
                        notificationMap[notification.id] = notification
                        
                        print("📋 [ChannelDetailView] Stored notification \(notification.id) with SK: \(notification.SK ?? "nil")")
                        
                        return AccessInboxNotification(
                            id: notification.id,
                            message: notification.message,
                            timestamp: date,
                            ownerUsername: ownerUsername,
                            isRead: notification.isRead
                        )
                    }
                    .filter { !$0.message.isEmpty } // Filter out any invalid notifications
                    .sorted { $0.timestamp > $1.timestamp } // Most recent first
                    
                    accessInboxNotificationData = notificationMap
                    
                    isLoadingAccessInbox = false
                    print("✅ [ChannelDetailView] Loaded \(accessInboxNotifications.count) access inbox notifications")
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading access inbox notifications: \(error)")
                await MainActor.run {
                    isLoadingAccessInbox = false
                }
            }
        }
    }
    
    private func markNotificationAsRead(notificationId: String) {
        guard let userEmail = authService.userEmail,
              let notification = accessInboxNotificationData[notificationId] else {
            print("⚠️ [ChannelDetailView] Cannot mark notification as read - missing data")
            return
        }
        
        // Optimistic update
        if let index = accessInboxNotifications.firstIndex(where: { $0.id == notificationId }) {
            accessInboxNotifications[index] = AccessInboxNotification(
                id: notification.id,
                message: notification.message,
                timestamp: accessInboxNotifications[index].timestamp,
                ownerUsername: accessInboxNotifications[index].ownerUsername,
                isRead: true
            )
        }
        
        // Update unread count immediately
        loadUnreadAccessInboxCount()
        
        // Call API
        Task {
            do {
                _ = try await ChannelService.shared.markNotificationRead(userEmail: userEmail, notificationId: notificationId)
                print("✅ [ChannelDetailView] Notification marked as read")
            } catch {
                print("❌ [ChannelDetailView] Error marking notification as read: \(error)")
                // Revert optimistic update on error
                if let index = accessInboxNotifications.firstIndex(where: { $0.id == notificationId }) {
                    accessInboxNotifications[index] = AccessInboxNotification(
                        id: notification.id,
                        message: notification.message,
                        timestamp: accessInboxNotifications[index].timestamp,
                        ownerUsername: accessInboxNotifications[index].ownerUsername,
                        isRead: false
                    )
                }
            }
        }
    }
    
    private func deleteNotification(notificationId: String) {
        guard let userEmail = authService.userEmail,
              let notification = accessInboxNotificationData[notificationId] else {
            print("⚠️ [ChannelDetailView] Cannot delete notification - missing data")
            return
        }
        
        // Optimistic update - remove from list
        accessInboxNotifications.removeAll { $0.id == notificationId }
        accessInboxNotificationData.removeValue(forKey: notificationId)
        
        // Update unread count immediately
        loadUnreadAccessInboxCount()
        
        // Call API to delete
        Task {
            do {
                // Extract SK from notification data - must be full SK format
                let sk: String
                if let notificationSK = notification.SK, !notificationSK.isEmpty {
                    sk = notificationSK
                } else {
                    // Fallback: construct SK from ID
                    sk = "NOTIFICATION#\(notificationId)"
                }
                
                print("🗑️ [ChannelDetailView] Deleting notification with SK: \(sk)")
                try await deleteNotificationFromBackend(userEmail: userEmail, sk: sk)
                print("✅ [ChannelDetailView] Notification deleted successfully")
            } catch {
                print("❌ [ChannelDetailView] Error deleting notification: \(error.localizedDescription)")
                // Reload notifications on error to restore
                await MainActor.run {
                    loadAccessInboxNotifications()
                }
            }
        }
    }
    
    private func deleteNotificationFromBackend(userEmail: String, sk: String) async throws {
        // Create delete notification endpoint call
        guard let url = URL(string: "https://twilly.app/api/users/delete-notification") else {
            throw NSError(domain: "ChannelDetailView", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "notificationSK": sk
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "ChannelDetailView", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response type"])
        }
        
        // Check for successful status codes (200-299)
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [ChannelDetailView] Delete notification failed with status \(httpResponse.statusCode): \(errorMessage)")
            throw NSError(domain: "ChannelDetailView", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Delete failed: \(errorMessage)"])
        }
        
        // Try to parse response to verify it's valid JSON
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("✅ [ChannelDetailView] Delete notification response: \(json)")
        }
    }
    
    private func loadAddedPrivateUsernames(mergeWithExisting: Bool = false) {
        // CRITICAL: Load from cache first (same as public usernames)
        let cached = loadAddedPrivateUsernamesFromUserDefaults()
        
        // Always use cached data immediately if available (for instant UI update)
        // Filter cached to only include private usernames
        let cachedPrivate = cached.filter { 
            ($0.streamerVisibility?.lowercased() ?? "public") == "private"
        }
        
        if !cachedPrivate.isEmpty {
            if mergeWithExisting {
                // Merge cached with existing, avoiding duplicates
                var merged = addedPrivateUsernames
                for cachedUsername in cachedPrivate {
                    let exists = merged.contains(where: {
                        $0.streamerUsername.lowercased() == cachedUsername.streamerUsername.lowercased() &&
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    })
                    if !exists {
                        merged.append(cachedUsername)
                    }
                }
                addedPrivateUsernames = merged
            } else {
                // Use cached data immediately
                addedPrivateUsernames = cachedPrivate
            }
            print("✅ [ChannelDetailView] Loaded \(addedPrivateUsernames.count) private usernames from cache")
        } else {
            print("⚠️ [ChannelDetailView] No cached private usernames found")
        }
        
        // Then load from server
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.getAddedUsernames(userEmail: userEmail)
                await MainActor.run {
                    // Filter to only private usernames
                    let allPrivate = (response.addedUsernames ?? []).filter { 
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    }
                    
                    if mergeWithExisting {
                        // Merge server data with cached (preserve optimistic updates)
                        var merged: [AddedUsername] = []
                        var seenEntries = Set<String>()
                        
                        // First, add all server usernames (server is source of truth)
                        for serverUsername in allPrivate {
                            let usernameLower = serverUsername.streamerUsername.lowercased()
                            let key = "\(usernameLower):private"
                            if !seenEntries.contains(key) {
                                merged.append(serverUsername)
                                seenEntries.insert(key)
                            }
                        }
                        
                        // Then, add cached private usernames that aren't in server (optimistic updates)
                        for cachedUsername in cachedPrivate {
                            let usernameLower = cachedUsername.streamerUsername.lowercased()
                            let key = "\(usernameLower):private"
                            if !seenEntries.contains(key) {
                                merged.append(cachedUsername)
                                seenEntries.insert(key)
                            }
                        }
                        
                        addedPrivateUsernames = merged
                        print("✅ [ChannelDetailView] Merged \(addedPrivateUsernames.count) private usernames (server + cache)")
                    } else {
                        // If server has data, use it; otherwise keep cache
                        if !allPrivate.isEmpty {
                            addedPrivateUsernames = allPrivate
                        }
                    }
                    
                    // CRITICAL: Save to UserDefaults (preserve optimistic updates)
                    saveAddedPrivateUsernamesToUserDefaults()
                }
            } catch {
                print("Error loading private usernames: \(error)")
            }
        }
    }
    
    // Save added usernames to UserDefaults
    private func saveAddedUsernamesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save to UserDefaults - userEmail is nil")
            return
        }
        
        // CRITICAL: Filter out private usernames BEFORE saving to cache
        // This ensures the cache NEVER contains private entries
        let cleanedForCache = addedUsernames.filter { username in
            let visibility = username.streamerVisibility?.lowercased() ?? "public"
            if visibility == "private" || username.streamerUsername.contains("🔒") {
                print("🚫 [ChannelDetailView] Preventing private username from being saved to cache: '\(username.streamerUsername)' (visibility: \(visibility))")
                return false
            }
            
            // Also filter out user's own username
            let lowercased = username.streamerUsername.lowercased()
            if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                print("🚫 [ChannelDetailView] Preventing user's own username from being saved to cache: '\(username.streamerUsername)'")
                return false
            }
            
            return true
        }
        
        let key = addedUsernamesKey(for: userEmail)
        print("🔑 [ChannelDetailView] Saving to UserDefaults with key: \(key)")
        
        // If we filtered out any usernames, log it
        if cleanedForCache.count != addedUsernames.count {
            print("🧹 [ChannelDetailView] Filtered out \(addedUsernames.count - cleanedForCache.count) private/invalid usernames before saving to cache")
        }
        
        do {
            let encoder = JSONEncoder()
            let encoded = try encoder.encode(cleanedForCache)
            UserDefaults.standard.set(encoded, forKey: key)
            UserDefaults.standard.synchronize() // Force immediate write
            print("💾 [ChannelDetailView] Saved \(cleanedForCache.count) added usernames to UserDefaults (key: \(key))")
            print("   📋 Usernames: \(cleanedForCache.map { "\($0.streamerUsername) (visibility: \($0.streamerVisibility ?? "public"))" }.joined(separator: ", "))")
        } catch {
            print("❌ [ChannelDetailView] Error saving added usernames to UserDefaults: \(error)")
            print("   Key used: \(key)")
        }
    }
    
    // Save sent follow requests to UserDefaults to persist optimistic updates
    private func saveSentFollowRequestsToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save sentFollowRequests to UserDefaults - userEmail is nil")
            return
        }
        
        // CRITICAL: Filter out user's own username before saving - users should never see themselves
        let currentUsername = authService.username?.lowercased()
        let filteredRequests = sentFollowRequests.filter { request in
            let requestUsername = request.requestedUsername.lowercased()
            if let current = currentUsername, requestUsername == current {
                print("🚫 [ChannelDetailView] Filtering out user's own username '\(request.requestedUsername)' before saving sentFollowRequests")
                return false
            }
            return true
        }
        
        let key = "sentFollowRequests_\(userEmail)"
        do {
            let encoder = JSONEncoder()
            let encoded = try encoder.encode(filteredRequests)
            UserDefaults.standard.set(encoded, forKey: key)
            UserDefaults.standard.synchronize() // CRITICAL: Force immediate write to disk
            print("💾 [ChannelDetailView] Saved \(filteredRequests.count) sent follow requests to UserDefaults (key: \(key))")
            print("   📋 Saved requests: \(filteredRequests.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
        } catch {
            print("❌ [ChannelDetailView] Failed to encode sentFollowRequests: \(error.localizedDescription)")
        }
    }
    
    // Load sent follow requests from UserDefaults (for optimistic updates persistence)
    // CRITICAL: This should ALWAYS load from cache first, before server data is fetched
    // This ensures optimistic updates persist across app restarts and logins
    // The cache is the source of truth for optimistic updates - server data will merge with it
    private func loadSentFollowRequestsFromUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load sentFollowRequests from UserDefaults - userEmail is nil")
            return
        }
        
        let key = "sentFollowRequests_\(userEmail)"
        if let data = UserDefaults.standard.data(forKey: key) {
            do {
                let decoder = JSONDecoder()
                let loaded = try decoder.decode([SentFollowRequest].self, from: data)
                
                // CRITICAL: Always merge cache with existing, prioritizing cache for optimistic updates
                // Cache contains the most recent user actions (like clicking "Request")
                // Server data will be merged later in loadSentFollowRequests()
                // CRITICAL: Filter out user's own username from cache - users should never see themselves
                let currentUsername = authService.username?.lowercased()
                let filteredLoaded = loaded.filter { request in
                    let requestUsername = request.requestedUsername.lowercased()
                    if let current = currentUsername, requestUsername == current {
                        print("🚫 [ChannelDetailView] Filtering out user's own username '\(request.requestedUsername)' from cached sentFollowRequests")
                        return false
                    }
                    return true
                }
                
                let cachedUsernames = Set(filteredLoaded.map { $0.requestedUsername.lowercased() })
                let existingUsernames = Set(sentFollowRequests.map { $0.requestedUsername.lowercased() })
                
                // Start with cached data (it has the most recent optimistic updates)
                var merged = filteredLoaded
                
                // Add any existing requests that aren't in cache (from previous server fetches)
                for existing in sentFollowRequests {
                    if !cachedUsernames.contains(existing.requestedUsername.lowercased()) {
                        merged.append(existing)
                    }
                }
                
                sentFollowRequests = merged
                
                // CRITICAL: Clean up cache if it contained user's own username - remove it permanently
                if filteredLoaded.count < loaded.count {
                    print("🧹 [ChannelDetailView] Cleaning up cache - removing user's own username from UserDefaults")
                    saveSentFollowRequestsToUserDefaults() // Save filtered list back to cache
                }
                
                print("📂 [ChannelDetailView] Loaded \(filteredLoaded.count) sent follow requests from UserDefaults (cache restored)")
                print("   📋 Cached requests: \(filteredLoaded.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
                if merged.count > filteredLoaded.count {
                    print("   ➕ Merged with \(merged.count - filteredLoaded.count) existing requests from memory")
                }
            } catch {
                print("❌ [ChannelDetailView] Failed to decode sentFollowRequests: \(error.localizedDescription)")
            }
        } else {
            print("📭 [ChannelDetailView] No cached sentFollowRequests in UserDefaults")
        }
    }
    
    // Save removed usernames to UserDefaults
    private func saveRemovedUsernamesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save removedUsernames to UserDefaults - userEmail is nil")
            return
        }
        
        let key = "removedUsernames_\(userEmail)"
        let array = Array(removedUsernames)
        UserDefaults.standard.set(array, forKey: key)
        UserDefaults.standard.synchronize()
        print("💾 [ChannelDetailView] Saved \(removedUsernames.count) removed usernames to UserDefaults: \(array.joined(separator: ", "))")
    }
    
    // Load removed usernames from UserDefaults
    private func loadRemovedUsernamesFromUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load removedUsernames from UserDefaults - userEmail is nil")
            return
        }
        
        let key = "removedUsernames_\(userEmail)"
        if let array = UserDefaults.standard.array(forKey: key) as? [String] {
            removedUsernames = Set(array)
            print("📂 [ChannelDetailView] Loaded \(removedUsernames.count) removed usernames from UserDefaults: \(array.joined(separator: ", "))")
        } else {
            print("📭 [ChannelDetailView] No removed usernames in UserDefaults")
        }
    }
    
    // Load added usernames from UserDefaults
    private func loadAddedUsernamesFromUserDefaults() -> [AddedUsername] {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load from UserDefaults - userEmail is nil")
            return []
        }
        
        let key = addedUsernamesKey(for: userEmail)
        print("🔑 [ChannelDetailView] Attempting to load from UserDefaults with key: \(key)")
        
        guard let data = UserDefaults.standard.data(forKey: key) else {
            print("📭 [ChannelDetailView] No cached added usernames in UserDefaults for key: \(key)")
            return []
        }
        
        do {
            let decoder = JSONDecoder()
            let cached = try decoder.decode([AddedUsername].self, from: data)
            print("📂 [ChannelDetailView] Loaded \(cached.count) added usernames from UserDefaults (key: \(key))")
            print("   📋 Usernames: \(cached.map { "\($0.streamerUsername) (visibility: \($0.streamerVisibility ?? "public"))" }.joined(separator: ", "))")
            
            // CRITICAL: Filter out private usernames and usernames with locks BEFORE returning
            // This ensures private usernames never appear in the public list, even if cached
            let filtered = cached.filter { username in
                let visibility = username.streamerVisibility?.lowercased() ?? "public"
                if visibility == "private" || username.streamerUsername.contains("🔒") {
                    print("🚫 [ChannelDetailView] Filtering out private username from cache load: '\(username.streamerUsername)' (visibility: \(visibility))")
                    return false
                }
                
                // Also filter out user's own username
                let lowercased = username.streamerUsername.lowercased()
                if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                    print("🚫 [ChannelDetailView] Filtering out user's own username from cache load: '\(username.streamerUsername)'")
                    return false
                }
                
                return true
            }
            
            // If we filtered out any usernames, update the cache to remove them permanently
            if filtered.count != cached.count {
                print("🧹 [ChannelDetailView] Found \(cached.count - filtered.count) private/invalid usernames in cache - cleaning cache")
                // Save the cleaned version back to cache
                do {
                    let encoder = JSONEncoder()
                    let encoded = try encoder.encode(filtered)
                    UserDefaults.standard.set(encoded, forKey: key)
                    UserDefaults.standard.synchronize()
                    print("✅ [ChannelDetailView] Cleaned cache - removed private/invalid entries")
                } catch {
                    print("⚠️ [ChannelDetailView] Could not clean cache: \(error)")
                }
            }
            
            // CRITICAL: Clean lock emoji from all cached usernames
            return filtered.map { username in
                AddedUsername(
                    streamerEmail: username.streamerEmail,
                    streamerUsername: username.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces),
                    addedAt: username.addedAt,
                    streamerVisibility: username.streamerVisibility
                )
            }
        } catch {
            print("❌ [ChannelDetailView] Error loading added usernames from UserDefaults: \(error)")
            print("   Key used: \(key)")
            return []
        }
    }
    
    // Load added usernames for Twilly TV filtering
    private func loadAddedUsernames(mergeWithExisting: Bool = false) {
        // CRITICAL: DO NOT load sentFollowRequests here - they are COMPLETELY INDEPENDENT
        // Public "Add" and private "Request" should NEVER affect each other
        // Only load received follow requests (for badge count) - this is independent
        guard currentChannel.channelName.lowercased() == "twilly tv" else {
            return
        }
        
        // Load removed usernames from UserDefaults first (to filter cache and server data)
        loadRemovedUsernamesFromUserDefaults()
        print("🔍 [DEBUG] removedUsernames set contains: \(removedUsernames.map { $0 }.joined(separator: ", "))")
        
        // Try to load from UserDefaults first (even if email is temporarily unavailable)
        if !mergeWithExisting {
            if let userEmail = authService.userEmail {
                let cached = loadAddedUsernamesFromUserDefaults()
                print("🔍 [DEBUG] Cached usernames from UserDefaults: \(cached.map { $0.streamerUsername }.joined(separator: ", "))")
                
                // CRITICAL: Filter out removed usernames, private usernames, and locks from cache (check by username:visibility)
                let filteredCached = cached.filter { username in
                    // CRITICAL: Filter out private usernames and usernames with locks
                    let visibility = username.streamerVisibility?.lowercased() ?? "public"
                    if visibility == "private" || username.streamerUsername.contains("🔒") {
                        print("🚫 [DEBUG] Filtering out private username from cache: '\(username.streamerUsername)' (visibility: \(visibility))")
                        return false
                    }
                    
                    let lowercased = username.streamerUsername.lowercased()
                    
                    // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
                    if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                        print("🚫 [DEBUG] Filtering out user's own username '\(username.streamerUsername)' from cached usernames")
                        return false
                    }
                    
                    let entryKey = "\(lowercased):\(visibility)"
                    // Check both specific visibility and general username (for backward compatibility)
                    let isRemoved = removedUsernames.contains(entryKey) || removedUsernames.contains(lowercased)
                    if isRemoved {
                        print("🚫 [DEBUG] Filtering out removed username from cache: '\(username.streamerUsername)' (visibility: \(visibility), key: \(entryKey))")
                    }
                    return !isRemoved
                }
                if !filteredCached.isEmpty {
                    addedUsernames = filteredCached
                    print("✅ [ChannelDetailView] Loaded \(filteredCached.count) added usernames from cache (filtered from \(cached.count), excluded \(cached.count - filteredCached.count) removed)")
                } else if !cached.isEmpty {
                    print("⚠️ [ChannelDetailView] All \(cached.count) cached usernames were filtered out (removed)")
                    // CRITICAL: If all cached usernames were removed, clear the cache
                    // This ensures the cache doesn't persist stale data
                    UserDefaults.standard.removeObject(forKey: addedUsernamesKey(for: userEmail))
                    print("🧹 [ChannelDetailView] Cleared stale cache after filtering")
                }
            } else {
                // Email not available yet - try loading with a delay
                print("⚠️ [ChannelDetailView] userEmail not available yet, will retry loading from cache")
                Task {
                    // Wait a bit for auth to complete
                    try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                    await MainActor.run {
                        if let userEmail = authService.userEmail {
                            let cached = loadAddedUsernamesFromUserDefaults()
                            print("🔍 [DEBUG] Delayed load - Cached usernames: \(cached.map { $0.streamerUsername }.joined(separator: ", "))")
                            print("🔍 [DEBUG] Delayed load - removedUsernames: \(removedUsernames.map { $0 }.joined(separator: ", "))")
                            
                            // CRITICAL: Filter out removed usernames, private usernames, and locks from cache
                            let filteredCached = cached.filter { username in
                                // CRITICAL: Filter out private usernames and usernames with locks
                                let visibility = username.streamerVisibility?.lowercased() ?? "public"
                                if visibility == "private" || username.streamerUsername.contains("🔒") {
                                    print("🚫 [DEBUG] Delayed load - Filtering out private username: '\(username.streamerUsername)' (visibility: \(visibility))")
                                    return false
                                }
                                
                                let lowercased = username.streamerUsername.lowercased()
                                
                                // CRITICAL: Filter out user's own username
                                if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                                    print("🚫 [DEBUG] Delayed load - Filtering out user's own username: '\(username.streamerUsername)'")
                                    return false
                                }
                                
                                let entryKey = "\(lowercased):\(visibility)"
                                // Check both specific visibility and general username (for backward compatibility)
                                let isRemoved = removedUsernames.contains(entryKey) || removedUsernames.contains(lowercased)
                                if isRemoved {
                                    print("🚫 [DEBUG] Delayed load - Filtering out removed username: '\(username.streamerUsername)' (visibility: \(visibility), key: \(entryKey))")
                                }
                                return !isRemoved
                            }
                            if !filteredCached.isEmpty {
                                addedUsernames = filteredCached
                                print("✅ [ChannelDetailView] Loaded \(filteredCached.count) added usernames from cache (delayed load, filtered from \(cached.count))")
                            } else if !cached.isEmpty {
                                print("⚠️ [ChannelDetailView] All \(cached.count) cached usernames were filtered out (removed)")
                            }
                        }
                    }
                }
            }
        }
        
        // Now proceed with server load (requires email)
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot load from server - userEmail not available")
            return
        }
        
        isLoadingAddedUsernames = true
        Task {
            do {
                let response = try await ChannelService.shared.getAddedUsernames(userEmail: userEmail)
                await MainActor.run {
                    // CRITICAL: Preserve optimistic updates - do NOT clear cache if we're merging
                    // Only clear cache on initial load if server is explicitly empty AND we're certain it's the source of truth
                    let serverUsernames = response.addedUsernames ?? []
                    
                    // CRITICAL: If merging, preserve optimistic updates even if server returns empty
                    // The server might not have processed the optimistic update yet
                    if mergeWithExisting && !addedUsernames.isEmpty {
                        // Merge server data with existing optimistic updates
                        // CRITICAL: Do NOT add back usernames that were explicitly removed
                        print("🔍 [DEBUG] Server returned \(serverUsernames.count) usernames: \(serverUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                        print("🔍 [DEBUG] Current removedUsernames: \(removedUsernames.map { $0 }.joined(separator: ", "))")
                        
                        var mergedUsernames: [AddedUsername] = []
                        // CRITICAL: Track existing entries by BOTH username AND visibility
                        let existingEntries = Set(addedUsernames.map { 
                            "\($0.streamerUsername.lowercased()):\($0.streamerVisibility?.lowercased() ?? "public")"
                        })
                        let removedUsernamesLower = Set(removedUsernames.map { $0.lowercased() })
                        
                        // Start with existing (optimistic) usernames
                        mergedUsernames = addedUsernames
                        
                        // Add server usernames that aren't already in the list (by username+visibility) AND weren't explicitly removed
                        for serverUsername in serverUsernames {
                            // CRITICAL: Filter out private usernames and usernames with locks
                            let visibility = serverUsername.streamerVisibility?.lowercased() ?? "public"
                            if visibility == "private" || serverUsername.streamerUsername.contains("🔒") {
                                print("🚫 [DEBUG] Filtering out private username from merge: '\(serverUsername.streamerUsername)' (visibility: \(visibility))")
                                continue
                            }
                            
                            // CRITICAL: Clean lock emoji from username
                            let cleanedUsername = serverUsername.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
                            let serverUsernameLower = cleanedUsername.lowercased()
                            
                            // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
                            if let currentUsername = authService.username?.lowercased(), serverUsernameLower == currentUsername {
                                print("🚫 [DEBUG] Filtering out user's own username '\(cleanedUsername)' from merge")
                                continue
                            }
                            
                            let cleanedServerUsername = AddedUsername(
                                streamerEmail: serverUsername.streamerEmail,
                                streamerUsername: cleanedUsername,
                                addedAt: serverUsername.addedAt,
                                streamerVisibility: serverUsername.streamerVisibility
                            )
                            let serverVisibility = cleanedServerUsername.streamerVisibility?.lowercased() ?? "public"
                            let serverEntryKey = "\(serverUsernameLower):\(serverVisibility)"
                            let isInExisting = existingEntries.contains(serverEntryKey)
                            let isRemoved = removedUsernamesLower.contains(serverUsernameLower)
                            
                            print("🔍 [DEBUG] Processing server username: '\(cleanedUsername)' (visibility: \(serverVisibility), key: \(serverEntryKey)) - inExisting: \(isInExisting), isRemoved: \(isRemoved)")
                            
                            if !isInExisting && !isRemoved {
                                mergedUsernames.append(cleanedServerUsername)
                                print("   ➕ Added server username: \(cleanedUsername) (visibility: \(serverVisibility))")
                            } else if isRemoved {
                                print("   🚫 Skipping removed username from server: \(cleanedUsername)")
                            } else {
                                print("   ⏭️ Skipping username+visibility already in existing list: \(cleanedUsername) (visibility: \(serverVisibility))")
                            }
                        }
                        
                        // Update existing entries with server data (more accurate) but keep optimistic ones if server doesn't have them
                        // CRITICAL: Match by BOTH username AND visibility
                        for (index, existing) in mergedUsernames.enumerated() {
                            let existingVisibility = existing.streamerVisibility?.lowercased() ?? "public"
                            let existingUsernameLower = existing.streamerUsername.lowercased()
                            if let serverVersion = serverUsernames.first(where: { 
                                let serverUsernameLower = $0.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                                return serverUsernameLower == existingUsernameLower &&
                                ($0.streamerVisibility?.lowercased() ?? "public") == existingVisibility
                            }) {
                                // Clean server username before updating
                                let cleanedServerUsername = AddedUsername(
                                    streamerEmail: serverVersion.streamerEmail,
                                    streamerUsername: serverVersion.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces),
                                    addedAt: serverVersion.addedAt,
                                    streamerVisibility: serverVersion.streamerVisibility
                                )
                                mergedUsernames[index] = cleanedServerUsername
                                print("   🔄 Updated existing entry with server data: \(existing.streamerUsername) (visibility: \(existingVisibility))")
                            } else {
                                // Keep optimistic update if server doesn't have it yet (might be processing)
                                print("   ⚠️ Keeping optimistic username (not in server yet): \(existing.streamerUsername) (visibility: \(existingVisibility))")
                            }
                        }
                        
                        addedUsernames = mergedUsernames
                        print("✅ [ChannelDetailView] Merged added usernames: \(addedUsernames.count) total (kept optimistic updates, excluded \(removedUsernames.count) removed)")
                    } else {
                        // Initial load: Replace with server data, but preserve cached data if server returns empty
                        // CRITICAL: Filter out removed usernames from server response
                        let allServerUsernames = response.addedUsernames ?? []
                        print("🔍 [DEBUG] Initial load - Server returned \(allServerUsernames.count) usernames: \(allServerUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                        print("🔍 [DEBUG] Current removedUsernames: \(removedUsernames.map { $0 }.joined(separator: ", "))")
                        
                        let serverUsernames = allServerUsernames.filter { username in
                            // CRITICAL: Clean lock emoji from username before filtering
                            let cleanedUsername = username.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
                            let lowercased = cleanedUsername.lowercased()
                            let visibility = username.streamerVisibility?.lowercased() ?? "public"
                            
                            // CRITICAL: Filter out private usernames and usernames with locks
                            if visibility == "private" || username.streamerUsername.contains("🔒") {
                                print("🚫 [DEBUG] Filtering out private username from server: '\(cleanedUsername)' (visibility: \(visibility))")
                                return false
                            }
                            
                            // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
                            if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                                print("🚫 [DEBUG] Filtering out user's own username '\(cleanedUsername)' from server usernames")
                                return false
                            }
                            
                            let entryKey = "\(lowercased):\(visibility)"
                            // Check both specific visibility and general username (for backward compatibility)
                            let isRemoved = removedUsernames.contains(entryKey) || removedUsernames.contains(lowercased)
                            if isRemoved {
                                print("🚫 [DEBUG] Filtering out removed username from server: '\(cleanedUsername)' (visibility: \(visibility), key: \(entryKey))")
                            }
                            return !isRemoved
                        }.map { username in
                            // Clean lock emoji from username
                            AddedUsername(
                                streamerEmail: username.streamerEmail,
                                streamerUsername: username.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces),
                                addedAt: username.addedAt,
                                streamerVisibility: username.streamerVisibility
                            )
                        }
                        
                        if !serverUsernames.isEmpty {
                            // Server has data - merge with cache to preserve optimistic updates (ONLY public usernames)
                            // CRITICAL: NEVER preserve private entries in the public added users list
                            let cached = loadAddedUsernamesFromUserDefaults()
                            var mergedUsernames: [AddedUsername] = []
                            
                            // Track entries by username+visibility to avoid duplicates
                            var seenEntries = Set<String>()
                            
                            // First, add all server usernames (server is source of truth for what exists)
                            for serverUsername in serverUsernames {
                                // CRITICAL: Filter out private usernames and usernames with locks
                                let serverVisibility = serverUsername.streamerVisibility?.lowercased() ?? "public"
                                if serverVisibility == "private" || serverUsername.streamerUsername.contains("🔒") {
                                    print("🚫 [DEBUG] Filtering out private username from initial load: '\(serverUsername.streamerUsername)' (visibility: \(serverVisibility))")
                                    continue
                                }
                                
                                let usernameLower = serverUsername.streamerUsername.lowercased()
                                
                                // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
                                if let currentUsername = authService.username?.lowercased(), usernameLower == currentUsername {
                                    print("🚫 [DEBUG] Filtering out user's own username '\(serverUsername.streamerUsername)' from initial load")
                                    continue
                                }
                                let entryKey = "\(usernameLower):\(serverVisibility)"
                                if !seenEntries.contains(entryKey) {
                                    mergedUsernames.append(serverUsername)
                                    seenEntries.insert(entryKey)
                                    print("   ➕ Added server username: \(serverUsername.streamerUsername) (visibility: \(serverVisibility))")
                                }
                            }
                            
                            // Then, add cached usernames that aren't in server (ONLY public usernames - never private)
                            for cachedUsername in cached {
                                let cachedVisibility = cachedUsername.streamerVisibility?.lowercased() ?? "public"
                                
                                // CRITICAL: Filter out private usernames and usernames with locks - NEVER add them to public list
                                if cachedVisibility == "private" || cachedUsername.streamerUsername.contains("🔒") {
                                    print("🚫 [DEBUG] Filtering out private username from cache merge: '\(cachedUsername.streamerUsername)' (visibility: \(cachedVisibility))")
                                    continue
                                }
                                
                                // CRITICAL: Filter out user's own username - users should never see themselves
                                let cachedUsernameLower = cachedUsername.streamerUsername.lowercased()
                                if let currentUsername = authService.username?.lowercased(), cachedUsernameLower == currentUsername {
                                    print("🚫 [DEBUG] Filtering out user's own username '\(cachedUsername.streamerUsername)' from cache merge")
                                    continue
                                }
                                
                                let entryKey = "\(cachedUsernameLower):\(cachedVisibility)"
                                let isInServer = serverUsernames.contains(where: {
                                    $0.streamerUsername.lowercased() == cachedUsernameLower &&
                                    ($0.streamerVisibility?.lowercased() ?? "public") == cachedVisibility
                                })
                                // Check removal by username:visibility (and legacy format for backward compatibility)
                                let cachedRemovedKey = "\(cachedUsernameLower):\(cachedVisibility)"
                                let isRemoved = removedUsernames.contains(cachedRemovedKey) || removedUsernames.contains(cachedUsernameLower)
                                
                                if !seenEntries.contains(entryKey) && !isRemoved && !isInServer {
                                    // CRITICAL: Only preserve public usernames that aren't in server (optimistic updates)
                                    // Private usernames should NEVER be in the public added users list
                                    if cachedVisibility == "private" || cachedUsername.streamerUsername.contains("🔒") {
                                        print("   🚫 Skipping private username from cache: \(cachedUsername.streamerUsername) (visibility: \(cachedVisibility))")
                                        continue
                                    }
                                    
                                    // Only add public entries that aren't in server
                                    mergedUsernames.append(cachedUsername)
                                    seenEntries.insert(entryKey)
                                    print("   ➕ Preserved cached public username: \(cachedUsername.streamerUsername) (visibility: \(cachedVisibility))")
                                }
                            }
                            
                            addedUsernames = mergedUsernames
                            let originalCount = allServerUsernames.count
                            print("✅ [ChannelDetailView] Loaded \(addedUsernames.count) added usernames from server + cache (initial load, filtered from \(originalCount) server entries, preserved \(mergedUsernames.count - serverUsernames.count) public optimistic updates from cache)")
                        } else {
                            // Server returned empty - preserve cache if it exists (might contain optimistic updates)
                            // Only clear cache if we don't have any cached data
                            let cached = loadAddedUsernamesFromUserDefaults()
                            if !cached.isEmpty {
                                // We have cached data - preserve it (might be optimistic updates)
                                // Filter out removed usernames, private usernames, locks, and user's own username but keep the rest
                                let filteredCached = cached.filter { username in
                                    // CRITICAL: Filter out private usernames and usernames with locks
                                    let visibility = username.streamerVisibility?.lowercased() ?? "public"
                                    if visibility == "private" || username.streamerUsername.contains("🔒") {
                                        print("🚫 [DEBUG] Filtering out private username from cached: '\(username.streamerUsername)' (visibility: \(visibility))")
                                        return false
                                    }
                                    
                                    let lowercased = username.streamerUsername.lowercased()
                                    
                                    // CRITICAL: Filter out user's own username - users should never see themselves in the added users list
                                    if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                                        print("🚫 [DEBUG] Filtering out user's own username '\(username.streamerUsername)' from cached")
                                        return false
                                    }
                                    
                                    return !removedUsernames.contains(lowercased)
                                }
                                if !filteredCached.isEmpty {
                                    addedUsernames = filteredCached
                                    print("✅ [ChannelDetailView] Server returned empty, preserving \(filteredCached.count) cached usernames (may contain optimistic updates)")
                                } else {
                                    // All cached usernames were removed - clear cache
                                    let key = addedUsernamesKey(for: userEmail)
                                    UserDefaults.standard.removeObject(forKey: key)
                                    addedUsernames = []
                                    print("🧹 [ChannelDetailView] Server returned empty, all cached usernames were removed - cleared cache")
                                }
                            } else {
                                // No cached data and server is empty - truly empty
                                addedUsernames = []
                                print("✅ [ChannelDetailView] Loaded 0 added usernames from server (server is clean, no cache)")
                            }
                        }
                    }
                    
                    // CRITICAL: Clean up any private usernames or user's own username that might have been cached
                    // Filter out private usernames, locks, and user's own username before saving
                    // This ensures the cache NEVER contains private usernames
                    let cleanedUsernames = addedUsernames.filter { username in
                        // CRITICAL: Filter out private usernames and usernames with locks
                        let visibility = username.streamerVisibility?.lowercased() ?? "public"
                        if visibility == "private" || username.streamerUsername.contains("🔒") {
                            print("🚫 [ChannelDetailView] Filtering out private username before saving to cache: '\(username.streamerUsername)' (visibility: \(visibility))")
                            return false
                        }
                        
                        // CRITICAL: Filter out user's own username
                        let lowercased = username.streamerUsername.lowercased()
                        if let currentUsername = authService.username?.lowercased(), lowercased == currentUsername {
                            print("🚫 [ChannelDetailView] Filtering out user's own username before saving to cache: '\(username.streamerUsername)'")
                            return false
                        }
                        
                        return true
                    }
                    
                    // Only save if we have cleaned usernames (don't save empty arrays with private entries)
                    if cleanedUsernames.count != addedUsernames.count {
                        print("🧹 [ChannelDetailView] Removed \(addedUsernames.count - cleanedUsernames.count) private/invalid usernames before saving to cache")
                        // Update addedUsernames to the cleaned version
                        addedUsernames = cleanedUsernames
                    }
                    
                    // Now filter for removed usernames (final check)
                    let finalUsernames = cleanedUsernames.filter { username in
                        let lowercased = username.streamerUsername.lowercased()
                        let entryKey = "\(lowercased):\(username.streamerVisibility?.lowercased() ?? "public")"
                        let isRemoved = removedUsernames.contains(entryKey) || removedUsernames.contains(lowercased)
                        return !isRemoved
                    }
                    
                    // Update addedUsernames with final cleaned list
                    if finalUsernames.count != cleanedUsernames.count {
                        print("🧹 [ChannelDetailView] Removed \(cleanedUsernames.count - finalUsernames.count) removed usernames from final list")
                        addedUsernames = finalUsernames
                    } else {
                        addedUsernames = cleanedUsernames
                    }
                    
                    // Save to UserDefaults after loading from server (only if we have data to save)
                    if !addedUsernames.isEmpty {
                        saveAddedUsernamesToUserDefaults()
                    }
                    
                    isLoadingAddedUsernames = false
                    
                    // FINAL VERIFICATION: Double-check that no removed usernames made it through
                    let finalFiltered = addedUsernames.filter { username in
                        let lowercased = username.streamerUsername.lowercased()
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("   🚨 [DEBUG] CRITICAL: Found removed username in final list! '\(username.streamerUsername)' (lowercased: '\(lowercased)') - REMOVING IT NOW")
                        }
                        return !isRemoved
                    }
                    
                    if finalFiltered.count != addedUsernames.count {
                        print("   🚨 [DEBUG] CRITICAL: Had to remove \(addedUsernames.count - finalFiltered.count) removed username(s) from final list!")
                        addedUsernames = finalFiltered
                        saveAddedUsernamesToUserDefaults()
                    }
                    
                    // Log usernames for debugging
                    if !addedUsernames.isEmpty {
                        print("   📋 Final usernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                    } else {
                        print("   ⚠️ No usernames found")
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading added usernames: \(error)")
                print("   Error type: \(type(of: error))")
                print("   Error description: \(error.localizedDescription)")
                if let channelError = error as? ChannelServiceError {
                    print("   ChannelServiceError: \(channelError)")
                }
                await MainActor.run {
                    isLoadingAddedUsernames = false
                    // Don't clear existing addedUsernames on error - keep optimistic updates or cached data
                    if addedUsernames.isEmpty {
                        // If we have no data at all, try loading from cache
                        let cached = loadAddedUsernamesFromUserDefaults()
                        if !cached.isEmpty {
                            addedUsernames = cached
                            print("⚠️ [ChannelDetailView] Using cached added usernames due to server error: \(cached.count) usernames")
                        }
                    } else {
                        print("⚠️ [ChannelDetailView] Keeping existing \(addedUsernames.count) usernames (optimistic updates)")
                    }
                    if !addedUsernames.isEmpty {
                        print("   Current usernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                    }
                }
            }
        }
    }
    
    // Auto-add user's own username to see their own content
    // CRITICAL: Do NOT auto-add user's own username - users should never see themselves in the added users list
    private func autoAddOwnUsername() {
        // CRITICAL: Never auto-add user's own username - they should never appear in their own added users list
        // Users can see their own content without adding themselves
        print("🚫 [ChannelDetailView] Skipping auto-add for user's own username - users should never see themselves in added users list")
        return
    }
    
    // Handle search text changes with optimized debouncing and instant local results
    private func handleSearchTextChange(newValue: String) {
        // Cancel any pending search
        searchTask?.cancel()
        
        // Close added usernames dropdown when searching
        if !newValue.isEmpty {
            showAddedUsernamesDropdown = false
            // Show search dropdown immediately when user starts typing
            showSearchDropdown = true
        }
        
        // Clear results if search is empty
        guard !newValue.isEmpty else {
            usernameSearchResults = []
            showSearchDropdown = false
            isSearchingUsernames = false
            return
        }
        
        let trimmedQuery = newValue.trimmingCharacters(in: .whitespaces)
        guard !trimmedQuery.isEmpty else {
            usernameSearchResults = []
            showSearchDropdown = false
            return
        }
        
        let searchKey = trimmedQuery.lowercased()
        
        // STEP 1: Instant local results from addedUsernames (no API call needed)
        let localResults = searchLocalUsernames(query: searchKey)
        if !localResults.isEmpty {
            print("⚡ [Search] Instant local results: \(localResults.count) from addedUsernames")
            usernameSearchResults = localResults
            showSearchDropdown = true
            isSearchingUsernames = false
            // Continue to API search in background for more results
        }
        
        // STEP 2: Check all cached results for instant matches (filter from entire cache)
        let cachedResults = searchCachedResults(query: searchKey)
        if !cachedResults.isEmpty {
            print("📦 [Search] Instant cached results: \(cachedResults.count) from cache")
            // Merge with local results, avoiding duplicates
            let combined = mergeResults(localResults, cachedResults)
            if !combined.isEmpty {
                usernameSearchResults = combined
                showSearchDropdown = true
                isSearchingUsernames = false
            }
        }
        
        // STEP 3: If we have instant results, show them immediately and search API in background
        // If no instant results, show loading state
        if localResults.isEmpty && cachedResults.isEmpty {
            isSearchingUsernames = true
        }
        
        // STEP 4: Debounced API call (very short debounce for instant feel)
        // Reduced to 50ms for 1-2 chars, 100ms for longer queries
        let debounceTime: UInt64 = trimmedQuery.count <= 2 ? 50_000_000 : 100_000_000
        
        searchTask = Task {
            do {
                try await Task.sleep(nanoseconds: debounceTime)
                
                // Check if task was cancelled or text changed
                guard !Task.isCancelled else { return }
                
                // Verify the search text hasn't changed
                let currentSearchText = usernameSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    return
                }
                
                // Perform the API search
                await performSearch(query: currentSearchText)
            } catch {
                // Task was cancelled - expected when user types quickly
                if !Task.isCancelled {
                    print("❌ [Search] Task error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // Search local usernames from addedUsernames list (instant, no API)
    // CRITICAL: Only return public usernames (no private, no locks)
    private func searchLocalUsernames(query: String) -> [UsernameSearchResult] {
        guard !query.isEmpty else { return [] }
        
        return addedUsernames.compactMap { added in
            // CRITICAL: Filter out private usernames and usernames with locks
            let visibility = added.streamerVisibility?.lowercased() ?? "public"
            if visibility == "private" || added.streamerUsername.contains("🔒") {
                return nil
            }
            
            let username = added.streamerUsername.lowercased()
            let cleanUsername = username.replacingOccurrences(of: "🔒", with: "")
            
            // Match if query is contained in username
            guard cleanUsername.contains(query) || query.contains(cleanUsername) else {
                return nil
            }
            
            // Create result from local data (only public usernames)
            return UsernameSearchResult(
                username: added.streamerUsername,
                email: added.streamerEmail,
                userId: added.streamerEmail,
                displayUsername: added.streamerUsername,
                visibility: added.streamerVisibility,
                isPrivate: false, // Always false for public usernames
                isPremium: nil, // Will be updated from API if needed
                subscriptionPrice: nil
            )
        }
    }
    
    // Search all cached results for matches (instant filtering)
    // CRITICAL: Only return public usernames (no private, no locks)
    private func searchCachedResults(query: String) -> [UsernameSearchResult] {
        guard !query.isEmpty else { return [] }
        
        var allCached: [UsernameSearchResult] = []
        
        // Search through all cached entries
        for (_, results) in searchCache {
            let filtered = results.filter { result in
                // CRITICAL: Filter out private usernames and usernames with locks
                if (result.isPrivate ?? false) || result.username.contains("🔒") {
                    return false
                }
                let resultUsername = result.username.replacingOccurrences(of: "🔒", with: "").lowercased()
                return resultUsername.contains(query)
            }
            allCached.append(contentsOf: filtered)
        }
        
        // Remove duplicates by username
        var seen = Set<String>()
        return allCached.filter { result in
            let key = result.username.lowercased()
            if seen.contains(key) {
                return false
            }
            seen.insert(key)
            return true
        }
    }
    
    // Merge two result arrays, avoiding duplicates
    private func mergeResults(_ results1: [UsernameSearchResult], _ results2: [UsernameSearchResult]) -> [UsernameSearchResult] {
        var seen = Set<String>()
        var merged: [UsernameSearchResult] = []
        
        for result in results1 + results2 {
            let key = result.username.lowercased()
            if !seen.contains(key) {
                seen.insert(key)
                merged.append(result)
            }
        }
        
        return merged
    }
    
    // Save search cache to UserDefaults for persistence across app restarts
    private func saveSearchCacheToUserDefaults() {
        // Only save if cache has meaningful data
        guard !searchCache.isEmpty else { return }
        
        do {
            // Convert cache to a serializable format
            var cacheData: [String: [[String: Any]]] = [:]
            for (key, results) in searchCache {
                cacheData[key] = results.map { result in
                    var dict: [String: Any] = [
                        "username": result.username,
                        "displayUsername": result.displayUsername ?? result.username
                    ]
                    if let email = result.email { dict["email"] = email }
                    if let userId = result.userId { dict["userId"] = userId }
                    if let visibility = result.visibility { dict["visibility"] = visibility }
                    if let isPrivate = result.isPrivate { dict["isPrivate"] = isPrivate }
                    if let isPremium = result.isPremium { dict["isPremium"] = isPremium }
                    if let price = result.subscriptionPrice { dict["subscriptionPrice"] = price }
                    return dict
                }
            }
            
            let data = try JSONSerialization.data(withJSONObject: cacheData)
            UserDefaults.standard.set(data, forKey: "usernameSearchCache")
            print("💾 [Search] Saved \(searchCache.count) cache entries to UserDefaults")
        } catch {
            print("❌ [Search] Error saving cache to UserDefaults: \(error)")
        }
    }
    
    // Load search cache from UserDefaults for instant results on app start
    private func loadSearchCacheFromUserDefaults() {
        guard let data = UserDefaults.standard.data(forKey: "usernameSearchCache") else {
            print("📭 [Search] No cached search results in UserDefaults")
            return
        }
        
        do {
            guard let cacheData = try JSONSerialization.jsonObject(with: data) as? [String: [[String: Any]]] else {
                print("❌ [Search] Invalid cache format in UserDefaults")
                return
            }
            
            var loadedCache: [String: [UsernameSearchResult]] = [:]
            for (key, resultsArray) in cacheData {
                let results = resultsArray.compactMap { dict -> UsernameSearchResult? in
                    guard let username = dict["username"] as? String else { return nil }
                    return UsernameSearchResult(
                        username: username,
                        email: dict["email"] as? String,
                        userId: dict["userId"] as? String,
                        displayUsername: dict["displayUsername"] as? String,
                        visibility: dict["visibility"] as? String,
                        isPrivate: dict["isPrivate"] as? Bool,
                        isPremium: dict["isPremium"] as? Bool,
                        subscriptionPrice: dict["subscriptionPrice"] as? Double
                    )
                }
                if !results.isEmpty {
                    loadedCache[key] = results
                }
            }
            
            searchCache = loadedCache
            print("📦 [Search] Loaded \(loadedCache.count) cache entries from UserDefaults (\(loadedCache.values.reduce(0) { $0 + $1.count }) total results)")
        } catch {
            print("❌ [Search] Error loading cache from UserDefaults: \(error)")
        }
    }
    
    // Perform the actual API search (runs in background after instant results shown)
    private func performSearch(query: String) async {
        let searchKey = query.lowercased()
        
        do {
            // CRITICAL: Only search for public usernames (no private accounts, no locks)
            print("🔍 [Search] API call for: '\(query)' (visibilityFilter: 'public')")
            let results = try await ChannelService.shared.searchUsernames(query: query, limit: 50, visibilityFilter: "public")
            
            await MainActor.run {
                // Only update if search text hasn't changed
                let currentSearchText = usernameSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    print("⚠️ [Search] Search text changed during API call, ignoring results")
                    return
                }
                
                // CRITICAL: Filter out any private usernames or usernames with locks (double-check)
                let publicOnlyResults = results.filter { result in
                    !(result.isPrivate ?? false) && !result.username.contains("🔒")
                }
                
                // Cache the results for future instant access (only public usernames)
                searchCache[searchKey] = publicOnlyResults
                
                // Also cache individual results for substring matching
                // This allows "jo" to match cached results from "john" searches
                // CRITICAL: Only cache public usernames
                for result in publicOnlyResults {
                    let resultKey = result.username.replacingOccurrences(of: "🔒", with: "").lowercased()
                    // Cache by first 2-3 characters for fast prefix matching
                    if resultKey.count >= 2 {
                        let prefix2 = String(resultKey.prefix(2))
                        if searchCache[prefix2] == nil {
                            searchCache[prefix2] = []
                        }
                        // Add if not already in cache
                        if !searchCache[prefix2]!.contains(where: { $0.username.lowercased() == result.username.lowercased() }) {
                            searchCache[prefix2]!.append(result)
                        }
                    }
                }
                
                // Limit cache size (keep last 100 searches for better coverage)
                if searchCache.count > 100 {
                    let keysToRemove = Array(searchCache.keys.prefix(searchCache.count - 100))
                    for key in keysToRemove {
                        searchCache.removeValue(forKey: key)
                    }
                }
                
                // Persist cache to UserDefaults for app restart persistence
                saveSearchCacheToUserDefaults()
                
                // Merge API results with existing local/cached results (only public usernames)
                // CRITICAL: Filter local and cached results to only show public usernames
                let localResults = searchLocalUsernames(query: searchKey)
                let cachedResults = searchCachedResults(query: searchKey)
                let merged = mergeResults(mergeResults(localResults, cachedResults), publicOnlyResults)
                
                // Update results (API results take priority for freshness)
                // CRITICAL: Final filter to ensure no private usernames or locks slip through
                let finalFiltered = merged.filter { result in
                    !(result.isPrivate ?? false) && !result.username.contains("🔒")
                }
                usernameSearchResults = finalFiltered
                showSearchDropdown = !finalFiltered.isEmpty
                isSearchingUsernames = false
                
                // Log results (should only be public now)
                print("✅ [Search] Complete: \(finalFiltered.count) total (Public only, no private)")
                
                if publicOnlyResults.count > 0 {
                    print("   API Results: \(results.prefix(5).map { "\($0.username)\($0.isPrivate == true ? "🔒" : "")" }.joined(separator: ", "))")
                }
            }
        } catch {
            print("❌ [Search] API error: \(error.localizedDescription)")
            await MainActor.run {
                // Don't clear results if we have local/cached results showing
                let currentSearchText = usernameSearchText.trimmingCharacters(in: .whitespaces)
                if currentSearchText.lowercased() == searchKey {
                    // Only clear if we have no local results
                    let localResults = searchLocalUsernames(query: searchKey)
                    let cachedResults = searchCachedResults(query: searchKey)
                    if localResults.isEmpty && cachedResults.isEmpty {
                        usernameSearchResults = []
                        showSearchDropdown = false
                    }
                    isSearchingUsernames = false
                }
            }
        }
    }
    
    // Add username inline
    // Add public username (private management moved to person icon in toolbar)
    private func addUsernameInline(_ username: String, email: String? = nil) {
        print("🔵 [ChannelDetailView] ========== ADD BUTTON CLICKED (PUBLIC) ==========")
        print("   📝 Username: '\(username)'")
        print("   📧 Email: \(email ?? "nil")")
        
        guard let userEmail = authService.userEmail else {
            print("   ❌ ERROR: No user email found - cannot proceed")
            return
        }
        print("   ✅ User email: \(userEmail)")
        
        // Remove 🔒 from username for API call (API expects username without lock)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        print("   🧹 Clean username: '\(cleanUsername)'")
        
        // CRITICAL: Prevent owner from adding themselves to public usernames
        if let ownerUsername = authService.username, cleanUsername.lowercased() == ownerUsername.lowercased() {
            print("   🚫 ERROR: Cannot add own username to public list - owner should not add themselves")
            return
        }
        
        // Check if already added with public visibility
        if let existingAdded = addedUsernames.first(where: { 
            $0.streamerUsername.lowercased() == cleanUsername.lowercased() &&
            ($0.streamerVisibility?.lowercased() ?? "public") == "public"
        }) {
            print("   ℹ️ Username already added with public visibility: \(cleanUsername) - returning early")
            return
        }
        
        // Check if already being added
        let addingKey = "\(cleanUsername.lowercased()):public"
        if addingUsernames.contains(addingKey) {
            print("   ℹ️ Username already being added: \(cleanUsername) (public) - returning early")
            return
        }
        print("   ✅ Username not currently being added")
        
        // Mark as being added
        addingUsernames.insert(addingKey)
        print("   ✅ Added '\(addingKey)' to addingUsernames set")
        
        Task {
            do {
                print("   🚀 Starting API call to requestFollow (public only)...")
                print("   📤 Request details:")
                print("      - requesterEmail: \(userEmail)")
                print("      - requestedUsername: \(cleanUsername)")
                print("      - requesterUsername: \(authService.username ?? "nil")")
                
                // Public username add - isPrivateStreamRequest is always false now
                let response = try await ChannelService.shared.requestFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requesterUsername: authService.username,
                    isPrivateStreamRequest: false
                )
                
                print("   ✅ API call completed!")
                print("   📥 Response received:")
                print("      - success: \(response.success)")
                print("      - autoAccepted: \(response.autoAccepted ?? false)")
                print("      - status: \(response.status ?? "nil")")
                print("      - message: \(response.message ?? "nil")")
                
                await MainActor.run {
                    print("   🔄 Updating UI on main thread...")
                    // Remove from adding set
                    let removingKey = "\(cleanUsername.lowercased()):public"
                    addingUsernames.remove(removingKey)
                    print("   ✅ Removed '\(removingKey)' from addingUsernames set")
                    
                    // Public "Add" button - add to addedUsernames → show "Added"
                    let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                    
                    print("   ✅ Public user - adding to list")
                    
                    let newAddedUsername = AddedUsername(
                        streamerEmail: streamerEmail,
                        streamerUsername: cleanUsername,
                        addedAt: ISO8601DateFormatter().string(from: Date()),
                        streamerVisibility: "public"
                    )
                    
                    // Only update/replace if there's an existing entry with the SAME visibility (public)
                    if let existingIndex = addedUsernames.firstIndex(where: { 
                        let usernameMatches = $0.streamerUsername.lowercased() == cleanUsername.lowercased()
                        let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
                        return usernameMatches && itemVisibility == "public"
                    }) {
                        print("⚠️ [ChannelDetailView] Username \(cleanUsername) already in addedUsernames list with PUBLIC visibility - updating")
                        addedUsernames[existingIndex] = newAddedUsername
                    } else {
                        addedUsernames.append(newAddedUsername)
                        print("✅ [ChannelDetailView] Optimistically added username: \(cleanUsername) (visibility: public, email: \(streamerEmail.isEmpty ? "N/A" : streamerEmail))")
                    }
                    
                    // CRITICAL: Remove from removedUsernames set if it was previously removed (check by username:visibility)
                    let publicKey = "\(cleanUsername.lowercased()):public"
                    if removedUsernames.contains(publicKey) {
                        removedUsernames.remove(publicKey)
                        print("   ✅ Removed '\(publicKey)' from removedUsernames set (can be added again)")
                        saveRemovedUsernamesToUserDefaults()
                    }
                    // Also check for legacy format (just username) for backward compatibility
                    if removedUsernames.contains(cleanUsername.lowercased()) {
                        removedUsernames.remove(cleanUsername.lowercased())
                        print("   ✅ Removed legacy '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                        saveRemovedUsernamesToUserDefaults()
                    }
                    print("   📊 Current addedUsernames count: \(addedUsernames.count)")
                    saveAddedUsernamesToUserDefaults()
                    
                    // Reload addedUsernames to sync with server
                    print("   ✅ [ChannelDetailView] User clicked Add - reloading addedUsernames")
                    Task {
                        do {
                            // Wait 1 second for backend to process
                            try await Task.sleep(nanoseconds: 1_000_000_000)
                            loadAddedUsernames(mergeWithExisting: true)
                        } catch {
                            print("⚠️ [ChannelDetailView] Could not refresh from server: \(error.localizedDescription)")
                        }
                    }
                    
                    // Refresh content immediately
                    if response.autoAccepted == true {
                        print("✅ [ChannelDetailView] Public user added - refreshing content")
                        Task {
                            try? await refreshChannelContent()
                        }
                    }
                    
                    // CRITICAL: For Twilly TV, always refresh content after adding a username
                    if currentChannel.channelName.lowercased() == "twilly tv" {
                        print("🔄 [ChannelDetailView] Refreshing Twilly TV content after adding username: \(cleanUsername)")
                        Task {
                            try? await refreshChannelContent()
                        }
                    }
                }
            } catch {
                print("   ❌ ERROR in API call:")
                print("      Error type: \(type(of: error))")
                print("      Error description: \(error.localizedDescription)")
                
                // Extract error message properly from ChannelServiceError
                var errorMessageText = error.localizedDescription
                if let channelError = error as? ChannelServiceError {
                    print("      ChannelServiceError: \(channelError)")
                    switch channelError {
                    case .serverError(let message):
                        errorMessageText = message
                        print("      Extracted server error message: \(message)")
                    default:
                        break
                    }
                }
                
                let isAlreadyPending = errorMessageText.lowercased().contains("already pending")
                let isAlreadyAccepted = errorMessageText.lowercased().contains("already accepted")
                let isUserNotFound = errorMessageText.lowercased().contains("user not found") || 
                                    errorMessageText.lowercased().contains("channel name")
                let isTimeout = errorMessageText.lowercased().contains("timeout") ||
                               errorMessageText.lowercased().contains("timed out")
                let isServerError = errorMessageText.lowercased().contains("server error") ||
                                   errorMessageText.lowercased().contains("http 500") ||
                                   errorMessageText.lowercased().contains("assignment to constant variable")
                
                await MainActor.run {
                    // Remove from adding set on error
                    let removingKey = "\(cleanUsername.lowercased()):public"
                    addingUsernames.remove(removingKey)
                    print("   ✅ Removed '\(removingKey)' from addingUsernames set (error cleanup)")
                    
                    // For "User not found" errors, show error and don't update UI
                    if isUserNotFound && !isAlreadyPending && !isAlreadyAccepted {
                        errorMessage = errorMessageText
                        print("   ⚠️ Showing error to user: \(errorMessageText)")
                        Task {
                            try? await Task.sleep(nanoseconds: 5_000_000_000)
                            await MainActor.run {
                                errorMessage = nil
                            }
                        }
                        return
                    }
                    
                    // CRITICAL: For public "Add" requests, update UI optimistically on ANY error
                    // (except "User not found") because the add might have succeeded on the backend
                    // This includes timeouts, HTTP 500 errors, and other server errors
                    if !isUserNotFound {
                        print("   ⚠️ Error occurred for public Add request - updating UI optimistically (add may have succeeded)")
                        print("      Error type: \(isTimeout ? "timeout" : isServerError ? "server error" : "other")")
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        let newAddedUsername = AddedUsername(
                            streamerEmail: streamerEmail,
                            streamerUsername: cleanUsername,
                            addedAt: ISO8601DateFormatter().string(from: Date()),
                            streamerVisibility: "public"
                        )
                        
                        // CRITICAL: Only update/replace if there's an existing entry with the SAME visibility (public)
                        if let existingIndex = addedUsernames.firstIndex(where: {
                            let usernameMatches = $0.streamerUsername.lowercased() == cleanUsername.lowercased()
                            let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
                            return usernameMatches && itemVisibility == "public"
                        }) {
                            print("   🔄 Updating existing public entry in addedUsernames")
                            addedUsernames[existingIndex] = newAddedUsername
                        } else {
                            print("   ➕ Adding new public entry to addedUsernames")
                            addedUsernames.append(newAddedUsername)
                        }
                        
                        // CRITICAL: Remove from removedUsernames set if it was previously removed (check by username:visibility)
                        let publicKey = "\(cleanUsername.lowercased()):public"
                        if removedUsernames.contains(publicKey) {
                            removedUsernames.remove(publicKey)
                            print("   ✅ Removed '\(publicKey)' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        // Also check for legacy format (just username) for backward compatibility
                        if removedUsernames.contains(cleanUsername.lowercased()) {
                            removedUsernames.remove(cleanUsername.lowercased())
                            print("   ✅ Removed legacy '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        
                        print("   ✅ Optimistically updated UI - button should show 'Added'")
                        print("   📊 Current addedUsernames count: \(addedUsernames.count)")
                        print("   📋 Contains '\(cleanUsername)': \(addedUsernames.contains(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() && ($0.streamerVisibility?.lowercased() ?? "public") == "public" }))")
                        
                        // CRITICAL: Save to UserDefaults immediately to persist optimistic update
                        saveAddedUsernamesToUserDefaults()
                        
                        // CRITICAL: For Twilly TV, refresh content after optimistic add
                        // This ensures newly added user's content appears immediately, even if API call failed
                        if currentChannel.channelName.lowercased() == "twilly tv" {
                            print("🔄 [ChannelDetailView] Refreshing Twilly TV content after optimistic add: \(cleanUsername)")
                            Task {
                                try? await refreshChannelContent()
                            }
                        }
                        
                        // Show a warning message for server errors but don't block the UI
                        if isServerError || isTimeout {
                            errorMessage = isServerError ?
                                "Add may have encountered an error, but was processed. Please check your connection." :
                                "Add may have timed out, but was processed. Please check your connection."
                            Task {
                                try? await Task.sleep(nanoseconds: 3_000_000_000)
                                await MainActor.run {
                                    errorMessage = nil
                                }
                            }
                        }
                        return
                    }
                    
                    // If the request is already pending, treat it as success and update UI optimistically
                    if isAlreadyPending {
                        print("   ℹ️ Request already pending - treating as success, updating UI optimistically")
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        
                        // User clicked "Add" - add to addedUsernames (if already pending, it might be auto-accepted)
                        let newAddedUsername = AddedUsername(
                            streamerEmail: streamerEmail,
                            streamerUsername: cleanUsername,
                            addedAt: ISO8601DateFormatter().string(from: Date()),
                            streamerVisibility: "public"
                        )
                        
                        if let existingIndex = addedUsernames.firstIndex(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
                            print("   ⚠️ Already in addedUsernames list - updating")
                            addedUsernames[existingIndex] = newAddedUsername
                        } else {
                            addedUsernames.append(newAddedUsername)
                            print("   ✅ Optimistically added username: \(cleanUsername)")
                        }
                        
                        // CRITICAL: Remove from removedUsernames set if it was previously removed
                        let publicKey = "\(cleanUsername.lowercased()):public"
                        if removedUsernames.contains(publicKey) {
                            removedUsernames.remove(publicKey)
                            print("   ✅ Removed '\(publicKey)' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        // Also check for legacy format (just username) for backward compatibility
                        if removedUsernames.contains(cleanUsername.lowercased()) {
                            removedUsernames.remove(cleanUsername.lowercased())
                            print("   ✅ Removed legacy '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        
                        saveAddedUsernamesToUserDefaults()
                        
                        // Reload added usernames for public requests
                        loadAddedUsernames(mergeWithExisting: true)
                        // Don't show error message for this case
                    } else if isAlreadyAccepted {
                        print("   ℹ️ Request already accepted - treating as success, updating UI optimistically")
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        
                        // If already accepted, add to both addedUsernames and sentFollowRequests with "active" status
                        let newAddedUsername = AddedUsername(
                            streamerEmail: streamerEmail,
                            streamerUsername: cleanUsername,
                            addedAt: ISO8601DateFormatter().string(from: Date()),
                            streamerVisibility: "public"
                        )
                        
                        if let existingIndex = addedUsernames.firstIndex(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
                            addedUsernames[existingIndex] = newAddedUsername
                        } else {
                            addedUsernames.append(newAddedUsername)
                            print("   ✅ Optimistically added accepted username: \(cleanUsername)")
                        }
                        
                        // CRITICAL: Remove from removedUsernames set if it was previously removed (check by username:visibility)
                        let publicKey = "\(cleanUsername.lowercased()):public"
                        if removedUsernames.contains(publicKey) {
                            removedUsernames.remove(publicKey)
                            print("   ✅ Removed '\(publicKey)' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        // Also check for legacy format (just username) for backward compatibility
                        if removedUsernames.contains(cleanUsername.lowercased()) {
                            removedUsernames.remove(cleanUsername.lowercased())
                            print("   ✅ Removed legacy '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        
                        saveAddedUsernamesToUserDefaults()
                        
                        // Reload added usernames to update UI
                        loadAddedUsernames(mergeWithExisting: true)
                        // Don't show error message for this case
                    } else {
                        // Show error to user for actual errors
                        errorMessage = "Failed to add username: \(errorMessageText)"
                        print("   📝 Error message set for user: \(errorMessage ?? "nil")")
                    }
                }
            }
        }
        print("🔵 [ChannelDetailView] ========== REQUEST BUTTON HANDLER COMPLETE ==========")
    }
    
    // Add a user as a private viewer (for private account owners)
    private func addPrivateViewerInline(username: String, email: String?) {
        print("🟢 [ChannelDetailView] ========== ADD TO PRIVATE START ==========")
        print("   Viewer Username: \(username)")
        
        guard let ownerUsername = authService.username else {
            print("❌ [ChannelDetailView] Cannot add private viewer - missing owner username")
            return
        }
        
        print("   Owner Username: \(ownerUsername)")
        
        let privateKey = "\(username.lowercased()):private"
        let addingKey = username.lowercased()
        addingUsernames.insert(privateKey)
        addingPrivateUsernames.insert(addingKey)
        print("   Added to addingUsernames set: \(privateKey)")
        
        // IMMEDIATE optimistic update for UI (but don't save to public cache - PrivateUsernameManagementView handles private cache)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let newAdded = AddedUsername(
            streamerEmail: email ?? "",
            streamerUsername: cleanUsername,
            addedAt: ISO8601DateFormatter().string(from: Date()),
            streamerVisibility: "private"
        )
        
        // CRITICAL: Add to private usernames array (separate from public)
        // Check if already exists with private visibility
        let existingIndex = addedPrivateUsernames.firstIndex(where: { 
            $0.streamerUsername.lowercased() == cleanUsername.lowercased() && 
            ($0.streamerVisibility?.lowercased() ?? "private") == "private"
        })
        
        if let index = existingIndex {
            // Update existing entry
            addedPrivateUsernames[index] = newAdded
            print("   🔄 Optimistically updated existing entry in addedPrivateUsernames at index \(index)")
        } else {
            // Add new entry immediately
            addedPrivateUsernames.append(newAdded)
            print("   ➕ Optimistically added new entry to addedPrivateUsernames array")
        }
        
        // Save to private cache
        saveAddedPrivateUsernamesToUserDefaults()
        print("   💾 Saved optimistic update to private cache")
        
        // Remove from removedUsernames set if it was previously removed
        let privateRemovedKey = "\(cleanUsername.lowercased()):private"
        if removedUsernames.contains(privateRemovedKey) {
            removedUsernames.remove(privateRemovedKey)
            saveRemovedUsernamesToUserDefaults()
        }
        if removedUsernames.contains(cleanUsername.lowercased()) {
            removedUsernames.remove(cleanUsername.lowercased())
            saveRemovedUsernamesToUserDefaults()
        }
        
        // DO NOT save to public cache - PrivateUsernameManagementView has its own cache
        // The UI will update when PrivateUsernameManagementView loads its cache
        
        Task {
            do {
                print("   📤 Calling API: addPrivateViewer(ownerUsername: \(ownerUsername), viewerUsername: \(cleanUsername))")
                // Only pass username - backend will do email lookup via GSI
                let response = try await ChannelService.shared.addPrivateViewer(
                    ownerUsername: ownerUsername,
                    viewerUsername: cleanUsername,
                    viewerEmail: nil
                )
                print("   ✅ API call succeeded")
                
                await MainActor.run {
                    print("🟢 [ChannelDetailView] ========== ADD TO PRIVATE SUCCESS ==========")
                    addingUsernames.remove(privateKey)
                    addingPrivateUsernames.remove(addingKey)
                    print("   ✅ Removed '\(privateKey)' from addingUsernames set")
                    
                    // Log response for debugging
                    print("   📥 API response: \(response)")
                    
                    // CRITICAL: Save again after API success to ensure persistence
                    saveAddedPrivateUsernamesToUserDefaults()
                    print("   💾 Saved to UserDefaults after API success")
                    
                    // Wait for backend to process, then reload from server (preserve optimistic update)
                    Task {
                        do {
                            try await Task.sleep(nanoseconds: 1_000_000_000)
                            await MainActor.run {
                                print("   🔄 Reloading from server after add...")
                                loadAddedPrivateUsernames(mergeWithExisting: true)
                                // Save again after reload to ensure persistence
                                saveAddedPrivateUsernamesToUserDefaults()
                            }
                        } catch {
                            print("   ⚠️ Could not refresh from server: \(error.localizedDescription)")
                        }
                    }
                    
                    // Refresh content to show new viewer's content
                    Task {
                        print("   🔄 Refreshing channel content...")
                        try? await refreshChannelContent()
                    }
                    
                    print("✅ [ChannelDetailView] Successfully added \(cleanUsername) as private viewer")
                    print("🟢 [ChannelDetailView] ========== ADD TO PRIVATE END ==========")
                }
            } catch {
                await MainActor.run {
                    addingUsernames.remove(privateKey)
                    addingPrivateUsernames.remove(addingKey)
                    print("❌ [ChannelDetailView] Error adding private viewer: \(error)")
                    print("   Error details: \(error.localizedDescription)")
                    if let channelError = error as? ChannelServiceError {
                        print("   ChannelServiceError: \(channelError)")
                    }
                    
                    // Determine error type to decide if we should keep optimistic update
                    // Extract error message - handle ChannelServiceError.serverError(String) properly
                    var errorMessageText = error.localizedDescription.lowercased()
                    if let channelError = error as? ChannelServiceError {
                        switch channelError {
                        case .serverError(let message):
                            errorMessageText = message.lowercased()
                            print("   🔍 Extracted server error message: \(message)")
                        case .invalidURL, .invalidResponse:
                            // Use localizedDescription for these
                            break
                        }
                    }
                    
                    // Clear failures - operation definitely did NOT succeed:
                    let isUserNotFound = errorMessageText.contains("not found")
                    let isSecurityTokenError = errorMessageText.contains("security token")
                    let isInvalidRequest = errorMessageText.contains("invalid") && !errorMessageText.contains("timeout")
                    let isBadRequest = errorMessageText.contains("bad request") || errorMessageText.contains("400")
                    let isNotPrivateAccount = errorMessageText.contains("only private accounts") || errorMessageText.contains("private account")
                    let isCannotAddSelf = errorMessageText.contains("cannot add yourself")
                    
                    // Ambiguous errors - operation MIGHT have succeeded (network issues, timeouts):
                    let isTimeout = errorMessageText.contains("timeout") || errorMessageText.contains("timed out")
                    let isNetworkError = errorMessageText.contains("network") || errorMessageText.contains("connection")
                    let isServerError = errorMessageText.contains("500") || errorMessageText.contains("internal server")
                    
                    let isClearFailure = isUserNotFound || isSecurityTokenError || (isInvalidRequest && !isTimeout) || isBadRequest || isNotPrivateAccount || isCannotAddSelf
                    let isAmbiguousError = isTimeout || isNetworkError || isServerError
                    
                    print("   🔍 Error analysis:")
                    print("      Error message: \(errorMessageText)")
                    print("      isUserNotFound: \(isUserNotFound)")
                    print("      isSecurityTokenError: \(isSecurityTokenError)")
                    print("      isInvalidRequest: \(isInvalidRequest)")
                    print("      isBadRequest: \(isBadRequest)")
                    print("      isTimeout: \(isTimeout)")
                    print("      isNetworkError: \(isNetworkError)")
                    print("      isServerError: \(isServerError)")
                    print("      isClearFailure: \(isClearFailure)")
                    print("      isAmbiguousError: \(isAmbiguousError)")
                    
                    if isClearFailure {
                        // Operation definitely failed - DO NOT keep optimistic update
                        // Remove any optimistic update we might have made
                        print("   ❌ Clear failure detected - operation did NOT succeed")
                        print("   🔄 Removing any optimistic updates...")
                        
                        // Remove from addedUsernames if it was added optimistically
                        let removedCount = addedUsernames.count
                        addedUsernames.removeAll(where: { 
                            $0.streamerUsername.lowercased() == username.lowercased() && 
                            $0.streamerVisibility?.lowercased() == "private"
                        })
                        let newCount = addedUsernames.count
                        
                        if removedCount != newCount {
                            print("   ✅ Removed \(removedCount - newCount) optimistic entry(ies)")
                            saveAddedUsernamesToUserDefaults()
                        }
                        
                        // Don't show error message for clear failures - they're expected and handled gracefully
                        // User will see the button revert to "Add to Private" which is sufficient feedback
                        // errorMessage = "Failed to add \(username) to private viewers: \(error.localizedDescription)"
                    } else if isAmbiguousError {
                        // Ambiguous error - operation MIGHT have succeeded (timeout, network issue)
                        // Keep optimistic update but warn user
                        print("   ⚠️ Ambiguous error (timeout/network) - keeping optimistic update (operation may have succeeded)")
                        print("      Error type: \(error.localizedDescription)")
                        
                        // Check if already in addedUsernames (might have been added optimistically before)
                        let alreadyAdded = addedUsernames.contains(where: { 
                            $0.streamerUsername.lowercased() == cleanUsername.lowercased() && 
                            $0.streamerVisibility?.lowercased() == "private"
                        })
                        
                        if !alreadyAdded {
                            // Only add if not already there (don't duplicate)
                            let newAdded = AddedUsername(
                                streamerEmail: email ?? "",
                                streamerUsername: cleanUsername,
                                addedAt: ISO8601DateFormatter().string(from: Date()),
                                streamerVisibility: "private"
                            )
                            addedUsernames.append(newAdded)
                            print("   ➕ Added optimistic entry (operation may have succeeded)")
                            saveAddedUsernamesToUserDefaults()
                        }
                        
                        // Show warning but don't block UI
                        errorMessage = "Add may have encountered a network issue, but was processed. Please check your connection."
                        Task {
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                            await MainActor.run {
                                errorMessage = nil
                            }
                        }
                    } else {
                        // Unknown error type - be conservative, don't keep optimistic update
                        // Don't show error message - button will revert which is sufficient feedback
                        // print("   ❓ Unknown error type - not keeping optimistic update")
                        // errorMessage = "Failed to add \(username) to private viewers: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
    
    // Remove a user from private viewers
    private func removePrivateViewerInline(username: String, email: String?) {
        guard let ownerEmail = authService.userEmail else {
            print("❌ [ChannelDetailView] Cannot remove private viewer - missing owner email")
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let privateKey = "\(cleanUsername.lowercased()):private"
        
        // Find the email from addedPrivateUsernames if not provided
        var viewerEmail = email
        if viewerEmail == nil || viewerEmail?.isEmpty == true {
            if let addedEntry = addedPrivateUsernames.first(where: { 
                $0.streamerUsername.lowercased() == cleanUsername.lowercased() && 
                ($0.streamerVisibility?.lowercased() ?? "private") == "private"
            }) {
                viewerEmail = addedEntry.streamerEmail
                print("   📧 Found email from addedPrivateUsernames: \(viewerEmail ?? "nil")")
            }
        }
        
        // If still no email, try to look it up
        if viewerEmail == nil || viewerEmail?.isEmpty == true {
            print("   ⚠️ Email not found, attempting lookup...")
            Task {
                do {
                    let searchResults = try await ChannelService.shared.searchUsernames(query: cleanUsername, limit: 1)
                    if let foundUser = searchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() }),
                       let foundEmail = foundUser.email, !foundEmail.isEmpty {
                        viewerEmail = foundEmail
                        print("   ✅ Found email from search: \(viewerEmail ?? "nil")")
                    } else {
                        print("   ❌ Could not find email for username: \(cleanUsername)")
                        await MainActor.run {
                            errorMessage = "Could not find email for \(cleanUsername). Cannot remove without email."
                        }
                        return
                    }
                } catch {
                    print("   ❌ Error looking up email: \(error.localizedDescription)")
                    await MainActor.run {
                        errorMessage = "Failed to look up email for \(cleanUsername): \(error.localizedDescription)"
                    }
                    return
                }
                
                // Continue with removal using looked-up email
                await performRemovePrivateViewer(username: cleanUsername, viewerEmail: viewerEmail ?? "", ownerEmail: ownerEmail, privateKey: privateKey)
            }
            return
        }
        
        // Email is available, proceed with removal
        Task {
            await performRemovePrivateViewer(username: cleanUsername, viewerEmail: viewerEmail ?? "", ownerEmail: ownerEmail, privateKey: privateKey)
        }
    }
    
    // Helper to perform the actual removal
    private func performRemovePrivateViewer(username: String, viewerEmail: String, ownerEmail: String, privateKey: String) async {
        // Add to removing set to show spinner
        let removingKey = "\(username.lowercased()):private"
        let removingUsernameKey = username.lowercased()
        
        await MainActor.run {
            removingPrivateUsernames.insert(removingUsernameKey)
        }
        
        do {
            print("🔴 [ChannelDetailView] ========== REMOVE FROM PRIVATE START ==========")
            print("   Viewer Username: \(username)")
            print("   Viewer Email: \(viewerEmail)")
            print("   Owner Email: \(ownerEmail)")
            
            // CRITICAL SECURITY: Pass authenticated user email for backend verification
            // Backend will verify that authenticated user is the owner
            let authenticatedUserEmail = authService.userEmail ?? ownerEmail
            
            let response = try await ChannelService.shared.removePrivateViewer(
                ownerEmail: ownerEmail,
                viewerEmail: viewerEmail,
                authenticatedUserEmail: authenticatedUserEmail
            )
            
            await MainActor.run {
                removingPrivateUsernames.remove(removingUsernameKey)
                print("✅ [ChannelDetailView] Remove API response: \(response)")
                
                // Optimistically remove from addedPrivateUsernames
                let removedCount = addedPrivateUsernames.count
                addedPrivateUsernames.removeAll(where: { 
                    $0.streamerUsername.lowercased() == username.lowercased() && 
                    ($0.streamerVisibility?.lowercased() ?? "private") == "private"
                })
                let newCount = addedPrivateUsernames.count
                
                if removedCount != newCount {
                    print("✅ [ChannelDetailView] Removed \(removedCount - newCount) entry(ies) from addedPrivateUsernames")
                    
                    // Save to private cache
                    saveAddedPrivateUsernamesToUserDefaults()
                    
                    // Add to removedUsernames set to prevent re-adding immediately (track by username:visibility)
                    let removedKey = "\(username.lowercased()):private"
                    removedUsernames.insert(removedKey)
                    print("   🚫 Added '\(removedKey)' to removedUsernames set (private removal)")
                    saveRemovedUsernamesToUserDefaults()
                    
                    // CRITICAL: Save to UserDefaults to persist the change
                    saveAddedUsernamesToUserDefaults()
                    print("✅ [ChannelDetailView] Saved updated addedUsernames to UserDefaults")
                    
                    // CRITICAL: Immediately filter out removed user's private content from cached arrays
                    let normalizedRemovedUsername = username.lowercased()
                    let beforePrivateCount = privateContent.count
                    privateContent.removeAll { item in
                        let itemUsername = (item.creatorUsername ?? "").replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                        let isPrivate = item.isPrivateUsername == true || (item.creatorUsername?.contains("🔒") ?? false)
                        return isPrivate && itemUsername == normalizedRemovedUsername
                    }
                    let afterPrivateCount = privateContent.count
                    if beforePrivateCount != afterPrivateCount {
                        print("✅ [ChannelDetailView] Optimistically removed \(beforePrivateCount - afterPrivateCount) private content item(s) from cache for \(username)")
                        
                        // Update displayed content if we're viewing private
                        if showPrivateContent {
                            content = privateContent
                        }
                    }
                    
                    // Clear cache for this channel to force fresh fetch
                    channelService.clearBothViewsCache(
                        channelName: currentChannel.channelName,
                        creatorEmail: currentChannel.creatorEmail,
                        viewerEmail: viewerEmail
                    )
                    
                    // Refresh content to remove viewer's content from server
                    Task {
                        print("   🔄 Refreshing channel content from server...")
                        try? await refreshChannelContent()
                    }
                } else {
                    print("⚠️ [ChannelDetailView] No entries found to remove for \(username)")
                }
                
                print("🔴 [ChannelDetailView] ========== REMOVE FROM PRIVATE END ==========")
            }
        } catch {
            await MainActor.run {
                removingPrivateUsernames.remove(removingUsernameKey)
                print("❌ [ChannelDetailView] Error removing private viewer: \(error)")
                print("   Error details: \(error.localizedDescription)")
                if let channelError = error as? ChannelServiceError {
                    print("   ChannelServiceError: \(channelError)")
                }
                // Show error to user
                errorMessage = "Failed to remove \(username) from private viewers: \(error.localizedDescription)"
            }
        }
    }
    
    // Check if username is already added
    // NOTE: This is completely independent of the "Request🔒" workflow
    // "Add" button tracks public username addition (addedUsernames)
    // "Request🔒" button tracks private request workflow (sentFollowRequests)
    // These should never affect each other
    // Check if a username is added with a specific visibility
    // For public button: check if username is added with "public" visibility
    // For private button: check if username is added with "private" visibility
    private func isUsernameAdded(_ username: String, visibility: String? = "public") -> Bool {
        // Remove 🔒 from username for comparison (addedUsernames stores clean usernames)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let isAdded = addedUsernames.contains(where: { 
            let usernameMatches = $0.streamerUsername.lowercased() == cleanUsername.lowercased()
            // If visibility is specified, check that it matches
            // If visibility is nil, check if streamerVisibility is nil or "public" (default to public)
            if let expectedVisibility = visibility {
                let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
                return usernameMatches && itemVisibility == expectedVisibility.lowercased()
            } else {
                // If no visibility specified, default to public (backward compatibility)
                let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
                return usernameMatches && itemVisibility == "public"
            }
        })
        return isAdded
    }
    
    // Check if a follow request was already sent for this username
    // Returns true if there's any request record (pending, accepted, or active)
    // CRITICAL: One-way flow - once "Requested", can't go back to "Request"
    // Standard lifecycle (like Instagram/Snapchat):
    // Request → Requested (pending/declined) → Approved (accepted) → Rejected (if removed)
    // CRITICAL: Once "Requested", can't go back to "Request" (one-way flow)
    // If declined, requester still sees "Requested" (can't request again)
    
    // Load sent follow requests
    private func loadSentFollowRequests(mergeWithExisting: Bool = false) {
        guard let userEmail = authService.userEmail else { return }
        
        isLoadingSentRequests = true
        Task {
            do {
                // Fetch all request states to track lifecycle
                // Standard lifecycle: pending (requested) → accepted (approved) OR declined (still shows "Requested")
                // "accepted" means the request was accepted and user can now see private content
                // "declined" means request was declined, but requester still sees "Requested" (can't request again)
                async let pendingResponse = ChannelService.shared.getSentFollowRequests(requesterEmail: userEmail, status: "pending")
                async let activeResponse = ChannelService.shared.getSentFollowRequests(requesterEmail: userEmail, status: "active")
                async let acceptedResponse = ChannelService.shared.getSentFollowRequests(requesterEmail: userEmail, status: "accepted")
                async let declinedResponse = ChannelService.shared.getSentFollowRequests(requesterEmail: userEmail, status: "declined")
                
                let (pendingResult, activeResult, acceptedResult, declinedResult) = try await (pendingResponse, activeResponse, acceptedResponse, declinedResponse)
                
                await MainActor.run {
                    // CRITICAL: Filter out removed usernames from server responses
                    let allPendingRequests = (pendingResult.requests ?? []).filter { !$0.requestedUsername.trimmingCharacters(in: .whitespaces).isEmpty }
                    let allActiveRequests = (activeResult.requests ?? []).filter { !$0.requestedUsername.trimmingCharacters(in: .whitespaces).isEmpty }
                    let allAcceptedRequests = (acceptedResult.requests ?? []).filter { !$0.requestedUsername.trimmingCharacters(in: .whitespaces).isEmpty }
                    let allDeclinedRequests = (declinedResult.requests ?? []).filter { !$0.requestedUsername.trimmingCharacters(in: .whitespaces).isEmpty }
                    
                    print("🔍 [DEBUG] loadSentFollowRequests - Server returned \(allPendingRequests.count) pending + \(allActiveRequests.count) active + \(allAcceptedRequests.count) accepted + \(allDeclinedRequests.count) declined")
                    print("🔍 [DEBUG] Current removedUsernames: \(removedUsernames.map { $0 }.joined(separator: ", "))")
                    
                    // Filter out removed usernames and user's own username
                    let currentUsername = authService.username?.lowercased()
                    var serverRequests = allPendingRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        if let current = currentUsername, lowercased == current {
                            print("🚫 [DEBUG] Filtering out user's own username from pending requests: '\(request.requestedUsername)'")
                            return false
                        }
                        
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from pending requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let activeRequests = allActiveRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        if let current = currentUsername, lowercased == current {
                            print("🚫 [DEBUG] Filtering out user's own username from active requests: '\(request.requestedUsername)'")
                            return false
                        }
                        
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from active requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let acceptedRequests = allAcceptedRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        if let current = currentUsername, lowercased == current {
                            print("🚫 [DEBUG] Filtering out user's own username from accepted requests: '\(request.requestedUsername)'")
                            return false
                        }
                        
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from accepted requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let declinedRequests = allDeclinedRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        if let current = currentUsername, lowercased == current {
                            print("🚫 [DEBUG] Filtering out user's own username from declined requests: '\(request.requestedUsername)'")
                            return false
                        }
                        
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from declined requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    // Merge all requests (avoid duplicates by username, prioritize accepted > active > pending > declined)
                    // Declined requests should still show as "Requested" from requester's perspective
                    var allUsernames = Set(serverRequests.map { $0.requestedUsername.lowercased() })
                    for activeRequest in activeRequests {
                        if !allUsernames.contains(activeRequest.requestedUsername.lowercased()) {
                            serverRequests.append(activeRequest)
                            allUsernames.insert(activeRequest.requestedUsername.lowercased())
                        }
                    }
                    for acceptedRequest in acceptedRequests {
                        // For accepted requests, update existing or add new
                        if let existingIndex = serverRequests.firstIndex(where: { $0.requestedUsername.lowercased() == acceptedRequest.requestedUsername.lowercased() }) {
                            // Update existing request to "accepted" status
                            serverRequests[existingIndex] = acceptedRequest
                            print("✅ [ChannelDetailView] Updated request status to accepted: \(acceptedRequest.requestedUsername)")
                        } else {
                            serverRequests.append(acceptedRequest)
                            print("✅ [ChannelDetailView] Added accepted request: \(acceptedRequest.requestedUsername)")
                        }
                    }
                    
                    for declinedRequest in declinedRequests {
                        // For declined requests, add them (they show as "Requested" from requester's perspective)
                        if !allUsernames.contains(declinedRequest.requestedUsername.lowercased()) {
                            serverRequests.append(declinedRequest)
                            allUsernames.insert(declinedRequest.requestedUsername.lowercased())
                            print("✅ [ChannelDetailView] Added declined request (shows as 'Requested'): \(declinedRequest.requestedUsername)")
                        }
                    }
                    
                    if mergeWithExisting {
                        // Merge server requests with existing optimistic updates
                        // CRITICAL: Preserve ALL optimistic updates that aren't on server yet
                        let serverUsernames = Set(serverRequests.map { $0.requestedUsername.lowercased() })
                        
                        print("   🔍 [DEBUG] Merge: Server has \(serverUsernames.count) usernames: \(Array(serverUsernames).sorted().joined(separator: ", "))")
                        print("   🔍 [DEBUG] Merge: Current sentFollowRequests has \(sentFollowRequests.count) requests")
                        print("   🔍 [DEBUG] Merge: Current requests: \(sentFollowRequests.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
                        
                        // Start with server requests (they take priority if they exist)
                        var mergedRequests = serverRequests
                        
                        // Add ALL optimistic requests that aren't on server
                        // CRITICAL: Preserve optimistic updates even if server doesn't have them yet
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        for existingRequest in sentFollowRequests {
                            let existingUsername = existingRequest.requestedUsername.lowercased()
                            
                            // CRITICAL: Filter out user's own username - users should never see themselves
                            if let current = currentUsername, existingUsername == current {
                                print("   🚫 Filtering out user's own username from optimistic merge: \(existingRequest.requestedUsername)")
                                continue
                            }
                            
                            let hasValidStatus = existingRequest.status.lowercased() == "pending" || 
                                                 existingRequest.status.lowercased() == "active" || 
                                                 existingRequest.status.lowercased() == "accepted" ||
                                                 existingRequest.status.lowercased() == "declined"
                            
                            if !serverUsernames.contains(existingUsername) && hasValidStatus {
                                // This is an optimistic update not yet on server - keep it
                                mergedRequests.append(existingRequest)
                                print("   💾 Preserved optimistic request for: \(existingRequest.requestedUsername) (status: \(existingRequest.status))")
                            } else if serverUsernames.contains(existingUsername) {
                                // Server has it - check if optimistic is newer (more recent requestedAt)
                                if let serverRequest = serverRequests.first(where: { $0.requestedUsername.lowercased() == existingUsername }) {
                                    // Use server version (it's the source of truth)
                                    if let existingIndex = mergedRequests.firstIndex(where: { $0.requestedUsername.lowercased() == existingUsername }) {
                                        mergedRequests[existingIndex] = serverRequest
                                    }
                                    print("   ✅ Server has request for: \(existingRequest.requestedUsername) - using server version")
                                }
                            } else if !hasValidStatus {
                                print("   ⚠️ Skipping request with invalid status: \(existingRequest.requestedUsername) (status: \(existingRequest.status))")
                            }
                        }
                        
                        // Remove duplicates (shouldn't happen, but safety check)
                        var uniqueRequests: [SentFollowRequest] = []
                        var seenUsernames: Set<String> = []
                        for req in mergedRequests {
                            let usernameLower = req.requestedUsername.lowercased()
                            if !seenUsernames.contains(usernameLower) {
                                uniqueRequests.append(req)
                                seenUsernames.insert(usernameLower)
                            }
                        }
                        
                        sentFollowRequests = uniqueRequests
                        print("✅ [ChannelDetailView] Merged sent follow requests: \(pendingResult.requests?.count ?? 0) pending + \(activeRequests.count) active from server + \(uniqueRequests.count - serverRequests.count) optimistic = \(uniqueRequests.count) total")
                        print("   📋 Final merged requests: \(uniqueRequests.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
                    } else {
                        // CRITICAL: Even when mergeWithExisting is false, we should preserve cached optimistic updates
                        // Only overwrite if we have cached data that's not in server response
                        let serverUsernames = Set(serverRequests.map { $0.requestedUsername.lowercased() })
                        var finalRequests = serverRequests
                        
                        // Preserve any cached requests that aren't on server yet (optimistic updates)
                        // CRITICAL: Filter out user's own username - users should never see themselves
                        for cached in sentFollowRequests {
                            let cachedUsername = cached.requestedUsername.lowercased()
                            
                            // CRITICAL: Filter out user's own username - users should never see themselves
                            if let current = currentUsername, cachedUsername == current {
                                print("   🚫 Filtering out user's own username from cached merge: \(cached.requestedUsername)")
                                continue
                            }
                            
                            if !serverUsernames.contains(cachedUsername) {
                                let hasValidStatus = cached.status.lowercased() == "pending" || 
                                                     cached.status.lowercased() == "active" || 
                                                     cached.status.lowercased() == "accepted" ||
                                                     cached.status.lowercased() == "declined"
                                if hasValidStatus {
                                    finalRequests.append(cached)
                                    print("   💾 Preserved cached optimistic request: \(cached.requestedUsername) (status: \(cached.status))")
                                }
                            }
                        }
                        
                        // CRITICAL: If server returns empty and we have cached requests, check if they should be cleared
                        // This handles the case where the database is clean but cache has stale entries
                        let hadCachedRequests = !sentFollowRequests.isEmpty
                        if finalRequests.isEmpty && hadCachedRequests {
                            let cachedCount = sentFollowRequests.count
                            print("⚠️ [ChannelDetailView] Server returned 0 follow requests but cache has \(cachedCount) entries")
                            print("   🧹 Clearing stale follow requests cache - database is clean")
                            
                            // Clear the cache since database is clean
                            sentFollowRequests = []
                            if let userEmail = authService.userEmail {
                                let key = "sentFollowRequests_\(userEmail)"
                                UserDefaults.standard.removeObject(forKey: key)
                                UserDefaults.standard.synchronize()
                                print("   ✅ Cleared follow requests cache (key: \(key))")
                            }
                        } else {
                            sentFollowRequests = finalRequests
                            print("✅ [ChannelDetailView] Loaded \(sentFollowRequests.count) sent follow requests (\(pendingResult.requests?.count ?? 0) pending + \(activeRequests.count) active)")
                        }
                    }
                    
                    // CRITICAL: DO NOT filter sentFollowRequests by removedUsernames
                    // removedUsernames is ONLY for filtering addedUsernames (public "Add" button)
                    // sentFollowRequests (private "Request🔒" button) are COMPLETELY INDEPENDENT
                    // A user can have a pending private request even if they removed the username from public added list
                    
                    // CRITICAL: Save to UserDefaults after loading to persist any optimistic updates
                    saveSentFollowRequestsToUserDefaults()
                    
                    isLoadingSentRequests = false
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading sent follow requests: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingSentRequests = false
                }
            }
        }
    }
    
    // Load received follow requests (incoming requests)
    
    
    // Helper to format date as relative time (e.g., "2 days ago", "today")
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else {
            return dateString
        }
        
        let calendar = Calendar.current
        let now = Date()
        
        // Check if it's today
        if calendar.isDateInToday(date) {
            let components = calendar.dateComponents([.hour, .minute], from: date, to: now)
            if let hours = components.hour, hours > 0 {
                return "\(hours) hour\(hours == 1 ? "" : "s") ago"
            } else if let minutes = components.minute, minutes > 0 {
                return "\(minutes) minute\(minutes == 1 ? "" : "s") ago"
            } else {
                return "Just now"
            }
        }
        
        // Check if it's yesterday
        if calendar.isDateInYesterday(date) {
            return "Yesterday"
        }
        
        // Check if it's this week
        if let days = calendar.dateComponents([.day], from: date, to: now).day, days < 7 {
            return "\(days) day\(days == 1 ? "" : "s") ago"
        }
        
        // Check if it's this month
        if let weeks = calendar.dateComponents([.weekOfYear], from: date, to: now).weekOfYear, weeks < 4 {
            return "\(weeks) week\(weeks == 1 ? "" : "s") ago"
        }
        
        // Check if it's this year
        if let months = calendar.dateComponents([.month], from: date, to: now).month, months < 12 {
            return "\(months) month\(months == 1 ? "" : "s") ago"
        }
        
        // Otherwise show years
        if let years = calendar.dateComponents([.year], from: date, to: now).year, years > 0 {
            return "\(years) year\(years == 1 ? "" : "s") ago"
        }
        
        // Fallback to formatted date
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
    
    // Check if username is currently being added
    private func isUsernameBeingAdded(_ username: String) -> Bool {
        // Track exact button clicked: store "username:public" or "username:private"
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let isPrivate = username.contains("🔒")
        let key = "\(cleanUsername.lowercased()):\(isPrivate ? "private" : "public")"
        let isBeingAdded = addingUsernames.contains(key)
        print("🔍 [ChannelDetailView] isUsernameBeingAdded check:")
        print("   Input username: '\(username)'")
        print("   Clean username: '\(cleanUsername)'")
        print("   Is private: \(isPrivate)")
        print("   Checking for key: '\(key)'")
        print("   Current addingUsernames: \(addingUsernames)")
        print("   Result: \(isBeingAdded ? "✅ YES - being added" : "❌ NO - not being added")")
        return isBeingAdded
    }
    
    // Remove username
    private func removeUsername(_ username: String) {
        guard let userEmail = authService.userEmail else {
            return
        }
        
        // Find the AddedUsername object to get the email
        guard let addedUsername = addedUsernames.first(where: { $0.streamerUsername.lowercased() == username.lowercased() }) else {
            print("⚠️ [ChannelDetailView] Could not find username in addedUsernames: \(username)")
            return
        }
        
        Task {
            do {
                // Call remove follow API endpoint with email directly
                let response = try await ChannelService.shared.removeFollow(
                    requesterEmail: userEmail,
                    requestedUsername: username,
                    requestedUserEmail: addedUsername.streamerEmail
                )
                
                // Response.success is already checked in removeFollow, so if we get here, it succeeded
                await MainActor.run {
                    // Optimistically remove from local list
                    addedUsernames.removeAll { $0.streamerUsername.lowercased() == username.lowercased() }
                    showAddedUsernamesDropdown = false
                    
                    // CRITICAL: Update sentFollowRequests status to "rejected" if it was "accepted"
                    // This maintains the lifecycle: Request → Requested → Approved → Rejected (if removed)
                    if let index = sentFollowRequests.firstIndex(where: { 
                        $0.requestedUsername.lowercased() == username.lowercased() && 
                        $0.status.lowercased() == "accepted"
                    }) {
                        // Update status to rejected (backend already did this, but update local state)
                        var updatedRequest = sentFollowRequests[index]
                        // Note: SentFollowRequest is immutable, so we need to reload from server
                        print("🔄 [ChannelDetailView] Request was approved, now removed - status should be 'rejected'")
                        // CRITICAL: Use merge=true to preserve any other optimistic updates
                        // Reload sent requests to get updated status
                        loadSentFollowRequests(mergeWithExisting: true)
                    }
                    
                    // Save to UserDefaults immediately
                    saveAddedUsernamesToUserDefaults()
                    
                    // Reload from server to ensure consistency (merge to preserve any other optimistic updates)
                    loadAddedUsernames(mergeWithExisting: true)
                    
                    // Refresh content to remove their posts from the timeline
                    Task {
                        try? await refreshChannelContent()
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error removing username: \(error.localizedDescription)")
                // Show error to user
                await MainActor.run {
                    // You could add an error state here to show an alert
                    print("❌ [ChannelDetailView] Failed to remove \(username): \(error)")
                }
            }
        }
    }
    
    // Deselect added username - reverts "Added" back to "Add"
    private func deselectAddedUsername(_ username: String, email: String? = nil, visibility: String? = nil) {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot deselect - userEmail is nil")
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let expectedVisibility = visibility?.lowercased() ?? "public" // Default to public if not specified
        
        print("🔴 [ChannelDetailView] ========== DESELECT ADDED USERNAME ==========")
        print("   📝 Username: '\(username)' -> clean: '\(cleanUsername)'")
        print("   📧 Email parameter: \(email ?? "nil")")
        print("   🔒 Visibility: \(expectedVisibility)")
        print("   📊 Current addedUsernames count: \(addedUsernames.count)")
        print("   📋 Current addedUsernames: \(addedUsernames.map { "\($0.streamerUsername) (visibility: \($0.streamerVisibility ?? "public"), email: \($0.streamerEmail))" }.joined(separator: ", "))")
        
        // CRITICAL: Find the AddedUsername object that matches BOTH username AND visibility
        // This ensures we only remove the correct entry (public or private)
        guard let addedUsername = addedUsernames.first(where: { 
            let usernameMatches = $0.streamerUsername.lowercased() == cleanUsername.lowercased()
            let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
            let visibilityMatches = itemVisibility == expectedVisibility
            return usernameMatches && visibilityMatches
        }) else {
            print("❌ [ChannelDetailView] Could not find username with matching visibility in addedUsernames: \(cleanUsername) (visibility: \(expectedVisibility))")
            print("   🔍 Searched in: \(addedUsernames.map { "\($0.streamerUsername.lowercased()) (visibility: \($0.streamerVisibility ?? "public"))" }.joined(separator: ", "))")
            return
        }
        
        var emailToUse = email ?? addedUsername.streamerEmail
        print("   ✅ Found username in addedUsernames")
        print("   📧 Email from parameter: \(email ?? "nil")")
        print("   📧 Email from addedUsername: \(addedUsername.streamerEmail)")
        print("   📧 Email to use (before lookup): \(emailToUse)")
        
        // Capture visibility for use in closures
        let visibilityToUse = visibility
        
        // If email is empty, try to look it up from the username
        if emailToUse.isEmpty {
            print("   ⚠️ Email is empty, attempting to look up email from username...")
            Task {
                do {
                    let searchResults = try await ChannelService.shared.searchUsernames(query: cleanUsername, limit: 1)
                    if let foundUser = searchResults.first, let foundEmail = foundUser.email, !foundEmail.isEmpty {
                        emailToUse = foundEmail
                        print("   ✅ Found email from search: \(emailToUse)")
                    } else {
                        print("   ❌ Could not find email for username: \(cleanUsername)")
                        await MainActor.run {
                            print("❌ [ChannelDetailView] ERROR: Email is empty and could not be looked up! Cannot remove without email.")
                        }
                        return
                    }
                } catch {
                    print("   ❌ Error looking up email: \(error.localizedDescription)")
                    await MainActor.run {
                        print("❌ [ChannelDetailView] ERROR: Email is empty and lookup failed! Cannot remove without email.")
                    }
                    return
                }
                
                // Continue with the removal using the looked-up email
                await performRemoveAddedUsername(cleanUsername: cleanUsername, email: emailToUse, userEmail: userEmail, visibility: visibilityToUse)
            }
            return
        }
        
        // Email is available, proceed with removal
        Task {
            await performRemoveAddedUsername(cleanUsername: cleanUsername, email: emailToUse, userEmail: userEmail, visibility: visibilityToUse)
        }
    }
    
    // Helper function to perform the actual removal
    private func performRemoveAddedUsername(cleanUsername: String, email: String, userEmail: String, visibility: String? = nil) async {
        Task {
            do {
                print("   🚀 Calling removeFollow API...")
                print("      - requesterEmail: \(userEmail)")
                print("      - requestedUsername: \(cleanUsername)")
                print("      - requestedUserEmail: \(email)")
                
                // Call remove follow API endpoint
                let response = try await ChannelService.shared.removeFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requestedUserEmail: email
                )
                
                print("   ✅ API call successful!")
                print("   📥 Response: success=\(response.success), message=\(response.message ?? "nil")")
                
                await MainActor.run {
                    // CRITICAL: Only remove the entry that matches BOTH username AND visibility
                    // This ensures we don't accidentally remove the other visibility type (public vs private)
                    let beforeCount = addedUsernames.count
                    let expectedVisibility = visibility?.lowercased() ?? "public"
                    addedUsernames.removeAll { 
                        let usernameMatches = $0.streamerUsername.lowercased() == cleanUsername.lowercased()
                        let itemVisibility = $0.streamerVisibility?.lowercased() ?? "public"
                        let visibilityMatches = itemVisibility == expectedVisibility
                        return usernameMatches && visibilityMatches
                    }
                    let afterCount = addedUsernames.count
                    print("   📊 Optimistically removed from addedUsernames: \(beforeCount) -> \(afterCount) (removed \(beforeCount - afterCount) item(s) with visibility: \(expectedVisibility))")
                    saveAddedUsernamesToUserDefaults()
                    
                    // Check what was actually deleted based on deletedType (for tracking purposes)
                    let deletedType = response.deletedType?.uppercased() ?? ""
                    print("   📥 Response deletedType: \(deletedType)")
                    
                    // CRITICAL: Do NOT remove from sentFollowRequests when removing Added username
                    // Even if backend deleted FOLLOW_REQUEST, we should NOT remove it from sentFollowRequests
                    // because the user only clicked "Remove" on Added, not Requested
                    if deletedType == "FOLLOW_REQUEST" || deletedType == "BOTH" {
                        print("   ⚠️ WARNING: FOLLOW_REQUEST was also deleted by backend, but user only clicked Remove on Added")
                        print("   ✅ NOT removing from sentFollowRequests - preserving private request")
                    }
                    
                    // Track as removed (always, since user explicitly clicked Remove) - use username:visibility format
                    let lowercasedUsername = cleanUsername.lowercased()
                    let visibilityValue = visibility?.lowercased() ?? "public"
                    let removedKey = "\(lowercasedUsername):\(visibilityValue)"
                    removedUsernames.insert(removedKey)
                    print("   🚫 Added '\(removedKey)' to removedUsernames set (original: '\(cleanUsername)', visibility: \(visibilityValue))")
                    saveRemovedUsernamesToUserDefaults()
                    
                    // Check backend response - if it says "not found", don't reload (keeps removal)
                    let responseMessage = response.message?.lowercased() ?? ""
                    if responseMessage.contains("not in timeline") || responseMessage.contains("already removed") || responseMessage.contains("never added") {
                        print("   ℹ️ Backend says entry not found - keeping optimistic removal, NOT reloading from server")
                    } else if deletedType == "ADDED_USERNAME" || deletedType == "BOTH" {
                        // Reload only addedUsernames (NOT sentFollowRequests) to sync with server
                        print("   🔄 Backend deleted ADDED_USERNAME - reloading addedUsernames only")
                        loadAddedUsernames(mergeWithExisting: true)
                    }
                    
                    // Refresh content to remove their posts from the timeline
                    Task {
                        try? await refreshChannelContent()
                    }
                    
                    print("✅ [ChannelDetailView] Deselected added username: \(cleanUsername)")
                    
                    // Check if all usernames are now empty - if so, show message and auto-close
                    checkAndAutoCloseIfEmpty()
                }
            } catch {
                print("❌ [ChannelDetailView] Error deselecting added username: \(error.localizedDescription)")
                print("   Error type: \(type(of: error))")
                if let channelError = error as? ChannelServiceError {
                    print("   ChannelServiceError: \(channelError)")
                }
            }
        }
    }
    
    private func deselectAddedUsernameOld(_ username: String, email: String?) {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot deselect - userEmail is nil")
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        // Find the AddedUsername object to get the email
        guard let addedUsername = addedUsernames.first(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) else {
            print("⚠️ [ChannelDetailView] Could not find username in addedUsernames: \(cleanUsername)")
            return
        }
        
        var emailToUse = email ?? addedUsername.streamerEmail
        
        Task {
            do {
                print("   🚀 Calling removeFollow API...")
                print("      - requesterEmail: \(userEmail)")
                print("      - requestedUsername: \(cleanUsername)")
                print("      - requestedUserEmail: \(emailToUse)")
                
                // Call remove follow API endpoint
                let response = try await ChannelService.shared.removeFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requestedUserEmail: emailToUse
                )
                
                print("   ✅ API call successful!")
                print("   📥 Response: success=\(response.success), message=\(response.message ?? "nil")")
                
                await MainActor.run {
                    // Optimistically remove from local list
                    let beforeCount = addedUsernames.count
                    addedUsernames.removeAll { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }
                    let afterCount = addedUsernames.count
                    print("   📊 Removed from local list: \(beforeCount) -> \(afterCount) (removed \(beforeCount - afterCount) item(s))")
                    
                    // Save to UserDefaults immediately
                    saveAddedUsernamesToUserDefaults()
                    
                    // Reload from server to ensure consistency
                    loadAddedUsernames(mergeWithExisting: true)
                    
                    // Refresh content to remove their posts from the timeline
                    Task {
                        try? await refreshChannelContent()
                    }
                    
                    print("✅ [ChannelDetailView] Deselected added username: \(cleanUsername)")
                    
                    // Check if all usernames are now empty - if so, show message and auto-close
                    checkAndAutoCloseIfEmpty()
                }
            } catch {
                print("❌ [ChannelDetailView] Error deselecting added username: \(error.localizedDescription)")
                print("   Error type: \(type(of: error))")
                if let channelError = error as? ChannelServiceError {
                    print("   ChannelServiceError: \(channelError)")
                }
            }
        }
    }
    
    
    private var channelInfo: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Hide channel name for Twilly TV (shown in nav bar instead)
            if currentChannel.channelName.lowercased() != "twilly tv" {
                Text(currentChannel.channelName)
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.white,
                                Color.twillyTeal,
                                Color.twillyCyan
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.6), radius: 8, x: 0, y: 2)
            }
            
            if !currentChannel.description.isEmpty {
                Text(currentChannel.description)
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.white.opacity(0.95),
                                Color.white.opacity(0.7)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .lineSpacing(4)
                    .padding(.top, currentChannel.channelName.lowercased() == "twilly tv" ? 0 : 4)
            }
            
            // Show badges and buttons based on user role
            VStack(alignment: .leading, spacing: 8) {
                // Collaborator badge - Show above Stream button for all collaborators (admin and non-admin)
                if canStream {
                    HStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(Color.twillyCyan.opacity(0.3))
                                .frame(width: 20, height: 20)
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.twillyCyan)
                        }
                        Text("COLLABORATOR")
                            .font(.system(size: 11, weight: .black, design: .rounded))
                            .tracking(1.5)
                    }
                    .foregroundColor(.twillyCyan)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal.opacity(0.25),
                                        Color.twillyCyan.opacity(0.15)
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal.opacity(0.6),
                                                Color.twillyCyan.opacity(0.4)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1
                                    )
                            )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.3), radius: 6, x: 0, y: 2)
                }
                
                // Stream button - Show for all authenticated users who can stream
                if canStream {
                    Button(action: {
                        // Navigate to stream screen with this channel selected
                        NotificationCenter.default.post(
                            name: NSNotification.Name("StartStreamingFromChannel"),
                            object: nil,
                            userInfo: [
                                "channelName": currentChannel.channelName,
                                "channelId": currentChannel.channelId
                            ]
                        )
                    }) {
                        HStack(spacing: 10) {
                            ZStack {
                                Circle()
                                    .fill(Color.white.opacity(0.2))
                                    .frame(width: 32, height: 32)
                                Image(systemName: "video.fill")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            
                            Text("STREAM")
                                .font(.system(size: 17, weight: .black, design: .rounded))
                                .tracking(2)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyTeal,
                                            Color.twillyCyan,
                                            Color.twillyTeal
                                        ]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(
                                            LinearGradient(
                                                gradient: Gradient(colors: [
                                                    Color.white.opacity(0.3),
                                                    Color.clear
                                                ]),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            ),
                                            lineWidth: 1
                                        )
                                )
                        )
                        .shadow(color: Color.twillyCyan.opacity(0.5), radius: 12, x: 0, y: 6)
                        .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 3)
                    }
                }
                
                // For Twilly TV, show inline username search bar
                if currentChannel.channelName.lowercased() == "twilly tv" {
                    VStack(alignment: .leading, spacing: 8) {
                            // Search bar
                            HStack(spacing: 12) {
                            // Toggle added usernames dropdown (moved to left)
                            Button(action: {
                                withAnimation {
                                    showAddedUsernamesDropdown.toggle()
                                    // Close search dropdown when opening added usernames
                                    if showAddedUsernamesDropdown {
                                        showSearchDropdown = false
                                        usernameSearchResults = []
                                    }
                                }
                            }) {
                                ZStack(alignment: .topTrailing) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "person.2.fill")
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal,
                                                Color.twillyCyan
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .cornerRadius(8)
                                    
                                    // Badge with count
                                    let totalUsernamesCount = getAllUsernamesForDropdown().count
                                    if totalUsernamesCount > 0 {
                                        Text("\(totalUsernamesCount)")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 2)
                                            .background(Color.orange)
                                            .clipShape(Capsule())
                                            .offset(x: 8, y: -8)
                                    }
                                }
                            }
                            
                            TextField("Add Streamers to your timeline", text: $usernameSearchText)
                                .foregroundColor(.white)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .submitLabel(.done)
                                .focused($isSearchFieldFocused)
                                .onChange(of: usernameSearchText) { newValue in
                                    print("🔍 [TextField] onChange triggered: '\(usernameSearchText)' -> '\(newValue)'")
                                    handleSearchTextChange(newValue: newValue)
                                }
                                .onSubmit {
                                    // Dismiss keyboard when user presses done
                                    isSearchFieldFocused = false
                                }
                            
                            if !usernameSearchText.isEmpty {
                                Button(action: {
                                    usernameSearchText = ""
                                    usernameSearchResults = []
                                    showSearchDropdown = false
                                    isSearchFieldFocused = false // Dismiss keyboard
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white.opacity(0.6))
                                }
                            }
                            
                            // Done button to dismiss keyboard
                            if isSearchFieldFocused {
                                Button(action: {
                                    isSearchFieldFocused = false // Dismiss keyboard
                                }) {
                                    Text("Done")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.twillyTeal)
                                }
                            }
                            
                            // Magnifying glass icon on the right
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.6))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // No visibility filter - always show all results (public and private together)
                        
                        // Search results dropdown - show loading or results
                        if showSearchDropdown {
                            searchResultsDropdown
                        }
                        
                        // Added usernames dropdown
                        if showAddedUsernamesDropdown {
                            VStack(alignment: .leading, spacing: 0) {
                                if !addedUsernames.isEmpty {
                                    // Use the same helper function to get all usernames
                                    let allUsernames = getAllUsernamesForDropdown()
                                    let filteredUsernames = allUsernames.filter { item in
                                        if usernameSearchText.isEmpty {
                                            return true
                                        }
                                        return item.username.lowercased().contains(usernameSearchText.lowercased())
                                    }
                                    
                                    if filteredUsernames.isEmpty {
                                        Text("No usernames found")
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                    } else {
                                        ForEach(filteredUsernames) { item in
                                            HStack {
                                                // Icon based on state
                                                if item.isAdded && item.isRequested {
                                                    // Both states - show both icons
                                                    HStack(spacing: 4) {
                                                        Image(systemName: "checkmark.circle.fill")
                                                            .foregroundColor(.twillyCyan)
                                                        Image(systemName: "lock.fill")
                                                            .foregroundColor(.orange)
                                                            .font(.caption2)
                                                    }
                                                } else if item.isAdded {
                                                    // Only added
                                                    Image(systemName: "checkmark.circle.fill")
                                                        .foregroundColor(.twillyCyan)
                                                } else if item.isRequested {
                                                    // Only requested
                                                    Image(systemName: "lock.fill")
                                                        .foregroundColor(.orange)
                                                }
                                                
                                                Text(item.username)
                                                    .foregroundColor(.white)
                                                    .lineLimit(1)
                                                    .minimumScaleFactor(0.8)
                                                
                                                Spacer()
                                                
                                                // Deselection buttons - both say "Remove"
                                                HStack(spacing: 8) {
                                                    // "Remove" button for added - only show if added
                                                    // CRITICAL: Pass visibility to ensure we remove the correct entry (public vs private)
                                                    if item.isAdded {
                                                        Button(action: {
                                                            print("🟡 [ChannelDetailView] Removing Added from dropdown: \(item.username) (visibility: \(item.addedVisibility ?? "public"))")
                                                            deselectAddedUsername(item.username, email: item.email, visibility: item.addedVisibility)
                                                        }) {
                                                            Text("Remove")
                                                                .font(.caption)
                                                                .fontWeight(.semibold)
                                                                .foregroundColor(.twillyCyan)
                                                                .padding(.horizontal, 10)
                                                                .padding(.vertical, 4)
                                                                .background(Color.twillyCyan.opacity(0.2))
                                                                .cornerRadius(6)
                                                        }
                                                    }
                                                    
                                                    // "Remove" button removed - private follow requests no longer supported
                                                }
                                            }
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                            .background(Color.white.opacity(0.05))
                                            
                                            if item.id != filteredUsernames.last?.id {
                                                Divider()
                                                    .background(Color.white.opacity(0.1))
                                            }
                                        }
                                    }
                                } else {
                                    Text("No added or requested usernames")
                                        .font(.subheadline)
                                        .foregroundColor(.gray)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                }
                            }
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .padding(.top, 4)
                        }
                        
                        // Tap area below dropdowns to close them
                        if showSearchDropdown || showAddedUsernamesDropdown {
                            Spacer()
                                .frame(minHeight: 200)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    withAnimation {
                                        showSearchDropdown = false
                                        showAddedUsernamesDropdown = false
                                        usernameSearchText = ""
                                        usernameSearchResults = []
                                    }
                                }
                        }
                    }
                    .padding(.top, 8)
                }
                
                // Viewer badge for regular viewers (if not a collaborator)
                if !canStream && currentChannel.channelName.lowercased() != "twilly tv" {
                    HStack(spacing: 4) {
                        Image(systemName: "eye.fill")
                            .font(.caption2)
                        Text("Viewer")
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.white.opacity(0.15),
                                Color.white.opacity(0.1)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(8)
                }
                
                // Show refresh message if no new content
                if let message = refreshMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.top, 4)
                }
            }
            .padding(.top, 8)
            
            // Price display removed - will be revealed later
        }
        .padding(.horizontal)
    }
    
    @ViewBuilder
    private var contentSection: some View {
        // INSTAGRAM/TIKTOK PATTERN: Simple, reliable state management
        // Priority: Error > Content > Loading > Empty (only if explicitly confirmed)
        
        if let error = errorMessage {
            errorView(error)
        } else if !content.isEmpty {
            // Always show content if available (even if loading in background)
            contentListView
        } else if !previousContentBeforeFilter.isEmpty {
            // Show previous content while filtering (smooth transition)
            LazyVStack(spacing: 12) {
                ForEach(previousContentBeforeFilter) { item in
                    contentCard(for: item)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 20)
        } else if isLoading {
            // Show loading only when actively fetching AND no cached content
            loadingView
        } else if hasLoadedOnce {
            // Show empty state if we've loaded at least once (even if other view has content)
            // For Twilly TV, if one view is empty but the other has content, still show empty state
            // This prevents showing loading spinner when we know the current view is empty
            emptyStateView
        } else {
            // Fallback: Show loading only if we haven't loaded yet
            // This handles the initial load state
            loadingView
        }
    }
    
    private var searchResultsDropdown: some View {
        Group {
            if isSearchingUsernames && usernameSearchResults.isEmpty {
                // Show loading indicator while searching
                VStack(spacing: 12) {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.2)
                    Text("Searching...")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                .background(Color.white.opacity(0.1))
                .cornerRadius(12)
                .padding(.top, 4)
                .gesture(
                    DragGesture(minimumDistance: 50, coordinateSpace: .local)
                        .onEnded { value in
                            // Swipe up to exit search
                            if value.translation.height < -50 {
                                withAnimation {
                                    usernameSearchText = ""
                                    usernameSearchResults = []
                                    showSearchDropdown = false
                                    isSearchFieldFocused = false
                                }
                            }
                        }
                )
            } else if !usernameSearchResults.isEmpty {
                searchResultsList
            }
        }
    }
    
    private var searchResultsList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Group results by base username (without 🔒)
                let groupedResults = Dictionary(grouping: usernameSearchResults) { result in
                    result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                }
                
                ForEach(Array(groupedResults.keys.sorted()), id: \.self) { baseUsernameKey in
                    searchResultRow(for: baseUsernameKey, in: groupedResults)
                }
            }
        }
        .onAppear {
            // CRITICAL: Load cache FIRST before server fetch to restore optimistic updates
            // This ensures "Requested" state persists even if server hasn't processed the request yet
            // CRITICAL: Public "Add" and private "Request" are COMPLETELY INDEPENDENT
            // Loading one should NEVER affect the other
            print("🔄 [ChannelDetailView] Loading sentFollowRequests and addedUsernames for search results...")
            // CRITICAL: Load from UserDefaults FIRST to restore cached optimistic updates
            // This must happen synchronously before any UI rendering
            loadSentFollowRequestsFromUserDefaults()
            print("   ✅ Cache loaded - sentFollowRequests count: \(sentFollowRequests.count)")
            // Then fetch from server and merge (preserves cached data if server doesn't have it yet)
            loadSentFollowRequests(mergeWithExisting: true) // Always merge to preserve optimistic updates
            if addedUsernames.isEmpty {
                loadAddedUsernames(mergeWithExisting: true)
            }
        }
        .frame(maxHeight: 300) // Maximum height for scrollable dropdown
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
        .padding(.top, 4)
        .simultaneousGesture(
            DragGesture(minimumDistance: 50, coordinateSpace: .local)
                .onEnded { value in
                    // Swipe up to exit search (only if swiping up, not down)
                    if value.translation.height < -50 {
                        withAnimation {
                            usernameSearchText = ""
                            usernameSearchResults = []
                            showSearchDropdown = false
                            isSearchFieldFocused = false
                        }
                    }
                }
                .onChanged { _ in
                    // Dismiss keyboard when scrolling search results
                    isSearchFieldFocused = false
                }
        )
    }
    
    @ViewBuilder
    private func searchResultRow(for baseUsernameKey: String, in groupedResults: [String: [UsernameSearchResult]]) -> some View {
        let results = groupedResults[baseUsernameKey] ?? []
        let publicResult = results.first(where: { $0.isPrivate != true })
        let privateResult = results.first(where: { $0.isPrivate == true })
        let displayUsername = publicResult?.username ?? privateResult?.username.replacingOccurrences(of: "🔒", with: "") ?? baseUsernameKey
        
        // Show row for any user (public, private, or both)
        // Previously hidden users with only private accounts - now showing them
        HStack(spacing: 8) {
            Image(systemName: "person.circle.fill")
                .foregroundColor(.twillyTeal)
                .frame(width: 20) // Fixed width for icon
            
            Text(displayUsername)
                .foregroundColor(.white)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false) // Allow full width, no scaling
                .layoutPriority(1) // Give username priority to expand
            
            Spacer(minLength: 8) // Minimum spacing before buttons
            
            // Show buttons based on what exists
            HStack(spacing: 8) {
                // Show Add button if public exists
                // Private management moved to top toolbar person icon
                if let publicResult = publicResult {
                    publicAccountButton(for: publicResult)
                }
            }
            .layoutPriority(0) // Buttons have lower priority
            .fixedSize(horizontal: false, vertical: false) // Allow buttons to shrink if needed
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.05))
        
        if baseUsernameKey != groupedResults.keys.sorted().last {
            Divider()
                .background(Color.white.opacity(0.1))
        }
    }
    
    @ViewBuilder
    private func publicAccountButton(for result: UsernameSearchResult) -> some View {
        // Public button should always show Add/Added, never Request
        // Check if already added with PUBLIC visibility FIRST - if added, allow deselection
        // CRITICAL: Only show "Added" if the username is added with "public" visibility
        // If it's added with "private" visibility, show "Add" (public version not added)
        let cleanUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let currentUsername = authService.username?.lowercased() ?? ""
        let isCurrentUser = !currentUsername.isEmpty && cleanUsername.lowercased() == currentUsername
        let isPublicAdded = isUsernameAdded(result.username, visibility: "public")
        
        // DEBUG: Log button state for public button
        let _ = {
            print("🔍 [ChannelDetailView] PUBLIC button state for '\(cleanUsername)':")
            print("   isPublicAdded: \(isPublicAdded)")
            print("   addedUsernames count: \(addedUsernames.count)")
            let matchingEntries = addedUsernames.filter { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }
            print("   Matching entries: \(matchingEntries.count)")
            for entry in matchingEntries {
                print("     - \(entry.streamerUsername) (visibility: \(entry.streamerVisibility ?? "public"))")
            }
        }()
        
        if isPublicAdded {
            Button(action: {
                print("🟡 [ChannelDetailView] ADDED BUTTON TAPPED (PUBLIC) - deselecting")
                deselectAddedUsername(result.username, email: result.email, visibility: "public")
            }) {
                Text("Added")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(isCurrentUser ? .white.opacity(0.5) : .twillyCyan)
                    .frame(minWidth: 60)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(isCurrentUser ? Color.white.opacity(0.1) : Color.twillyCyan.opacity(0.2))
                    .cornerRadius(6)
            }
            .disabled(isCurrentUser)
            .opacity(isCurrentUser ? 0.5 : 1.0)
        } else {
            // Check if THIS SPECIFIC public button is being added (not private)
            // Only show spinner for public button if it's the public key being added
            let cleanUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
            let publicKey = "\(cleanUsername.lowercased()):public"
            let isPublicBeingAdded = addingUsernames.contains(publicKey)
            
            if isPublicBeingAdded {
                // Only show spinner if THIS public button is being added
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
            } else {
                Button(action: {
                    print("🟢 [ChannelDetailView] ADD BUTTON TAPPED (public)")
                    print("   Username: '\(result.username)'")
                    print("   Email: \(result.email ?? "nil")")
                    addUsernameInline(result.username, email: result.email)
                }) {
                    Text("Add")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(isCurrentUser ? .white.opacity(0.5) : .white)
                        .frame(minWidth: 60)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Group {
                                if isCurrentUser {
                                    Color.white.opacity(0.1)
                                } else {
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyTeal,
                                            Color.twillyCyan
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                }
                            }
                        )
                        .cornerRadius(6)
                }
                .disabled(isCurrentUser)
                .opacity(isCurrentUser ? 0.5 : 1.0)
            }
        }
    }
    
    @ViewBuilder
    private func privateAccountButton(for result: UsernameSearchResult) -> some View {
        let cleanPrivateUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        // NEW FLOW: If current user is a private account owner, they can add/remove viewers directly
        // Check if current user is viewing their own account (can't add themselves)
        let isViewingSelf = authService.username?.lowercased() == cleanPrivateUsername.lowercased()
        
        // Check if target user is already added as a private viewer
        // Check private usernames from separate cache
        let isPrivateViewer = addedPrivateUsernames.contains(where: { 
            $0.streamerUsername.lowercased() == cleanPrivateUsername.lowercased() &&
            ($0.streamerVisibility?.lowercased() ?? "private") == "private"
        })
        
        // ANY user can add others to view their private streams (not just private account owners)
        // Only restriction: can't add yourself
        if !isViewingSelf {
            let privateKey = "\(cleanPrivateUsername.lowercased()):private"
            let isBeingAdded = addingUsernames.contains(privateKey)
            
            if isBeingAdded {
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
            } else if isPrivateViewer {
                // User is already a private viewer - show "Remove from Private"
                Button(action: {
                    print("🔴 [ChannelDetailView] REMOVE FROM PRIVATE - \(cleanPrivateUsername)")
                    removePrivateViewerInline(username: cleanPrivateUsername, email: result.email)
                }) {
                    Text("Remove from Private")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(minWidth: 100) // Reduced further
                        .padding(.horizontal, 6) // Reduced padding
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.8))
                        .cornerRadius(6)
                }
            } else {
                // User is not a private viewer - show "Add to Private"
                Button(action: {
                    print("🟢 [ChannelDetailView] ADD TO PRIVATE BUTTON TAPPED - \(cleanPrivateUsername)")
                    print("   Email: \(result.email ?? "nil")")
                    addPrivateViewerInline(username: cleanPrivateUsername, email: result.email)
                }) {
                    Text("Add to Private")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(minWidth: 100)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 6)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.orange.opacity(0.8),
                                    Color.orange
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(6)
                }
            }
        } else {
            // If viewing self, don't show button (can't add yourself)
            EmptyView()
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.5)
            Text("Loading content...")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
    
    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.twillyTeal,
                            Color.twillyCyan
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            Text("Error")
                .font(.headline)
                .foregroundColor(.white)
            Text(error)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(.top, 40)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: showFavoritesOnly ? "star" : "video.slash")
                .font(.system(size: 40))
                .foregroundColor(.white.opacity(0.5))
            Text(showFavoritesOnly ? "No Favorites Yet" : "No Content Available")
                .font(.headline)
                .foregroundColor(.white)
            Text(showFavoritesOnly ? "You haven't favorited any content yet. Tap the star icon on videos to add them to your favorites." : "This channel doesn't have any visible content yet")
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(.top, 40)
    }
    
    // Private Management View - inline implementation using same search pattern
    private var privateAccessInboxView: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if isLoadingAccessInbox {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyCyan))
                } else if accessInboxNotifications.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "envelope.open")
                            .font(.system(size: 60))
                            .foregroundColor(.white.opacity(0.3))
                        
                        Text("No Notifications")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        
                        Text("You'll see notifications here when someone adds you to their private content")
                            .font(.body)
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(accessInboxNotifications) { notification in
                                AccessInboxNotificationRow(
                                    notification: notification,
                                    onTap: {
                                        // Mark notification as read
                                        markNotificationAsRead(notificationId: notification.id)
                                        
                                        // Post notification to FloatingCommentView to select the thread for this username
                                        // The notification's ownerUsername should match a comment thread
                                        let usernameToFind = notification.ownerUsername
                                        
                                        NotificationCenter.default.post(
                                            name: NSNotification.Name("SelectCommentThreadByUsername"),
                                            object: nil,
                                            userInfo: ["username": usernameToFind]
                                        )
                                        
                                        print("📬 [ChannelDetailView] Posted SelectCommentThreadByUsername notification for: \(usernameToFind)")
                                        
                                        // Close the inbox
                                        showingPrivateInbox = false
                                    },
                                    onDelete: {
                                        deleteNotification(notificationId: notification.id)
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("Access Inbox")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        showingPrivateInbox = false
                        // Reload unread count when inbox is dismissed
                        loadUnreadAccessInboxCount()
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
        }
        .onAppear {
            loadAccessInboxNotifications()
            // Also refresh unread count when inbox opens
            loadUnreadAccessInboxCount()
        }
    }
    
    private var privateManagementView: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Search bar (same as username search)
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.white.opacity(0.6))
                        
                        TextField("Add Creator to View your private streams", text: $privateManagementSearchText)
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .onChange(of: privateManagementSearchText) { newValue in
                                handlePrivateManagementSearch(newValue)
                            }
                        
                        if !privateManagementSearchText.isEmpty {
                            Button(action: {
                                privateManagementSearchText = ""
                                privateManagementSearchResults = []
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(10)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    
                    if isSearchingPrivateManagement {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyCyan))
                        Spacer()
                    } else if !privateManagementSearchText.isEmpty && privateManagementSearchResults.isEmpty {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "person.crop.circle.badge.questionmark")
                                .font(.system(size: 50))
                                .foregroundColor(.white.opacity(0.3))
                            Text("No results found")
                                .foregroundColor(.white.opacity(0.7))
                        }
                        Spacer()
                    } else if privateManagementSearchText.isEmpty {
                        // Show added PRIVATE usernames
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                // Filter to only show private usernames
                                let privateUsernames = addedPrivateUsernames.filter { 
                                    let visibility = $0.streamerVisibility?.lowercased() ?? "public"
                                    let username = $0.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
                                    // Only show private users, exclude any with lock emoji in username, and exclude empty usernames
                                    return visibility == "private" && !username.isEmpty && !$0.streamerUsername.contains("🔒")
                                }
                                
                                if privateUsernames.isEmpty {
                                    VStack(spacing: 16) {
                                        Image(systemName: "person.circle")
                                            .font(.system(size: 60))
                                            .foregroundColor(.white.opacity(0.3))
                                        
                                        Text("Add users to allow them to see your private streams")
                                            .font(.title3)
                                            .fontWeight(.medium)
                                            .foregroundColor(.white)
                                            .multilineTextAlignment(.center)
                                            .padding(.horizontal, 32)
                                    }
                                    .padding(.top, 60)
                                } else {
                                    ForEach(privateUsernames) { username in
                                        privateUsernameRow(username: username)
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                        }
                    } else {
                        // Show search results
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                // Group results by base username (without 🔒)
                                let groupedResults = Dictionary(grouping: privateManagementSearchResults) { result in
                                    result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                                }
                                
                                ForEach(Array(groupedResults.keys.sorted()), id: \.self) { baseUsernameKey in
                                    privateManagementSearchResultRow(for: baseUsernameKey, in: groupedResults)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                        }
                    }
                }
            }
            .navigationTitle("Manage Private Viewers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        showingPrivateManagement = false
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
            .onAppear {
                // Load private usernames when view appears - merge with existing to preserve optimistic updates
                loadAddedPrivateUsernames(mergeWithExisting: true)
            }
        }
    }
    
    // Handle private management search (same pattern as username search with instant results)
    private func handlePrivateManagementSearch(_ newValue: String) {
        // Cancel any pending search
        privateManagementSearchTask?.cancel()
        
        // Clear results if search is empty
        guard !newValue.isEmpty else {
            privateManagementSearchResults = []
            isSearchingPrivateManagement = false
            return
        }
        
        let trimmedQuery = newValue.trimmingCharacters(in: .whitespaces)
        guard !trimmedQuery.isEmpty else {
            privateManagementSearchResults = []
            isSearchingPrivateManagement = false
            return
        }
        
        let searchKey = trimmedQuery.lowercased()
        
        // STEP 1: Instant local results from addedUsernames (no API call needed)
        // CRITICAL: Only show public usernames (current user will be disabled, not filtered)
        let localResults = searchLocalUsernames(query: searchKey).filter { result in
            let isPublic = !(result.isPrivate ?? false) && !result.username.contains("🔒")
            return isPublic
        }
        if !localResults.isEmpty {
            print("⚡ [PrivateManagement] Instant local results: \(localResults.count) from addedUsernames")
            privateManagementSearchResults = localResults
            isSearchingPrivateManagement = false
            // Continue to API search in background for more results
        }
        
        // STEP 2: Check all cached results for instant matches (filter from entire cache)
        // CRITICAL: Only show public usernames (current user will be disabled, not filtered)
        let cachedResults = searchCachedResults(query: searchKey).filter { result in
            let isPublic = !(result.isPrivate ?? false) && !result.username.contains("🔒")
            return isPublic
        }
        if !cachedResults.isEmpty {
            print("📦 [PrivateManagement] Instant cached results: \(cachedResults.count) from cache")
            // Merge with local results, avoiding duplicates
            let combined = mergeResults(localResults, cachedResults)
            if !combined.isEmpty {
                privateManagementSearchResults = combined
                isSearchingPrivateManagement = false
            }
        }
        
        // STEP 3: If we have instant results, show them immediately and search API in background
        // If no instant results, show loading state
        if localResults.isEmpty && cachedResults.isEmpty {
            isSearchingPrivateManagement = true
        }
        
        // STEP 4: Debounced API call (very short debounce for instant feel)
        // Reduced to 50ms for 1-2 chars, 100ms for longer queries
        let debounceTime: UInt64 = trimmedQuery.count <= 2 ? 50_000_000 : 100_000_000
        
        privateManagementSearchTask = Task {
            do {
                try await Task.sleep(nanoseconds: debounceTime)
                
                // Check if task was cancelled or text changed
                guard !Task.isCancelled else { return }
                
                // Verify the search text hasn't changed
                let currentSearchText = privateManagementSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    return
                }
                
                // Perform the API search
                await performPrivateManagementSearch(query: currentSearchText)
            } catch {
                // Task was cancelled - expected when user types quickly
                if !Task.isCancelled {
                    print("❌ [PrivateManagement] Task error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // Perform the actual API search for private management (runs in background after instant results shown)
    private func performPrivateManagementSearch(query: String) async {
        let searchKey = query.lowercased()
        
        do {
            print("🔍 [PrivateManagement] API call for: '\(query)' (visibilityFilter: 'all')")
            let results = try await ChannelService.shared.searchUsernames(query: query, limit: 50, visibilityFilter: "all")
            
            await MainActor.run {
                // Only update if search text hasn't changed
                let currentSearchText = privateManagementSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    print("⚠️ [PrivateManagement] Search text changed during API call, ignoring results")
                    return
                }
                
                // CRITICAL: Filter to ONLY show public usernames (no private accounts, no locks)
                // Current user will be shown but disabled
                let publicOnlyResults = results.filter { result in
                    let isPublic = !(result.isPrivate ?? false) && !result.username.contains("🔒")
                    return isPublic
                }
                
                // Cache the results for future instant access (reuse same cache as public search)
                searchCache[searchKey] = publicOnlyResults
                
                // Also cache individual results for substring matching
                // This allows "jo" to match cached results from "john" searches
                for result in publicOnlyResults {
                    let resultKey = result.username.replacingOccurrences(of: "🔒", with: "").lowercased()
                    // Cache by first 2-3 characters for fast prefix matching
                    if resultKey.count >= 2 {
                        let prefix2 = String(resultKey.prefix(2))
                        if searchCache[prefix2] == nil {
                            searchCache[prefix2] = []
                        }
                        // Add if not already in cache
                        if !searchCache[prefix2]!.contains(where: { $0.username.lowercased() == result.username.lowercased() }) {
                            searchCache[prefix2]!.append(result)
                        }
                    }
                }
                
                // Limit cache size (keep last 100 searches for better coverage)
                if searchCache.count > 100 {
                    let keysToRemove = Array(searchCache.keys.prefix(searchCache.count - 100))
                    for key in keysToRemove {
                        searchCache.removeValue(forKey: key)
                    }
                }
                
                // Save cache to UserDefaults for persistence
                saveSearchCacheToUserDefaults()
                
                // Merge API results with existing instant results (avoid duplicates)
                // publicOnlyResults already filtered above (line 5176)
                
                // Update results (merge with any instant results already shown, but only public)
                let currentPublicOnly = privateManagementSearchResults.filter { result in
                    !(result.isPrivate ?? false) && !result.username.contains("🔒")
                }
                let merged = mergeResults(currentPublicOnly, publicOnlyResults)
                privateManagementSearchResults = merged
                isSearchingPrivateManagement = false
                
                print("✅ [PrivateManagement] Updated results: \(merged.count) total (from API: \(publicOnlyResults.count) public, filtered from \(results.count) total)")
            }
        } catch {
            await MainActor.run {
                // Only update if search text hasn't changed
                let currentSearchText = privateManagementSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    return
                }
                
                isSearchingPrivateManagement = false
                if !Task.isCancelled {
                    print("❌ [PrivateManagement] Search error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // Private username row (for list of added private viewers)
    @ViewBuilder
    private func privateUsernameRow(username: AddedUsername) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.title2)
                .foregroundColor(.twillyCyan)
                .frame(width: 40, height: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(username.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces))
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                
                if let addedAt = username.addedAt {
                    Text("Added \(formatRelativeDate(addedAt))")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                }
            }
            
            Spacer()
            
            let removingKey = username.streamerUsername.lowercased()
            if removingPrivateUsernames.contains(removingKey) {
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
            } else {
                Button(action: {
                    removePrivateViewerInline(username: username.streamerUsername, email: username.streamerEmail)
                }) {
                    Text("Remove")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.2))
                        .cornerRadius(8)
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
    
    // Private management search result row (with Add to Private / Remove from Private buttons)
    // ONLY shows public usernames (no private accounts, no locks)
    // Current user will be shown but disabled
    @ViewBuilder
    private func privateManagementSearchResultRow(for baseUsernameKey: String, in groupedResults: [String: [UsernameSearchResult]]) -> some View {
        let results = groupedResults[baseUsernameKey] ?? []
        let currentUsername = authService.username?.lowercased() ?? ""
        
        // ONLY show public results - filter out private accounts
        let publicResult = results.first(where: { result in
            let isPublic = !(result.isPrivate ?? false) && !result.username.contains("🔒")
            return isPublic
        })
        
        // If no public result, don't show this row at all
        if let result = publicResult {
            let cleanResultUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
            let isCurrentUser = !currentUsername.isEmpty && cleanResultUsername == currentUsername
            let cleanUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
            // Check private usernames from separate cache
            let isPrivateViewer = addedPrivateUsernames.contains(where: {
                $0.streamerUsername.lowercased() == cleanUsername.lowercased() &&
                ($0.streamerVisibility?.lowercased() ?? "private") == "private"
            })
            let addingKey = cleanUsername.lowercased()
            let isAdding = addingPrivateUsernames.contains(addingKey)
            let isRemoving = removingPrivateUsernames.contains(addingKey)
            
            HStack(spacing: 12) {
                Image(systemName: "person.circle.fill")
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.7))
                    .frame(width: 40, height: 40)
                    .background(Color.white.opacity(0.2))
                    .clipShape(Circle())
                
                Text(cleanUsername)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(isCurrentUser ? .white.opacity(0.5) : .white)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                
                Spacer()
                
                if isAdding || isRemoving {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                } else if isPrivateViewer {
                    Button(action: {
                        removePrivateViewerInline(username: cleanUsername, email: result.email)
                    }) {
                        Text("Remove")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.red)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.2))
                            .cornerRadius(8)
                    }
                    .disabled(isCurrentUser)
                    .opacity(isCurrentUser ? 0.5 : 1.0)
                } else {
                    Button(action: {
                        addPrivateViewerInline(username: cleanUsername, email: result.email)
                    }) {
                        Text("Add to Private")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(isCurrentUser ? .white.opacity(0.5) : .twillyCyan)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(isCurrentUser ? Color.white.opacity(0.1) : Color.twillyCyan.opacity(0.2))
                            .cornerRadius(8)
                    }
                    .disabled(isCurrentUser)
                    .opacity(isCurrentUser ? 0.5 : 1.0)
                }
            }
            .padding(16)
            .background(Color.white.opacity(isCurrentUser ? 0.02 : 0.05))
            .cornerRadius(12)
            .opacity(isCurrentUser ? 0.6 : 1.0)
        }
    }
    
    // Helper to format relative date
    private func formatRelativeDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let relativeFormatter = RelativeDateTimeFormatter()
            return relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        return dateString
    }
    
    private var contentListView: some View {
        LazyVStack(spacing: 12) { // Tighter spacing for premium feel
            ForEach(content) { item in
                contentCard(for: item)
            }
            
            if isLoadingMore {
                loadingMoreIndicator
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8) // Minimal top padding - starts right after divider
        .padding(.bottom, 20) // Keep bottom padding for scroll comfort
    }
    
    private func contentCard(for item: ChannelContent) -> some View {
        // Check if this is the latest content (first item in the list)
        let isLatest = content.first?.id == item.id
        
        // Get air schedule label for this content's creator
        let airScheduleLabel: String? = {
            // Try to get from channel creator's email
            if let schedule = creatorAirSchedule[currentChannel.creatorEmail] {
                return formatAirScheduleLabel(day: schedule.day, time: schedule.time)
            }
            return nil
        }()
        
        // Check if this is the user's own content
        // CRITICAL: Use normalized username comparison (same as filter) to handle "Twilly TV" vs "Twilly TV🔒"
        let normalizedViewerUsername = normalizeViewerUsername(authService.username)
        let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
        let isOwnContent: Bool
        if let viewerUsername = normalizedViewerUsername,
           let creatorUsername = normalizedCreatorUsername {
            isOwnContent = creatorUsername == viewerUsername
        } else {
            // Fallback to simple comparison if normalization fails
            isOwnContent = item.creatorUsername?.lowercased() == authService.username?.lowercased()
        }
        
        return ContentCard(
            content: item,
            onTap: {
                handleContentCardTap(item)
            },
            onPlay: {
                handleContentCardPlay(item)
            },
            isLocalVideo: item.localFileURL != nil,
            isUploadComplete: item.localFileURL != nil && isUploadComplete && item.id == localVideoContent?.id,
            isPollingForThumbnail: item.localFileURL != nil && isPollingForThumbnail && item.id == localVideoContent?.id,
            channelCreatorUsername: currentChannel.creatorUsername,
            channelCreatorEmail: currentChannel.creatorEmail,
            isLatestContent: isLatest,
            airScheduleLabel: airScheduleLabel,
            // When filter is active, show both edit and delete buttons
            showDeleteButton: showOnlyOwnContent && isOwnContent, // Show delete button when filter is active
            onDelete: showOnlyOwnContent && isOwnContent ? {
                // Show delete confirmation before deleting
                contentToDelete = item
                showingDeleteConfirmation = true
            } : nil,
            showEditButton: showOnlyOwnContent && isOwnContent, // Show edit button only when filter is active
            onEdit: showOnlyOwnContent && isOwnContent ? {
                // Open title page when edit button is clicked - show text field immediately
                managingContent = item
                editingTitle = item.title ?? ""
                showingContentManagementPopup = true
            } : nil,
            isOwnContent: isOwnContent,
            isFavorite: isFavorite(item),
            onFavorite: {
                toggleFavorite(for: item)
            },
            showPrivateContent: showPrivateContent // Pass private view state to show lock icon for all private videos
        )
        .onAppear {
            handleContentCardAppear(item)
        }
    }
    
    private func formatAirScheduleLabel(day: String, time: String) -> String {
        // Convert "16:00" to "4:00 PM" format
        let components = time.split(separator: ":")
        guard components.count == 2,
              let hour = Int(components[0]),
              let minute = Int(components[1]) else {
            return "\(day)s at \(time)"
        }
        
        let hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        let amPm = hour < 12 ? "AM" : "PM"
        let formattedTime = String(format: "%d:%02d %@", hour12, minute, amPm)
        
        return "\(day)s at \(formattedTime)"
    }
    
    private func handleContentCardTap(_ item: ChannelContent) {
        print("🖱️ [ChannelDetailView] ContentCard tapped - fileName: \(item.fileName)")
        
        // Always play the video when tapping (reverted behavior)
        handleContentCardPlay(item)
    }
    
    private func handleContentCardPlay(_ item: ChannelContent) {
        print("▶️ [ChannelDetailView] ContentCard play - fileName: \(item.fileName)")
        print("   - hlsUrl: \(item.hlsUrl ?? "nil")")
        print("   - localFileURL: \(item.localFileURL?.path ?? "nil")")
        print("   - isVisible: \(item.isVisible ?? true)")
        print("   - airdate: \(item.airdate ?? "nil")")
        print("   - isPremium: \(item.isPremium ?? false)")
        print("   - isOwner: \(isOwnerVideo(item))")
        
        // Check if content is premium and user is not the owner
        if item.isPremium == true && !isOwnerVideo(item) {
            print("🔒 [ChannelDetailView] Premium content - user must pay to unlock (not owner)")
            // Show premium alert popup
            premiumContentItem = item
            showingPremiumAlert = true
            return
        }
        
        // Check if content is scheduled (has airdate and not visible)
        if let airdateString = item.airdate,
           let airdate = parseDateFromISO8601(airdateString),
           item.isVisible != true,
           airdate > Date() {
            print("⏰ [ChannelDetailView] Content is scheduled for future - not playable yet")
            // Don't show player for scheduled content (like Netflix)
            return
        }
        
        // Show player if video has HLS URL or local file URL and is visible
        if let hlsUrl = item.hlsUrl, !hlsUrl.isEmpty {
            print("✅ [ChannelDetailView] Setting selectedContent and showing player (HLS)")
            selectedContent = item
            showingPlayer = true
        } else if item.localFileURL != nil {
            print("✅ [ChannelDetailView] Setting selectedContent and showing player (Local)")
            selectedContent = item
            showingPlayer = true
        } else {
            print("❌ [ChannelDetailView] Cannot show player - missing hlsUrl and localFileURL")
        }
    }
    
    private func handleContentCardAppear(_ item: ChannelContent) {
        // LIGHTNING FAST: Preload comments when video card appears (before user opens chat)
        // This makes chat feel instant when opened
        MessagingService.shared.preloadMessages(for: item.SK)
        // HYBRID OPTIMIZATION: Prefetch next page when user scrolls near the end (last 5 items)
        // This ensures seamless pagination without loading states
        if let index = content.firstIndex(where: { $0.id == item.id }),
           index >= content.count - 5, // Prefetch earlier (5 items instead of 3) for smoother experience
           hasMoreContent && !isLoadingMore {
            loadMoreContent()
        }
    }
    
    // Helper function to parse date from ISO8601 string
    private func parseDateFromISO8601(_ dateString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) {
            return date
        }
        // Fallback to standard ISO8601 without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }
    
    private var loadingMoreIndicator: some View {
        HStack {
            Spacer()
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
            Text("Loading more...")
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
            Spacer()
        }
        .padding()
    }
    
    // MARK: - Helper Methods
    
    private func refreshContent() async {
        print("🔄 [ChannelDetailView] Pull-to-refresh triggered for channel: \(currentChannel.channelName)")
        await MainActor.run {
            isLoading = true
            errorMessage = nil
            nextToken = nil
            hasMoreContent = true
            initialContentCount = content.count
            refreshMessage = nil
        }
        
        // Refresh both channel metadata (poster) and content
        do {
            async let refreshChannelTask: Bool = refreshChannelMetadata()
            async let refreshContentTask: (content: [ChannelContent], nextToken: String?, hasMore: Bool)? = refreshChannelContent()
            
            // Wait for both to complete
            let channelUpdated = try await refreshChannelTask
            let contentResult = try await refreshContentTask
            
            await MainActor.run {
                if channelUpdated {
                    print("✅ [ChannelDetailView] Channel metadata (poster) refreshed")
                }
                
                if let result = contentResult {
                    let newCount = result.content.count
                    let oldCount = content.count
                    updateContentWith(result.content, replaceLocal: false)
                    nextToken = result.nextToken
                    hasMoreContent = result.hasMore
                    
                    // Show message if no new content
                    if newCount <= oldCount && !channelUpdated {
                        refreshMessage = "No new content"
                        // Clear message after 3 seconds
                        Task {
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                            await MainActor.run {
                                refreshMessage = nil
                            }
                        }
                    } else if channelUpdated || newCount > oldCount {
                        refreshMessage = nil // Clear message if there's new content or poster
                    }
                }
                
                isLoading = false
                hasLoadedOnce = true
            }
        } catch {
            await MainActor.run {
                // Handle cancelled requests silently - these are intentional (user navigated away, etc.)
                if let urlError = error as? URLError, urlError.code == .cancelled {
                    print("🔄 [ChannelDetailView] Request was cancelled (likely intentional) - not showing error")
                    isLoading = false
                    refreshMessage = nil
                    return // Don't set error message for cancelled requests
                }
                
                // Provide user-friendly error messages for actual errors
                let errorMsg: String
                if let urlError = error as? URLError {
                    switch urlError.code {
                    case .timedOut:
                        errorMsg = "Request timed out. Please try again."
                    case .notConnectedToInternet:
                        errorMsg = "No internet connection. Please check your network."
                    default:
                        errorMsg = "Failed to refresh: \(error.localizedDescription)"
                    }
                } else {
                    errorMsg = "Failed to refresh: \(error.localizedDescription)"
                }
                errorMessage = errorMsg
                isLoading = false
                refreshMessage = nil
            }
        }
    }
    
    // Refresh channel metadata (poster, description, etc.)
    private func refreshChannelMetadata() async throws -> Bool {
        print("🔄 [ChannelDetailView] Refreshing channel metadata for: \(currentChannel.channelName)")
        
        do {
            // Fetch fresh channel data
            let channels = try await channelService.fetchDiscoverableChannels(
                searchQuery: currentChannel.channelName,
                forceRefresh: true
            )
            
            // Find the matching channel
            if let updatedChannel = channels.first(where: { $0.channelId == currentChannel.channelId }) {
                let posterChanged = updatedChannel.posterUrl != currentChannel.posterUrl
                
                await MainActor.run {
                    currentChannel = updatedChannel
                    if posterChanged {
                        print("✅ [ChannelDetailView] Poster URL updated: \(updatedChannel.posterUrl)")
                    }
                }
                
                return posterChanged
            } else {
                print("⚠️ [ChannelDetailView] Channel not found in refresh response")
                return false
            }
        } catch {
            print("❌ [ChannelDetailView] Error refreshing channel metadata: \(error.localizedDescription)")
            throw error
        }
    }
    
    // Refresh channel content
    private func refreshChannelContent() async throws -> (content: [ChannelContent], nextToken: String?, hasMore: Bool)? {
        do {
            let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
            let viewerEmail = isTwillyTV ? authService.userEmail : nil
            
            // For Twilly TV, use fetchBothViewsContent to get both public and private content
            // CRITICAL: Pass clientAddedUsernames so backend knows about newly added/removed usernames
            if isTwillyTV {
                // Extract usernames from addedUsernames array (current state)
                let clientAddedUsernames = addedUsernames.map { $0.streamerUsername }
                
                let bothViews = try await channelService.fetchBothViewsContent(
                    channelName: currentChannel.channelName,
                    creatorEmail: currentChannel.creatorEmail,
                    viewerEmail: viewerEmail,
                    limit: 20,
                    forceRefresh: true,
                    clientAddedUsernames: clientAddedUsernames.isEmpty ? nil : clientAddedUsernames
                )
                
                if let viewerUsername = authService.username {
                    print("   Viewer username: \(viewerUsername)")
                    let ownerPublicCount = bothViews.publicContent.filter { item in
                        item.creatorUsername?.lowercased().trimmingCharacters(in: .whitespaces) == viewerUsername.lowercased()
                    }.count
                    let ownerPrivateCount = bothViews.privateContent.filter { item in
                        item.creatorUsername?.lowercased().trimmingCharacters(in: .whitespaces) == viewerUsername.lowercased()
                    }.count
                    print("   Owner videos in public array: \(ownerPublicCount)")
                    print("   Owner videos in private array: \(ownerPrivateCount)")
                }
                
                // CRITICAL: Apply strict filtering to ensure public/private separation (same as loadContent)
                // Filter on background thread for performance
                // CRITICAL: Check if items are owner videos to ensure they're included
                // Use email as source of truth (more reliable than username)
                let viewerEmail = authService.userEmail?.lowercased()
                let viewerUsername = authService.username?.lowercased().trimmingCharacters(in: .whitespaces)
                let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
                
                // Helper function to normalize username (remove lock symbols and whitespace)
                func normalizeUsername(_ username: String?) -> String? {
                    guard let username = username else { return nil }
                    return username.replacingOccurrences(of: "🔒", with: "")
                        .trimmingCharacters(in: CharacterSet.whitespaces)
                        .lowercased()
                }
                
                // Helper function to check if item is owner video
                // Uses email comparison (channel creator) as primary, username as fallback
                func isOwnerVideo(_ item: ChannelContent) -> Bool {
                    // Primary: Check if channel creator email matches viewer email
                    // For Twilly TV, all content from the channel owner should be considered owner videos
                    if channelCreatorEmail == viewerEmail {
                        return true
                    }
                    
                    // Fallback: Check username (normalized - remove lock symbols and whitespace)
                    if let viewerUsername = viewerUsername,
                       let normalizedCreatorUsername = normalizeUsername(item.creatorUsername),
                       normalizedCreatorUsername == viewerUsername {
                        return true
                    }
                    
                    return false
                }
                
                let strictlyPublic = await Task.detached(priority: .userInitiated) {
                    bothViews.publicContent.filter { item in
                        let isOwner = isOwnerVideo(item)
                        let isPrivate = item.isPrivateUsername == true
                        
                        if isPrivate && !isOwner {
                            // Only filter out private items if they're NOT owner videos
                            print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned private item in public response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                            return false
                        }
                        
                        if isOwner {
                            print("✅ [ChannelDetailView] Including owner video in public array (refresh): \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivate: \(isPrivate))")
                        }
                        
                        return !isPrivate || isOwner
                    }
                }.value
                
                let strictlyPrivate = await Task.detached(priority: .userInitiated) {
                    bothViews.privateContent.filter { item in
                        let isOwner = isOwnerVideo(item)
                        let isPrivate = item.isPrivateUsername == true
                        let isPremium = item.isPremium == true
                        
                        // DEBUG: Log all items in privateContent array to understand what backend is sending
                        print("🔍 [ChannelDetailView] Private array item: \(item.fileName), isPrivateUsername: \(item.isPrivateUsername?.description ?? "nil"), isPremium: \(item.isPremium?.description ?? "nil"), creator: \(item.creatorUsername ?? "unknown"), isOwner: \(isOwner)")
                        
                        // CRITICAL: Include ALL owner videos in private view, regardless of isPrivateUsername flag
                        // This ensures owner's private videos are never filtered out
                        if isOwner {
                            print("✅ [ChannelDetailView] Including owner video in private array (refresh): \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivate: \(isPrivate), isPremium: \(isPremium))")
                            return true // Always include owner videos in private view
                        }
                        
                        // For non-owner videos, include if isPrivateUsername is true OR isPremium is true
                        // CRITICAL: Use isPrivateUsername and isPremium flags as source of truth
                        if !isPrivate && !isPremium {
                            print("🚫 [ChannelDetailView] Filtering out item from private array - not private or premium: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivateUsername: \(item.isPrivateUsername?.description ?? "nil"), isPremium: \(item.isPremium?.description ?? "nil"))")
                            return false
                        }
                        
                        print("✅ [ChannelDetailView] Including private/premium video: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPremium: \(isPremium))")
                        return true
                    }
                }.value
                
                // CRITICAL: Deduplicate before assigning to prevent duplicates
                // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
                let deduplicatedPublic = await Task.detached(priority: .userInitiated) {
                    var seenPublicSKs = Set<String>()
                    var seenPublicFileNames = Set<String>()
                    return strictlyPublic.filter { item in
                        if seenPublicSKs.contains(item.SK) {
                            print("⚠️ [ChannelDetailView] Removing duplicate public item in refresh (by SK): \(item.SK) - \(item.fileName)")
                            return false
                        }
                        if seenPublicFileNames.contains(item.fileName) {
                            print("⚠️ [ChannelDetailView] Removing duplicate public item in refresh (by fileName): \(item.fileName) (SK: \(item.SK))")
                            return false
                        }
                        seenPublicSKs.insert(item.SK)
                        seenPublicFileNames.insert(item.fileName)
                        return true
                    }
                }.value
                
                let deduplicatedPrivate = await Task.detached(priority: .userInitiated) {
                    var seenPrivateSKs = Set<String>()
                    var seenPrivateFileNames = Set<String>()
                    return strictlyPrivate.filter { item in
                        if seenPrivateSKs.contains(item.SK) {
                            print("⚠️ [ChannelDetailView] Removing duplicate private item in refresh (by SK): \(item.SK) - \(item.fileName)")
                            return false
                        }
                        if seenPrivateFileNames.contains(item.fileName) {
                            print("⚠️ [ChannelDetailView] Removing duplicate private item in refresh (by fileName): \(item.fileName) (SK: \(item.SK))")
                            return false
                        }
                        seenPrivateSKs.insert(item.SK)
                        seenPrivateFileNames.insert(item.fileName)
                        return true
                    }
                }.value
                
                // Update both public and private content arrays with deduplicated content
                await MainActor.run {
                    publicContent = deduplicatedPublic
                    privateContent = deduplicatedPrivate
                    publicNextToken = bothViews.publicNextToken
                    privateNextToken = bothViews.privateNextToken
                    publicHasMore = bothViews.publicHasMore
                    privateHasMore = bothViews.privateHasMore
                    bothViewsLoaded = true
                    
                    // Update currently displayed content based on showPrivateContent
                    if showPrivateContent {
                        content = privateContent
                        nextToken = privateNextToken
                        hasMoreContent = privateHasMore
                    } else {
                        content = publicContent
                        nextToken = publicNextToken
                        hasMoreContent = publicHasMore
                    }
                    
                    // Update cached unfiltered content
                    cachedUnfilteredContent = publicContent + privateContent
                    
                    print("✅ [ChannelDetailView] Refreshed content - public: \(publicContent.count), private: \(privateContent.count), current view: \(content.count)")
                }
                
                // Prefetch video content after updating (outside MainActor for async work)
                Task {
                    await prefetchVideoContent()
                }
                
                // Return content for current view
                return showPrivateContent ? 
                    (bothViews.privateContent, bothViews.privateNextToken, bothViews.privateHasMore) :
                    (bothViews.publicContent, bothViews.publicNextToken, bothViews.publicHasMore)
            } else {
                // For non-Twilly TV channels, use regular fetchChannelContent
                let result = try await channelService.fetchChannelContent(
                    channelName: currentChannel.channelName,
                    creatorEmail: currentChannel.creatorEmail,
                    viewerEmail: viewerEmail,
                    limit: 20,
                    nextToken: nil,
                    forceRefresh: true,
                    showPrivateContent: showPrivateContent
                )
                return (result.content, result.nextToken, result.hasMore)
            }
        } catch {
            print("❌ [ChannelDetailView] Error refreshing content: \(error.localizedDescription)")
            throw error
        }
    }
    
    // Instant filter function - applies filter synchronously for immediate UI update
    private func applyVisibilityFilterInstantly() {
        guard currentChannel.channelName.lowercased() == "twilly tv" else { return }
        
        // Save previous content to keep it visible if filter results in empty
        if !content.isEmpty {
            previousContentBeforeFilter = content
            hasConfirmedNoContent = false // Reset - we haven't confirmed there's no content yet
        }
        
        // Ensure cache is populated from current content if empty
        if cachedUnfilteredContent.isEmpty && !content.isEmpty {
            cachedUnfilteredContent = content
            cachedNextToken = nextToken
            cachedHasMoreContent = hasMoreContent
            print("💾 [ChannelDetailView] Cached unfiltered content for instant filter: \(cachedUnfilteredContent.count) items")
        }
        
        // Filter from cached unfiltered content (or current content if cache is empty)
        // BUT: For Twilly TV, use the correct source arrays (privateContent/publicContent)
        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
        let sourceContent: [ChannelContent]
        if isTwillyTV && bothViewsLoaded {
            // Use the correct source array based on current view
            sourceContent = showPrivateContent ? privateContent : publicContent
        } else {
            sourceContent = cachedUnfilteredContent.isEmpty ? content : cachedUnfilteredContent
        }
        
        var filtered = sourceContent.filter { item in
            let isPrivate = item.isPrivateUsername == true
            let isOwner = isOwnerVideo(item)
            if showPrivateContent {
                // PRIVATE VIEW: Include private items OR owner videos
                if !isPrivate && !isOwner {
                    print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in instant filter: \(item.fileName)")
                }
                return isPrivate || isOwner
            } else {
                // PUBLIC VIEW: Include non-private items OR owner videos
                if isPrivate && !isOwner {
                    print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in instant filter: \(item.fileName)")
                }
                return !isPrivate || isOwner
            }
        }
        
        // Also apply "own content" filter if active
        if showOnlyOwnContent {
            filtered = filtered.filter { item in
                isOwnerVideo(item)
            }
        }
        
        // Only update content if we have results, otherwise keep previous content visible
        if !filtered.isEmpty {
            content = filtered
            previousContentBeforeFilter = [] // Clear previous since we have new content
            hasConfirmedNoContent = false
            print("⚡ [ChannelDetailView] Instantly filtered content by visibility: \(showPrivateContent ? "private" : "public")\(showOnlyOwnContent ? " + own" : "") - \(filtered.count) items")
        } else {
            // Keep previous content visible while we check for more
            print("⚡ [ChannelDetailView] Filter resulted in empty, keeping previous content visible while checking...")
            // Don't update content - keep previousContentBeforeFilter visible
        }
        
        // If filter resulted in empty, check server in background
        if filtered.isEmpty {
            Task {
                await fetchFilteredContentInBackground()
            }
        }
    }
    
    // Background fetch for filtered content (only if needed)
    private func fetchFilteredContentInBackground() async {
        await MainActor.run {
            isFilteringContent = true
        }
        
        do {
            let viewerEmail = authService.userEmail
            let result = try await channelService.fetchChannelContent(
                channelName: currentChannel.channelName,
                creatorEmail: currentChannel.creatorEmail,
                viewerEmail: viewerEmail,
                limit: 100,
                nextToken: nil,
                forceRefresh: false,
                showPrivateContent: showPrivateContent
            )
            
            await MainActor.run {
                // Update cache with all content
                cachedUnfilteredContent = result.content
                cachedNextToken = result.nextToken
                cachedHasMoreContent = result.hasMore
                
                // CRITICAL: Strict filtering - public/private must be completely separate
                // BUT: Owner videos are always included in private view regardless of isPrivateUsername flag
                var filtered = result.content.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    let isOwner = isOwnerVideo(item)
                    if showPrivateContent {
                        // PRIVATE VIEW: Include private items OR owner videos
                        if !isPrivate && !isOwner {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in background fetch: \(item.fileName)")
                        }
                        return isPrivate || isOwner
                    } else {
                        // PUBLIC VIEW: STRICT - only non-private items (unless owner video)
                        if isPrivate && !isOwner {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in background fetch: \(item.fileName)")
                        }
                        return !isPrivate || isOwner
                    }
                }
                
                if showOnlyOwnContent {
                    filtered = filtered.filter { item in
                        isOwnerVideo(item)
                    }
                }
                
                // Update content with filtered results
                if !filtered.isEmpty {
                    content = filtered
                    previousContentBeforeFilter = []
                    hasConfirmedNoContent = false
                    print("🔍 [ChannelDetailView] Fetched filtered content in background: \(filtered.count) items")
                } else {
                    // For Twilly TV, confirm "no content" only if both views are empty
                    let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                    if isTwillyTV {
                        // Check both public and private content
                        let hasPublicContent = !publicContent.isEmpty
                        let hasPrivateContent = !privateContent.isEmpty
                        if !hasPublicContent && !hasPrivateContent && bothViewsLoaded {
                            hasConfirmedNoContent = true
                            print("🔍 [ChannelDetailView] Twilly TV: Confirmed no content in both public and private views")
                        } else {
                            hasConfirmedNoContent = false
                            print("🔍 [ChannelDetailView] Twilly TV: No content in this view - not confirming (might be in other view)")
                        }
                    } else {
                        hasConfirmedNoContent = true
                        print("🔍 [ChannelDetailView] Confirmed no content available after server check (non-Twilly TV)")
                    }
                    content = []
                    previousContentBeforeFilter = []
                }
                
                isFilteringContent = false
            }
        } catch {
            await MainActor.run {
                isFilteringContent = false
                // On error, keep previous content visible (don't show empty state)
                hasConfirmedNoContent = false
                print("❌ [ChannelDetailView] Error fetching filtered content: \(error.localizedDescription)")
            }
        }
    }
    
    // Optimized filter function that uses cache instead of reloading from server (legacy - kept for compatibility)
    private func applyVisibilityFilterOptimized(wasPrivateFiltered: Bool) async {
        guard currentChannel.channelName.lowercased() == "twilly tv" else { return }
        
        await MainActor.run {
            // Always cache unfiltered content before filtering (if not already cached)
            if cachedUnfilteredContent.isEmpty {
                cachedUnfilteredContent = content
                cachedNextToken = nextToken
                cachedHasMoreContent = hasMoreContent
                print("💾 [ChannelDetailView] Cached unfiltered content for visibility filter: \(cachedUnfilteredContent.count) items")
            }
            
            // Always filter from cached unfiltered content (not current filtered content) for instant feedback
            let sourceContent = cachedUnfilteredContent
            // CRITICAL: Strict separation - public/private must be completely separate
            var filtered = sourceContent.filter { item in
                let isPrivate = item.isPrivateUsername == true
                let isOwner = isOwnerVideo(item)
                if showPrivateContent {
                    // PRIVATE VIEW: Include private items OR owner videos (owner videos always shown in private view)
                    if !isPrivate && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in optimized filter: \(item.fileName)")
                    }
                    return isPrivate || isOwner
                } else {
                    // PUBLIC VIEW: STRICT - only non-private items (unless owner video)
                    if isPrivate && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in optimized filter: \(item.fileName)")
                    }
                    return !isPrivate || isOwner
                }
            }
            
            // Also apply "own content" filter if active
            // CRITICAL: "My" filter should only match videos where creatorUsername matches viewer's username
            // NOT all videos in a channel owned by the viewer
        if showOnlyOwnContent {
            filtered = filtered.filter { item in
                let normalizedViewerUsername = normalizeViewerUsername(authService.username)
                let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
                
                if let viewerUsername = normalizedViewerUsername,
                   let creatorUsername = normalizedCreatorUsername {
                    return creatorUsername == viewerUsername
                }
                return false
            }
        }
        
        content = filtered
            print("🔍 [ChannelDetailView] Filtered content by visibility: \(showPrivateContent ? "private" : "public")\(showOnlyOwnContent ? " + own" : "") - \(filtered.count) items from cache")
        }
        
        // Only make server call if switching TO private AND cache is empty AND we need more private content
        // This should rarely happen since we cache on first filter application
        if showPrivateContent && cachedUnfilteredContent.isEmpty {
            // Check if current content has any private items - if yes, we can filter from it
            let hasPrivateInCurrent = content.contains { $0.isPrivateUsername == true }
            if !hasPrivateInCurrent {
                // Only fetch from server if we truly have no private content
                await MainActor.run {
                    isFilteringContent = true
                }
                
                do {
                    let viewerEmail = authService.userEmail
                    let result = try await channelService.fetchChannelContent(
                        channelName: currentChannel.channelName,
                        creatorEmail: currentChannel.creatorEmail,
                        viewerEmail: viewerEmail,
                        limit: 100,
                        nextToken: nil,
                        forceRefresh: false,
                        showPrivateContent: showPrivateContent
                    )
                    
                    await MainActor.run {
                        var filtered = result.content.filter { item in
                            let isPrivate = item.isPrivateUsername == true
                            let isOwner = isOwnerVideo(item)
                            return isPrivate || isOwner // PRIVATE VIEW: Show private videos OR owner videos
                        }
                        
                        // Also apply "own content" filter if active
                        if showOnlyOwnContent {
                            filtered = filtered.filter { item in
                                isOwnerVideo(item)
                            }
                        }
                        
                        // Update cache with new content
                        cachedUnfilteredContent = result.content
                        cachedNextToken = result.nextToken
                        cachedHasMoreContent = result.hasMore
                        
                        content = filtered
                        isFilteringContent = false
                        print("🔍 [ChannelDetailView] Fetched and filtered content by visibility: private\(showOnlyOwnContent ? " + own" : "") - \(filtered.count) items")
                    }
                } catch {
                    await MainActor.run {
                        isFilteringContent = false
                        print("❌ [ChannelDetailView] Error filtering content: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
    
    // Filter existing content by public/private visibility (fallback - reloads from server)
    private func applyVisibilityFilter() async {
        guard currentChannel.channelName.lowercased() == "twilly tv" else { return }
        
        // First, filter existing content immediately for instant feedback
        // CRITICAL: Strict separation - public/private must be completely separate
        // BUT: Owner videos are always included in private view regardless of isPrivateUsername flag
        await MainActor.run {
            let filtered = content.filter { item in
                let isPrivate = item.isPrivateUsername == true
                let isOwner = isOwnerVideo(item)
                if showPrivateContent {
                    // PRIVATE VIEW: Include private items OR owner videos
                    if !isPrivate && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in visibility filter: \(item.fileName)")
                    }
                    return isPrivate || isOwner
                } else {
                    // PUBLIC VIEW: STRICT - only non-private items (unless owner video)
                    if isPrivate && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in visibility filter: \(item.fileName)")
                    }
                    return !isPrivate || isOwner
                }
            }
            content = filtered
            print("🔍 [ChannelDetailView] Filtered existing content by visibility: \(showPrivateContent ? "private" : "public") - \(filtered.count) items")
        }
        
        // Then reload from server to get all content (including paginated items)
        await MainActor.run {
            isFilteringContent = true
        }
        
        do {
            let viewerEmail = authService.userEmail
            let result = try await channelService.fetchChannelContent(
                channelName: currentChannel.channelName,
                creatorEmail: currentChannel.creatorEmail,
                viewerEmail: viewerEmail,
                limit: 100, // Load more items to ensure we have content for both filters
                nextToken: nil,
                forceRefresh: false,
                showPrivateContent: showPrivateContent
            )
            
            await MainActor.run {
                // CRITICAL: Strict separation - public/private must be completely separate
                // BUT: Owner videos are always included in private view regardless of isPrivateUsername flag
                let filtered = result.content.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    let isOwner = isOwnerVideo(item)
                    if showPrivateContent {
                        // PRIVATE VIEW: Include private items OR owner videos
                        if !isPrivate && !isOwner {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in server filter: \(item.fileName)")
                        }
                        return isPrivate || isOwner
                    } else {
                        // PUBLIC VIEW: STRICT - only non-private items (unless owner video)
                        if isPrivate && !isOwner {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in server filter: \(item.fileName)")
                        }
                        return !isPrivate || isOwner
                    }
                }
                
                content = filtered
                isFilteringContent = false
                print("🔍 [ChannelDetailView] Reloaded and filtered content by visibility: \(showPrivateContent ? "private" : "public") - \(filtered.count) items")
            }
        } catch {
            await MainActor.run {
                isFilteringContent = false
                print("❌ [ChannelDetailView] Error filtering content: \(error.localizedDescription)")
            }
        }
    }
    
    private func loadContent() {
        print("🔄 [ChannelDetailView] Starting to load content for channel: \(currentChannel.channelName), forceRefresh: \(forceRefresh)")
        
        // Load creator's air schedule for label display
        loadCreatorAirSchedule()
        
        // CRITICAL: Set isLoading synchronously to prevent "No content available" flash
        // ALWAYS set isLoading = true when starting to load (unless we have local video)
        // This ensures loading view shows immediately, even before async work starts
        if localVideoContent == nil {
                isLoading = true
                errorMessage = nil
        }
        
        Task {
            do {
                // If forceRefresh is true (after upload), load server content
                // OPTIMIZATION: If we have local video, just load once (no retries) - user already sees their video
                if forceRefresh {
                    // Check if we have local video - if so, just load once without retries
                    let hasLocalVideo = await MainActor.run {
                        return localVideoContent != nil
                    }
                    
                    if hasLocalVideo {
                        // We have local video - just load server content once in background
                        // No retries needed - user already sees their video
                        print("📹 [ChannelDetailView] Local video present - loading server content once (no retries)")
                        // For Twilly TV, pass viewerEmail to filter by added usernames
                        let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
                        let result = try await channelService.fetchChannelContent(
                            channelName: currentChannel.channelName,
                            creatorEmail: currentChannel.creatorEmail,
                            viewerEmail: viewerEmail,
                            limit: 20,
                            nextToken: nil,
                            forceRefresh: true,
                            showPrivateContent: showPrivateContent
                        )
                        await MainActor.run {
                            // Merge server content with local video (local video stays on top)
                            updateContentWith(result.content, replaceLocal: false)
                            nextToken = result.nextToken
                            hasMoreContent = result.hasMore
                            // updateContentWith already sets isLoading = false and hasLoadedOnce = true, but ensure it's set
                            isLoading = false
                            hasLoadedOnce = true
                            
                            // Check if local video now has thumbnail from server
                            if let localContent = localVideoContent,
                               let serverVideo = result.content.first(where: { serverItem in
                                   // Normalize strings for comparison (handle nil, empty, and whitespace)
                                   let localTitle = (localContent.title ?? "").trimmingCharacters(in: .whitespaces)
                                   let serverTitle = (serverItem.title ?? "").trimmingCharacters(in: .whitespaces)
                                   let localDesc = (localContent.description ?? "").trimmingCharacters(in: .whitespaces)
                                   let serverDesc = (serverItem.description ?? "").trimmingCharacters(in: .whitespaces)
                                   
                                   let titleMatch = localTitle.isEmpty && serverTitle.isEmpty || localTitle == serverTitle
                                   let descMatch = localDesc.isEmpty && serverDesc.isEmpty || localDesc == serverDesc
                                   let priceMatch = (localContent.price == nil && serverItem.price == nil) || serverItem.price == localContent.price
                                   
                                   let isMatch = titleMatch && descMatch && priceMatch
                                   let hasThumbnail = serverItem.thumbnailUrl != nil && !serverItem.thumbnailUrl!.isEmpty
                                   
                                   return isMatch && hasThumbnail
                               }) {
                                // Thumbnail is available! Update local content with thumbnail
                                print("✅ [ChannelDetailView] Thumbnail found during loadContent - updating local video with thumbnail")
                                
                                // Always update local content with thumbnail (keep local file for playback until HLS is ready)
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
                                    print("✅ [ChannelDetailView] Content updated with thumbnail - UI should refresh")
                                    print("   - Updated thumbnailUrl: \(updatedContent.thumbnailUrl ?? "nil")")
                                    print("   - Content array count: \(content.count)")
                                } else {
                                    print("⚠️ [ChannelDetailView] Could not find local content in array to update!")
                                }
                                
                                // Check if upload is complete (has HLS URL and thumbnail)
                                if serverVideo.hlsUrl != nil && !serverVideo.hlsUrl!.isEmpty {
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
                                    isUploadComplete = true
                                    print("✅ [ChannelDetailView] Upload complete! Video has HLS URL and thumbnail")
                                    
                                    // Re-run updateContentWith to properly merge (duplicates will be filtered)
                                    updateContentWith(result.content, replaceLocal: false)
                                } else {
                                    print("✅ [ChannelDetailView] Thumbnail ready, waiting for HLS to process...")
                                }
                            }
                        }
                    } else {
                        // No local video - just load normally (no retries needed for navigation)
                        // The retry logic was for post-upload scenarios, but for navigation we just want to load once
                        print("🔄 [ChannelDetailView] No local video - loading content normally (forceRefresh: true for cache busting)")
                        // For Twilly TV, pass viewerEmail to filter by added usernames
                        let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
                        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                        
                        if isTwillyTV && bothViewsLoaded {
                            // Reload both views in a single request
                            // CRITICAL: Set isLoading immediately to prevent "No content available" flash
                            await MainActor.run {
                                isLoading = true
                                errorMessage = nil
                            }
                            
                            do {
                                // Send added usernames to backend as fallback
                                let clientAddedUsernames = addedUsernames.map { $0.streamerUsername }
                                let bothViews = try await channelService.fetchBothViewsContent(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: viewerEmail,
                                limit: 20,
                                    forceRefresh: true,
                                    clientAddedUsernames: clientAddedUsernames
                                )
                                
                                await MainActor.run {
                                    // CRITICAL SECURITY: Strictly filter server responses - server might return wrong items
                                    let strictlyPublic = bothViews.publicContent.filter { item in
                                        let isPrivate = item.isPrivateUsername == true
                                        if isPrivate {
                                            print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned private item in public response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                                        }
                                        return !isPrivate
                                    }
                                    let strictlyPrivate = bothViews.privateContent.filter { item in
                                        let isPrivate = item.isPrivateUsername == true
                                        if !isPrivate {
                                            print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned public item in private response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                                        }
                                        return isPrivate
                                    }
                                    
                                    // CRITICAL: Deduplicate before assigning to prevent duplicates
                                    // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
                                    var seenPublicSKs = Set<String>()
                                    var seenPublicFileNames = Set<String>()
                                    let deduplicatedPublic = strictlyPublic.filter { item in
                                        if seenPublicSKs.contains(item.SK) {
                                            print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPublic (by SK): \(item.SK)")
                                            return false
                                        }
                                        if seenPublicFileNames.contains(item.fileName) {
                                            print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPublic (by fileName): \(item.fileName) (SK: \(item.SK))")
                                            return false
                                        }
                                        seenPublicSKs.insert(item.SK)
                                        seenPublicFileNames.insert(item.fileName)
                                        return true
                                    }
                                    
                                    var seenPrivateSKs = Set(seenPublicSKs) // Prevent cross-contamination
                                    var seenPrivateFileNames = Set(seenPublicFileNames) // Prevent cross-contamination
                                    let deduplicatedPrivate = strictlyPrivate.filter { item in
                                        if seenPrivateSKs.contains(item.SK) {
                                            print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPrivate (by SK): \(item.SK)")
                                            return false
                                        }
                                        if seenPrivateFileNames.contains(item.fileName) {
                                            print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPrivate (by fileName): \(item.fileName) (SK: \(item.SK))")
                                            return false
                                        }
                                        seenPrivateSKs.insert(item.SK)
                                        seenPrivateFileNames.insert(item.fileName)
                                        return true
                                    }
                                    
                                    publicContent = deduplicatedPublic
                                    privateContent = deduplicatedPrivate
                                    publicNextToken = bothViews.publicNextToken
                                    privateNextToken = bothViews.privateNextToken
                                    publicHasMore = bothViews.publicHasMore
                                    privateHasMore = bothViews.privateHasMore
                                    
                                    // Update current view - use deduplicated arrays (not raw filtered)
                                    if showPrivateContent {
                                        content = deduplicatedPrivate
                                        nextToken = privateNextToken
                                        hasMoreContent = privateHasMore
                                    } else {
                                        content = deduplicatedPublic
                                        nextToken = publicNextToken
                                        hasMoreContent = publicHasMore
                                    }
                                    
                                    cachedUnfilteredContent = publicContent + privateContent
                                    isLoading = false
                                    hasLoadedOnce = true
                                    print("✅ [ChannelDetailView] Both views reloaded in single request - public: \(publicContent.count), private: \(privateContent.count)")
                                }
                            } catch {
                                print("❌ [ChannelDetailView] Error reloading both views: \(error.localizedDescription)")
                                // Fallback to single load
                                let result = try await channelService.fetchChannelContent(
                                    channelName: currentChannel.channelName,
                                    creatorEmail: currentChannel.creatorEmail,
                                    viewerEmail: viewerEmail,
                                    limit: 20,
                                    nextToken: nil,
                                    forceRefresh: true,
                                    showPrivateContent: showPrivateContent
                                )
                                await MainActor.run {
                                    updateContentWith(result.content, replaceLocal: false)
                                    nextToken = result.nextToken
                                    hasMoreContent = result.hasMore
                                    isLoading = false
                                    hasLoadedOnce = true
                                }
                            }
                        } else {
                            // Non-Twilly TV or not yet loaded both views - use single load
                            let result = try await channelService.fetchChannelContent(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: viewerEmail,
                                limit: 20,
                                nextToken: nil,
                                forceRefresh: true,
                                showPrivateContent: showPrivateContent
                            )
                            print("✅ [ChannelDetailView] Fetched \(result.content.count) items from API, hasMore: \(result.hasMore)")
                            await MainActor.run {
                                updateContentWith(result.content, replaceLocal: false)
                                nextToken = result.nextToken
                                hasMoreContent = result.hasMore
                                isLoading = false
                                hasLoadedOnce = true
                                print("✅ [ChannelDetailView] Content loaded - isLoading: \(isLoading), hasLoadedOnce: \(hasLoadedOnce), content.count: \(content.count)")
                            }
                        }
                    }
                } else {
                    // Normal load (no force refresh) - fetch first page
                    print("🔄 [ChannelDetailView] Fetching first page of content... (forceRefresh: \(forceRefresh))")
                    // For Twilly TV, pass viewerEmail to filter by added usernames
                    let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
                    let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                    
                    if isTwillyTV && !bothViewsLoaded {
                        // Load both public and private content in a single request for instant toggle
                        print("🔄 [ChannelDetailView] Loading both views in single request...")
                        
                        // isLoading already set synchronously in loadContent() - no need to set again
                        
                        do {
                            // Send added usernames to backend as fallback (in case server doesn't have them due to auth errors)
                            let clientAddedUsernames = addedUsernames.map { $0.streamerUsername }
                            let bothViews = try await channelService.fetchBothViewsContent(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: viewerEmail,
                                limit: 20,
                                forceRefresh: forceRefresh,
                                clientAddedUsernames: clientAddedUsernames
                            )
                            
                            // DEBUG: Log what we received from backend
                            print("📥 [ChannelDetailView] Received from backend:")
                            print("   Public content: \(bothViews.publicContent.count) items")
                            print("   Private content: \(bothViews.privateContent.count) items")
                            print("   Client added usernames sent: \(clientAddedUsernames.joined(separator: ", "))")
                            if let viewerUsername = authService.username {
                                print("   Viewer username: \(viewerUsername)")
                                let ownerPublicCount = bothViews.publicContent.filter { item in
                                    item.creatorUsername?.lowercased().trimmingCharacters(in: .whitespaces) == viewerUsername.lowercased()
                                }.count
                                let ownerPrivateCount = bothViews.privateContent.filter { item in
                                    item.creatorUsername?.lowercased().trimmingCharacters(in: .whitespaces) == viewerUsername.lowercased()
                                }.count
                                print("   Owner videos in public array: \(ownerPublicCount)")
                                print("   Owner videos in private array: \(ownerPrivateCount)")
                            }
                            
                            // Filter on background thread for performance, then update UI incrementally
                            // CRITICAL: Check if items are owner videos to ensure they're included
                            // Use email as source of truth (more reliable than username)
                            let viewerEmail = authService.userEmail?.lowercased()
                            let viewerUsername = authService.username?.lowercased().trimmingCharacters(in: .whitespaces)
                            let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
                            
                            // Helper function to normalize username (remove lock symbols and whitespace)
                            func normalizeUsername(_ username: String?) -> String? {
                                guard let username = username else { return nil }
                                return username.replacingOccurrences(of: "🔒", with: "")
                                    .trimmingCharacters(in: CharacterSet.whitespaces)
                                    .lowercased()
                            }
                            
                            // Helper function to check if item is owner video
                            // Uses email comparison (channel creator) as primary, username as fallback
                            func isOwnerVideo(_ item: ChannelContent) -> Bool {
                                // Primary: Check if channel creator email matches viewer email
                                // For Twilly TV, all content from the channel owner should be considered owner videos
                                if channelCreatorEmail == viewerEmail {
                                    return true
                                }
                                
                                // Fallback: Check username (normalized - remove lock symbols and whitespace)
                                if let viewerUsername = viewerUsername,
                                   let normalizedCreatorUsername = normalizeUsername(item.creatorUsername),
                                   normalizedCreatorUsername == viewerUsername {
                                    return true
                                }
                                
                                return false
                            }
                            
                            let strictlyPublic = await Task.detached(priority: .userInitiated) {
                                bothViews.publicContent.filter { item in
                                    let isOwner = isOwnerVideo(item)
                                    let isPrivate = item.isPrivateUsername == true
                                    
                                    if isPrivate && !isOwner {
                                        print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned private item in public response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                                        return false
                                    }
                                    
                                    if isOwner {
                                        print("✅ [ChannelDetailView] Including owner video in public array: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivate: \(isPrivate))")
                                    }
                                    
                                    return !isPrivate || isOwner
                                }
                            }.value
                            
                            let strictlyPrivate = await Task.detached(priority: .userInitiated) {
                                bothViews.privateContent.filter { item in
                                    let isOwner = isOwnerVideo(item)
                                    let isPrivate = item.isPrivateUsername == true
                                    let isPremium = item.isPremium == true
                                    
                                    // DEBUG: Log all items in privateContent array to understand what backend is sending
                                    print("🔍 [ChannelDetailView] Private array item (loadContent): \(item.fileName), isPrivateUsername: \(item.isPrivateUsername?.description ?? "nil"), isPremium: \(item.isPremium?.description ?? "nil"), creator: \(item.creatorUsername ?? "unknown"), isOwner: \(isOwner)")
                                    
                                    // CRITICAL: Include ALL owner videos in private view, regardless of isPrivateUsername flag
                                    // This ensures owner's private videos are never filtered out
                                    if isOwner {
                                        print("✅ [ChannelDetailView] Including owner video in private array: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivate: \(isPrivate), isPremium: \(isPremium))")
                                        return true // Always include owner videos in private view
                                    }
                                    
                                    // For non-owner videos, include if isPrivateUsername is true OR isPremium is true
                                    // CRITICAL: Use isPrivateUsername and isPremium flags as source of truth
                                    if !isPrivate && !isPremium {
                                        print("🚫 [ChannelDetailView] Filtering out item from private array - not private or premium: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPrivateUsername: \(item.isPrivateUsername?.description ?? "nil"), isPremium: \(item.isPremium?.description ?? "nil"))")
                                        return false
                                    }
                                    
                                    print("✅ [ChannelDetailView] Including private/premium video: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"), isPremium: \(isPremium))")
                                    return true
                                }
                            }.value
                                
                            // Update UI immediately with filtered content
                            await MainActor.run {
                                // Store both separately - use strictly filtered arrays
                                // CRITICAL: Deduplicate before assigning to prevent duplicates
                                // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
                                var seenPublicSKs = Set<String>()
                                var seenPublicFileNames = Set<String>()
                                let deduplicatedPublic = strictlyPublic.filter { item in
                                    if seenPublicSKs.contains(item.SK) {
                                        print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPublic (by SK): \(item.SK)")
                                        return false
                                    }
                                    if seenPublicFileNames.contains(item.fileName) {
                                        print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPublic (by fileName): \(item.fileName) (SK: \(item.SK))")
                                        return false
                                    }
                                    seenPublicSKs.insert(item.SK)
                                    seenPublicFileNames.insert(item.fileName)
                                    return true
                                }
                                
                                var seenPrivateSKs = Set(seenPublicSKs) // Prevent cross-contamination
                                var seenPrivateFileNames = Set(seenPublicFileNames) // Prevent cross-contamination
                                let deduplicatedPrivate = strictlyPrivate.filter { item in
                                    if seenPrivateSKs.contains(item.SK) {
                                        print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPrivate (by SK): \(item.SK)")
                                        return false
                                    }
                                    if seenPrivateFileNames.contains(item.fileName) {
                                        print("⚠️ [ChannelDetailView] Removing duplicate in strictlyPrivate (by fileName): \(item.fileName) (SK: \(item.SK))")
                                        return false
                                    }
                                    seenPrivateSKs.insert(item.SK)
                                    seenPrivateFileNames.insert(item.fileName)
                                    return true
                                }
                                
                                publicContent = deduplicatedPublic
                                privateContent = deduplicatedPrivate
                                publicNextToken = bothViews.publicNextToken
                                privateNextToken = bothViews.privateNextToken
                                publicHasMore = bothViews.publicHasMore
                                privateHasMore = bothViews.privateHasMore
                                bothViewsLoaded = true
                                
                                // Set current content based on showPrivateContent - use deduplicated arrays (not raw filtered)
                                if showPrivateContent {
                                    content = deduplicatedPrivate
                                    nextToken = privateNextToken
                                    hasMoreContent = privateHasMore
                                } else {
                                    content = deduplicatedPublic
                                    nextToken = publicNextToken
                                    hasMoreContent = publicHasMore
                                }
                                
                                // Update cache with all content
                                cachedUnfilteredContent = publicContent + privateContent
                                
                                isLoading = false
                                hasLoadedOnce = true
                                print("✅ [ChannelDetailView] Both views loaded in single request - public: \(publicContent.count), private: \(privateContent.count), showing: \(showPrivateContent ? "private" : "public")")
                            }
                                
                            // Check and delete short videos after content is loaded (background task)
                            Task.detached(priority: .utility) {
                                    await checkAndDeleteShortVideos()
                            }
                        } catch {
                            print("❌ [ChannelDetailView] Error loading both views: \(error.localizedDescription)")
                            // CRITICAL: Always set isLoading = false, even if fallback fails
                            await MainActor.run {
                                isLoading = false
                            }
                            
                            // Fallback to single load
                            do {
                            let result = try await channelService.fetchChannelContent(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: viewerEmail,
                                limit: 20,
                                nextToken: nil,
                                forceRefresh: forceRefresh,
                                showPrivateContent: showPrivateContent
                            )
                            await MainActor.run {
                                updateContentWith(result.content, replaceLocal: false)
                                nextToken = result.nextToken
                                hasMoreContent = result.hasMore
                                isLoading = false
                                hasLoadedOnce = true
                                }
                            } catch {
                                // Even if fallback fails, ensure isLoading is false
                                await MainActor.run {
                                    isLoading = false
                                    hasLoadedOnce = true
                                    errorMessage = "Failed to load content: \(error.localizedDescription)"
                                    print("❌ [ChannelDetailView] Fallback load also failed: \(error.localizedDescription)")
                                }
                            }
                        }
                    } else {
                        // Non-Twilly TV channel or already loaded both views - use single load
                        let result = try await channelService.fetchChannelContent(
                            channelName: currentChannel.channelName,
                            creatorEmail: currentChannel.creatorEmail,
                            viewerEmail: viewerEmail,
                            limit: 20,
                            nextToken: nil,
                            forceRefresh: forceRefresh,
                            showPrivateContent: showPrivateContent
                        )
                        print("✅ [ChannelDetailView] Fetched \(result.content.count) items from API, hasMore: \(result.hasMore)")
                        if result.content.isEmpty {
                            print("⚠️ [ChannelDetailView] WARNING: API returned empty content array!")
                        } else {
                            print("✅ [ChannelDetailView] API returned \(result.content.count) items - first item: \(result.content[0].fileName)")
                        }
                        await MainActor.run {
                            print("🔄 [ChannelDetailView] About to call updateContentWith with \(result.content.count) items")
                            updateContentWith(result.content, replaceLocal: false)
                            print("🔄 [ChannelDetailView] After updateContentWith - content.count: \(content.count)")
                            nextToken = result.nextToken
                            hasMoreContent = result.hasMore
                            isLoading = false
                            hasLoadedOnce = true
                            print("✅ [ChannelDetailView] Final state - content.count: \(content.count), isLoading: \(isLoading), hasLoadedOnce: \(hasLoadedOnce), errorMessage: \(errorMessage ?? "nil")")
                            
                            // Check and delete short videos after content is loaded
                            Task {
                                await checkAndDeleteShortVideos()
                            }
                        }
                    }
                }
            } catch {
                // Handle cancelled requests silently - these are intentional (user navigated away, etc.)
                if let urlError = error as? URLError, urlError.code == .cancelled {
                    print("🔄 [ChannelDetailView] Request was cancelled (likely intentional) - not showing error")
                    await MainActor.run {
                        isLoading = false
                        // Don't set errorMessage for cancelled requests
                    }
                    return
                }
                
                // CRITICAL: Only show errors if we have NO cached content
                // If we have cached content, errors are silent (Instagram/Twitter pattern)
                let hasCachedContent = await MainActor.run {
                    let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                    return isTwillyTV ? (!publicContent.isEmpty || !privateContent.isEmpty) : !content.isEmpty
                }
                
                print("❌ [ChannelDetailView] Error fetching content: \(error.localizedDescription)")
                
                await MainActor.run {
                    isLoading = false
                    hasLoadedOnce = true
                    
                    // Only show error if we have NO cached content
                    // If we have cached content, errors are completely silent (Instagram/Twitter pattern)
                    if !hasCachedContent {
                        // Show user-friendly error message
                        errorMessage = "Unable to load content. Please check your connection."
                    } else {
                        // We have cached content - error is silent (user sees cached content)
                        print("✅ [ChannelDetailView] Error occurred but we have cached content - error is silent")
                        errorMessage = nil
                    }
                    
                    print("❌ [ChannelDetailView] Error state set - errorMessage: \(errorMessage ?? "nil"), isLoading: \(isLoading), hasLoadedOnce: \(hasLoadedOnce), hasCachedContent: \(hasCachedContent)")
                }
            }
        }
    }
    
    private func updateContentWith(_ fetchedContent: [ChannelContent], replaceLocal: Bool = false) {
        // CRITICAL: Optimize for speed - process efficiently, update UI immediately
        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
        
        // CRITICAL: For Twilly TV, private and public are completely separate arrays
        // This function updates the arrays but only updates displayed content if it matches current view
        
        // For Twilly TV, split content into public and private arrays for instant toggle
        if isTwillyTV {
            // CRITICAL: Strict separation - public content must NEVER be in private array and vice versa
            // Process filtering efficiently in one pass
            var publicItems: [ChannelContent] = []
            var privateItems: [ChannelContent] = []
            publicItems.reserveCapacity(fetchedContent.count)
            privateItems.reserveCapacity(fetchedContent.count)
            
            // CRITICAL: Deduplicate fetchedContent FIRST before splitting to prevent duplicates
            // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
            var seenSKs = Set<String>()
            var seenFileNames = Set<String>()
            let deduplicatedFetchedContent = fetchedContent.filter { item in
                // First check SK (most reliable)
                if seenSKs.contains(item.SK) {
                    print("⚠️ [ChannelDetailView] Removing duplicate item before split (by SK): \(item.SK)")
                    return false
                }
                // Then check fileName (catch duplicates with different SKs)
                if seenFileNames.contains(item.fileName) {
                    print("⚠️ [ChannelDetailView] Removing duplicate item before split (by fileName): \(item.fileName) (SK: \(item.SK))")
                    return false
                }
                seenSKs.insert(item.SK)
                seenFileNames.insert(item.fileName)
                return true
            }
            
            // CRITICAL: Use email/username to detect owner videos for proper splitting
            let viewerEmail = authService.userEmail?.lowercased()
            let viewerUsername = authService.username?.lowercased().trimmingCharacters(in: .whitespaces)
            let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
            
            // Helper to normalize username
            func normalizeUsername(_ username: String?) -> String? {
                guard let username = username else { return nil }
                return username.replacingOccurrences(of: "🔒", with: "")
                    .trimmingCharacters(in: CharacterSet.whitespaces)
                    .lowercased()
            }
            
            // Helper to check if item is owner video
            func isOwnerVideo(_ item: ChannelContent) -> Bool {
                if channelCreatorEmail == viewerEmail {
                    return true
                }
                if let viewerUsername = viewerUsername,
                   let normalizedCreatorUsername = normalizeUsername(item.creatorUsername),
                   normalizedCreatorUsername == viewerUsername {
                    return true
                }
                return false
            }
            
            for item in deduplicatedFetchedContent {
                // CRITICAL: Use isPrivateUsername flag as source of truth (not username label)
                // If isPrivateUsername is true, it's private. If false/nil, it's public.
                // BUT: Owner videos should be split based on their actual privacy, not filtered out
                let isPrivate = item.isPrivateUsername == true
                let isOwner = isOwnerVideo(item)
                
                // CRITICAL: If owner video, check if it should be in private or public based on flag
                // If not owner, use isPrivateUsername flag directly
                if isPrivate {
                    privateItems.append(item)
                } else {
                    publicItems.append(item)
                }
            }
            
            // CRITICAL: Deduplicate BEFORE updating arrays to prevent duplicates
            // Use Set to track SKs across both arrays to ensure no item appears in both
            var allSeenSKs = Set<String>()
            
            // Deduplicate public items
            let deduplicatedPublicItems = publicItems.filter { item in
                if allSeenSKs.contains(item.SK) {
                    print("⚠️ [ChannelDetailView] Removing duplicate public item (already seen): \(item.SK)")
                    return false
                }
                allSeenSKs.insert(item.SK)
                return true
            }
            
            // Deduplicate private items (check against all seen SKs including public)
            let deduplicatedPrivateItems = privateItems.filter { item in
                if allSeenSKs.contains(item.SK) {
                    print("⚠️ [ChannelDetailView] Removing duplicate private item (already in public or duplicate): \(item.SK)")
                    return false
                }
                allSeenSKs.insert(item.SK)
                return true
            }
            
            // Update public and private arrays
            if replaceLocal {
                // Replace entire arrays with deduplicated items
                publicContent = deduplicatedPublicItems
                privateContent = deduplicatedPrivateItems
            } else {
                // Merge with existing, removing duplicates using Set for O(1) lookup
                // CRITICAL: Check against BOTH arrays to prevent cross-contamination
                // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
                var seenPublicSKs = Set(publicContent.map { $0.SK })
                var seenPrivateSKs = Set(privateContent.map { $0.SK })
                var seenPublicFileNames = Set(publicContent.map { $0.fileName })
                var seenPrivateFileNames = Set(privateContent.map { $0.fileName })
                var allExistingSKs = seenPublicSKs.union(seenPrivateSKs)
                var allExistingFileNames = seenPublicFileNames.union(seenPrivateFileNames)
                
                // Add new items efficiently (only if not already in either array)
                for item in deduplicatedPublicItems {
                    // CRITICAL: Check against both arrays by SK and fileName to prevent duplicates
                    if !allExistingSKs.contains(item.SK) && !allExistingFileNames.contains(item.fileName) {
                        publicContent.append(item)
                        seenPublicSKs.insert(item.SK)
                        seenPublicFileNames.insert(item.fileName)
                        allExistingSKs.insert(item.SK)
                        allExistingFileNames.insert(item.fileName)
                    } else {
                        print("⚠️ [ChannelDetailView] Removing duplicate public item during merge (already exists): \(item.fileName) (SK: \(item.SK))")
                    }
                }
                for item in deduplicatedPrivateItems {
                    // CRITICAL: Check against both arrays by SK and fileName to prevent duplicates
                    if !allExistingSKs.contains(item.SK) && !allExistingFileNames.contains(item.fileName) {
                        privateContent.append(item)
                        seenPrivateSKs.insert(item.SK)
                        seenPrivateFileNames.insert(item.fileName)
                        allExistingSKs.insert(item.SK)
                        allExistingFileNames.insert(item.fileName)
                    } else {
                        print("⚠️ [ChannelDetailView] Removing duplicate private item during merge (already exists): \(item.fileName) (SK: \(item.SK))")
                    }
                }
            }
                
            // CRITICAL: Only update current view content if we're replacing or if content is empty
            // Don't overwrite existing content during merge to prevent flashing
            // CRITICAL: Private and public are completely separate - never mix them
            if replaceLocal {
                // When replacing, always update from the correct array
            if showPrivateContent {
                    // PRIVATE VIEW: Only use privateContent array (completely separate)
                content = privateContent
                    nextToken = privateNextToken
                    hasMoreContent = privateHasMore
            } else {
                    // PUBLIC VIEW: Only use publicContent array (completely separate)
                content = publicContent
                    nextToken = publicNextToken
                    hasMoreContent = publicHasMore
                }
            } else {
                // When merging, CRITICAL: Only update displayed content if it matches current view state
                // This prevents background refreshes from showing wrong content during toggle
                // Private and public are completely separate - never mix them
                // CRITICAL: Don't update content during merge unless it matches the current view
                // This prevents flashing when toggling between views
                if showPrivateContent {
                    // PRIVATE VIEW: Only update from privateContent (never publicContent)
                    // Only update if content is empty or if we have more private items
                    // This ensures we don't overwrite content during toggle
                    if content.isEmpty || privateContent.count > content.count {
                        content = privateContent
                        nextToken = privateNextToken
                        hasMoreContent = privateHasMore
                    }
                } else {
                    // PUBLIC VIEW: Only update from publicContent (never privateContent)
                    // Only update if content is empty or if we have more public items
                    // This ensures we don't overwrite content during toggle
                    if content.isEmpty || publicContent.count > content.count {
                        content = publicContent
                        nextToken = publicNextToken
                        hasMoreContent = publicHasMore
                    }
                }
                }
        }
        
        // Populate cache with unfiltered content when content is updated
        // This ensures the cache is always available for instant filtering
        if cachedUnfilteredContent.isEmpty || replaceLocal {
            // Merge all content (from API + existing) to build complete cache
            var allContent = replaceLocal ? fetchedContent : (cachedUnfilteredContent + fetchedContent)
            // Remove duplicates by SK
            var seenSKs = Set<String>()
            allContent = allContent.filter { item in
                if seenSKs.contains(item.SK) {
                    return false
                }
                seenSKs.insert(item.SK)
                return true
            }
            cachedUnfilteredContent = allContent
            cachedNextToken = nextToken
            cachedHasMoreContent = hasMoreContent
            print("💾 [ChannelDetailView] Updated content cache: \(cachedUnfilteredContent.count) items (replaceLocal: \(replaceLocal))")
        }
        
        // CRITICAL: Reduce logging to prevent UI freeze - only log summary, not every item
        // Check for duplicates (silently, only log if found)
        var seenIds = Set<String>()
        var duplicateIds: [String] = []
        for item in fetchedContent {
            if seenIds.contains(item.id) {
                duplicateIds.append(item.id)
            } else {
                seenIds.insert(item.id)
            }
        }
        if !duplicateIds.isEmpty {
            print("⚠️ [ChannelDetailView] Found \(duplicateIds.count) duplicate ID(s): \(Array(duplicateIds.prefix(3)))")
        }
        
        // Check for duplicate fileNames
        var seenFileNames = Set<String>()
        var duplicateFileNames: [String] = []
        for item in fetchedContent {
            if seenFileNames.contains(item.fileName) {
                duplicateFileNames.append(item.fileName)
            } else {
                seenFileNames.insert(item.fileName)
            }
        }
        if !duplicateFileNames.isEmpty {
            print("⚠️ [ChannelDetailView] Found \(duplicateFileNames.count) duplicate fileName(s): \(Array(duplicateFileNames.prefix(3)))")
        }
        
        
        // Filter out duplicates and incomplete videos if we have a local video
        var filteredFetchedContent = fetchedContent
        
        if let localContent = localVideoContent {
            // CRITICAL: When we have a local video, hide ALL incomplete server videos (missing thumbnail OR HLS)
            // This prevents showing "gray loading" videos alongside the local video
            // Only show server videos that are FULLY processed (have both thumbnail AND HLS)
            filteredFetchedContent = fetchedContent.filter { serverItem in
                // Check if this is a video
                let isVideo = serverItem.category == "Videos"
                
                if isVideo {
                    let hasThumbnail = serverItem.thumbnailUrl != nil && !serverItem.thumbnailUrl!.isEmpty
                    let hasHLS = serverItem.hlsUrl != nil && !serverItem.hlsUrl!.isEmpty
                    
                    // Only show videos that have BOTH thumbnail AND HLS (fully processed)
                    if hasThumbnail && hasHLS {
                        // Check if this matches our local video (same title/description/price)
                        let localTitle = (localContent.title ?? "").trimmingCharacters(in: .whitespaces)
                        let serverTitle = (serverItem.title ?? "").trimmingCharacters(in: .whitespaces)
                        let localDesc = (localContent.description ?? "").trimmingCharacters(in: .whitespaces)
                        let serverDesc = (serverItem.description ?? "").trimmingCharacters(in: .whitespaces)
                        
                        let titleMatch = localTitle.isEmpty && serverTitle.isEmpty || localTitle == serverTitle
                        let descMatch = localDesc.isEmpty && serverDesc.isEmpty || localDesc == serverDesc
                        let priceMatch = (localContent.price == nil && serverItem.price == nil) || serverItem.price == localContent.price
                        
                        let isMatch = titleMatch && descMatch && priceMatch
                        
                        if isMatch {
                            print("✅ [ChannelDetailView] Server video is fully ready and matches local - will replace local")
                        } else {
                            print("✅ [ChannelDetailView] Server video is fully ready (different video) - showing it")
                        }
                        
                        return true
                    } else {
                        // Video is not fully processed - hide it to prevent showing gray loading spinner
                        print("⏳ [ChannelDetailView] Hiding incomplete server video (thumbnail: \(hasThumbnail), HLS: \(hasHLS)) - showing local video instead")
                        return false
                    }
                }
                
                // Not a video - keep it (e.g., other content types)
                return true
            }
            
            if fetchedContent.count != filteredFetchedContent.count {
                print("🔄 [ChannelDetailView] Filtered out \(fetchedContent.count - filteredFetchedContent.count) incomplete/duplicate video(s) from server content")
            }
        }
        
        // If we have a local video and server content is available, check if we should replace it
        if replaceLocal, let localContent = localVideoContent {
            // Find matching server video that is fully ready (has both thumbnail and HLS)
            if let serverVideo = filteredFetchedContent.first(where: { serverItem in
                // Normalize strings for comparison
                let localTitle = (localContent.title ?? "").trimmingCharacters(in: .whitespaces)
                let serverTitle = (serverItem.title ?? "").trimmingCharacters(in: .whitespaces)
                let localDesc = (localContent.description ?? "").trimmingCharacters(in: .whitespaces)
                let serverDesc = (serverItem.description ?? "").trimmingCharacters(in: .whitespaces)
                
                let titleMatch = localTitle.isEmpty && serverTitle.isEmpty || localTitle == serverTitle
                let descMatch = localDesc.isEmpty && serverDesc.isEmpty || localDesc == serverDesc
                let priceMatch = (localContent.price == nil && serverItem.price == nil) || serverItem.price == localContent.price
                
                let isMatch = titleMatch && descMatch && priceMatch
                let hasThumbnail = serverItem.thumbnailUrl != nil && !serverItem.thumbnailUrl!.isEmpty
                let hasHLS = serverItem.hlsUrl != nil && !serverItem.hlsUrl!.isEmpty
                
                return isMatch && hasThumbnail && hasHLS
            }) {
                print("🔄 [ChannelDetailView] Server has fully ready matching video - removing local video")
                localVideoContent = nil
                // Delete the local file now that server version is available
                if let localURL = localContent.localFileURL {
                    try? FileManager.default.removeItem(at: localURL)
                    print("🗑️ [ChannelDetailView] Deleted local video file: \(localURL.lastPathComponent)")
                }
            } else {
                print("📹 [ChannelDetailView] Server doesn't have fully ready matching video yet - keeping local video")
            }
        }
        
        // If we have a local video or placeholder, prepend it to the list (show it first)
        var contentToShow = filteredFetchedContent
        if let localContent = localVideoContent {
            // Prepend local video to the list (show it first) - duplicates already filtered out
            contentToShow = [localContent] + filteredFetchedContent
            print("📹 [ChannelDetailView] Showing local video + \(filteredFetchedContent.count) server items (total: \(contentToShow.count))")
            print("📹 [ChannelDetailView] Local video details:")
            print("   fileName: \(localContent.fileName)")
            print("   SK/id: \(localContent.SK) / \(localContent.id)")
            print("   hlsUrl: \(localContent.hlsUrl != nil && !localContent.hlsUrl!.isEmpty ? "✅" : "❌")")
            print("   thumbnailUrl: \(localContent.thumbnailUrl != nil && !localContent.thumbnailUrl!.isEmpty ? "✅" : "❌")")
            print("   uploadId: \(localContent.uploadId ?? "nil")")
            print("   fileId: \(localContent.fileId ?? "nil")")
        } else {
            print("📋 [ChannelDetailView] Showing \(filteredFetchedContent.count) server items only (no local video)")
        }
        
        // Deduplicate by SK and fileName (match managefiles.vue behavior) - optimized to reduce logging
        // Backend may return same fileName with different SKs, so deduplicate by both
        var seenSKs = Set<String>()
        var seenFileNamesForDedup = Set<String>()
        let deduplicatedContent = contentToShow.filter { item in
            // First check SK (most reliable)
            if seenSKs.contains(item.SK) {
                return false
            }
            // Then check fileName (catch duplicates with different SKs)
            if seenFileNamesForDedup.contains(item.fileName) {
                print("⚠️ [ChannelDetailView] Removing duplicate by fileName: \(item.fileName) (SK: \(item.SK))")
                return false
            }
            seenSKs.insert(item.SK)
            seenFileNamesForDedup.insert(item.fileName)
            return true
        }
        
        if contentToShow.count != deduplicatedContent.count {
            print("🔄 [ChannelDetailView] Deduplicated: \(contentToShow.count) → \(deduplicatedContent.count) items")
        }
        
        // Sort by airdate/createdAt (newest first) - match managefiles.vue: .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        // CRITICAL: Sort by airdate first (if available), then createdAt, to match backend sorting
        // Create date formatters once (outside the sorted closure for efficiency)
        let dateFormatterWithFractional = ISO8601DateFormatter()
        dateFormatterWithFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let dateFormatterWithoutFractional = ISO8601DateFormatter()
        dateFormatterWithoutFractional.formatOptions = [.withInternetDateTime]
        
        // Helper function to parse date from string (try multiple formats)
        func parseDate(_ dateString: String?) -> Date? {
            guard let dateString = dateString, !dateString.isEmpty else { return nil }
            
            // Try with fractional seconds first
            if let date = dateFormatterWithFractional.date(from: dateString) {
                return date
            }
            // Try without fractional seconds
            if let date = dateFormatterWithoutFractional.date(from: dateString) {
                return date
            }
            // Try standard date formatter as last resort
            let standardFormatter = DateFormatter()
            standardFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            if let date = standardFormatter.date(from: dateString) {
                return date
            }
            standardFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
            if let date = standardFormatter.date(from: dateString) {
                return date
            }
            return nil
        }
        
        let sortedContent = deduplicatedContent.sorted { item1, item2 in
            // Priority 1: Use airdate if available (matches backend sorting)
            var date1: Date?
            if let airdate = item1.airdate, !airdate.isEmpty {
                date1 = parseDate(airdate)
            } else if let createdAt = item1.createdAt, !createdAt.isEmpty {
                date1 = parseDate(createdAt)
            }
            
            var date2: Date?
            if let airdate = item2.airdate, !airdate.isEmpty {
                date2 = parseDate(airdate)
            } else if let createdAt = item2.createdAt, !createdAt.isEmpty {
                date2 = parseDate(createdAt)
            }
            
            // If both have dates, compare them (newer first = descending order)
            if let d1 = date1, let d2 = date2 {
                return d1 > d2
            }
            // If only one has a date, prioritize it (items with dates come first)
            if date1 != nil && date2 == nil {
                return true
            }
            if date1 == nil && date2 != nil {
                return false
            }
            // If neither has a date, use fileName as fallback
            return item1.fileName > item2.fileName
        }
        
        // Match managefiles.vue: Show ALL videos (not just latest)
        // managefiles.vue returns all filtered videos sorted by createdAt (newest first)
        
        // CRITICAL: For Twilly TV, filter from the CORRECT source arrays (privateContent/publicContent)
        // NOT from sortedContent - this ensures we filter from the complete arrays that include all owner videos
        // Public and private filter from completely different places
        var filteredSortedContent = sortedContent
        
        if isTwillyTV {
            // CRITICAL: Use the correct source array based on current view
            // This ensures we filter from the FULL arrays that include all owner videos
            let sourceArray = showPrivateContent ? privateContent : publicContent
            
            // Sort the source array the same way as sortedContent
            let sortedSource = sourceArray.sorted { item1, item2 in
                // Use same sorting logic as sortedContent
                func parseDate(_ dateString: String?) -> Date? {
                    guard let dateString = dateString, !dateString.isEmpty else { return nil }
                    let dateFormatterWithFractional = ISO8601DateFormatter()
                    dateFormatterWithFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    let dateFormatterWithoutFractional = ISO8601DateFormatter()
                    dateFormatterWithoutFractional.formatOptions = [.withInternetDateTime]
                    if let date = dateFormatterWithFractional.date(from: dateString) { return date }
                    if let date = dateFormatterWithoutFractional.date(from: dateString) { return date }
                    return nil
                }
                
                var date1: Date?
                if let airdate = item1.airdate, !airdate.isEmpty {
                    date1 = parseDate(airdate)
                } else if let createdAt = item1.createdAt, !createdAt.isEmpty {
                    date1 = parseDate(createdAt)
                }
                
                var date2: Date?
                if let airdate = item2.airdate, !airdate.isEmpty {
                    date2 = parseDate(airdate)
                } else if let createdAt = item2.createdAt, !createdAt.isEmpty {
                    date2 = parseDate(createdAt)
                }
                
                if let d1 = date1, let d2 = date2 {
                    return d1 > d2
                }
                if date1 != nil && date2 == nil { return true }
                if date1 == nil && date2 != nil { return false }
                return item1.fileName > item2.fileName
            }
            
            // Apply filters to the sorted source array
            filteredSortedContent = sortedSource
            
            // 1. Filter for own content if active
            // CRITICAL: "My" filter should only match videos where creatorUsername matches viewer's username
            // NOT all videos in a channel owned by the viewer
            if showOnlyOwnContent {
                let viewerUsernameRaw = authService.username
                let normalizedViewerUsername = normalizeViewerUsername(viewerUsernameRaw)
                
                filteredSortedContent = filteredSortedContent.filter { item in
                    let creatorUsernameRaw = item.creatorUsername
                    let normalizedCreatorUsername = normalizeUsername(creatorUsernameRaw)
                    
                    let isMatch: Bool
                    if let viewerUsername = normalizedViewerUsername,
                       let creatorUsername = normalizedCreatorUsername {
                        isMatch = creatorUsername == viewerUsername
                    } else {
                        isMatch = false
                    }
                    
                    // Debug logging for videos that should match but don't
                    if !isMatch && creatorUsernameRaw != nil {
                        // Check if it's close (might be a normalization issue)
                        let viewerLower = viewerUsernameRaw?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                        let creatorLower = creatorUsernameRaw?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                        if viewerLower.contains("twilly") && creatorLower.contains("twilly") {
                            print("⚠️ [ChannelDetailView] My filter: Video NOT matched but should be?")
                            print("   Viewer username (raw): '\(viewerUsernameRaw ?? "nil")'")
                            print("   Viewer username (normalized): '\(normalizedViewerUsername ?? "nil")'")
                            print("   Creator username (raw): '\(creatorUsernameRaw ?? "nil")'")
                            print("   Creator username (normalized): '\(normalizedCreatorUsername ?? "nil")'")
                            print("   FileName: \(item.fileName)")
                            print("   Category: \(item.category ?? "nil")")
                        }
                    }
                    
                    return isMatch
                }
                print("🔍 [ChannelDetailView] Filtering to own content from \(showPrivateContent ? "private" : "public") array: \(filteredSortedContent.count) items (from \(sortedSource.count) total)")
            }
            
            // 2. Filter for public/private content (already done when populating arrays, but ensure strict separation)
            if showPrivateContent {
                // PRIVATE VIEW: Show items where isPrivateUsername is true OR isPremium is true OR owner videos
                // Note: Owner videos may appear in private view even if isPrivateUsername == false (backend decision)
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    let isPremium = item.isPremium == true
                    let isOwner = isOwnerVideo(item)
                    if !isPrivate && !isPremium && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view: \(item.fileName) (isPrivateUsername: \(item.isPrivateUsername != nil ? String(describing: item.isPrivateUsername!) : "nil"), isPremium: \(item.isPremium != nil ? String(describing: item.isPremium!) : "nil"))")
                    }
                    return isPrivate || isPremium || isOwner // Include private/premium items OR owner videos
                }
                print("🔒 [ChannelDetailView] PRIVATE VIEW: \(filteredSortedContent.count) items (strictly filtered)")
            } else {
                // PUBLIC VIEW: ONLY show items where isPrivateUsername is NOT true AND isPremium is NOT true (unless owner video)
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    let isPremium = item.isPremium == true
                    let isOwner = isOwnerVideo(item)
                    if (isPrivate || isPremium) && !isOwner {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private/premium item from public view: \(item.fileName) (isPrivateUsername: \(isPrivate), isPremium: \(isPremium))")
                    }
                    return (!isPrivate && !isPremium) || isOwner // Include non-private/non-premium items OR owner videos
                }
                print("🌐 [ChannelDetailView] PUBLIC VIEW: \(filteredSortedContent.count) items (strictly filtered)")
            }
        } else {
            // For non-Twilly TV channels, filter from sortedContent as before
            // CRITICAL: "My" filter should only match videos where creatorUsername matches viewer's username
            if showOnlyOwnContent {
                filteredSortedContent = filteredSortedContent.filter { item in
                    let normalizedViewerUsername = normalizeViewerUsername(authService.username)
                    let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
                    
                    if let viewerUsername = normalizedViewerUsername,
                       let creatorUsername = normalizedCreatorUsername {
                        return creatorUsername == viewerUsername
                    }
                    return false
                }
                print("🔍 [ChannelDetailView] Filtering to own content: \(filteredSortedContent.count) items (from \(sortedContent.count) total)")
            }
        }
        
        // CRITICAL: Preserve optimistic title updates ONLY when server title is empty
        // This prevents titles from disappearing after being edited, but allows server updates to come through
        // IMPORTANT: If server has a title (even if different), use it - server is the source of truth after save
        let contentWithPreservedTitles = filteredSortedContent.map { serverItem -> ChannelContent in
            // Find matching item in existing content by SK
            if let existingItem = content.first(where: { $0.SK == serverItem.SK }) {
                let existingTitle = existingItem.title?.trimmingCharacters(in: CharacterSet.whitespaces) ?? ""
                let serverTitle = serverItem.title?.trimmingCharacters(in: CharacterSet.whitespaces) ?? ""
                
                // CRITICAL: Only preserve existing title if server title is empty
                // If server has a title (even if different), use server title - it's the source of truth
                // This ensures:
                // 1. Optimistic updates are preserved until server confirms (server title empty = not saved yet)
                // 2. Server updates always win (server has title = it was saved, use it)
                // 3. Fresh titles from server are always used (prevents stale cache from blocking new titles)
                if !existingTitle.isEmpty && serverTitle.isEmpty {
                    // Preserve existing title - server hasn't updated yet (optimistic update still valid)
                    print("🔒 [ChannelDetailView] Preserving existing title '\(existingTitle)' for \(serverItem.fileName) (server title is empty - not saved yet)")
                    return ChannelContent(
                        SK: serverItem.SK,
                        fileName: serverItem.fileName,
                        title: existingItem.title, // Preserve existing title (optimistic update)
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
                } else if !serverTitle.isEmpty && serverTitle != existingTitle {
                    // Server has a title that's different - use server title (it's the source of truth)
                    print("📥 [ChannelDetailView] Using server title '\(serverTitle)' for \(serverItem.fileName) (existing was '\(existingTitle.isEmpty ? "empty" : existingTitle)')")
                } else if existingTitle == serverTitle && !serverTitle.isEmpty {
                    // Titles match - server has confirmed our update
                    print("✅ [ChannelDetailView] Title confirmed by server: '\(serverTitle)' for \(serverItem.fileName)")
                }
            }
            // Use server item (server is always source of truth if it has data)
            return serverItem
        }
        
        content = contentWithPreservedTitles
        isLoading = false
        hasLoadedOnce = true // Mark as successfully loaded
        
        // INSTAGRAM/TIKTOK PATTERN: Only confirm "no content" after explicit server response
        // Reset flags when content is successfully loaded
        if !content.isEmpty {
            hasConfirmedNoContent = false
            previousContentBeforeFilter = []
        } else {
            // CRITICAL: Only confirm "no content" if we've loaded from server and it's truly empty
            // For Twilly TV, never confirm "no content" - content might be in the other view (public/private)
            // Only confirm for non-Twilly TV channels after explicit server response
            if currentChannel.channelName.lowercased() != "twilly tv" {
                // Only confirm if we've actually loaded from server (not just from cache)
                hasConfirmedNoContent = true
                print("ℹ️ [ChannelDetailView] Content is empty after server update - setting hasConfirmedNoContent = true (non-Twilly TV)")
            } else {
                hasConfirmedNoContent = false
                print("ℹ️ [ChannelDetailView] Content is empty for Twilly TV - not confirming (might be in other view)")
            }
            previousContentBeforeFilter = []
        }
        
        // Minimal final logging to prevent UI freeze
        print("✅ [ChannelDetailView] Updated: \(content.count) items, isLoading: \(isLoading)")
        
        // CRITICAL: Prefetch video content for instant playback
        // Prefetch HLS playlists for first 3-5 items in background
        if !content.isEmpty && !isLoading {
            Task {
                await prefetchVideoContent()
            }
        }
        
        // HYBRID OPTIMIZATION: Proactively prefetch next page when initial content loads
        // This ensures seamless pagination - next page is ready before user scrolls to the end
        if hasLoadedOnce && hasMoreContent && nextToken != nil && !isLoadingMore && content.count >= 15 {
            // Prefetch next page in background (don't show loading indicator)
            Task {
                // Small delay to avoid competing with initial load
                try? await Task.sleep(nanoseconds: 2000_000_000) // 2s delay
                
                // Check if still valid (user hasn't navigated away)
                if hasMoreContent && nextToken != nil && !isLoadingMore {
                    print("⚡ [ChannelDetailView] Proactively prefetching next page (hybrid optimization)")
                    loadMoreContent()
                }
            }
        }
        
        // Check for duplicates in final content array (diagnostic only - duplicates should be removed at source)
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
        
        // CRITICAL: Prefetch video content for instant playback
        // Prefetch HLS playlists for first 3-5 items in background
        if !content.isEmpty && !isLoading {
            Task {
                await prefetchVideoContent()
            }
        }
    }
    
    // Prefetch video content for instant playback
    private func prefetchVideoContent() async {
        // Only prefetch for Twilly TV (main timeline)
        guard currentChannel.channelName.lowercased() == "twilly tv" else {
            return
        }
        
        // Get items to prefetch (first 5 items from current view)
        let itemsToPrefetch = Array(content.prefix(5))
        
        guard !itemsToPrefetch.isEmpty else {
            return
        }
        
        print("🔄 [ChannelDetailView] Starting video prefetch for \(itemsToPrefetch.count) items")
        print("   📋 Items: \(itemsToPrefetch.map { $0.fileName }.joined(separator: ", "))")
        
        // TODO: VideoPrefetchService calls - ensure VideoPrefetchService.swift is added to Xcode target
        // Uncomment these lines once VideoPrefetchService.swift is added to the target:
        /*
        // Cancel any existing prefetches before starting new ones
        VideoPrefetchService.shared.cancelAllPrefetches()
        
        // Prefetch playlists in background
        VideoPrefetchService.shared.prefetchPlaylists(for: itemsToPrefetch, maxItems: 5)
        
        // Log cache stats after a delay
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            let stats = VideoPrefetchService.shared.getCacheStats()
            print("📊 [ChannelDetailView] Prefetch cache stats - Playlists: \(stats.playlists), Segments: \(stats.segments), Active: \(stats.activeTasks)")
        }
        */
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
                        // Check if file was already deleted (idempotent delete)
                        let wasAlreadyDeleted = response.alreadyDeleted == true
                        
                        if wasAlreadyDeleted {
                            print("ℹ️ [ChannelDetailView] File was already deleted (idempotent delete): \(fileName)")
                            // Still remove from UI even if already deleted on server
                        } else {
                            print("✅ [ChannelDetailView] Successfully deleted content: \(fileName)")
                        }
                        
                        // Remove from currently displayed content array
                        let beforeCount = content.count
                        content.removeAll { $0.id == itemId }
                        let afterCount = content.count
                        
                        if beforeCount == afterCount {
                            print("⚠️ [ChannelDetailView] Item not found in content array after delete - may have already been removed")
                        }
                        
                        // CRITICAL: Also remove from cached public/private arrays
                        let isPrivate = item.isPrivateUsername == true
                        if isPrivate {
                            let beforePrivateCount = privateContent.count
                            privateContent.removeAll { $0.id == itemId }
                            let afterPrivateCount = privateContent.count
                            if beforePrivateCount != afterPrivateCount {
                                print("✅ [ChannelDetailView] Removed from private content cache")
                            }
                        } else {
                            let beforePublicCount = publicContent.count
                            publicContent.removeAll { $0.id == itemId }
                            let afterPublicCount = publicContent.count
                            if beforePublicCount != afterPublicCount {
                                print("✅ [ChannelDetailView] Removed from public content cache")
                            }
                        }
                        
                        contentToDelete = nil
                        
                        // If content is now empty, stop loading spinner immediately
                        if content.isEmpty && publicContent.isEmpty && privateContent.isEmpty {
                            isLoading = false
                            hasLoadedOnce = true
                            // For Twilly TV, never confirm "no content" - might be content in other view
                            if currentChannel.channelName.lowercased() != "twilly tv" {
                                hasConfirmedNoContent = true
                            }
                            print("✅ [ChannelDetailView] All content deleted - stopping loading spinner")
                        } else {
                            // Refresh content to get updated list from server
                            Task {
                                do {
                                    let result = try await refreshChannelContent()
                                    await MainActor.run {
                                        // Ensure loading stops even if content is empty
                                        if result?.content.isEmpty == true {
                                            isLoading = false
                                            hasLoadedOnce = true
                                            // For Twilly TV, never confirm "no content"
                                            if currentChannel.channelName.lowercased() != "twilly tv" {
                                                hasConfirmedNoContent = true
                                            }
                                        }
                                    }
                                } catch {
                                    await MainActor.run {
                                        isLoading = false
                                        hasLoadedOnce = true
                                        // Don't show error for empty content - it's expected
                                        if !error.localizedDescription.lowercased().contains("not found") {
                                            print("❌ [ChannelDetailView] Error refreshing after delete: \(error.localizedDescription)")
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Handle error - check if it's a "file not found" error
                        let errorMsg = response.message ?? "Unknown error"
                        let isFileNotFound = errorMsg.lowercased().contains("not found") || errorMsg.lowercased().contains("file not found")
                        
                        if isFileNotFound {
                            // File not found - treat as success (already deleted) - NO ERROR MESSAGE
                            print("ℹ️ [ChannelDetailView] File not found (already deleted): \(fileName) - treating as success")
                            
                            // Remove from UI anyway
                            content.removeAll { $0.id == itemId }
                            
                            // Also remove from cached arrays
                            let isPrivate = item.isPrivateUsername == true
                            if isPrivate {
                                privateContent.removeAll { $0.id == itemId }
                            } else {
                                publicContent.removeAll { $0.id == itemId }
                            }
                            
                            contentToDelete = nil
                            
                            // If content is now empty, stop loading spinner immediately
                            if content.isEmpty && publicContent.isEmpty && privateContent.isEmpty {
                                isLoading = false
                                hasLoadedOnce = true
                                // For Twilly TV, never confirm "no content"
                                if currentChannel.channelName.lowercased() != "twilly tv" {
                                    hasConfirmedNoContent = true
                                }
                            } else {
                                // Refresh content
                                Task {
                                    do {
                                        let result = try await refreshChannelContent()
                                        await MainActor.run {
                                            if result?.content.isEmpty == true {
                                                isLoading = false
                                                hasLoadedOnce = true
                                                // For Twilly TV, never confirm "no content"
                                                if currentChannel.channelName.lowercased() != "twilly tv" {
                                                    hasConfirmedNoContent = true
                                                }
                                            }
                                        }
                                    } catch {
                                        await MainActor.run {
                                            isLoading = false
                                            hasLoadedOnce = true
                                        }
                                    }
                                }
                            }
                        } else {
                            // Real error - show it
                            print("❌ [ChannelDetailView] Delete failed: \(errorMsg)")
                            errorMessage = errorMsg
                            contentToDelete = nil
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isDeleting = false
                    
                    // Check if error is "File not found" - treat as success (idempotent)
                    let errorDescription = error.localizedDescription.lowercased()
                    let isFileNotFound = errorDescription.contains("not found") || 
                                        errorDescription.contains("file not found") ||
                                        errorDescription.contains("404")
                    
                    if isFileNotFound {
                        // File not found - treat as success (already deleted) - NO ERROR MESSAGE
                        print("ℹ️ [ChannelDetailView] File not found during delete (already deleted): \(fileName) - treating as success")
                        
                        // Remove from UI anyway
                        content.removeAll { $0.id == itemId }
                        
                        // Also remove from cached arrays
                        let isPrivate = item.isPrivateUsername == true
                        if isPrivate {
                            privateContent.removeAll { $0.id == itemId }
                        } else {
                            publicContent.removeAll { $0.id == itemId }
                        }
                        
                        contentToDelete = nil
                        
                        // If content is now empty, stop loading spinner immediately
                        if content.isEmpty && publicContent.isEmpty && privateContent.isEmpty {
                            isLoading = false
                            hasLoadedOnce = true
                            // For Twilly TV, only confirm no content if both views are loaded and both are empty
                            let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                            if isTwillyTV && bothViewsLoaded {
                            hasConfirmedNoContent = true
                            } else if !isTwillyTV {
                                hasConfirmedNoContent = true
                            }
                        } else {
                            // Refresh content
                            Task {
                                do {
                                    let result = try await refreshChannelContent()
                                    await MainActor.run {
                                        if result?.content.isEmpty == true {
                                            isLoading = false
                                            hasLoadedOnce = true
                                            // For Twilly TV, never confirm "no content" unless both views are checked
                                            let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                                            if !isTwillyTV {
                                            hasConfirmedNoContent = true
                                            }
                                        }
                                    }
                                } catch {
                                    await MainActor.run {
                                        isLoading = false
                                        hasLoadedOnce = true
                                    }
                                }
                            }
                        }
                    } else {
                        // Real error - show it
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
        let isPrivate = content.isPrivateUsername == true
        
        // Helper function to create updated item
        let createUpdatedItem: (ChannelContent) -> ChannelContent = { original in
            ChannelContent(
                SK: original.SK,
                fileName: original.fileName,
                title: trimmedTitle.isEmpty ? nil : trimmedTitle,
                description: original.description,
                hlsUrl: original.hlsUrl,
                thumbnailUrl: original.thumbnailUrl,
                createdAt: original.createdAt,
                isVisible: original.isVisible,
                price: original.price,
                category: original.category,
                uploadId: original.uploadId,
                fileId: original.fileId,
                airdate: original.airdate,
                creatorUsername: original.creatorUsername,
                isPrivateUsername: original.isPrivateUsername,
                localFileURL: original.localFileURL
            )
        }
        
        // OPTIMISTIC UPDATE: Update UI immediately before API call
        // Update the currently displayed content array
        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
            self.content[index] = createUpdatedItem(self.content[index])
            print("✅ [ChannelDetailView] Optimistic update - showing title immediately: '\(trimmedTitle)'")
        }
        
        // CRITICAL: Also update the cached public/private arrays so title persists when toggling
        if isPrivate {
            // Update private content cache
            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                self.privateContent[index] = createUpdatedItem(self.privateContent[index])
                print("✅ [ChannelDetailView] Updated private content cache with title")
            }
        } else {
            // Update public content cache
            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                self.publicContent[index] = createUpdatedItem(self.publicContent[index])
                print("✅ [ChannelDetailView] Updated public content cache with title")
            }
        }
        
        // CRITICAL: Also update cachedUnfilteredContent so title persists when toggling filter
        if let index = self.cachedUnfilteredContent.firstIndex(where: { $0.SK == content.SK }) {
            self.cachedUnfilteredContent[index] = createUpdatedItem(self.cachedUnfilteredContent[index])
            print("✅ [ChannelDetailView] Updated cachedUnfilteredContent with title (for filter toggle)")
        }
        
        // Close popup immediately so user sees the update
        showingContentManagementPopup = false
        managingContent = nil
        editingTitle = ""
        showingTitleField = false
        
        isUpdatingContent = true
        
        Task {
            do {
                // CRITICAL: Always use SK (which is the full FILE#file-123 format) for the update
                // fileId might be missing the FILE# prefix, so SK is the reliable source
                // The backend expects the full SK format (FILE#file-123) as the fileId parameter
                let fileIdToUse = content.SK // Always use SK - it's the full format that matches DynamoDB
                
                // CRITICAL FIX: Use creator's email, not viewer's email!
                // FILE entries are stored under USER#creatorEmail, not USER#viewerEmail
                let creatorEmail = currentChannel.creatorEmail
                print("💾 [ChannelDetailView] Updating title - SK: \(fileIdToUse), fileId: \(content.fileId ?? "N/A"), title: '\(trimmedTitle)', creatorEmail: \(creatorEmail)")
                
                let response = try await ChannelService.shared.updateFileDetails(
                    fileId: fileIdToUse,
                    userId: creatorEmail, // CRITICAL: Use creator's email, not viewer's email!
                    title: trimmedTitle.isEmpty ? nil : trimmedTitle,
                    description: nil,
                    price: nil,
                    isVisible: nil,
                    airdate: nil
                )
                
                await MainActor.run {
                    isUpdatingContent = false
                    
                    // Helper function to create updated item with server title
                    let createConfirmedItem: (ChannelContent, String?) -> ChannelContent = { original, title in
                        ChannelContent(
                            SK: original.SK,
                            fileName: original.fileName,
                            title: title,
                            description: original.description,
                            hlsUrl: original.hlsUrl,
                            thumbnailUrl: original.thumbnailUrl,
                            createdAt: original.createdAt,
                            isVisible: original.isVisible,
                            price: original.price,
                            category: original.category,
                            uploadId: original.uploadId,
                            fileId: original.fileId,
                            airdate: original.airdate,
                            creatorUsername: original.creatorUsername,
                            isPrivateUsername: original.isPrivateUsername,
                            localFileURL: original.localFileURL
                        )
                    }
                    
                    if response.success {
                        // Determine server title from response
                        // CRITICAL: Use the title we sent (trimmedTitle) as the source of truth
                        // The backend should have saved it, so use what we sent unless response explicitly says otherwise
                        let serverTitle: String? = trimmedTitle.isEmpty ? nil : trimmedTitle
                        
                        // Log response for debugging
                        print("✅ [ChannelDetailView] Update successful - using saved title: '\(serverTitle ?? "nil")'")
                        if let data = response.data {
                            print("   📦 Response data keys: \(data.keys.joined(separator: ", "))")
                            if let titleValue = data["title"] {
                                print("   📝 Response title value: \(titleValue)")
                            }
                        }
                        
                        // Update with confirmed data from server - update all arrays
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            self.content[index] = createConfirmedItem(self.content[index], serverTitle)
                            print("✅ [ChannelDetailView] Confirmed update from server - title: '\(serverTitle ?? "nil")'")
                        }
                        
                        // CRITICAL: Also update the cached public/private arrays
                        if isPrivate {
                            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.privateContent[index] = createConfirmedItem(self.privateContent[index], serverTitle)
                                print("✅ [ChannelDetailView] Updated private content cache with confirmed title")
                            }
                        } else {
                            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.publicContent[index] = createConfirmedItem(self.publicContent[index], serverTitle)
                                print("✅ [ChannelDetailView] Updated public content cache with confirmed title")
                            }
                        }
                        
                        // CRITICAL: Invalidate ChannelService cache to force fresh load on next fetch
                        // This ensures titles persist across logout/login
                        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                        if isTwillyTV {
                            // Clear both views cache for Twilly TV
                            ChannelService.shared.clearBothViewsCache(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: userEmail
                            )
                        } else {
                            // Clear single view cache for other channels
                            ChannelService.shared.clearContentCache(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: userEmail,
                                showPrivateContent: showPrivateContent
                            )
                        }
                        print("🗑️ [ChannelDetailView] Invalidated content cache to ensure fresh titles on next load")
                    } else {
                        print("❌ [ChannelDetailView] Update failed: \(response.message ?? "Unknown error")")
                        // Revert optimistic update on failure - revert all arrays
                        let revertedTitle = content.title
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            self.content[index] = createConfirmedItem(self.content[index], revertedTitle)
                        }
                        
                        // Revert cached arrays
                        if isPrivate {
                            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.privateContent[index] = createConfirmedItem(self.privateContent[index], revertedTitle)
                            }
                        } else {
                            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.publicContent[index] = createConfirmedItem(self.publicContent[index], revertedTitle)
                            }
                        }
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error updating content: \(error.localizedDescription)")
                await MainActor.run {
                    isUpdatingContent = false
                    // Revert optimistic update on error - revert all arrays
                    let revertedTitle = content.title
                    let createRevertedItem: (ChannelContent) -> ChannelContent = { original in
                        ChannelContent(
                            SK: original.SK,
                            fileName: original.fileName,
                            title: revertedTitle,
                            description: original.description,
                            hlsUrl: original.hlsUrl,
                            thumbnailUrl: original.thumbnailUrl,
                            createdAt: original.createdAt,
                            isVisible: original.isVisible,
                            price: original.price,
                            category: original.category,
                            uploadId: original.uploadId,
                            fileId: original.fileId,
                            airdate: original.airdate,
                            creatorUsername: original.creatorUsername,
                            isPrivateUsername: original.isPrivateUsername,
                            localFileURL: original.localFileURL
                        )
                    }
                    
                    if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                        self.content[index] = createRevertedItem(self.content[index])
                    }
                    
                    // Revert cached arrays
                    if isPrivate {
                        if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                            self.privateContent[index] = createRevertedItem(self.privateContent[index])
                        }
                    } else {
                        if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                            self.publicContent[index] = createRevertedItem(self.publicContent[index])
                        }
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
        
        let isPrivate = content.isPrivateUsername == true
        
        // Helper function to create updated item
        let createUpdatedItem: (ChannelContent) -> ChannelContent = { original in
            ChannelContent(
                SK: original.SK,
                fileName: original.fileName,
                title: trimmedTitle, // Save locally immediately
                description: original.description, // Keep existing description
                hlsUrl: original.hlsUrl,
                thumbnailUrl: original.thumbnailUrl,
                createdAt: original.createdAt,
                isVisible: original.isVisible,
                price: original.price,
                category: original.category,
                uploadId: original.uploadId,
                fileId: original.fileId,
                airdate: original.airdate,
                creatorUsername: original.creatorUsername,
                isPrivateUsername: original.isPrivateUsername,
                localFileURL: original.localFileURL
            )
        }
        
        // OPTIMISTIC UPDATE: Update UI immediately before API call
        // Save locally so editor can see the update right away
        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
            self.content[index] = createUpdatedItem(self.content[index])
            print("✅ [ChannelDetailView] Optimistic update - showing title immediately: '\(trimmedTitle)'")
        } else {
            print("⚠️ [ChannelDetailView] Could not find content item for optimistic update (SK: \(content.SK))")
        }
        
        // CRITICAL: Also update the cached public/private arrays so title persists when toggling
        if isPrivate {
            // Update private content cache
            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                self.privateContent[index] = createUpdatedItem(self.privateContent[index])
                print("✅ [ChannelDetailView] Updated private content cache with title")
            }
        } else {
            // Update public content cache
            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                self.publicContent[index] = createUpdatedItem(self.publicContent[index])
                print("✅ [ChannelDetailView] Updated public content cache with title")
            }
        }
        
        // Close modal immediately so user sees the update
        showingEditModal = false
        editingContent = nil
        editingTitle = ""
        
        // Deselect the filter toggle so user sees their changes in the full timeline
        if showOnlyOwnContent {
            showOnlyOwnContent = false
            // Refresh content to show updated title in full timeline
            Task {
                try? await refreshChannelContent()
            }
        }
        
        isUpdatingContent = true
        
        Task {
            do {
                let response = try await ChannelService.shared.updateFileDetails(
                    fileId: content.SK,
                    userId: userEmail,
                    title: trimmedTitle,
                    description: nil, // Only update title, not description
                    price: nil,
                    isVisible: nil,
                    airdate: nil
                )
                
                await MainActor.run {
                    isUpdatingContent = false
                    
                    // Helper function to create updated item with server title
                    let createConfirmedItem: (ChannelContent, String) -> ChannelContent = { original, title in
                        ChannelContent(
                            SK: original.SK,
                            fileName: original.fileName,
                            title: title, // Use server-confirmed title
                            description: original.description,
                            hlsUrl: original.hlsUrl,
                            thumbnailUrl: original.thumbnailUrl,
                            createdAt: original.createdAt,
                            isVisible: original.isVisible,
                            price: original.price,
                            category: original.category,
                            uploadId: original.uploadId,
                            fileId: original.fileId,
                            airdate: original.airdate,
                            creatorUsername: original.creatorUsername,
                            isPrivateUsername: original.isPrivateUsername,
                            localFileURL: original.localFileURL
                        )
                    }
                    
                    if response.success {
                        // Use the title from the server response (confirmed from DynamoDB)
                        // response.data is [String: AnyCodable]?, so we need to extract the String value
                        let serverTitle: String
                        if let data = response.data, let titleValue = data["title"] {
                            // Extract string value from Any
                            if let stringValue = titleValue as? String, !stringValue.isEmpty {
                                serverTitle = stringValue
                            } else {
                                // Fallback to what we sent if server didn't return a valid title
                                serverTitle = trimmedTitle
                            }
                        } else {
                            // No title in response, use what we sent
                            serverTitle = trimmedTitle
                        }
                        
                        // Overwrite with confirmed data from DynamoDB - update all arrays
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            self.content[index] = createConfirmedItem(self.content[index], serverTitle)
                            print("✅ [ChannelDetailView] Confirmed update from DynamoDB - title: '\(serverTitle)'")
                        }
                        
                        // CRITICAL: Also update the cached public/private arrays
                        if isPrivate {
                            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.privateContent[index] = createConfirmedItem(self.privateContent[index], serverTitle)
                                print("✅ [ChannelDetailView] Updated private content cache with confirmed title")
                            }
                        } else {
                            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.publicContent[index] = createConfirmedItem(self.publicContent[index], serverTitle)
                                print("✅ [ChannelDetailView] Updated public content cache with confirmed title")
                            }
                        }
                        
                        print("✅ [ChannelDetailView] Content updated successfully on server")
                    } else {
                        print("❌ [ChannelDetailView] Update failed: \(response.message ?? "Unknown error")")
                        errorMessage = response.message ?? "Failed to update video details"
                        
                        // Revert optimistic update on failure - revert all arrays
                        let revertedTitle = content.title
                        let createRevertedItem: (ChannelContent) -> ChannelContent = { original in
                            ChannelContent(
                                SK: original.SK,
                                fileName: original.fileName,
                                title: revertedTitle, // Revert to original
                                description: original.description,
                                hlsUrl: original.hlsUrl,
                                thumbnailUrl: original.thumbnailUrl,
                                createdAt: original.createdAt,
                                isVisible: original.isVisible,
                                price: original.price,
                                category: original.category,
                                uploadId: original.uploadId,
                                fileId: original.fileId,
                                airdate: original.airdate,
                                creatorUsername: original.creatorUsername,
                                isPrivateUsername: original.isPrivateUsername,
                                localFileURL: original.localFileURL
                            )
                        }
                        
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            self.content[index] = createRevertedItem(self.content[index])
                            print("⚠️ [ChannelDetailView] Reverted optimistic update due to server error")
                        }
                        
                        // Revert cached arrays
                        if isPrivate {
                            if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.privateContent[index] = createRevertedItem(self.privateContent[index])
                            }
                        } else {
                            if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                                self.publicContent[index] = createRevertedItem(self.publicContent[index])
                            }
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isUpdatingContent = false
                    print("❌ [ChannelDetailView] Error updating content: \(error.localizedDescription)")
                    errorMessage = "Failed to update video details: \(error.localizedDescription)"
                    
                    // Revert optimistic update on error - revert all arrays
                    let revertedTitle = content.title
                    let createRevertedItem: (ChannelContent) -> ChannelContent = { original in
                        ChannelContent(
                            SK: original.SK,
                            fileName: original.fileName,
                            title: revertedTitle, // Revert to original
                            description: original.description,
                            hlsUrl: original.hlsUrl,
                            thumbnailUrl: original.thumbnailUrl,
                            createdAt: original.createdAt,
                            isVisible: original.isVisible,
                            price: original.price,
                            category: original.category,
                            uploadId: original.uploadId,
                            fileId: original.fileId,
                            airdate: original.airdate,
                            creatorUsername: original.creatorUsername,
                            isPrivateUsername: original.isPrivateUsername,
                            localFileURL: original.localFileURL
                        )
                    }
                    
                    if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                        self.content[index] = createRevertedItem(self.content[index])
                        print("⚠️ [ChannelDetailView] Reverted optimistic update due to network error")
                    }
                    
                    // Revert cached arrays
                    if isPrivate {
                        if let index = self.privateContent.firstIndex(where: { $0.SK == content.SK }) {
                            self.privateContent[index] = createRevertedItem(self.privateContent[index])
                        }
                    } else {
                        if let index = self.publicContent.firstIndex(where: { $0.SK == content.SK }) {
                            self.publicContent[index] = createRevertedItem(self.publicContent[index])
                        }
                    }
                }
            }
        }
    }
    
    // Load more content (pagination)
    private func loadMoreContent() {
        guard hasMoreContent, !isLoadingMore, let currentToken = nextToken else {
            print("⚠️ [ChannelDetailView] Cannot load more - hasMore: \(hasMoreContent), isLoadingMore: \(isLoadingMore), nextToken: \(nextToken != nil ? "exists" : "nil")")
            return
        }
        
        print("📄 [ChannelDetailView] Loading more content (pagination)...")
        isLoadingMore = true
        
        // HYBRID OPTIMIZATION: Prefetch next page in background while user scrolls
        // This ensures seamless pagination without loading states
        
        Task {
            do {
                let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                
                if isTwillyTV {
                    // CRITICAL: For Twilly TV, fetch content for the current view using the appropriate nextToken
                    // Use fetchChannelContent with showPrivateContent to get paginated results for current view
                    let viewerEmail = authService.userEmail
                    let viewerUsername = authService.username?.lowercased().trimmingCharacters(in: .whitespaces)
                    let channelCreatorEmail = currentChannel.creatorEmail.lowercased()
                    
                    // Helper to normalize username
                    func normalizeUsername(_ username: String?) -> String? {
                        return username?.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                    }
                    
                    // Helper to detect owner videos
                    func isOwnerVideo(_ item: ChannelContent) -> Bool {
                        if channelCreatorEmail == viewerEmail {
                            return true
                        }
                        if let viewerUsername = viewerUsername,
                           let normalizedCreatorUsername = normalizeUsername(item.creatorUsername),
                           normalizedCreatorUsername == viewerUsername {
                            return true
                        }
                        // Note: ChannelContent doesn't have creatorEmail, only creatorUsername
                        // Owner detection is handled via username comparison above
                        return false
                    }
                    
                    let result = try await channelService.fetchChannelContent(
                        channelName: currentChannel.channelName,
                        creatorEmail: currentChannel.creatorEmail,
                        viewerEmail: viewerEmail,
                        limit: 20,
                        nextToken: currentToken,
                        forceRefresh: false,
                        showPrivateContent: showPrivateContent
                    )
                    
                    // CRITICAL: Filter by privacy AND include owner videos
                    let filteredContent = result.content.filter { item in
                        let isOwner = isOwnerVideo(item)
                        let isPrivate = item.isPrivateUsername == true
                        
                        if showPrivateContent {
                            // Private view: include private items OR owner videos
                            return isPrivate || isOwner
                        } else {
                            // Public view: include public items OR owner videos
                            return !isPrivate || isOwner
                        }
                    }
                    
                    // If filtering to own content, filter the results
                    // CRITICAL: "My" filter should only match videos where creatorUsername matches viewer's username
                    // NOT all videos in a channel owned by the viewer
                    var finalContent = filteredContent
                    if showOnlyOwnContent {
                        finalContent = filteredContent.filter { item in
                            let normalizedViewerUsername = normalizeViewerUsername(authService.username)
                            let normalizedCreatorUsername = normalizeUsername(item.creatorUsername)
                            
                            if let viewerUsername = normalizedViewerUsername,
                               let creatorUsername = normalizedCreatorUsername {
                                return creatorUsername == viewerUsername
                            }
                            return false
                        }
                    }
                    
                    await MainActor.run {
                        // CRITICAL: Deduplicate against BOTH arrays to prevent cross-contamination
                        // Deduplicate by both SK and fileName (backend may return same fileName with different SKs)
                        var seenPublicSKs = Set(publicContent.map { $0.SK })
                        var seenPrivateSKs = Set(privateContent.map { $0.SK })
                        var seenPublicFileNames = Set(publicContent.map { $0.fileName })
                        var seenPrivateFileNames = Set(privateContent.map { $0.fileName })
                        var allSeenSKs = seenPublicSKs.union(seenPrivateSKs)
                        var allSeenFileNames = seenPublicFileNames.union(seenPrivateFileNames)
                        
                        // Update the appropriate array based on current view
                        if showPrivateContent {
                            // Append new items to privateContent array (deduplicate against both arrays)
                            var newPrivateItems: [ChannelContent] = []
                            for item in finalContent {
                                // CRITICAL: Check against both arrays by SK and fileName to prevent duplicates
                                if !allSeenSKs.contains(item.SK) && !allSeenFileNames.contains(item.fileName) {
                                    newPrivateItems.append(item)
                                    allSeenSKs.insert(item.SK)
                                    allSeenFileNames.insert(item.fileName)
                                    seenPrivateSKs.insert(item.SK)
                                    seenPrivateFileNames.insert(item.fileName)
                                } else {
                                    print("⚠️ [ChannelDetailView] Removing duplicate in loadMoreContent (private): \(item.fileName) (SK: \(item.SK))")
                                }
                            }
                            privateContent.append(contentsOf: newPrivateItems)
                            
                            // Update displayed content
                            if showOnlyOwnContent, let username = authService.username {
                                content = privateContent.filter { item in
                                    isOwnerVideo(item)
                                }
                            } else {
                                content = privateContent
                            }
                            
                            // Update pagination tokens
                            privateNextToken = result.nextToken
                            privateHasMore = result.hasMore
                            nextToken = privateNextToken
                            hasMoreContent = privateHasMore
                        } else {
                            // Append new items to publicContent array (deduplicate against both arrays)
                            var newPublicItems: [ChannelContent] = []
                            for item in finalContent {
                                // CRITICAL: Check against both arrays by SK and fileName to prevent duplicates
                                if !allSeenSKs.contains(item.SK) && !allSeenFileNames.contains(item.fileName) {
                                    newPublicItems.append(item)
                                    allSeenSKs.insert(item.SK)
                                    allSeenFileNames.insert(item.fileName)
                                    seenPublicSKs.insert(item.SK)
                                    seenPublicFileNames.insert(item.fileName)
                                } else {
                                    print("⚠️ [ChannelDetailView] Removing duplicate in loadMoreContent (public): \(item.fileName) (SK: \(item.SK))")
                                }
                            }
                            publicContent.append(contentsOf: newPublicItems)
                            
                            // Update displayed content
                            if showOnlyOwnContent, let username = authService.username {
                                content = publicContent.filter { item in
                                    isOwnerVideo(item)
                                }
                            } else {
                                content = publicContent
                            }
                            
                            // Update pagination tokens
                            publicNextToken = result.nextToken
                            publicHasMore = result.hasMore
                            nextToken = publicNextToken
                            hasMoreContent = publicHasMore
                        }
                        
                        isLoadingMore = false
                        print("📄 [ChannelDetailView] Loaded more \(showPrivateContent ? "private" : "public") content - total: \(content.count) items (added \(finalContent.count) new items)")
                    }
                } else {
                    // For non-Twilly TV channels, use regular fetchChannelContent
                    let viewerEmail: String? = nil
                let result = try await channelService.fetchChannelContent(
                    channelName: currentChannel.channelName,
                    creatorEmail: currentChannel.creatorEmail,
                    viewerEmail: viewerEmail,
                    limit: 20,
                    nextToken: currentToken,
                    forceRefresh: false,
                    showPrivateContent: showPrivateContent
                )
                
                // If filtering to own content, filter the results
                var filteredContent = result.content
                if showOnlyOwnContent {
                    filteredContent = result.content.filter { item in
                        isOwnerVideo(item)
                    }
                }
                
                print("✅ [ChannelDetailView] Loaded \(filteredContent.count) more items, hasMore: \(result.hasMore)")
                
                await MainActor.run {
                    // Append new content to existing content
                    content.append(contentsOf: filteredContent)
                    nextToken = result.nextToken
                    hasMoreContent = result.hasMore
                    isLoadingMore = false
                    print("📄 [ChannelDetailView] Total content count: \(content.count)")
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading more content: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingMore = false
                    // Don't show error for pagination failures - user can try scrolling again
                }
            }
        }
    }
}

// MARK: - Access Inbox Types

struct AccessInboxNotification: Identifiable {
    let id: String
    let message: String
    let timestamp: Date
    let ownerUsername: String
    var isRead: Bool
}

struct AccessInboxNotificationRow: View {
    let notification: AccessInboxNotification
    let onTap: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.title3)
                .foregroundColor(.twillyCyan)
                .frame(width: 40, height: 40)
                .background(Color.twillyCyan.opacity(0.2))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(notification.message)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(notification.isRead ? .white.opacity(0.6) : .white)
                
                Text(notification.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
            }
            
            Spacer()
            
            // Delete button
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.system(size: 16))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .padding(16)
        .background(notification.isRead ? Color.white.opacity(0.03) : Color.white.opacity(0.05))
        .cornerRadius(12)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}

struct ContentCard: View {
    let content: ChannelContent
    let onTap: () -> Void
    let onPlay: (() -> Void)? // Play button callback (separate from card tap)
    let isLocalVideo: Bool // Whether this is a local video (being processed)
    let isUploadComplete: Bool // Whether upload is complete
    let isPollingForThumbnail: Bool // Whether we're polling for thumbnail
    let channelCreatorUsername: String // Channel owner's username for fallback
    let channelCreatorEmail: String // Channel owner's email for fallback
    let isLatestContent: Bool // Whether this is the latest content (for "NEW" banner)
    let airScheduleLabel: String? // Air schedule label (e.g., "Tuesdays at 4 PM")
    let showDeleteButton: Bool // Whether to show delete button
    let onDelete: (() -> Void)? // Delete callback
    let showEditButton: Bool // Whether to show edit button
    let onEdit: (() -> Void)? // Edit callback
    let isOwnContent: Bool // Whether this is the user's own content (for "MINE" badge)
    let isFavorite: Bool // Whether this content is favorited
    let onFavorite: (() -> Void)? // Favorite toggle callback
    let showPrivateContent: Bool // Whether we're in private view (to show lock icon for all private videos)
    
    @State private var videoDuration: TimeInterval? = nil
    @State private var isLoadingDuration = false
    @State private var shouldHide = false // Hide card if duration < 6 seconds
    @State private var commentCount: Int? = nil // Comment count for this video
    @State private var unreadCommentCount: Int = 0 // Unread comment count (badge)
    
    // Computed property to get display title (never show raw m3u8 filename)
    private var displayTitle: String {
        // If title exists and is not empty, use cleaned title
        if let title = content.title, !title.trimmingCharacters(in: .whitespaces).isEmpty {
            return ContentCard.cleanTitle(title)
        }
        // If no title, return empty string (show nothing)
        return ""
    }
    
    // Computed property to check if content is scheduled
    private var isScheduled: Bool {
        guard let airdateString = content.airdate,
              let airdate = parseDate(airdateString),
              content.isVisible != true else {
            return false
        }
        return airdate > Date()
    }
    
    // Computed property for scheduled date
    private var scheduledDate: Date? {
        guard let airdateString = content.airdate,
              let airdate = parseDate(airdateString) else {
            return nil
        }
        return airdate
    }
    
    // Helper function to parse date from ISO8601 string
    private func parseDate(_ dateString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) {
            return date
        }
        // Fallback to standard ISO8601 without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }
    
    init(content: ChannelContent, onTap: @escaping () -> Void, onPlay: (() -> Void)? = nil, isLocalVideo: Bool = false, isUploadComplete: Bool = false, isPollingForThumbnail: Bool = false, channelCreatorUsername: String = "", channelCreatorEmail: String = "", isLatestContent: Bool = false, airScheduleLabel: String? = nil, showDeleteButton: Bool = false, onDelete: (() -> Void)? = nil, showEditButton: Bool = false, onEdit: (() -> Void)? = nil, isOwnContent: Bool = false, isFavorite: Bool = false, onFavorite: (() -> Void)? = nil, showPrivateContent: Bool = false) {
        self.content = content
        self.onTap = onTap
        self.onPlay = onPlay
        self.isLocalVideo = isLocalVideo
        self.isUploadComplete = isUploadComplete
        self.isPollingForThumbnail = isPollingForThumbnail
        self.channelCreatorUsername = channelCreatorUsername
        self.channelCreatorEmail = channelCreatorEmail
        self.isLatestContent = isLatestContent
        self.airScheduleLabel = airScheduleLabel
        self.showDeleteButton = showDeleteButton
        self.onDelete = onDelete
        self.showEditButton = showEditButton
        self.onEdit = onEdit
        self.isOwnContent = isOwnContent
        self.isFavorite = isFavorite
        self.onFavorite = onFavorite
        self.showPrivateContent = showPrivateContent
    }
    
    var body: some View {
        // Hide videos under 6 seconds
        if shouldHide {
            EmptyView()
        } else {
            HStack(spacing: 12) {
                // Tappable area for card (everything except play button)
                Button(action: onTap) {
                    HStack(spacing: 12) {
                        // Thumbnail with favorite button overlay
                        ZStack(alignment: .topTrailing) {
                        // Thumbnail - maintain aspect ratio for portrait videos
                        ZStack {
                            AsyncImage(url: URL(string: content.thumbnailUrl ?? "")) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                case .failure(_), .empty:
                                    ZStack {
                                        Color.gray.opacity(0.3)
                                        Image(systemName: "play.circle.fill")
                                            .font(.system(size: 40))
                                            .foregroundColor(.white.opacity(0.5))
                                    }
                                @unknown default:
                                    Color.gray.opacity(0.3)
                                }
                            }
                            
                            // Upload status indicators overlay
                            if isLocalVideo && isUploadComplete {
                                VStack {
                                    Spacer()
                                    HStack {
                                        Spacer()
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.system(size: 20))
                                            .foregroundColor(.twillyCyan)
                                            .background(Circle().fill(Color.black.opacity(0.7)))
                                            .padding(4)
                                    }
                                }
                            } else if isLocalVideo && isPollingForThumbnail {
                                VStack {
                                    Spacer()
                                    HStack {
                                        Spacer()
                                        ProgressView()
                                            .tint(.twillyCyan)
                                            .scaleEffect(0.8)
                                            .padding(6)
                                            .background(Circle().fill(Color.black.opacity(0.7)))
                                    }
                                }
                            }
                        }
                        .frame(width: 120, height: 120) // Square frame to accommodate both portrait and landscape
                        .clipped()
                        .cornerRadius(8)
                        }
                        
                        // Content info - Title, username, and duration
                        VStack(alignment: .leading, spacing: 6) {
                            // Video title (never show raw m3u8 filename) - only show if title exists
                            if !displayTitle.isEmpty {
                                Text(displayTitle)
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                            }
                            
                            // Creator username with icon - Use SF Symbols (not emojis) to prevent flickering
                            if let username = content.creatorUsername, !username.isEmpty {
                                HStack(spacing: 4) {
                                    Image(systemName: "person.circle.fill")
                                        .font(.system(size: 12))
                                        .foregroundColor(.twillyCyan)
                                    
                                    // Username text - normalize: Remove lock symbol and trim whitespace
                                    Text(username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespacesAndNewlines))
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.twillyCyan)
                                        .lineLimit(1) // Force single line
                                        .minimumScaleFactor(0.8) // Scale down if needed
                                        .fixedSize(horizontal: true, vertical: false) // Allow horizontal expansion, prevent wrapping
                                    
                                    // Icon based on view mode - IMMEDIATE UPDATE, NO FLASH
                                    // Use transaction to disable animation for instant icon switch
                                    Group {
                                        if showPrivateContent {
                                            // PRIVATE VIEW: Show premium or private icon
                                            if let isPremium = content.isPremium, isPremium == true {
                                                // Premium content - yellow dollar sign icon
                                                Image(systemName: "dollarsign.circle.fill")
                                                    .font(.system(size: 12))
                                                    .foregroundColor(.yellow)
                                            } else {
                                                // Private content - orange lock icon
                                                Image(systemName: "lock.fill")
                                                    .font(.system(size: 12))
                                                    .foregroundColor(.orange)
                                            }
                                        } else {
                                            // PUBLIC VIEW: Always show blue globe icon
                                            Image(systemName: "globe")
                                                .font(.system(size: 12))
                                                .foregroundColor(.blue)
                                        }
                                    }
                                    .id("icon-\(showPrivateContent ? "private" : "public")-\(content.isPremium == true ? "premium" : "regular")-\(content.SK)") // Include content.SK for stability
                                    .transaction { transaction in
                                        // CRITICAL: Disable animation on icon to prevent flash
                                        transaction.animation = nil
                                    }
                                }
                                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading) // Allow HStack to take available space
                            }
                            
                            // Video duration and comment count
                            VStack(alignment: .leading, spacing: 4) {
                                // Duration
                                HStack(spacing: 4) {
                                    Image(systemName: "clock.fill")
                                        .font(.system(size: 10))
                                        .foregroundColor(.white.opacity(0.7))
                                    if isLoadingDuration {
                                        ProgressView()
                                            .scaleEffect(0.7)
                                            .tint(.white.opacity(0.7))
                                    } else if let duration = videoDuration {
                                        Text(formatDuration(duration))
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.7))
                                    } else {
                                        Text("--:--")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.7))
                                    }
                                }
                            }
                            
                            // Comment icon and Favorite star button - side by side
                            HStack(alignment: .top, spacing: 12) {
                                // Comment icon with unread badge - always visible
                                Button(action: {
                                    // Open video player with comments
                                    onTap()
                                }) {
                                    ZStack(alignment: .topTrailing) {
                                        Image(systemName: "text.bubble.fill")
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundColor(.twillyCyan)
                                        
                                        // Unread comment badge (red circle) - show "1" if ANY unread messages exist
                                        // Binary indicator: 1 = has unread, 0 = none (no badge)
                                        if unreadCommentCount > 0 {
                                            Text("1")
                                                .font(.system(size: 8, weight: .bold))
                                                .foregroundColor(.white)
                                                .padding(3)
                                                .background(Color.red)
                                                .clipShape(Circle())
                                                .offset(x: 6, y: -6)
                                        }
                                        
                                        // Show comment count if available (below icon)
                                        if let count = commentCount, count > 0 {
                                            Text("\(count)")
                                                .font(.system(size: 9, weight: .semibold))
                                                .foregroundColor(.white.opacity(0.8))
                                                .offset(x: 0, y: 16)
                                        }
                                    }
                                }
                                .buttonStyle(PlainButtonStyle())
                                
                                // Favorite star button - centered with comment box
                                if let onFavorite = onFavorite {
                                    Button(action: {
                                        onFavorite()
                                    }) {
                                        Image(systemName: isFavorite ? "star.fill" : "star")
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundColor(isFavorite ? .yellow : .white.opacity(0.6))
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                    .offset(y: -1.5) // Slightly above comment icon center
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading) // Take available space, keep aligned left
                        
                        // Edit and Delete buttons (when filtering to own content)
                        // Always reserve space for buttons to prevent layout shift - NO SPACER so username always has same width
                        HStack(spacing: 8) {
                            // Edit button - always reserve space
                            if showEditButton {
                                Button(action: {
                                    onEdit?()
                                }) {
                                    Image(systemName: "pencil.circle.fill")
                                        .font(.system(size: 18))
                                        .foregroundColor(.twillyCyan)
                                        .padding(8)
                                        .background(Color.black.opacity(0.6))
                                        .clipShape(Circle())
                                }
                                .buttonStyle(PlainButtonStyle())
                            } else {
                                // Invisible spacer to maintain layout (same size as button)
                                Color.clear
                                    .frame(width: 34, height: 34)
                            }
                            
                            // Delete button - always reserve space
                            if showDeleteButton {
                                Button(action: {
                                    onDelete?()
                                }) {
                                    Image(systemName: "trash.fill")
                                        .font(.system(size: 18))
                                        .foregroundColor(.red)
                                        .padding(8)
                                        .background(Color.black.opacity(0.6))
                                        .clipShape(Circle())
                                }
                                .buttonStyle(PlainButtonStyle())
                            } else {
                                // Invisible spacer to maintain layout (same size as button)
                                Color.clear
                                    .frame(width: 34, height: 34)
                            }
                        }
                        .frame(width: 76) // Fixed width: 34 (button) + 8 (spacing) + 34 (button) = 76
                        .padding(.trailing, 8)
                    }
                }
                .buttonStyle(PlainButtonStyle())
                
                // Play button - separate from card tap (always plays, doesn't trigger popup)
                Button(action: {
                    onPlay?() ?? onTap() // Use onPlay if provided, otherwise fall back to onTap
                }) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 30))
                        .foregroundColor(.white.opacity(0.7))
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding()
            .background(Color.white.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .opacity(isScheduled ? 0.6 : 1.0)
            .overlay(alignment: .topLeading) {
                HStack(spacing: 4) {
                    // "NEW" badge for latest content
                    if isLatestContent {
                        Text("NEW")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.red)
                            .cornerRadius(4)
                    }
                    
                    // MINE badge removed - filtering still works via isOwnContent
                }
                .padding(8)
            }
            .overlay(alignment: .topTrailing) {
                // Scheduled date badge
                if isScheduled, let date = scheduledDate {
                    HStack(spacing: 4) {
                        Image(systemName: "clock.fill")
                            .font(.system(size: 9))
                        Text(formatScheduledDate(date))
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(Color.blue.opacity(0.8))
                    )
                    .padding(8)
                }
            }
            .overlay {
                // Overlay for scheduled content (like Netflix - prevents interaction)
                if isScheduled {
                    Color.black.opacity(0.3)
                        .allowsHitTesting(false)
                } else {
                    Color.clear
                }
            }
            .onAppear {
                loadVideoDuration()
                loadCommentCount()
                
                // CRITICAL: For latest video, immediately load unread counts to show indicator
                if isLatestContent {
                    Task {
                        try? await MessagingService.shared.loadUnreadCounts(for: content.SK)
                        await MainActor.run {
                            self.unreadCommentCount = MessagingService.shared.getUnreadCount(for: content.SK)
                            print("🔔 [ContentCard] Loaded unread count for latest video: \(self.unreadCommentCount)")
                        }
                    }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("CommentsViewed"))) { notification in
                if let videoId = notification.userInfo?["videoId"] as? String,
                   videoId == content.SK {
                    // If unreadCount is provided directly, use it immediately (faster)
                    if let unreadCount = notification.userInfo?["unreadCount"] as? Int {
                        self.unreadCommentCount = unreadCount
                    } else {
                        // Otherwise refresh from server
                    Task {
                        // Refresh comment count
                        do {
                                let comments = try await ChannelService.shared.getComments(videoId: content.SK, userId: AuthService.shared.userId, viewerEmail: AuthService.shared.userEmail)
                            await MainActor.run {
                                // Only count public comments (not private messages)
                                let publicComments = comments.filter { $0.isPrivate != true && $0.parentCommentId == nil }
                                self.commentCount = publicComments.count
                            }
                        } catch {
                            print("❌ [ContentCard] Failed to refresh comment count: \(error.localizedDescription)")
                        }
                        
                            // Refresh unread count using MessagingService
                            Task {
                            do {
                                    try await MessagingService.shared.loadUnreadCounts(for: content.SK)
                                await MainActor.run {
                                        self.unreadCommentCount = MessagingService.shared.getUnreadCount(for: content.SK)
                                }
                            } catch {
                                print("❌ [ContentCard] Failed to refresh unread count: \(error.localizedDescription)")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func formatScheduledDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    // Clean title by removing stream key patterns (static helper for use in multiple places)
    static func cleanTitle(_ text: String) -> String {
        // Remove stream key patterns like "sk_xxxxx_" or "twillytvxxxxx_" from the beginning
        let patterns = [
            "^sk_[a-z0-9]+_",  // sk_xxxxx_ pattern
            "^twillytv[a-z0-9]+_"  // twillytvxxxxx_ pattern
        ]
        
        var cleaned = text
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let range = NSRange(location: 0, length: cleaned.utf16.count)
                cleaned = regex.stringByReplacingMatches(in: cleaned, options: [], range: range, withTemplate: "")
            }
        }
        
        // Remove date patterns like "2026-02-07T03-22-32-449Z_" or "2026-01-29T23-59-23-822Z_"
        if let dateRegex = try? NSRegularExpression(pattern: "^\\d{4}-\\d{2}-\\d{2}T[\\d-]+Z_", options: []) {
            let range = NSRange(location: 0, length: cleaned.utf16.count)
            cleaned = dateRegex.stringByReplacingMatches(in: cleaned, options: [], range: range, withTemplate: "")
        }
        
        // Remove random ID patterns like "_xs9x974t_" or "_l6yx5kug_"
        if let idRegex = try? NSRegularExpression(pattern: "_[a-z0-9]+_", options: []) {
            let range = NSRange(location: 0, length: cleaned.utf16.count)
            cleaned = idRegex.stringByReplacingMatches(in: cleaned, options: [], range: range, withTemplate: "")
        }
        
        // Remove file extensions
        cleaned = cleaned.replacingOccurrences(of: ".m3u8", with: "", options: .caseInsensitive)
        cleaned = cleaned.replacingOccurrences(of: "_master", with: "", options: .caseInsensitive)
        
        // Trim whitespace
        cleaned = cleaned.trimmingCharacters(in: .whitespaces)
        
        // If cleaned is empty or just whitespace, return a default
        if cleaned.isEmpty {
            return "Video"
        }
        
        return cleaned
    }
    
    // Format duration as MM:SS or HH:MM:SS
    private func formatDuration(_ duration: TimeInterval) -> String {
        let hours = Int(duration) / 3600
        let minutes = Int(duration) / 60 % 60
        let seconds = Int(duration) % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
    
    // Load video duration asynchronously
    private func loadVideoDuration() {
        guard videoDuration == nil && !isLoadingDuration else { return }
        
        isLoadingDuration = true
        
        Task {
            var duration: TimeInterval? = nil
            
            // Try local file first
            if let localURL = content.localFileURL {
                duration = await getDuration(from: localURL)
            }
            
            // If no local file, try HLS URL
            if duration == nil, let hlsUrl = content.hlsUrl, !hlsUrl.isEmpty, let url = URL(string: hlsUrl) {
                duration = await getDuration(from: url)
            }
            
                await MainActor.run {
                    self.videoDuration = duration
                    self.isLoadingDuration = false
                    // Hide videos under 6 seconds while deletion is in progress
                    // (Deletion happens in ChannelDetailView.checkAndDeleteShortVideos)
                    if content.category == "Videos" || content.category == nil {
                        if let duration = duration, duration < 6.0 {
                            print("🚫 [ContentCard] Video under 6 seconds detected: \(content.fileName), duration: \(String(format: "%.2f", duration))s - will be deleted")
                            self.shouldHide = true
                        }
                    }
                }
        }
    }
    
    // Load comment count and unread count asynchronously
    private func loadCommentCount() {
        guard commentCount == nil else { return }
        
        Task {
            do {
                // Load comments to get count - only count public comments (not private messages)
                let comments = try await ChannelService.shared.getComments(videoId: content.SK, userId: AuthService.shared.userId, viewerEmail: AuthService.shared.userEmail)
                await MainActor.run {
                    // Only count public comments (not private messages)
                    let publicComments = comments.filter { $0.isPrivate != true && $0.parentCommentId == nil }
                    self.commentCount = publicComments.count
                }
                
                // Load unread private message count (red badge indicator)
                // Use MessagingService as source of truth for consistency
                if let userEmail = AuthService.shared.userEmail {
                    do {
                        // Load unread counts via MessagingService (ensures consistency)
                        try await MessagingService.shared.loadUnreadCounts(for: content.SK)
                        await MainActor.run {
                            // Get unread count from MessagingService
                            self.unreadCommentCount = MessagingService.shared.getUnreadCount(for: content.SK)
                        }
                    } catch {
                        print("❌ [ContentCard] Failed to load unread count: \(error.localizedDescription)")
                        await MainActor.run {
                            self.unreadCommentCount = 0
                        }
                    }
                }
            } catch {
                print("❌ [ContentCard] Failed to load comment count: \(error.localizedDescription)")
                await MainActor.run {
                    self.commentCount = 0
                    self.unreadCommentCount = 0
                }
            }
        }
    }
    
    // Get duration from video URL
    private func getDuration(from url: URL) async -> TimeInterval? {
        let asset = AVAsset(url: url)
        
        do {
            let duration = try await asset.load(.duration)
            return CMTimeGetSeconds(duration)
        } catch {
            print("❌ [ContentCard] Failed to load duration: \(error.localizedDescription)")
            return nil
        }
    }
}

// SVG Image View using WKWebView for SVG support
struct SVGImageView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.scrollView.isScrollEnabled = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        // Disable user interaction
        webView.isUserInteractionEnabled = false
        // Center content
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        // Load SVG from URL with full-size centered content
        let htmlString = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: transparent;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                }
            </style>
        </head>
        <body>
            <img src="\(url.absoluteString)" alt="SVG Poster" />
        </body>
        </html>
        """
        webView.loadHTMLString(htmlString, baseURL: nil)
    }
}

// MARK: - Comment Model
// MARK: - MessagingService (Temporary: Should be in separate file, add MessagingService.swift to Xcode project)
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
    }
    
    // MARK: - Public API
    
    /// Load messages for a video - SERVER IS SOURCE OF TRUTH
    /// LIGHTNING FAST: Returns cached data immediately if available, then refreshes in background
    func loadMessages(for videoId: String, useCache: Bool = true) async throws {
        guard let userId = authService.userId,
              let viewerEmail = authService.userEmail else {
            throw MessagingError.notAuthenticated
        }
        
        // LIGHTNING FAST: Return cached data immediately if available
        if useCache {
            await MainActor.run {
                if let cachedPublic = publicComments[videoId], !cachedPublic.isEmpty {
                    print("⚡ [MessagingService] Cache hit for \(videoId): \(cachedPublic.count) public, \(privateThreads[videoId]?.count ?? 0) threads")
                    // Cache hit - data already available, refresh in background
                    Task.detached { [weak self] in
                        try? await self?.loadMessages(for: videoId, useCache: false)
                    }
                    return
                }
            }
        }
        
        // Load fresh from server
        let response = try await ChannelService.shared.getCommentsWithThreads(
            videoId: videoId,
            userId: userId,
            viewerEmail: viewerEmail
        )
        
        await MainActor.run {
            // Process public comments - reverse once (server returns newest first)
            // UNIFIED LOGIC: General chat = flat list, private chat = flat list per threadId
            // Both work the same - just different IDs (general has no ID, private has threadId)
            let reversedPublic = Array(response.comments.filter { $0.isPrivate != true && $0.parentCommentId == nil }.reversed())
            publicComments[videoId] = reversedPublic
            
            // Process private threads - reverse each thread once
            // CRITICAL: Preserve existing threads (SAME AS GENERAL CHAT preserves publicComments)
            // Don't overwrite - merge with existing to ensure persistence when navigating away
            var threads: [String: [Comment]] = privateThreads[videoId] ?? [:]
            
            // Update with server data (server is source of truth)
            for (parentId, serverMessages) in response.threadsByParent {
                // Reverse once (newest first -> oldest first) - SAME AS GENERAL CHAT
                let reversedMessages = Array(serverMessages.reversed())
                
                // Merge with existing messages to preserve optimistic updates - SAME AS GENERAL CHAT
                let existingMessages = threads[parentId] ?? []
                let serverMessageIds = Set(reversedMessages.map { $0.id })
                let optimisticMessages = existingMessages.filter { !serverMessageIds.contains($0.id) }
                
                // Combine: server messages + optimistic updates - SAME AS GENERAL CHAT
                var merged = reversedMessages
                merged.append(contentsOf: optimisticMessages)
                
                threads[parentId] = merged
            }
            
            // CRITICAL: Preserve ALL existing threads that aren't in server response
            // This ensures messages don't disappear when navigating away - SAME AS GENERAL CHAT
            // General chat always preserves publicComments, private threads should always be preserved
            privateThreads[videoId] = threads
            
            // Update cached user threads immediately
            updateCachedUserThreads(for: videoId)
            
            print("✅ [MessagingService] Loaded \(reversedPublic.count) public comments and \(threads.count) private threads for \(videoId)")
        }
        
        // CRITICAL: Load unread counts after loading messages
        // This ensures unread indicators are always up-to-date
        try await loadUnreadCounts(for: videoId)
        
        // Update cached user threads AFTER unread counts are loaded
        // This ensures orange highlights match the red badge
        await MainActor.run {
            updateCachedUserThreads(for: videoId)
        }
    }
    
    /// Preload messages for a video (non-blocking, for instant display later)
    /// LIGHTNING FAST: Preloads comments when video card appears, before user opens chat
    func preloadMessages(for videoId: String) {
        // Only preload if not already cached (avoid redundant loads)
        Task.detached { [weak self] in
            await MainActor.run {
                if self?.publicComments[videoId] == nil || (self?.publicComments[videoId]?.isEmpty ?? true) {
                    // No cache - preload in background
                    Task.detached {
                        try? await self?.loadMessages(for: videoId, useCache: false)
                    }
                }
            }
        }
    }
    
    /// Update cached user threads for a video (for username scroll)
    /// OPEN MESSAGING: Anyone who has commented (public or private) can be messaged
    func updateCachedUserThreads(for videoId: String) {
        guard let userId = authService.userId,
              let currentUsername = authService.username else { return }
        
        var threads: [ThreadInfo] = []
        var usernameToThreadId: [String: String] = [:] // Track best threadId for each username
        
        // Get all public comments to find ALL participants (not just private thread participants)
        let publicCommentsList = publicComments[videoId] ?? []
        let threadsDict = privateThreads[videoId] ?? [:]
        
        // STEP 1: Collect all unique participants from private threads (existing conversations)
        // SIMPLIFIED: Track participants naturally - whoever posts is a participant
        // Allow self-messaging (user can message themselves)
        var participantSet: Set<String> = []
        
        for (parentId, threadMessages) in threadsDict {
            for message in threadMessages {
                // Include ALL participants (including self for self-messaging)
                participantSet.insert(message.username)
                // Track threadId for this participant (prefer thread with messages)
                if usernameToThreadId[message.username] == nil {
                    usernameToThreadId[message.username] = parentId
                }
            }
        }
        
        // STEP 2: Add ALL users who have made public comments (OPEN MESSAGING - anyone can message anyone)
        // Allow self-messaging - user can click on their own comment to start a conversation with themselves
        for comment in publicCommentsList {
            // Include ALL users (including self)
            participantSet.insert(comment.username)
            
            // If this user has a private thread, use that threadId
            // Otherwise, use the comment.id as the threadId (allows starting new conversation)
            if usernameToThreadId[comment.username] == nil {
                // Check if this comment has a private thread
                if threadsDict[comment.id] != nil {
                    usernameToThreadId[comment.username] = comment.id
                } else {
                    // No private thread yet - use comment.id so clicking starts a new conversation
                    usernameToThreadId[comment.username] = comment.id
                }
            }
        }
        
        // STEP 3: Create ThreadInfo for each participant
        for username in participantSet {
            // Get the best threadId for this username
            let threadId = usernameToThreadId[username] ?? username // Fallback to username if no threadId
            
            let key = "\(videoId)_\(threadId)"
            let hasUnread = threadUnreadStatus[key] == true
            
            // Check if thread has messages (existing conversation) or is just a public comment (new conversation)
            let hasMessages = threadsDict[threadId] != nil && !(threadsDict[threadId]?.isEmpty ?? true)
            
            threads.append(ThreadInfo(id: threadId, username: username, hasUnread: hasUnread))
        }
        
        // Sort by unread first, then alphabetically
        threads.sort { first, second in
            if first.hasUnread != second.hasUnread {
                return first.hasUnread
            }
            return first.username < second.username
        }
        
        cachedUserThreads[videoId] = threads
        print("✅ [MessagingService] Updated cached user threads: \(threads.count) participants for \(videoId)")
    }
    
    struct ThreadInfo: Identifiable {
        var id: String // Mutable to allow updating to more recent thread
        let username: String
        var hasUnread: Bool // Mutable to allow updating unread status
    }
    
    /// Post a message - OPTIMISTIC UPDATE + SERVER SYNC
    func postMessage(videoId: String, text: String, threadId: String?, username: String) async throws -> Comment {
        guard let userId = authService.userId else {
            throw MessagingError.notAuthenticated
        }
        
        // Create optimistic comment for immediate UI feedback
        let optimisticComment = Comment(
            id: "temp_\(Date().timeIntervalSince1970)",
            videoId: videoId,
            userId: userId,
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
        
        // OPTIMISTIC UPDATE: Add to UI immediately (no delay, no jitter)
        await MainActor.run {
            if let threadId = threadId {
                // Private thread message
                if privateThreads[videoId] == nil {
                    privateThreads[videoId] = [:]
                }
                if privateThreads[videoId]?[threadId] == nil {
                    privateThreads[videoId]?[threadId] = []
                }
                privateThreads[videoId]?[threadId]?.append(optimisticComment)
            } else {
                // Public comment
                if publicComments[videoId] == nil {
                    publicComments[videoId] = []
                }
                publicComments[videoId]?.append(optimisticComment)
            }
            
            // Update cached user threads immediately (no flash)
            updateCachedUserThreads(for: videoId)
        }
        
        // Post to server in background
        let comment = try await ChannelService.shared.postComment(
            videoId: videoId,
            userId: userId,
            username: username,
            text: text,
            parentCommentId: threadId,
            creatorEmail: nil,
            commenterEmail: nil
        )
        
        // UNIFIED LOGIC: Private thread = general chat with 2 people
        // Replace optimistic comment with real one (same logic for both)
        await MainActor.run {
            if let threadId = threadId {
                // Private thread - treat exactly like general chat, just in a thread array
                if var thread = privateThreads[videoId]?[threadId] {
                    if let index = thread.firstIndex(where: { $0.id == optimisticComment.id }) {
                        thread[index] = comment
                        privateThreads[videoId]?[threadId] = thread
                    } else {
                        // Optimistic comment not found - add the real one (same as general chat)
                        thread.append(comment)
                        privateThreads[videoId]?[threadId] = thread
                    }
                } else {
                    // Thread doesn't exist - create it with the real comment (same as general chat)
                    if privateThreads[videoId] == nil {
                        privateThreads[videoId] = [:]
                    }
                    privateThreads[videoId]?[threadId] = [comment]
                }
            } else {
                // Public comment (general chat)
                if var comments = publicComments[videoId] {
                    if let index = comments.firstIndex(where: { $0.id == optimisticComment.id }) {
                        comments[index] = comment
                        publicComments[videoId] = comments
                    } else {
                        // Optimistic comment not found - add the real one
                        comments.append(comment)
                        publicComments[videoId] = comments
                    }
                } else {
                    // No comments yet - create array with the real comment
                    publicComments[videoId] = [comment]
                }
            }
            
            // Update cached user threads after adding message
            updateCachedUserThreads(for: videoId)
        }
        
        // UNIFIED PERSISTENCE: Private thread = general chat with 2 people
        // CRITICAL: Always reload from server after posting (useCache: false to force server fetch)
        // This ensures message is persisted and visible to both participants
        // Same logic for both general chat and private threads
        Task.detached { [weak self] in
            guard let self = self else { return }
            // Wait for server processing (same delay for both)
            try? await Task.sleep(nanoseconds: 1000_000_000) // 1.0s delay to ensure server processing
            // CRITICAL: Force reload from server (useCache: false) to get persisted message
            // This ensures both participants see the message - same as general chat
            try? await self.loadMessages(for: videoId, useCache: false)
            
            // After reload, update cached user threads
            await MainActor.run {
                self.updateCachedUserThreads(for: videoId)
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
        
        // Get current like state after optimistic update
        let newIsLiked = await MainActor.run {
            if let comments = publicComments[videoId],
               let comment = comments.first(where: { $0.id == commentId }) {
                return comment.isLiked
            } else if let threads = privateThreads[videoId] {
                for (_, thread) in threads {
                    if let comment = thread.first(where: { $0.id == commentId }) {
                        return comment.isLiked
                    }
                }
            }
            return false
        }
        
        // Update on server (WebSocket will confirm)
        _ = try await ChannelService.shared.likeComment(
            videoId: videoId,
            commentId: commentId,
            userId: userId,
            isLiked: newIsLiked
        )
    }
    
    /// Mark thread as read
    func markThreadRead(threadId: String, videoId: String) async throws {
        guard let viewerEmail = authService.userEmail else {
            throw MessagingError.notAuthenticated
        }
        
        // Optimistic update - immediate UI feedback
        await MainActor.run {
            let key = "\(videoId)_\(threadId)"
            threadUnreadStatus[key] = false
            threadUnreadStatus[threadId] = false // Also update without videoId prefix for compatibility
            updateCachedUserThreads(for: videoId)
        }
        
        // Update on server
        _ = try await ChannelService.shared.markThreadAsRead(
            videoId: videoId,
            viewerEmail: viewerEmail,
            threadId: threadId
        )
        
        // Reload unread counts (will update badge and clear if no unreads remain)
        try await loadUnreadCounts(for: videoId)
        
        // CRITICAL: After marking as read, check if all threads are read and clear badge
        await MainActor.run {
            let remainingUnreadCount = threadUnreadStatus.values.filter { $0 }.count
            NotificationCenter.default.post(
                name: NSNotification.Name("CommentsViewed"),
                object: nil,
                userInfo: [
                    "videoId": videoId,
                    "unreadCount": remainingUnreadCount
                ]
            )
        }
    }
    
    /// Load unread counts for a video
    func loadUnreadCounts(for videoId: String) async throws {
        guard let viewerEmail = authService.userEmail else {
            return
        }
        
        let counts = try await ChannelService.shared.getUnreadCommentCounts(
            videoIds: [videoId],
            viewerEmail: viewerEmail
        )
        
        await MainActor.run {
            if let videoResponse = counts[videoId] {
                if let intValue = videoResponse as? Int {
                    unreadCounts[videoId] = intValue
                } else if let dictValue = videoResponse as? [String: Any],
                          let total = dictValue["total"] as? Int {
                    unreadCounts[videoId] = total
                    
                    // Update thread unread status
                    if let threads = dictValue["threads"] as? [String: Int] {
                        for (threadId, count) in threads {
                            let key = "\(videoId)_\(threadId)"
                            threadUnreadStatus[key] = count > 0
                        }
                    }
                }
            }
            
            // Update cached user threads after unread status changes
            updateCachedUserThreads(for: videoId)
            
            // Notify ContentCard of unread count change
            NotificationCenter.default.post(
                name: NSNotification.Name("CommentsViewed"),
                object: nil,
                userInfo: [
                    "videoId": videoId,
                    "unreadCount": unreadCounts[videoId] ?? 0
                ]
            )
        }
    }
    
    /// Clear all cache - SERVER IS SOURCE OF TRUTH
    func clearCache() {
        publicComments.removeAll()
        privateThreads.removeAll()
        unreadCounts.removeAll()
        threadUnreadStatus.removeAll()
        
        // Clear UserDefaults
        let defaults = UserDefaults.standard
        let keys = defaults.dictionaryRepresentation().keys
        for key in keys {
            if key.hasPrefix("comments_") || key.hasPrefix("commentLikes_") || key.hasPrefix("threadUnreadStatus_") {
                defaults.removeObject(forKey: key)
            }
        }
        defaults.synchronize()
        
        print("🗑️ [MessagingService] Cleared all cache - server is source of truth")
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
        return unreadCounts[videoId] ?? 0
    }
    
    /// Check if thread has unread messages
    func hasUnreadThread(videoId: String, threadId: String) -> Bool {
        let key = "\(videoId)_\(threadId)"
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
                Task {
                    try? await self?.loadMessages(for: notification.videoId)
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
// END MessagingService

struct Comment: Identifiable, Codable {
    let id: String
    let videoId: String
    let userId: String
    let username: String
    let text: String
    let createdAt: Date
    var likeCount: Int
    var isLiked: Bool
    var isPrivate: Bool?
    var parentCommentId: String?
    var visibleTo: [String]?
    var mentionedUsername: String?
}

// MARK: - Floating Comment View
struct FloatingCommentView: View {
    let content: ChannelContent
    let channelCreatorEmail: String? // For checking ownership
    @ObservedObject private var messagingService = MessagingService.shared
    @ObservedObject private var websocketService = UnifiedWebSocketService.shared
    @State private var selectedThreadId: String? = nil // Selected comment ID to view thread
    @State private var newCommentText: String = ""
    @State private var isExpanded: Bool = false
    @State private var isLoading: Bool = false
    @State private var isPosting: Bool = false
    @State private var isClearing: Bool = false
    @State private var previousGeneralCommentCount: Int = 0
    @State private var previousThreadMessageCount: [String: Int] = [:]
    @ObservedObject private var authService = AuthService.shared
    // WebSocket and polling are handled by MessagingService
    
    // State variables - synced with MessagingService
    @State private var publicComments: [Comment] = []
    @State private var privateThreads: [String: [Comment]] = [:]
    @State private var threadUnreadStatus: [String: Bool] = [:]
    @State private var cachedUserThreads: [MessagingService.ThreadInfo] = []
    
    // Helper function to normalize videoId for comparison (removes FILE# and file- prefixes)
    private func normalizeVideoId(_ videoId: String) -> String {
        return videoId
            .replacingOccurrences(of: "FILE#", with: "")
            .replacingOccurrences(of: "file-", with: "")
    }
    
    // Check if current user is the video/post owner/creator
    // CRITICAL: Check the POST/VIDEO creator, not the channel creator
    private var isOwner: Bool {
        guard let currentUsername = authService.username else {
            return false
        }
        
        // Normalize both usernames the same way (remove lock symbols, trim, lowercase)
        let normalizeUsername: (String?) -> String? = { username in
            guard let username = username else { return nil }
            return username.replacingOccurrences(of: "🔒", with: "")
                .trimmingCharacters(in: CharacterSet.whitespaces)
                .lowercased()
        }
        
        let normalizedCurrentUsername = normalizeUsername(currentUsername)
        let normalizedCreatorUsername = normalizeUsername(content.creatorUsername)
        
        if let current = normalizedCurrentUsername,
           let creator = normalizedCreatorUsername {
            return current == creator
        }
        
        // Fallback: simple comparison if normalization fails
        return content.creatorUsername?.lowercased() == currentUsername.lowercased()
    }
    
    // Get current thread messages from MessagingService
    private var currentThreadMessages: [Comment] {
        guard let threadId = selectedThreadId else {
            return []
        }
        // CRITICAL: Use local state first (includes optimistic updates), fallback to MessagingService
        // This ensures messages don't vanish before server confirms
        if let localThread = privateThreads[threadId], !localThread.isEmpty {
            return localThread
        }
        // Fallback to MessagingService if local state is empty
        return messagingService.getPrivateThread(for: content.SK, threadId: threadId)
    }
    
    // Get thread unread status from MessagingService
    private func hasUnreadThread(_ threadId: String) -> Bool {
        return messagingService.hasUnreadThread(videoId: content.SK, threadId: threadId)
    }
    
    // Check if comments should be visible
    // Comments are now available on all videos (public, private, and premium)
    private var canViewComments: Bool {
        return true // Comments are available on all videos
    }
    
    @ViewBuilder
    private var commentContentView: some View {
        // Only show comment section if user can view comments
        if canViewComments {
            VStack {
                Spacer()
                
                if isExpanded {
                    expandedCommentSection
                } else {
                    collapsedCommentButton
                }
            }
        }
    }
    
    private var expandedCommentSection: some View {
        VStack(spacing: 0) {
            commentHeader
            threadSelector
            commentsList
            commentInput
        }
        .frame(maxHeight: 400)
        .cornerRadius(12)
        .padding()
    }
    
    private var commentHeader: some View {
        VStack(spacing: 0) {
            HStack {
                if selectedThreadId != nil {
                    Button(action: {
                        // Save unread status before closing thread
                        if let threadId = selectedThreadId {
                            threadUnreadStatus[threadId] = false
                            saveUnreadStatusToCache()
                            // Update cached user threads to reflect unread status change (removes orange highlight)
                            updateCachedUserThreads()
                        }
                        withAnimation {
                            selectedThreadId = nil
                        }
                    }) {
                        HStack {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .foregroundColor(.twillyCyan)
                    }
                }
                
                Text(selectedThreadId != nil ? "Private Thread" : "Comments")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Spacer()
                
                Button(action: {
                    // If viewing a private thread, mark it as read before closing
                    if let threadId = selectedThreadId {
                        // Mark thread as read when closing comments
                        markThreadAsRead(threadId: threadId)
                        threadUnreadStatus[threadId] = false
                        saveUnreadStatusToCache()
                        updateCachedUserThreads()
                        // Clear selected thread
                        selectedThreadId = nil
                    }
                    
                    withAnimation {
                        isExpanded = false
                    }
                    // Reload comments to get latest count when closing
                    loadComments()
                    // Notify ContentCard to refresh comment count
                    NotificationCenter.default.post(
                        name: NSNotification.Name("CommentsViewed"),
                        object: nil,
                        userInfo: ["videoId": content.SK]
                    )
                }) {
                    Image(systemName: "chevron.down")
                        .foregroundColor(.white)
                }
            }
            .padding()
            .background(Color.black.opacity(0.7))
        }
    }
    
    private var threadSelector: some View {
        Group {
            if selectedThreadId == nil && !publicComments.isEmpty {
                let userThreads = filteredUserThreads
                
                if !userThreads.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(userThreads) { threadInfo in
                                threadButton(for: threadInfo)
                            }
                        }
                        .padding(.horizontal, 12)
                    }
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.3))
                }
            }
        }
    }
    
    // Thread info for unique username display
    // ThreadInfo is now in MessagingService - keeping for reference during migration
    private struct ThreadInfo_OLD: Identifiable {
        var id: String // threadId (comment.id) - mutable to allow updating to more recent thread
        let username: String
        var hasUnread: Bool // Make mutable so we can update unread status without rebuilding
    }
    
    // Helper: Find the threadId (parentCommentId) that has private messages for a given comment ID
    // Backend groups messages by parentCommentId, so we need to find the thread key that contains messages
    private func findThreadIdForComment(_ commentId: String) -> String? {
        // Check if this comment ID is directly a thread key with messages
        if privateThreads[commentId] != nil && !(privateThreads[commentId]?.isEmpty ?? true) {
            return commentId
        }
        
        // Check if any thread has messages with this commentId as parentCommentId
        // This handles the case where the comment is the parent that started the thread
        for (threadId, messages) in privateThreads {
            if !messages.isEmpty {
                // Check if any message has this commentId as parentCommentId
                if messages.contains(where: { $0.parentCommentId == commentId }) {
                    return threadId
                }
                // Also check if the threadId itself matches (the parent comment)
                if threadId == commentId {
                    return threadId
                }
            }
        }
        
        return nil
    }
    
    // Update cached user threads incrementally - only add new usernames, update existing ones
    // CRITICAL LOGIC FOR 2-WAY CONVERSATIONS:
    // - Show ALL participants in private threads (both owner and non-owner see the same participants)
    // - Also show usernames from public comments if they have associated private threads
    // - This ensures both parties in a conversation see each other, regardless of who owns the post
    // Usernames are ordered by most recent comment (newest first)
    // DEPRECATED: Use MessagingService.updateCachedUserThreads instead
    // This function is kept for backward compatibility but should delegate to MessagingService
    private func updateCachedUserThreads() {
        // Delegate to MessagingService for consistency
        messagingService.updateCachedUserThreads(for: content.SK)
        cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
    }
    
    // OLD updateCachedUserThreads - keeping for reference but delegating to MessagingService
    private func updateCachedUserThreads_OLD() {
        guard let currentUsername = authService.username else {
            print("⚠️ [FloatingCommentView] updateCachedUserThreads: No current username")
            return
        }
        
        print("   - currentUsername: \(currentUsername)")
        print("   - isOwner: \(isOwner)")
        print("   - publicComments count: \(publicComments.count)")
        print("   - publicComments usernames: \(publicComments.map { "\($0.username) (id: \($0.id))" })")
        print("   - current cachedUserThreads count: \(cachedUserThreads.count)")
        print("   - current cachedUserThreads: \(cachedUserThreads.map { "\($0.username) (id: \($0.id))" })")
        print("   - privateThreads count: \(privateThreads.count)")
        
        // Build a map of existing threads by username for quick lookup
        var existingThreadsByUsername: [String: Int] = [:] // username -> index in cachedUserThreads
        for (index, thread) in cachedUserThreads.enumerated() {
            existingThreadsByUsername[thread.username] = index
        }
        
        // Sort public comments by most recent first (newest comment = most recent username to add)
        let sortedComments = publicComments.sorted { $0.createdAt > $1.createdAt }
        print("   - sortedComments count: \(sortedComments.count)")
        
        print("   - Processing \(sortedComments.count) public comments for post owner threads")
        
        var seenUsernames = Set<String>()
        var newThreads: [MessagingService.ThreadInfo] = []
        
        // Process comments in order of most recent first
        for comment in sortedComments {
            let username = comment.username
            
            // SKIP current user's own comments - only show OTHER participants
            if username == currentUsername {
                continue
            }
            
            // UNIFIED LOGIC: Show usernames who have private threads OR made public comments
            // This ensures 2-way conversations work for both post owners and non-owners
            // CRITICAL: Find the threadId that has private messages (parentCommentId), or use comment.id if no private thread yet
            let threadIdForComment = findThreadIdForComment(comment.id) ?? comment.id
            let hasPrivateThread = privateThreads[threadIdForComment] != nil && !(privateThreads[threadIdForComment]?.isEmpty ?? true)
            let hasUnreadForThread = threadUnreadStatus[threadIdForComment] == true
            
            // Show username if: has private thread OR has unread status OR is post owner (can start private chat)
            let shouldShow = hasPrivateThread || hasUnreadForThread || isOwner
            
            if shouldShow {
                
                if let existingIndex = existingThreadsByUsername[username] {
                    // Update existing thread's unread status and potentially update to thread with private messages
                    let existingThread = cachedUserThreads[existingIndex]
                    let existingHasPrivateMessages = privateThreads[existingThread.id] != nil && !(privateThreads[existingThread.id]?.isEmpty ?? true)
                    let currentHasPrivateMessages = hasPrivateThread
                    
                    // Prefer thread with private messages, or more recent comment if both have/ don't have messages
                    if currentHasPrivateMessages && !existingHasPrivateMessages {
                        cachedUserThreads[existingIndex].id = threadIdForComment
                    } else if let existingComment = publicComments.first(where: { $0.id == existingThread.id }),
                              comment.createdAt > existingComment.createdAt && !currentHasPrivateMessages && !existingHasPrivateMessages {
                        // Only update to more recent comment if neither has private messages
                        cachedUserThreads[existingIndex].id = threadIdForComment
                    }
                    // Update unread status (in case it changed)
                    cachedUserThreads[existingIndex].hasUnread = hasUnreadForThread
                } else if !seenUsernames.contains(username) {
                    // New username - add it (ordered by most recent comment)
                    newThreads.append(MessagingService.ThreadInfo(
                        id: threadIdForComment,
                        username: username,
                        hasUnread: hasUnreadForThread
                    ))
                    seenUsernames.insert(username)
                }
            }
        }
        
        // CRITICAL: Check ALL private threads for ALL participants (works for BOTH owner and non-owner)
        // This ensures 2-way conversations: both participants see each other regardless of post ownership
        // Server already filters privateThreads to only include threads where viewer is a participant
        // So we should show all participants in those threads
        // This is the SAME logic for both owner and non-owner - unified 2-way conversation model
            
            // CRITICAL FIX: Check threadUnreadStatus FIRST, even if privateThreads is empty
            // This handles the case where unread status is loaded from cache but private threads haven't loaded yet
            var processedThreadIds = Set<String>()
            
        // Process ALL threads (both with and without unread status)
        // Combine threadUnreadStatus keys and privateThreads keys to get all thread IDs
        var allThreadIds = Set<String>()
        allThreadIds.formUnion(threadUnreadStatus.keys)
        allThreadIds.formUnion(privateThreads.keys)
        
        for threadId in allThreadIds {
                let isUnread = threadUnreadStatus[threadId] == true
                // Skip if we've already processed this thread
                if processedThreadIds.contains(threadId) {
                    continue
                }
                
                
                // Check if this thread ID exists in publicComments (valid thread)
                let threadExists = publicComments.contains { $0.id == threadId }
                
                // CRITICAL: Only show thread if it has messages, unread status, OR parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
                let hasMessages = (privateThreads[threadId]?.isEmpty == false)
                let hasUnread = isUnread
                let hasParentComment = threadExists
                
                // Only add/keep thread if it has at least one: messages, unread status, or parent comment
                let shouldShowThread = hasMessages || hasUnread || hasParentComment
                
                if shouldShowThread {
                    processedThreadIds.insert(threadId)
                    
                    // Get thread messages for this threadId
                    let threadMessages = privateThreads[threadId] ?? []
                    
                    // Find all unique usernames who sent messages in this thread (excluding current user)
                    var participantUsernames: [String] = []
                    
                    // First, try to find from private thread messages (if loaded)
                        for message in threadMessages {
                        let messageUsername = message.username.lowercased().trimmingCharacters(in: .whitespaces)
                        let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                        // Only add if not current user and not already added
                        if messageUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == messageUsername }) {
                            participantUsernames.append(message.username) // Use original username (not normalized)
                        }
                    }
                    
                    // CRITICAL: Also check ALL threads for messages that reference this threadId as parentCommentId
                    // This handles cases where messages are keyed under a different threadId but have parentCommentId = threadId
                    if participantUsernames.isEmpty {
                        for (keyThreadId, otherThreadMessages) in privateThreads {
                            for message in otherThreadMessages {
                                // Check if this message has parentCommentId matching our threadId
                                if message.parentCommentId == threadId {
                                    let messageUsername = message.username.lowercased().trimmingCharacters(in: .whitespaces)
                                    let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                                    // Only add if not current user and not already added
                                    if messageUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == messageUsername }) {
                                        participantUsernames.append(message.username)
                                        print("     ✅ Found participant username from cross-thread message: \(message.username) (thread: \(keyThreadId), parent: \(threadId))")
                                    }
                                }
                            }
                        }
                    }
                    
                    // ALWAYS check parent comment - the person who started the thread is a participant
                    if let parentComment = publicComments.first(where: { $0.id == threadId }) {
                        let parentUsername = parentComment.username.lowercased().trimmingCharacters(in: .whitespaces)
                        let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                        // Only add if not current user and not already added
                        if parentUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == parentUsername }) {
                            participantUsernames.append(parentComment.username)
                            print("     ✅ Found participant username from parent comment: \(parentComment.username)")
                        }
                    }
                    
                    // CRITICAL: Also check if POST OWNER is a participant (even if they didn't make a public comment)
                    // This ensures 2-way conversations work - if post owner sent private messages, they should appear
                    if !isOwner {
                        let postOwnerUsername = content.creatorUsername?.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                        let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                        
                        // Check if post owner sent any messages in this thread
                        let postOwnerSentMessage = threadMessages.contains { message in
                            let messageUsername = message.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                            return messageUsername == postOwnerUsername
                        }
                        
                        if postOwnerSentMessage, let postOwnerUsernameOriginal = content.creatorUsername,
                           postOwnerUsername != currentUsernameLower,
                           !participantUsernames.contains(where: { $0.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased() == postOwnerUsername }) {
                            participantUsernames.append(postOwnerUsernameOriginal)
                            print("     ✅ Found post owner as participant: \(postOwnerUsernameOriginal) (sent private message)")
                        }
                    }
                    
                    // Add threads for all participants
                    for username in participantUsernames {
                        print("   - Adding participant to scroll: \(username), threadId: \(threadId), hasUnread: \(isUnread)")
                        
                        // CRITICAL: Use the threadId (parentCommentId) that has private messages
                        // This ensures we show the private conversation, not a general chat message
                        // The threadId is the parentCommentId that started the private thread
                        let displayThreadId = threadId
                    
                    if let existingIndex = existingThreadsByUsername[username] {
                            // CRITICAL: Don't change threadId if it's currently selected
                            let existingThreadId = cachedUserThreads[existingIndex].id
                            let isCurrentlySelected = selectedThreadId == existingThreadId
                            
                            if isCurrentlySelected {
                                // Thread is currently selected - preserve its threadId
                                // Only update unread status
                                cachedUserThreads[existingIndex].hasUnread = isUnread || cachedUserThreads[existingIndex].hasUnread
                                print("     ✅ Preserved selected threadId \(existingThreadId), updated unread status")
                            } else {
                                // Update existing thread - prefer thread with private messages
                        let existingHasUnread = cachedUserThreads[existingIndex].hasUnread
                                // Check if existing thread has private messages, if not, prefer this one
                                let existingThreadHasPrivateMessages = privateThreads[existingThreadId] != nil && !(privateThreads[existingThreadId]?.isEmpty ?? true)
                                let currentThreadHasPrivateMessages = !(privateThreads[threadId]?.isEmpty ?? true)
                                
                                if currentThreadHasPrivateMessages && !existingThreadHasPrivateMessages {
                                    // Prefer thread with private messages
                            cachedUserThreads[existingIndex].id = displayThreadId
                                    cachedUserThreads[existingIndex].hasUnread = isUnread || existingHasUnread
                                    print("     ✅ Updated to thread with private messages")
                                } else if !existingHasUnread {
                                    cachedUserThreads[existingIndex].id = displayThreadId
                                    cachedUserThreads[existingIndex].hasUnread = isUnread
                            print("     ✅ Updated existing thread with unread status")
                        } else {
                            // Prefer thread with unread
                            cachedUserThreads[existingIndex].id = displayThreadId
                                }
                        }
                    } else if !seenUsernames.contains(username) {
                            // Participant with private thread - add it
                            newThreads.append(MessagingService.ThreadInfo(
                            id: displayThreadId,
                            username: username,
                                hasUnread: isUnread
                        ))
                        seenUsernames.insert(username)
                            print("     ✅ Added new thread for participant: \(username) (threadId: \(displayThreadId), hasPrivateMessages: \(!(privateThreads[threadId]?.isEmpty ?? true)))")
                        }
                    }
                }
            }
            
            // Also check privateThreads for messages (in case they're loaded but not in threadUnreadStatus)
            for (threadId, threadMessages) in privateThreads {
                // Skip if already processed
                if processedThreadIds.contains(threadId) {
                    continue
                }
                
                print("   - Checking thread \(threadId) with \(threadMessages.count) messages")
                
                // Check if thread has messages, unread status, or parent comment
            let hasMessages = !threadMessages.isEmpty
            let hasUnread = threadUnreadStatus[threadId] == true
                let hasParentComment = publicComments.contains { $0.id == threadId }
                
            // Only show thread if it has at least one: messages, unread status, or parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
            let shouldShowThread = hasMessages || hasUnread || hasParentComment
                
            if shouldShowThread {
                    processedThreadIds.insert(threadId)
                    
                // Find all unique usernames who sent messages in this thread (excluding current user)
                var participantUsernames: [String] = []
                    
                    // First, try to find from messages
                    for message in threadMessages {
                    let messageUsername = message.username.lowercased().trimmingCharacters(in: .whitespaces)
                    let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                    // Only add if not current user and not already added
                    if messageUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == messageUsername }) {
                        participantUsernames.append(message.username) // Use original username (not normalized)
                        print("     ✅ Found participant username from message: \(message.username)")
                    }
                }
                
                // CRITICAL: Also check ALL threads for messages that reference this threadId as parentCommentId
                // This handles cases where messages are keyed under a different threadId but have parentCommentId = threadId
                if participantUsernames.isEmpty {
                    for (keyThreadId, otherThreadMessages) in privateThreads {
                        for message in otherThreadMessages {
                            // Check if this message has parentCommentId matching our threadId
                            if message.parentCommentId == threadId {
                                let messageUsername = message.username.lowercased().trimmingCharacters(in: .whitespaces)
                                let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                                // Only add if not current user and not already added
                                if messageUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == messageUsername }) {
                                    participantUsernames.append(message.username)
                                    print("     ✅ Found participant username from cross-thread message: \(message.username) (thread: \(keyThreadId), parent: \(threadId))")
                                }
                            }
                        }
                    }
                }
                
                    // ALWAYS check parent comment - the person who started the thread is a participant
                    if let parentComment = publicComments.first(where: { $0.id == threadId }) {
                        let parentUsername = parentComment.username.lowercased().trimmingCharacters(in: .whitespaces)
                        let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                        // Only add if not current user and not already added
                        if parentUsername != currentUsernameLower && !participantUsernames.contains(where: { $0.lowercased().trimmingCharacters(in: .whitespaces) == parentUsername }) {
                            participantUsernames.append(parentComment.username)
                            print("     ✅ Found participant username from parent comment: \(parentComment.username)")
                        }
                    }
                    
                    // CRITICAL: Also check if POST OWNER is a participant (even if they didn't make a public comment)
                    // This ensures 2-way conversations work - if post owner sent private messages, they should appear
                    if !isOwner {
                        let postOwnerUsername = content.creatorUsername?.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                        let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                        
                        // Check if post owner sent any messages in this thread
                        let postOwnerSentMessage = threadMessages.contains { message in
                            let messageUsername = message.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                            return messageUsername == postOwnerUsername
                        }
                        
                        if postOwnerSentMessage, let postOwnerUsernameOriginal = content.creatorUsername,
                           postOwnerUsername != currentUsernameLower,
                           !participantUsernames.contains(where: { $0.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased() == postOwnerUsername }) {
                            participantUsernames.append(postOwnerUsernameOriginal)
                            print("     ✅ Found post owner as participant: \(postOwnerUsernameOriginal) (sent private message)")
                        }
                    }
                    
                    // Add threads for all participants
                    for username in participantUsernames {
                    print("   - Adding participant to scroll: \(username), threadId: \(threadId), hasUnread: \(hasUnread)")
                    
                    // CRITICAL: Use the threadId (parentCommentId) that has private messages
                    // This ensures we show the private conversation, not a general chat message
                    let displayThreadId = threadId
                    
                    if let existingIndex = existingThreadsByUsername[username] {
                        // CRITICAL: Don't change threadId if it's currently selected
                        let existingThreadId = cachedUserThreads[existingIndex].id
                        let isCurrentlySelected = selectedThreadId == existingThreadId
                        
                        if isCurrentlySelected {
                            // Thread is currently selected - preserve its threadId
                            // Only update unread status
                            cachedUserThreads[existingIndex].hasUnread = hasUnread || cachedUserThreads[existingIndex].hasUnread
                            print("     ✅ Preserved selected threadId \(existingThreadId), updated unread status")
                        } else {
                            // Update existing thread - prefer thread with private messages
                        let existingHasUnread = cachedUserThreads[existingIndex].hasUnread
                            // Check if existing thread has private messages, if not, prefer this one
                            let existingThreadHasPrivateMessages = privateThreads[existingThreadId] != nil && !(privateThreads[existingThreadId]?.isEmpty ?? true)
                            let currentThreadHasPrivateMessages = !threadMessages.isEmpty
                            
                            if currentThreadHasPrivateMessages && !existingThreadHasPrivateMessages {
                                // Prefer thread with private messages
                                cachedUserThreads[existingIndex].id = displayThreadId
                                cachedUserThreads[existingIndex].hasUnread = hasUnread || existingHasUnread
                                print("     ✅ Updated to thread with private messages")
                            } else if hasUnread && !existingHasUnread {
                            cachedUserThreads[existingIndex].id = displayThreadId
                            cachedUserThreads[existingIndex].hasUnread = true
                            print("     ✅ Updated existing thread with unread status")
                            } else if hasUnread == existingHasUnread {
                            // Same unread status - prefer thread with unread
                                if hasUnread {
                                cachedUserThreads[existingIndex].id = displayThreadId
                                }
                            }
                        }
                    } else if !seenUsernames.contains(username) {
                        // Participant with private thread - add it
                        newThreads.append(MessagingService.ThreadInfo(
                            id: displayThreadId,
                            username: username,
                            hasUnread: hasUnread
                        ))
                        seenUsernames.insert(username)
                        print("     ✅ Added new thread for participant: \(username) (threadId: \(displayThreadId), hasPrivateMessages: \(!threadMessages.isEmpty))")
                    }
                    }
                }
            }
            
            print("✅ [FloatingCommentView] Finished checking private threads. New threads to add: \(newThreads.count)")
        
        // Remove threads that no longer meet criteria
        cachedUserThreads.removeAll { threadInfo in
            // Remove if it's the current user (shouldn't happen, but safety check)
            if threadInfo.username == currentUsername {
                return true
            }
            
            if isOwner {
                // POST OWNER: Check if thread has messages, unread status, or parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
                let threadMessages = privateThreads[threadInfo.id] ?? []
                let hasMessages = !threadMessages.isEmpty
                let hasUnread = threadUnreadStatus[threadInfo.id] == true
                let hasParentComment = publicComments.contains { $0.id == threadInfo.id }
                
                print("🔍 [FloatingCommentView] POST OWNER removal check for \(threadInfo.username) (id: \(threadInfo.id)): hasMessages=\(hasMessages), hasUnread=\(hasUnread), hasParentComment=\(hasParentComment)")
                
                // Remove if thread has NO messages, NO unread status, and NO parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
                let shouldKeep = hasMessages || hasUnread || hasParentComment
                
                if !shouldKeep {
                    print("   ❌ Removing thread for \(threadInfo.username) - no messages, no unread, no parent comment")
                } else {
                    print("   ✅ Keeping thread for \(threadInfo.username)")
                }
                
                return !shouldKeep // Remove if shouldKeep is false
            } else {
                // NOT POST OWNER: Keep threads from all participants (not just post owner)
                // Check if thread has messages, unread status, or parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
                let threadMessages = privateThreads[threadInfo.id] ?? []
                let hasMessages = !threadMessages.isEmpty
                let hasUnread = threadUnreadStatus[threadInfo.id] == true
                let hasParentComment = publicComments.contains { $0.id == threadInfo.id }
                
                // Also check all private threads to see if any messages have this threadId as parentCommentId
                var hasMessagesInOtherThreads = false
                for (threadId, threadMessages) in privateThreads {
                    // Check if any message in this thread has parentCommentId matching our threadInfo.id
                    if threadMessages.contains(where: { $0.parentCommentId == threadInfo.id }) {
                        hasMessagesInOtherThreads = true
                        break
                    }
                }
                
                // Remove if thread has NO messages, NO unread status, and NO parent comment
                // Threads should NOT exist if they don't meet at least one of these criteria
                let shouldKeep = hasMessages || hasUnread || hasParentComment || hasMessagesInOtherThreads
                
                if !shouldKeep {
                    print("   ❌ Removing thread for \(threadInfo.username) - no messages, no unread, no parent comment")
                } else {
                    print("   ✅ Keeping thread for \(threadInfo.username)")
                }
                
                return !shouldKeep // Remove if shouldKeep is false
            }
        }
        
        // Add new threads to the end (maintains order, no jittery scrolling)
        if !newThreads.isEmpty {
            cachedUserThreads.append(contentsOf: newThreads)
            print("✅ [FloatingCommentView] Added \(newThreads.count) new threads to cachedUserThreads")
        }
        
        // Summary log
        print("📊 [FloatingCommentView] updateCachedUserThreads complete:")
        print("   - isOwner: \(isOwner)")
        print("   - publicComments count: \(publicComments.count)")
        print("   - privateThreads count: \(privateThreads.count)")
        print("   - final cachedUserThreads count: \(cachedUserThreads.count)")
        print("   - cachedUserThreads: \(cachedUserThreads.map { "\($0.username) (id: \($0.id), unread: \($0.hasUnread))" })")
    }
    
    private var filteredUserThreads: [MessagingService.ThreadInfo] {
        guard let currentUsername = authService.username else {
            return cachedUserThreads
        }
        
        // Normalize username for comparison (remove lock symbols, trim, lowercase)
        let normalizeUsername: (String) -> String = { username in
            username.replacingOccurrences(of: "🔒", with: "")
                .trimmingCharacters(in: .whitespaces)
                .lowercased()
        }
        let normalizedCurrentUsername = normalizeUsername(currentUsername)
        
        // Filter out current user's own username (should never appear in scroll bar)
        // Deduplicate by normalized username - keep only one entry per username
        // Prefer entries with unread messages, otherwise keep the first one encountered
        var seenUsernames: [String: MessagingService.ThreadInfo] = [:]
        
        for threadInfo in cachedUserThreads {
            let normalizedUsername = normalizeUsername(threadInfo.username)
            
            // CRITICAL: Skip if this is the current user's username (should never appear)
            if normalizedUsername == normalizedCurrentUsername {
                print("⚠️ [FloatingCommentView] Filtering out current user's own username: \(threadInfo.username)")
                continue
            }
            
            // If we haven't seen this username, add it
            if seenUsernames[normalizedUsername] == nil {
                seenUsernames[normalizedUsername] = threadInfo
            } else {
                // If we've seen it, prefer the one with unread messages
                let existing = seenUsernames[normalizedUsername]!
                if threadInfo.hasUnread && !existing.hasUnread {
                    seenUsernames[normalizedUsername] = threadInfo
                }
            }
        }
        
        // Return deduplicated threads, sorted by unread first, then alphabetically
        return Array(seenUsernames.values).sorted { first, second in
            if first.hasUnread != second.hasUnread {
                return first.hasUnread
            }
            return first.username < second.username
        }
    }
    
    // Helper function to find the best threadId for a username
    // Prefers threadIds that have private messages
    // CRITICAL: Only returns threads where the username is the OTHER participant, not the current user
    private func findBestThreadId(for username: String) -> String? {
        let normalizedUsername = username.lowercased().trimmingCharacters(in: .whitespaces)
        let currentUsername = authService.username ?? ""
        let normalizedCurrentUsername = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
        
        // CRITICAL: Don't return threads for your own username
        if normalizedUsername == normalizedCurrentUsername {
            return nil
        }
        
        // Find all threads for this username (must be OTHER participant, not current user)
        let matchingThreads = cachedUserThreads.filter {
            let threadUsername = $0.username.lowercased().trimmingCharacters(in: .whitespaces)
            return threadUsername == normalizedUsername && threadUsername != normalizedCurrentUsername
        }
        
        // Prefer thread with private messages and unread status
        if let bestThread = matchingThreads.first(where: { thread in
            let hasPrivateMessages = privateThreads[thread.id] != nil && !(privateThreads[thread.id]?.isEmpty ?? true)
            return hasPrivateMessages && thread.hasUnread
        }) {
            return bestThread.id
        }
        
        // Prefer thread with private messages
        if let bestThread = matchingThreads.first(where: { thread in
            let hasPrivateMessages = privateThreads[thread.id] != nil && !(privateThreads[thread.id]?.isEmpty ?? true)
            return hasPrivateMessages
        }) {
            return bestThread.id
        }
        
        // Fall back to any thread for this username (but not current user)
        return matchingThreads.first?.id
    }
    
    private func threadButton(for threadInfo: MessagingService.ThreadInfo) -> some View {
        // Find the best threadId for this username (prefer one with private messages)
        let bestThreadId = findBestThreadId(for: threadInfo.username) ?? threadInfo.id
        let isSelected = selectedThreadId == bestThreadId || selectedThreadId == threadInfo.id
        let hasUnread = threadInfo.hasUnread && !isSelected // Don't show unread color if thread is currently open
        
        return Button(action: {
            print("🔍 [FloatingCommentView] Thread button clicked for username: \(threadInfo.username), original threadId: \(threadInfo.id), best threadId: \(bestThreadId)")
            
            // Use the best threadId (one with private messages if available)
            let threadIdToUse = bestThreadId
            
            // Preserve current thread messages before loading (prevent flash)
            let preservedMessages = privateThreads[threadIdToUse]
            
            withAnimation {
                selectedThreadId = threadIdToUse
            }
            
            // CRITICAL: Mark thread as read IMMEDIATELY when opened (optimistic update)
            // WEBSOCKET WILL CONFIRM - Don't wait for API response
            let key = "\(content.SK)_\(threadIdToUse)"
            threadUnreadStatus[threadIdToUse] = false
            threadUnreadStatus[key] = false // Also update with videoId prefix for consistency
            
            // Update MessagingService unread status immediately
            messagingService.threadUnreadStatus[key] = false
            
            // Mark private_message notification as read (same as private_access_granted)
            markPrivateMessageNotificationAsRead(for: threadIdToUse)
            
            // Update cached user threads to remove orange highlight immediately
            messagingService.updateCachedUserThreads(for: content.SK)
            cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
            
            // Calculate remaining unread count (check all threads for this video)
            // Only dismiss indicator if NO other unread threads remain
            let remainingUnreadCount = threadUnreadStatus.values.filter { $0 }.count
            
            // CRITICAL: Only clear red badge if no unread threads remain
            // If there are other unread threads, keep the badge
            NotificationCenter.default.post(
                name: NSNotification.Name("CommentsViewed"),
                object: nil,
                userInfo: [
                    "videoId": content.SK,
                    "unreadCount": remainingUnreadCount
                ]
            )
            
            print("📊 [FloatingCommentView] Marked thread as read. Remaining unread: \(remainingUnreadCount)")
            
            // Mark as read on server (async) - WebSocket will send unread_count_update to confirm
            markThreadAsRead(threadId: threadIdToUse)
            
            // CRITICAL: Load thread IMMEDIATELY - don't wait for async
            // First check cache, then load from server
            if let cachedThread = messagingService.privateThreads[content.SK]?[threadIdToUse], !cachedThread.isEmpty {
                // Show cached messages immediately for instant display
                privateThreads[threadIdToUse] = cachedThread
                print("⚡ [FloatingCommentView] Instant display: \(cachedThread.count) cached messages for thread \(threadIdToUse)")
            } else {
                // No cache - thread might not be loaded yet, load it NOW
                print("⚠️ [FloatingCommentView] No cached messages for thread \(threadIdToUse), loading from server...")
            }
            
            // CRITICAL: Always load full history from server (same as general chat)
            // Server has the complete conversation history - load it to ensure all messages are available
            Task {
                print("📥 [FloatingCommentView] Loading full thread history from server for thread: \(threadIdToUse)")
                do {
                    try await messagingService.loadMessages(for: content.SK, useCache: false)
                    await MainActor.run {
                        // Load ALL threads from server (server has full history)
                        let messagingThreads = messagingService.privateThreads[content.SK] ?? [:]
                        print("📦 [FloatingCommentView] Server returned \(messagingThreads.count) threads")
                        
                        for (threadId, messages) in messagingThreads {
                            // Always use server data (has full conversation history)
                            privateThreads[threadId] = messages
                            print("   - Thread \(threadId): \(messages.count) messages")
                        }
                        
                        // Ensure selected thread has full history loaded
                        if let serverThread = messagingThreads[threadIdToUse] {
                            privateThreads[threadIdToUse] = serverThread
                            print("✅ [FloatingCommentView] Loaded full history for thread \(threadIdToUse): \(serverThread.count) messages")
                        } else {
                            print("❌ [FloatingCommentView] Thread \(threadIdToUse) not found in server response!")
                            print("   Available thread IDs: \(Array(messagingThreads.keys).joined(separator: ", "))")
                            
                            // CRITICAL: Try to find thread by searching all threads for this username
                            // The threadId might be different from what we expect (server uses parentCommentId)
                            let username = threadInfo.username
                            var foundThread = false
                            
                            for (tid, msgs) in messagingThreads {
                                // Check if any message in this thread is from the target username
                                let hasTargetUsername = msgs.contains { msg in
                                    msg.username.lowercased().trimmingCharacters(in: .whitespaces) == username.lowercased().trimmingCharacters(in: .whitespaces)
                                }
                                
                                // Also check if the threadId matches the parentCommentId of any message
                                let matchesThreadId = msgs.contains { msg in
                                    msg.parentCommentId == threadIdToUse || msg.id == threadIdToUse
                                }
                                
                                if hasTargetUsername || matchesThreadId {
                                    print("   🔍 Found matching thread: \(tid) with \(msgs.count) messages (hasTargetUsername: \(hasTargetUsername), matchesThreadId: \(matchesThreadId))")
                                    privateThreads[tid] = msgs
                                    selectedThreadId = tid
                                    foundThread = true
                                    break
                                }
                            }
                            
                            if !foundThread {
                                print("   ⚠️ No matching thread found - thread might not exist or user doesn't have access")
                                // Still set empty array so UI doesn't break
                                privateThreads[threadIdToUse] = []
                            }
                        }
                    }
                } catch {
                    print("❌ [FloatingCommentView] Error loading thread history: \(error)")
                }
            }
        }) {
            Text(threadInfo.username)
                .font(.caption)
                .fontWeight(hasUnread ? .bold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(hasUnread ? Color.orange : Color.twillyCyan.opacity(0.3))
                .foregroundColor(hasUnread ? .white : .white)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(hasUnread ? Color.orange : Color.clear, lineWidth: 2)
                )
        }
    }
    
    private var commentsList: some View {
        ScrollViewReader { proxy in
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if selectedThreadId != nil {
                    // Show "Start a conversation" message if thread is empty
                    if currentThreadMessages.isEmpty {
                        VStack(spacing: 8) {
                            Text("Start a conversation with \(cachedUserThreads.first(where: { $0.id == selectedThreadId })?.username ?? "this user")")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                                .padding(.vertical, 20)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    
                    // Show private thread - messages are tappable like public comments
                    ForEach(currentThreadMessages) { message in
                        CommentRowView(comment: message, onLike: {
                            toggleLike(for: message)
                        })
                        .onTapGesture {
                            // Same behavior as public comments - tap to view/start thread
                            // For private messages, this allows navigating to the parent thread
                            if let parentId = message.parentCommentId ?? selectedThreadId {
                                withAnimation {
                                    selectedThreadId = parentId
                                }
                                // Reload comments to ensure thread messages are loaded
                                loadComments()
                                // Mark thread as read when opened
                                markThreadAsRead(threadId: parentId)
                                // Update unread status immediately
                                threadUnreadStatus[parentId] = false
                                // Save to cache so it persists when clicking out
                                saveUnreadStatusToCache()
                                // Update cached user threads to reflect unread status change
                                updateCachedUserThreads()
                            }
                        }
                            .id(message.id)
                    }
                        // Bottom anchor for private thread (newest messages at bottom)
                        Color.clear
                            .frame(height: 1)
                            .id("threadBottom")
                } else {
                        // Show public comments with oldest first, newest last (same as private chat)
                    ForEach(publicComments) { comment in
                        CommentRowView(comment: comment, onLike: {
                            toggleLike(for: comment)
                        })
                        .onTapGesture {
                            // CRITICAL: Don't allow clicking your own username - that's not a conversation
                            let username = comment.username
                            let currentUsername = authService.username ?? ""
                            
                            // Normalize both for comparison
                            let normalizedClickedUsername = username.lowercased().trimmingCharacters(in: .whitespaces)
                            let normalizedCurrentUsername = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
                            
                            // If clicking your own username, don't open a thread
                            if normalizedClickedUsername == normalizedCurrentUsername {
                                print("⚠️ [FloatingCommentView] Cannot open thread with yourself: \(username)")
                                return
                            }
                            
                            // CRITICAL: Check if there's an existing thread for this username first
                            // If user has history with this person, use that thread instead of creating new one
                            let bestThreadId = findBestThreadId(for: username) ?? comment.id
                            
                            print("🔍 [FloatingCommentView] Tapped username in general chat: \(username), using threadId: \(bestThreadId) (existing: \(bestThreadId != comment.id))")
                            
                            // Use existing thread if found, otherwise use comment.id (new thread)
                            let threadIdToUse = bestThreadId
                            
                            withAnimation {
                                selectedThreadId = threadIdToUse
                            }
                            
                            // Mark thread as read when opened
                            markThreadAsRead(threadId: threadIdToUse)
                            // Update unread status immediately
                            threadUnreadStatus[threadIdToUse] = false
                            // Save to cache so it persists when clicking out
                            saveUnreadStatusToCache()
                            // Update cached user threads to reflect unread status change (removes orange highlight)
                            updateCachedUserThreads()
                            // Reload comments to ensure thread messages are loaded (only once)
                            loadComments()
                        }
                            .id(comment.id)
                    }
                        // Top anchor for general chat (newest messages at top)
                        Color.clear
                            .frame(height: 1)
                            .id("generalChatTop")
                }
            }
            .padding()
        }
        .frame(maxHeight: 300)
        .background(Color.black.opacity(0.6))
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ScrollCommentsToBottom"))) { notification in
                // Scroll appropriately when comments finish loading
                let threadId = notification.userInfo?["threadId"] as? String
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    withAnimation {
                        if threadId != nil {
                            proxy.scrollTo("threadBottom", anchor: .bottom) // Private thread: newest at bottom
                        } else {
                            proxy.scrollTo("generalChatTop", anchor: .top) // General chat: newest at top
                        }
                    }
                }
            }
            .onChange(of: publicComments.count) { newCount in
                // Scroll to top when new comment is added to general chat (newest at top)
                if selectedThreadId == nil && newCount > previousGeneralCommentCount {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation {
                            proxy.scrollTo("generalChatTop", anchor: .top)
                        }
                    }
                    previousGeneralCommentCount = newCount
                }
            }
            .onChange(of: currentThreadMessages.count) { newCount in
                // Scroll to bottom when new message is added to private thread (newest at bottom)
                if let threadId = selectedThreadId, newCount > (previousThreadMessageCount[threadId] ?? 0) {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation {
                            proxy.scrollTo("threadBottom", anchor: .bottom)
                        }
                    }
                    previousThreadMessageCount[threadId] = newCount
                }
            }
            .onChange(of: selectedThreadId) { newThreadId in
                // When switching between general chat and private thread, scroll appropriately
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    withAnimation {
                        if newThreadId != nil {
                            proxy.scrollTo("threadBottom", anchor: .bottom) // Private thread: newest at bottom
                        } else {
                            proxy.scrollTo("generalChatTop", anchor: .top) // General chat: newest at top
                        }
                    }
                }
                
                // Initialize previous count when thread changes
                if let threadId = newThreadId {
                    previousThreadMessageCount[threadId] = currentThreadMessages.count
                }
            }
            .onChange(of: isExpanded) { expanded in
                // When chat expands, scroll appropriately after a short delay
                if expanded {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        withAnimation {
                            if selectedThreadId != nil {
                                proxy.scrollTo("threadBottom", anchor: .bottom) // Private thread: newest at bottom
                            } else {
                                proxy.scrollTo("generalChatTop", anchor: .top) // General chat: newest at top
                            }
                        }
                    }
                }
            }
            .onAppear {
                // Initialize previous count for general chat
                previousGeneralCommentCount = publicComments.count
                // Initialize previous count for current thread if in thread view
                if let threadId = selectedThreadId {
                    previousThreadMessageCount[threadId] = currentThreadMessages.count
                }
                
                // Always scroll appropriately when chat opens
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    withAnimation {
                        if selectedThreadId != nil {
                            proxy.scrollTo("threadBottom", anchor: .bottom) // Private thread: newest at bottom
                        } else {
                            proxy.scrollTo("generalChatTop", anchor: .top) // General chat: newest at top
                        }
                    }
                }
            }
        }
    }
    
    // Helper function to find the other participant in a thread
    private func findOtherParticipant(in threadId: String) -> String? {
        guard let currentUsername = authService.username else { return nil }
        
        // First, try to find from thread messages
        if let threadMessages = privateThreads[threadId] {
            let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
            for message in threadMessages {
                let messageUsername = message.username.lowercased().trimmingCharacters(in: .whitespaces)
                if messageUsername != currentUsernameLower {
                    return message.username
                }
            }
        }
        
        // If not found, check parent comment (but only if it's not the current user)
        if let parentComment = publicComments.first(where: { $0.id == threadId }) {
            let parentUsernameLower = parentComment.username.lowercased().trimmingCharacters(in: .whitespaces)
            let currentUsernameLower = currentUsername.lowercased().trimmingCharacters(in: .whitespaces)
            if parentUsernameLower != currentUsernameLower {
                return parentComment.username
            }
        }
        
        return nil
    }
    
    private var commentInput: some View {
        VStack(spacing: 4) {
            if let threadId = selectedThreadId,
               let otherUsername = findOtherParticipant(in: threadId) {
                Text("Replying to \(otherUsername)")
                    .font(.caption)
                    .foregroundColor(.twillyCyan.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
            }
            
            HStack {
                TextField(commentInputPlaceholder, text: $newCommentText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .foregroundColor(.white)
                    .padding(8)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(8)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                
                Button(action: {
                    postComment()
                }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(newCommentText.isEmpty ? .gray : .twillyCyan)
                }
                .disabled(newCommentText.isEmpty)
            }
            .padding()
        }
        .background(Color.black.opacity(0.7))
    }
    
    private var commentInputPlaceholder: String {
        if let threadId = selectedThreadId,
           let otherUsername = findOtherParticipant(in: threadId) {
            return "@\(otherUsername) "
        }
        return "Add a comment..."
    }
    
    private var collapsedCommentButton: some View {
        Button(action: {
            withAnimation {
                isExpanded = true
                loadComments()
            }
        }) {
            HStack {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 18))
                Text("\(messagingService.getPublicComments(for: content.SK).count)")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.6))
            .cornerRadius(20)
        }
        .padding(.trailing, 16)
        .padding(.bottom, 80)
    }
    
    var body: some View {
        commentContentView
            .onAppear {
                // LIGHTNING FAST: Use cached data immediately, refresh in background
                // Comments should feel instant - no loading delay
                
                // STEP 1: Show cached data INSTANTLY (if available)
                if let cachedPublic = messagingService.publicComments[content.SK], !cachedPublic.isEmpty {
                    publicComments = cachedPublic
                    print("⚡ [FloatingCommentView] Instant display: \(cachedPublic.count) cached public comments")
                }
                if let cachedThreads = messagingService.privateThreads[content.SK], !cachedThreads.isEmpty {
                    // MERGE (don't overwrite) - preserve existing threads - SAME AS GENERAL CHAT
                    for (threadId, messages) in cachedThreads {
                        if !messages.isEmpty {
                            privateThreads[threadId] = messages
                        }
                    }
                    cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                    print("⚡ [FloatingCommentView] Instant display: \(cachedThreads.count) cached private threads")
                }
                
                // STEP 2: Connect WebSocket IMMEDIATELY for real-time updates
                messagingService.connectWebSocket(for: content.SK)
                
                // Debug: Check WebSocket connection status
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    if websocketService.isConnected {
                        print("✅ [FloatingCommentView] WebSocket is CONNECTED - ready to receive notifications")
                        print("   Connected user email: \(authService.userEmail ?? "N/A")")
                    } else {
                        print("❌ [FloatingCommentView] WebSocket is NOT CONNECTED - notifications won't work!")
                        print("   User email: \(authService.userEmail ?? "N/A")")
                        print("   WebSocket endpoint: \(ChannelService.shared.websocketEndpoint)")
                    }
                }
                
                // STEP 3: Load fresh from server in background (non-blocking, uses cache if available)
                // CRITICAL: Load ALL messages including ALL private threads - same as general chat
                // This ensures full history is available immediately
                Task {
                    do {
                        // Force server fetch to get ALL threads (same as general chat loads all comments)
                        try await messagingService.loadMessages(for: content.SK, useCache: false)
                        
                        // CRITICAL: Always check unread counts when view appears (PRIMARY way indicators are shown)
                        // This works even if the other user wasn't online when the message was posted
                        // WebSocket is just for real-time updates when both users are online
                        if let userEmail = authService.userEmail {
                            try? await messagingService.loadUnreadCounts(for: content.SK)
                        }
                        
                        await MainActor.run {
                            // Sync with fresh data (seamless update)
                            // UNIFIED LOGIC: Private thread = general chat with 2 people
                            // Load ALL threads from server - same as general chat loads all comments
                            publicComments = messagingService.getPublicComments(for: content.SK)
                            
                            // CRITICAL: Load ALL private threads from MessagingService (same as general chat)
                            // This ensures full conversation history is available
                            let messagingThreads = messagingService.privateThreads[content.SK] ?? [:]
                            for (threadId, messages) in messagingThreads {
                                // Always update with server data (server has full history)
                                privateThreads[threadId] = messages
                            }
                            
                            // Update thread unread status from MessagingService
                            for threadId in privateThreads.keys {
                                let key = "\(content.SK)_\(threadId)"
                                threadUnreadStatus[threadId] = messagingService.threadUnreadStatus[key] == true
                            }
                            
                            // CRITICAL: Update cached user threads after loading all threads
                            // This ensures orange highlight appears/disappears correctly
                            messagingService.updateCachedUserThreads(for: content.SK)
                            cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                            
                            // Update red badge with unread count
                            let unreadCount = messagingService.getUnreadCount(for: content.SK)
                            NotificationCenter.default.post(
                                name: NSNotification.Name("CommentsViewed"),
                                object: nil,
                                userInfo: [
                                    "videoId": content.SK,
                                    "unreadCount": unreadCount
                                ]
                            )
                            
                            // Only log if unread count > 0 (for debugging)
                            if unreadCount > 0 {
                                print("🔔 [FloatingCommentView] Found \(unreadCount) unread message(s) in \(messagingThreads.count) thread(s)")
                            }
                        }
                    } catch {
                        print("⚠️ [FloatingCommentView] Background refresh error: \(error)")
                    }
                }
                
                // STEP 4: Check for private_message notifications (same as private_access_granted)
                checkPrivateMessageNotifications()
                
                // STEP 5: Update cached user threads immediately (for username scroll)
                messagingService.updateCachedUserThreads(for: content.SK)
                cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
            }
            .onDisappear {
                // Disconnect and cleanup via MessagingService
                messagingService.disconnect(for: content.SK)
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                // Immediately refresh when app comes to foreground
                loadComments()
                
                // Check for private message notifications (same as inbox notifications)
                checkPrivateMessageNotifications()
                
                // Reconnect WebSocket via MessagingService
                messagingService.connectWebSocket(for: content.SK)
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RefreshInboxCount"))) { _ in
                // Also check when inbox count refreshes (notifications might have changed)
                checkPrivateMessageNotifications()
            }
            // Handle WebSocket comment notifications - reload unread counts when new private message arrives
            .onReceive(websocketService.$commentNotification) { notification in
                guard let notification = notification,
                      normalizeVideoId(notification.videoId) == normalizeVideoId(content.SK),
                      notification.isPrivate,
                      let parentCommentId = notification.parentCommentId else { return }
                
                print("📬 [FloatingCommentView] Received WebSocket private message notification for thread: \(parentCommentId)")
                
                // Check if this thread is currently selected (if so, don't mark as unread)
                let isCurrentlySelected = selectedThreadId == parentCommentId
                
                if !isCurrentlySelected {
                    // Reload unread counts to get latest status from server
                    Task {
                        try? await messagingService.loadUnreadCounts(for: content.SK)
                        await MainActor.run {
                            // Update cached user threads with latest unread status
                            messagingService.updateCachedUserThreads(for: content.SK)
                            cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                            
                            // Sync thread unread status
                            for threadId in privateThreads.keys {
                                let key = "\(content.SK)_\(threadId)"
                                threadUnreadStatus[threadId] = messagingService.threadUnreadStatus[key] == true
                            }
                            
                            print("🔔 [FloatingCommentView] Updated unread status after WebSocket notification")
                        }
                    }
                }
                
                // Reload messages to get the new comment
                loadComments()
            }
            // FASTEST APPROACH: Handle simple indicator notifications (show/clear)
            .onReceive(websocketService.$privateMessageIndicatorNotification) { notification in
                // CRITICAL: Ignore nil notifications (initial state or reset)
                guard let notification = notification else {
                    return
                }
                
                // CRITICAL: Normalize both videoIds for comparison (backend sends normalized, content.SK may have FILE# prefix)
                let normalizedNotificationVideoId = normalizeVideoId(notification.videoId)
                let normalizedContentSK = normalizeVideoId(content.SK)
                
                print("🔔 [FloatingCommentView] Received private_message_indicator: action=\(notification.action), videoId=\(normalizedNotificationVideoId), currentVideoId=\(normalizedContentSK), threadId=\(notification.threadId ?? "none")")
                
                guard normalizedNotificationVideoId == normalizedContentSK else {
                    print("⚠️ [FloatingCommentView] VideoId mismatch, ignoring indicator")
                    return
                }
                
                if notification.action == "show" {
                    print("✅ [FloatingCommentView] Showing indicator for thread: \(notification.threadId ?? "none")")
                    // Show indicator immediately
                    if let threadId = notification.threadId {
                        let key = "\(content.SK)_\(threadId)"
                        threadUnreadStatus[threadId] = true
                        messagingService.threadUnreadStatus[key] = true
                    }
                    
                    // Update cached user threads to show orange highlight
                    messagingService.updateCachedUserThreads(for: content.SK)
                    cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                    
                    // Show red badge
                    NotificationCenter.default.post(
                        name: NSNotification.Name("CommentsViewed"),
                        object: nil,
                        userInfo: [
                            "videoId": content.SK,
                            "unreadCount": 1
                        ]
                    )
                    
                } else if notification.action == "clear" {
                    // Clear indicator immediately
                    if let threadId = notification.threadId {
                        let key = "\(content.SK)_\(threadId)"
                        threadUnreadStatus[threadId] = false
                        messagingService.threadUnreadStatus[key] = false
                    }
                    
                    // Update cached user threads to remove orange highlight
                    messagingService.updateCachedUserThreads(for: content.SK)
                    cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                    
                    // Check if all threads are read
                    let hasAnyUnread = threadUnreadStatus.values.contains(true)
                    if !hasAnyUnread {
                        // Clear red badge
                        NotificationCenter.default.post(
                            name: NSNotification.Name("CommentsViewed"),
                            object: nil,
                            userInfo: [
                                "videoId": content.SK,
                                "unreadCount": 0
                            ]
                        )
                    }
                    
                }
            }
            // Handle WebSocket unread count updates - update indicators immediately
            .onReceive(websocketService.$unreadCountUpdateNotification) { notification in
                guard let notification = notification else {
                    return
                }
                
                guard normalizeVideoId(notification.videoId) == normalizeVideoId(content.SK) else {
                    return
                }
                
                // Update MessagingService unreadCounts (for ContentCard badge)
                messagingService.unreadCounts[content.SK] = notification.totalUnread
                
                // Update thread unread status from notification
                for (threadId, count) in notification.threadUnreadCounts {
                    let key = "\(content.SK)_\(threadId)"
                    let hasUnread = count > 0
                    threadUnreadStatus[threadId] = hasUnread
                    messagingService.threadUnreadStatus[key] = hasUnread
                }
                
                // Update cached user threads to show/hide orange highlights
                messagingService.updateCachedUserThreads(for: content.SK)
                cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                
                // CRITICAL: Notify ContentCard to update red badge indicator
                NotificationCenter.default.post(
                    name: NSNotification.Name("CommentsViewed"),
                    object: nil,
                    userInfo: [
                        "videoId": content.SK,
                        "unreadCount": notification.totalUnread
                    ]
                )
                
                print("🔔 [FloatingCommentView] Updated orange highlights and red badge from unread count update")
            }
            // WebSocket updates are handled by MessagingService
            // When MessagingService receives WebSocket notifications, it updates its state
            // and FloatingCommentView syncs via loadComments() which is called automatically
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("SelectCommentThreadByUsername"))) { notification in
                // Handle notification to select a comment thread by username
                if let username = notification.userInfo?["username"] as? String {
                    print("📬 [FloatingCommentView] Received SelectCommentThreadByUsername for: \(username)")
                    print("   - Current cachedUserThreads count: \(cachedUserThreads.count)")
                    print("   - Current cachedUserThreads usernames: \(cachedUserThreads.map { $0.username })")
                    
                    // Normalize username for comparison (lowercase, trim)
                    let normalizedUsername = username.lowercased().trimmingCharacters(in: .whitespaces)
                    
                    // First, ensure comments are loaded and cachedUserThreads are updated
                    Task {
                        // Load comments (this is synchronous but triggers async Task internally)
                        loadComments()
                        
                        // Wait for comments to load and updateCachedUserThreads to complete
                        // The loadComments() function uses a Task internally, so we need to wait
                        try? await Task.sleep(nanoseconds: 800_000_000) // 0.8 seconds to ensure load completes
                        
                        await MainActor.run {
                            // Find the thread ID for this username (case-insensitive comparison)
                            // Prefer threads with private messages and unread status
                            let matchingThreads = cachedUserThreads.filter { 
                                $0.username.lowercased().trimmingCharacters(in: .whitespaces) == normalizedUsername 
                            }
                            
                            // Find the best thread: prefer one with private messages and unread status
                            let bestThread = matchingThreads.first { thread in
                                let hasPrivateMessages = privateThreads[thread.id] != nil && !(privateThreads[thread.id]?.isEmpty ?? true)
                                return hasPrivateMessages && thread.hasUnread
                            } ?? matchingThreads.first { thread in
                                let hasPrivateMessages = privateThreads[thread.id] != nil && !(privateThreads[thread.id]?.isEmpty ?? true)
                                return hasPrivateMessages
                            } ?? matchingThreads.first
                            
                            if let matchingThread = bestThread {
                                print("✅ [FloatingCommentView] Found matching thread for username: \(username) -> \(matchingThread.username), threadId: \(matchingThread.id), hasUnread: \(matchingThread.hasUnread)")
                                
                                // Ensure comments section is expanded first
                                if !isExpanded {
                                    withAnimation {
                                        isExpanded = true
                                    }
                                }
                                
                                // Select this thread (preserve unread status - don't mark as read yet)
                                withAnimation {
                                    selectedThreadId = matchingThread.id
                                }
                                
                                // DON'T mark as read immediately - let the user view it first
                                // The thread will be marked as read when they actually view it or when they click the thread button
                                
                                // Reload comments to ensure thread messages are loaded
                                loadComments()
                                
                                print("✅ [FloatingCommentView] Selected thread for username: \(username), threadId: \(matchingThread.id), preserving unread status: \(matchingThread.hasUnread)")
                            } else {
                                print("⚠️ [FloatingCommentView] Could not find thread for username: '\(username)' (normalized: '\(normalizedUsername)')")
                                print("   - Available usernames in cachedUserThreads: \(cachedUserThreads.map { "'\($0.username)' (normalized: '\($0.username.lowercased().trimmingCharacters(in: .whitespaces))')" })")
                                
                                // Still expand comments section so user can see all threads
                                if !isExpanded {
                                    withAnimation {
                                        isExpanded = true
                                    }
                                }
                                
                                // Try to find by searching in publicComments directly
                                if let matchingComment = publicComments.first(where: { 
                                    $0.username.lowercased().trimmingCharacters(in: .whitespaces) == normalizedUsername 
                                }) {
                                    print("✅ [FloatingCommentView] Found comment directly, creating thread selection: \(matchingComment.id)")
                                    
                                    // Create a temporary thread entry if not in cachedUserThreads
                                    let tempThread = MessagingService.ThreadInfo(
                                        id: matchingComment.id,
                                        username: matchingComment.username,
                                        hasUnread: threadUnreadStatus[matchingComment.id] == true
                                    )
                                    
                                    // Add to cachedUserThreads if not already there
                                    if !cachedUserThreads.contains(where: { $0.id == matchingComment.id }) {
                                        cachedUserThreads.append(tempThread)
                                    }
                                    
                                    withAnimation {
                                        selectedThreadId = matchingComment.id
                                    }
                                    
                                    markThreadAsRead(threadId: matchingComment.id)
                                    threadUnreadStatus[matchingComment.id] = false
                                    saveUnreadStatusToCache()
                                    updateCachedUserThreads()
                                    
                                    loadComments()
                                } else {
                                    print("❌ [FloatingCommentView] Could not find comment for username: '\(username)' in publicComments either")
                                    print("   - Available usernames in publicComments: \(publicComments.map { "'\($0.username)' (normalized: '\($0.username.lowercased().trimmingCharacters(in: .whitespaces))')" })")
                                }
                            }
                        }
                    }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NewCommentPosted"))) { notification in
                // Immediately refresh when a new comment is posted (for general chat only)
                // Private thread messages don't post this notification to prevent flip
                if let videoId = notification.userInfo?["videoId"] as? String,
                   videoId == content.SK,
                   let isPrivate = notification.userInfo?["isPrivate"] as? Bool,
                   !isPrivate {
                    // Only reload for general chat comments (not private thread replies)
                    // Small delay to ensure server has processed the comment
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        loadComments()
                    }
                }
            }
    }
    
    // MARK: - Notification Functions
    
    // Mark private_message notification as read when thread is opened
    private func markPrivateMessageNotificationAsRead(for threadId: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                // Get all notifications to find the one for this thread
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                let allNotifications = response.notifications ?? []
                
                // Find unread private_message notification for this video/thread
                if let notification = allNotifications.first(where: { notif in
                    guard notif.type == "private_message" && !notif.isRead else { return false }
                    if let metadata = notif.metadata,
                       let notifVideoId = metadata["videoId"] as? String,
                       let notifThreadId = metadata["threadId"] as? String {
                        return normalizeVideoId(notifVideoId) == normalizeVideoId(content.SK) && notifThreadId == threadId
                    }
                    return false
                }) {
                    // Mark as read
                    _ = try await ChannelService.shared.markNotificationRead(userEmail: userEmail, notificationId: notification.id)
                    print("✅ [FloatingCommentView] Marked private_message notification as read for thread: \(threadId)")
                }
            } catch {
                print("⚠️ [FloatingCommentView] Error marking private_message notification as read: \(error)")
            }
        }
    }
    
    // Check for private_message notifications (same pattern as private_access_granted)
    private func checkPrivateMessageNotifications() {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                await MainActor.run {
                    let allNotifications = response.notifications ?? []
                    
                    // Find unread private_message notifications for this video
                    let unreadPrivateMessages = allNotifications.filter { notification in
                        guard notification.type == "private_message" && !notification.isRead else { return false }
                        // Check if this notification is for the current video
                        if let metadata = notification.metadata,
                           let notifVideoId = metadata["videoId"] as? String {
                            return normalizeVideoId(notifVideoId) == normalizeVideoId(content.SK)
                        }
                        return false
                    }
                    
                    if unreadPrivateMessages.count > 0 {
                        print("🔔 [FloatingCommentView] Found \(unreadPrivateMessages.count) unread private message notification(s)")
                        
                        // Update indicators for each unread notification
                        for notification in unreadPrivateMessages {
                            if let metadata = notification.metadata,
                               let threadId = metadata["threadId"] as? String {
                                // Mark thread as unread in BOTH places (local and MessagingService)
                                let key = "\(content.SK)_\(threadId)"
                                threadUnreadStatus[threadId] = true
                                threadUnreadStatus[key] = true // Also set with videoId prefix
                                messagingService.threadUnreadStatus[key] = true
                                messagingService.threadUnreadStatus[threadId] = true // Also set without prefix for compatibility
                                
                                print("   ✅ Marked thread \(threadId) as unread (key: \(key))")
                            }
                        }
                        
                        // CRITICAL: Update cached user threads to show orange highlights
                        // This must be called AFTER threadUnreadStatus is updated
                        messagingService.updateCachedUserThreads(for: content.SK)
                        cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                        
                        // Verify the update worked
                        let threadsWithUnread = cachedUserThreads.filter { $0.hasUnread }
                        print("   📊 Updated cached threads: \(threadsWithUnread.count) threads with orange highlight")
                        
                        // Show red badge
                        NotificationCenter.default.post(
                            name: NSNotification.Name("CommentsViewed"),
                            object: nil,
                            userInfo: [
                                "videoId": content.SK,
                                "unreadCount": unreadPrivateMessages.count
                            ]
                        )
                        
                        print("✅ [FloatingCommentView] Orange highlights and red badge updated from notifications")
                    } else {
                        print("ℹ️ [FloatingCommentView] No unread private message notifications found")
                    }
                }
            } catch {
                print("❌ [FloatingCommentView] Error checking private message notifications: \(error)")
            }
        }
    }
    
    // MARK: - Persistence Functions
    
    private func commentsCacheKey(for videoId: String) -> String {
        guard let userEmail = authService.userEmail else {
            return "comments_\(videoId)"
        }
        return "comments_\(videoId)_\(userEmail)"
    }
    
    private func likesCacheKey(for videoId: String) -> String {
        guard let userEmail = authService.userEmail else {
            return "commentLikes_\(videoId)"
        }
        return "commentLikes_\(videoId)_\(userEmail)"
    }
    
    private func unreadStatusCacheKey(for videoId: String) -> String {
        guard let userEmail = authService.userEmail else {
            return "threadUnreadStatus_\(videoId)"
        }
        return "threadUnreadStatus_\(videoId)_\(userEmail)"
    }
    
    // Save unread status to UserDefaults
    private func saveUnreadStatusToCache() {
        let videoId = content.SK
        let key = unreadStatusCacheKey(for: videoId)
        
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(threadUnreadStatus)
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
            print("💾 [FloatingCommentView] Saved unread status for \(threadUnreadStatus.count) threads to cache")
        } catch {
            print("❌ [FloatingCommentView] Error saving unread status to cache: \(error)")
        }
    }
    
    // Load unread status from UserDefaults
    // NOTE: DO NOT USE CACHE - always fetch fresh from server to avoid stale data
    // Cache can be out of sync with server, causing red badge but no orange name
    private func loadUnreadStatusFromCache() {
        // DISABLED: Don't load from cache - always fetch fresh from server
        // This prevents stale data where red badge shows but orange name doesn't
        // The server is the source of truth for unread status
        print("⚠️ [FloatingCommentView] Skipping cache load - will fetch fresh unread status from server")
    }
    
    // Save comments to UserDefaults
    private func saveCommentsToCache() {
        let videoId = content.SK
        let key = commentsCacheKey(for: videoId)
        
        do {
            // Create a cache structure that includes both public comments and private threads
            struct CachedComments: Codable {
                let publicComments: [Comment]
                let privateThreads: [String: [Comment]]
                let timestamp: Date
            }
            
            // MessagingService handles caching - this function is deprecated
            // Keeping stub for compatibility but MessagingService is source of truth
            let publicCommentsList = messagingService.getPublicComments(for: content.SK)
            let threadsDict = messagingService.privateThreads[content.SK] ?? [:]
            
            let cached = CachedComments(
                publicComments: publicCommentsList,
                privateThreads: threadsDict,
                timestamp: Date()
            )
            
            let encoder = JSONEncoder()
            let data = try encoder.encode(cached)
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
            print("💾 [FloatingCommentView] Saved \(publicCommentsList.count) public comments and \(threadsDict.count) private threads to cache (MessagingService handles this)")
        } catch {
            print("❌ [FloatingCommentView] Error saving comments to cache: \(error)")
        }
    }
    
    // Clear all comment caches - SERVER IS SOURCE OF TRUTH
    private func clearCommentsCache() {
        let videoId = content.SK
        let key = commentsCacheKey(for: videoId)
        UserDefaults.standard.removeObject(forKey: key)
        
        // Also clear likes cache for this video
        let likesKey = likesCacheKey(for: videoId)
        UserDefaults.standard.removeObject(forKey: likesKey)
        
        print("🗑️ [FloatingCommentView] Cleared comment cache for video: \(videoId)")
    }
    
    // Clear all unread status caches - SERVER IS SOURCE OF TRUTH
    private func clearUnreadStatusCache() {
        let videoId = content.SK
        let key = unreadStatusCacheKey(for: videoId)
        UserDefaults.standard.removeObject(forKey: key)
        
        print("🗑️ [FloatingCommentView] Cleared unread status cache for video: \(videoId)")
    }
    
    // DISABLED: Load comments from UserDefaults cache
    // SERVER IS SOURCE OF TRUTH - Cache is cleared on app start
    // Cache is only used for optimistic updates during active session
    private func loadCommentsFromCache() {
        // DISABLED: Don't load from cache - always fetch fresh from server
        // This ensures no stale data from previous sessions
        print("⚠️ [FloatingCommentView] Cache loading disabled - server is source of truth")
    }
    
    // Save likes to UserDefaults
    private func saveLikesToCache() {
        let videoId = content.SK
        let key = likesCacheKey(for: videoId)
        
        // Create a dictionary of commentId -> LikeData
        struct LikeData: Codable {
            let likeCount: Int
            let isLiked: Bool
        }
        
        var likesDict: [String: LikeData] = [:]
        
        // Save likes from public comments
        for comment in publicComments {
            likesDict[comment.id] = LikeData(likeCount: comment.likeCount, isLiked: comment.isLiked)
        }
        
        // Save likes from private threads - MessagingService handles this
        let threadsDict = messagingService.privateThreads[content.SK] ?? [:]
        for (_, thread) in threadsDict {
            for comment in thread {
                likesDict[comment.id] = LikeData(likeCount: comment.likeCount, isLiked: comment.isLiked)
            }
        }
        
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(likesDict)
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
            print("💾 [FloatingCommentView] Saved likes for \(likesDict.count) comments to cache")
        } catch {
            print("❌ [FloatingCommentView] Error saving likes to cache: \(error)")
        }
    }
    
    // Apply cached likes to comments
    private func applyCachedLikes() {
        let videoId = content.SK
        let key = likesCacheKey(for: videoId)
        
        guard let data = UserDefaults.standard.data(forKey: key) else {
            return
        }
        
        do {
            // Decode the likes dictionary
            struct LikeData: Codable {
                let likeCount: Int
                let isLiked: Bool
            }
            
            let decoder = JSONDecoder()
            if let likesDict = try? decoder.decode([String: LikeData].self, from: data) {
                // MessagingService handles likes - this function is deprecated
                // Server is source of truth for likes, so we don't apply cached likes anymore
                print("⚠️ [FloatingCommentView] applyCachedLikes is deprecated - MessagingService handles likes")
            }
        } catch {
            print("❌ [FloatingCommentView] Error applying cached likes: \(error)")
        }
    }
    
    // NO PERIODIC POLLING - WebSocket provides all real-time updates
    // This function is kept as a fallback only (e.g., on app foreground if WebSocket is disconnected)
    private func refreshUnreadCountsOnly() {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let unreadCountsResponse = try await ChannelService.shared.getUnreadCommentCountsDetailed(
                    videoIds: [content.SK],
                    viewerEmail: userEmail
                )
                
                await MainActor.run {
                    // Parse the response
                    var threadUnreadCounts: [String: Int] = [:]
                    var totalUnreadCount = 0
                    
                    if let videoResponse = unreadCountsResponse[content.SK] {
                        if let intValue = videoResponse as? Int {
                            totalUnreadCount = intValue
                        } else if let dictValue = videoResponse as? [String: Any],
                                  let total = dictValue["total"] as? Int,
                                  let threads = dictValue["threads"] as? [String: Int] {
                            totalUnreadCount = total
                            threadUnreadCounts = threads
                        }
                    }
                    
                    // Update unread status map
                    var unreadStatus: [String: Bool] = [:]
                    for comment in publicComments {
                        let unreadCount = threadUnreadCounts[comment.id] ?? 0
                        unreadStatus[comment.id] = unreadCount > 0
                    }
                    
                    // Also check private threads - if there's an unread count for a thread, mark it as unread
                    // This handles cases where the post owner sent a private message without commenting in general chat
                    for (threadId, _) in privateThreads {
                        let unreadCount = threadUnreadCounts[threadId] ?? 0
                        if unreadCount > 0 {
                            unreadStatus[threadId] = true
                        }
                    }
                    
                    // Update threadUnreadStatus - server is source of truth
                    // Overwrite cached values with server values to prevent stale cache
                    for (threadId, status) in unreadStatus {
                        // Server data always takes precedence - overwrite cache
                        threadUnreadStatus[threadId] = status
                    }
                    
                    // Also clear any cached threads that are no longer in server response (they've been read)
                    // This prevents stale "unread" indicators from cache
                    let serverThreadIds = Set(unreadStatus.keys)
                    for cachedThreadId in threadUnreadStatus.keys {
                        if !serverThreadIds.contains(cachedThreadId) {
                            // Thread not in server response means it's been read - clear it
                            threadUnreadStatus[cachedThreadId] = false
                        }
                    }
                    
                    // Update cached user threads with new unread status
                    updateCachedUserThreads()
                    
                    // Notify ContentCard to refresh unread count badge
                    NotificationCenter.default.post(
                        name: NSNotification.Name("CommentsViewed"),
                        object: nil,
                        userInfo: ["videoId": content.SK]
                    )
                }
            } catch {
                print("❌ [FloatingCommentView] Error refreshing unread counts: \(error)")
            }
        }
    }
    
    // Process comments response (extracted for reuse)
    @MainActor
    private func processCommentsResponse(_ response: ChannelService.CommentsResponse, preservedSelectedThreadMessages: [Comment]?) {
                    // CRITICAL: Server is source of truth for likes
                    // The backend correctly calculates isLiked based on whether userId is in likedBy array
                    // Don't overwrite server data with cache - trust the server response
                    
                    // Separate public comments from private threads
        var newPublicComments = response.comments.filter { $0.isPrivate != true && $0.parentCommentId == nil }
        
        // Backend returns newest first (ScanIndexForward: false), reverse once to get oldest first (newest at bottom)
        // Same approach as private threads - reverse once when storing, not on every access
        let reversedPublicComments = Array(newPublicComments.reversed())
        
        // Debug: Log first and last comment timestamps to verify order
        if !reversedPublicComments.isEmpty {
            let first = reversedPublicComments.first!
            let last = reversedPublicComments.last!
            print("📊 [FloatingCommentView] Public comments - First (oldest): \(first.createdAt), Last (newest): \(last.createdAt), Total: \(reversedPublicComments.count)")
        }
        
        publicComments = reversedPublicComments
        
        // UNIFIED LOGIC: Private thread = general chat with 2 people
        // CRITICAL: Start with existing privateThreads to preserve ALL threads (same as general chat preserves publicComments)
        // Then update with server data (server is source of truth for messages that exist on server)
        // This ensures threads don't disappear when navigating away - same as general chat
        var threads: [String: [Comment]] = privateThreads
        
        // Update with server data - server is source of truth
        let serverThreads = response.threadsByParent
        print("🔄 [FloatingCommentView] Merging threads - existing: \(threads.count), server: \(serverThreads.count)")
        
        // Merge server messages into existing threads - REVERSE ONCE when storing
        // Backend returns newest first, we reverse once to get oldest first (newest at bottom)
        // SAME LOGIC AS GENERAL CHAT - just different ID (threadId vs no ID)
        for (threadId, serverMessages) in serverThreads {
            // Reverse backend order once (newest first -> oldest first) so newest appears at bottom
            // Convert ReversedCollection to Array so we can append
            let reversedServerMessages = Array(serverMessages.reversed())
            let existingMessages = threads[threadId] ?? []
            let serverMessageIds = Set(reversedServerMessages.map { $0.id })
            
            // Create a map of existing messages by ID to preserve like state
            var existingMessagesById: [String: Comment] = [:]
            for msg in existingMessages {
                existingMessagesById[msg.id] = msg
            }
            
            // Preserve optimistic updates (messages not yet on server) - SAME AS GENERAL CHAT
            let optimisticMessages = existingMessages.filter { !serverMessageIds.contains($0.id) }
            
            // Merge server messages with existing like state (preserve optimistic like updates)
            // WebSocket handles real-time updates, but preserve optimistic state during merge
            // WebSocket will update it when the server confirms the like
            var mergedMessages: [Comment] = []
            for serverMsg in reversedServerMessages {
                if let existingMsg = existingMessagesById[serverMsg.id] {
                    // Message exists - preserve optimistic like state (WebSocket will confirm)
                    var mergedMsg = serverMsg
                    mergedMsg.isLiked = existingMsg.isLiked
                    mergedMsg.likeCount = existingMsg.likeCount
                    mergedMessages.append(mergedMsg)
                } else {
                    // New message from server
                    mergedMessages.append(serverMsg)
                }
            }
            
            // Combine: merged server messages (oldest first) + optimistic updates at the end
            // SAME AS GENERAL CHAT - just different ID
            mergedMessages.append(contentsOf: optimisticMessages)
            
            threads[threadId] = mergedMessages
            print("   - Thread \(threadId): \(serverMessages.count) server + \(optimisticMessages.count) optimistic = \(mergedMessages.count) total (reversed once)")
        }
        
        // CRITICAL: Preserve ALL existing threads that aren't in server response (optimistic messages)
        // This ensures messages don't disappear when navigating away - SAME AS GENERAL CHAT
        // General chat preserves all publicComments, private threads should preserve all threads
        for (threadId, existingMessages) in privateThreads {
            // If thread not in server response, preserve it (might be optimistic or server hasn't processed yet)
            if threads[threadId] == nil && !existingMessages.isEmpty {
                threads[threadId] = existingMessages
                print("   - Preserved existing thread \(threadId) with \(existingMessages.count) messages (not in server response)")
            }
        }
        
        // Preserve selected thread if it exists but isn't in server response
        if let selectedId = selectedThreadId,
           let preservedMessages = preservedSelectedThreadMessages,
           threads[selectedId] == nil {
            threads[selectedId] = preservedMessages
            print("   - Preserved selected thread \(selectedId) with \(preservedMessages.count) messages")
        }
        
        // Update privateThreads - preserve ALL threads, update with server data
        // SAME AS GENERAL CHAT - publicComments always preserved, privateThreads should always be preserved
        privateThreads = threads
        print("✅ [FloatingCommentView] After merge - privateThreads keys: \(privateThreads.keys)")
                    
                    // Save to cache after merging
                    saveCommentsToCache()
                    saveLikesToCache()
        
        // CRITICAL: Update cached user threads IMMEDIATELY after loading threads
        // This ensures usernames appear in the scroll and threads are accessible when clicked
        // Don't wait for unread status - update threads first, then update unread status
        updateCachedUserThreads()
                    
                    // Debug: Log thread counts
                    print("📊 [FloatingCommentView] Loaded comments:")
                    print("   - Public comments: \(publicComments.count)")
                    print("   - Private threads: \(threads.count)")
                    for (threadId, messages) in threads {
                        print("   - Thread \(threadId): \(messages.count) messages")
                    }                    
    }
    
    // MARK: - WebSocket & Polling
    // WebSocket and polling are now handled by MessagingService
    
    private func loadComments() {
        guard !isLoading, canViewComments else { return }
        isLoading = true
        
        // CRITICAL: Always sync from MessagingService immediately (even if cache exists)
        // UNIFIED LOGIC: Private thread = general chat with 2 people
        // General chat preserves publicComments, private threads should preserve all threads
        // Don't overwrite - merge to ensure messages don't disappear when navigating away
        publicComments = messagingService.getPublicComments(for: content.SK)
        
        // MERGE with existing privateThreads (don't overwrite) - SAME AS GENERAL CHAT
        // General chat always preserves publicComments, private threads should always preserve all threads
        let messagingThreads = messagingService.privateThreads[content.SK] ?? [:]
        for (threadId, messages) in messagingThreads {
            // Update with MessagingService data, but preserve existing if MessagingService is empty
            if !messages.isEmpty {
                privateThreads[threadId] = messages
            } else if privateThreads[threadId] == nil {
                // Only set to empty if it doesn't exist yet (don't overwrite existing non-empty threads)
                privateThreads[threadId] = []
            }
        }
        // Preserve all existing threads that aren't in MessagingService (optimistic messages)
        // This ensures messages don't disappear when navigating away - SAME AS GENERAL CHAT
        
        cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
        
        // Update thread unread status from cache
        for threadId in privateThreads.keys {
            threadUnreadStatus[threadId] = messagingService.hasUnreadThread(videoId: content.SK, threadId: threadId)
        }
        
        // CRITICAL: Always reload from server to ensure we have latest data (same as general chat)
        // This ensures persistence - server is source of truth
        Task {
            do {
                // Force server fetch to ensure we have latest messages (including newly posted ones)
                try await messagingService.loadMessages(for: content.SK, useCache: false)
                await MainActor.run {
                    // Sync local state with MessagingService after server reload
                    // UNIFIED LOGIC: Private thread = general chat with 2 people
                    // MERGE with existing (don't overwrite) - SAME AS GENERAL CHAT
                    publicComments = messagingService.getPublicComments(for: content.SK)
                    
                    // MERGE with existing privateThreads (don't overwrite) - SAME AS GENERAL CHAT
                    // General chat always preserves publicComments, private threads should always preserve all threads
                    let messagingThreads = messagingService.privateThreads[content.SK] ?? [:]
                    for (threadId, messages) in messagingThreads {
                        // Update with MessagingService data, but preserve existing if MessagingService is empty
                        if !messages.isEmpty {
                            privateThreads[threadId] = messages
                        } else if privateThreads[threadId] == nil {
                            // Only set to empty if it doesn't exist yet (don't overwrite existing non-empty threads)
                            privateThreads[threadId] = []
                        }
                    }
                    // Preserve all existing threads that aren't in MessagingService (optimistic messages)
                    // This ensures messages don't disappear when navigating away - SAME AS GENERAL CHAT
                    
                    cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                    
                    // CRITICAL: If a thread is selected, ensure its messages are loaded
                    if let threadId = selectedThreadId {
                        // Force reload thread messages if empty
                        if privateThreads[threadId]?.isEmpty ?? true {
                            // Thread messages not loaded - trigger reload
                            print("⚠️ [FloatingCommentView] Selected thread \(threadId) has no messages, reloading...")
                            Task {
                                try? await messagingService.loadMessages(for: content.SK, useCache: false)
                                await MainActor.run {
                                    // MERGE (don't overwrite) - preserve existing threads
                                    let messagingThreads = messagingService.privateThreads[content.SK] ?? [:]
                                    for (tid, msgs) in messagingThreads {
                                        if !msgs.isEmpty {
                                            privateThreads[tid] = msgs
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Update thread unread status after server reload
                    for threadId in privateThreads.keys {
                        threadUnreadStatus[threadId] = messagingService.hasUnreadThread(videoId: content.SK, threadId: threadId)
                    }
                    
                    isLoading = false
                }
            } catch {
                print("❌ [FloatingCommentView] Error loading comments: \(error)")
                await MainActor.run {
                    isLoading = false
                }
            }
        }
    }
    
    // OLD loadComments - keeping for reference during migration
    private func loadComments_OLD() {
        guard !isLoading, canViewComments else { return }
        isLoading = true
        
        // Preserve selected thread messages to prevent flash during loading
        let preservedSelectedThreadMessages = selectedThreadId != nil ? privateThreads[selectedThreadId!] : nil
        
        Task {
            do {
                let userId = authService.userId
                let viewerEmail = authService.userEmail
                let response = try await ChannelService.shared.getCommentsWithThreads(videoId: content.SK, userId: userId, viewerEmail: viewerEmail)
                await MainActor.run {
                    processCommentsResponse(response, preservedSelectedThreadMessages: preservedSelectedThreadMessages)                    
                    
                    // CRITICAL: Load unread status from server FIRST, then update cached user threads
                    // This ensures we never use stale cache data - server is always source of truth
                    if let userEmail = authService.userEmail {
                        Task {
                            do {
                                // Use API to get unread counts for threads (with per-thread details)
                                let unreadCountsResponse = try await ChannelService.shared.getUnreadCommentCountsDetailed(
                                    videoIds: [content.SK],
                                    viewerEmail: userEmail
                                )
                                
                                await MainActor.run {
                                    // Parse the response - handle both old format (Int) and new format (dict with total/threads)
                                    var threadUnreadCounts: [String: Int] = [:]
                                    var totalUnreadCount = 0
                                    
                                    if let videoResponse = unreadCountsResponse[content.SK] {
                                        if let intValue = videoResponse as? Int {
                                            // Old format - just total count, no per-thread info
                                            totalUnreadCount = intValue
                                        } else if let dictValue = videoResponse as? [String: Any],
                                                  let total = dictValue["total"] as? Int,
                                                  let threads = dictValue["threads"] as? [String: Int] {
                                            // New format - total and per-thread counts
                                            totalUnreadCount = total
                                            threadUnreadCounts = threads
                                        }
                                    }
                                    
                                    // Build unread status map from per-thread counts - SERVER IS SOURCE OF TRUTH
                                    // Clear existing unread status first to prevent stale data
                                    threadUnreadStatus.removeAll()
                                    
                                    // Set unread status from server response
                                    for comment in publicComments {
                                        let unreadCount = threadUnreadCounts[comment.id] ?? 0
                                        threadUnreadStatus[comment.id] = unreadCount > 0
                                    }
                                    
                                    // Also check all threadIds from privateThreads (in case they're not in publicComments)
                                    for threadId in privateThreads.keys {
                                        if threadUnreadStatus[threadId] == nil {
                                            let unreadCount = threadUnreadCounts[threadId] ?? 0
                                            threadUnreadStatus[threadId] = unreadCount > 0
                                        }
                                    }
                                    
                                    print("✅ [FloatingCommentView] Loaded fresh unread status from server: \(threadUnreadStatus)")
                                    
                                    // Save fresh unread status to cache (server data is source of truth)
                                    saveUnreadStatusToCache()
                                    
                                    // CRITICAL: Update cached user threads AFTER unread status is loaded from server
                                    // This ensures orange highlights match the red badge
                                    updateCachedUserThreads()
                                    
                                    isLoading = false
                                    
                                    // Scroll to bottom after comments load (like Instagram)
                                    NotificationCenter.default.post(
                                        name: NSNotification.Name("ScrollCommentsToBottom"),
                                        object: nil,
                                        userInfo: ["threadId": selectedThreadId as Any]
                                    )
                                }
                            } catch {
                                print("❌ [FloatingCommentView] Error loading unread status: \(error)")
                                await MainActor.run {
                                    // Even if unread status fails, update threads (they'll just have no unread highlights)
                                    updateCachedUserThreads()
                                    isLoading = false
                                }
                            }
                        }
                    } else {
                        // No email - can't load unread status, but still update threads
                        updateCachedUserThreads()
                        isLoading = false
                    }
                    
                    // Notify ContentCard to refresh unread count
                    NotificationCenter.default.post(
                        name: NSNotification.Name("CommentsViewed"),
                        object: nil,
                        userInfo: ["videoId": content.SK]
                    )
                }
            } catch {
                print("❌ [FloatingCommentView] Error loading comments: \(error)")
                await MainActor.run {
                    isLoading = false
                }
            }
        }
    }
    
    private func clearAllComments() {
        guard !isClearing else { return }
        isClearing = true
        
        Task {
            do {
                try await ChannelService.shared.clearAllComments(videoId: content.SK)
                await MainActor.run {
                    // Clear local state
                    publicComments = []
                    privateThreads = [:]
                    threadUnreadStatus = [:]
                    cachedUserThreads = [] // Clear cached user threads
                    selectedThreadId = nil
                    isClearing = false
                    
                    // Clear cache
                    let commentsKey = commentsCacheKey(for: content.SK)
                    let likesKey = likesCacheKey(for: content.SK)
                    let unreadStatusKey = unreadStatusCacheKey(for: content.SK)
                    UserDefaults.standard.removeObject(forKey: commentsKey)
                    UserDefaults.standard.removeObject(forKey: likesKey)
                    UserDefaults.standard.removeObject(forKey: unreadStatusKey)
                    UserDefaults.standard.synchronize()
                    print("🗑️ [FloatingCommentView] Cleared comments, likes, and unread status cache")
                    
                    // Reload comments (will be empty now)
                    loadComments()
                    
                    // Notify ContentCard to refresh
                    NotificationCenter.default.post(
                        name: NSNotification.Name("CommentsViewed"),
                        object: nil,
                        userInfo: ["videoId": content.SK]
                    )
                }
            } catch {
                print("❌ [FloatingCommentView] Error clearing comments: \(error)")
                await MainActor.run {
                    isClearing = false
                }
            }
        }
    }
    
    private func postComment() {
        guard !newCommentText.isEmpty, !isPosting,
              let username = authService.username else { return }
        
        let isPrivatePost = selectedThreadId != nil
        
        isPosting = true
        let commentText = newCommentText
        
        // CRITICAL: Clear input IMMEDIATELY (synchronous) - instant feedback
        newCommentText = ""
        
        // CRITICAL: Create optimistic comment IMMEDIATELY on main thread (before async call)
        // This ensures the comment appears instantly with zero delay
        let optimisticComment = Comment(
            id: "temp_\(Date().timeIntervalSince1970)",
            videoId: content.SK,
            userId: authService.userId ?? "",
            username: username,
            text: commentText,
            createdAt: Date(),
            likeCount: 0,
            isLiked: false,
            isPrivate: selectedThreadId != nil,
            parentCommentId: selectedThreadId,
            visibleTo: nil,
            mentionedUsername: nil
        )
        
        // Add optimistic comment IMMEDIATELY (synchronous, no await)
        if let threadId = selectedThreadId {
            if privateThreads[threadId] == nil {
                privateThreads[threadId] = []
            }
            privateThreads[threadId]?.append(optimisticComment)
        } else {
            publicComments.append(optimisticComment)
        }
        
        // Update cached user threads immediately
        messagingService.updateCachedUserThreads(for: content.SK)
        cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
        
        Task {
            do {
                // Post to server (optimistic comment already shown)
                let comment = try await messagingService.postMessage(
                    videoId: content.SK,
                    text: commentText,
                    threadId: selectedThreadId,
                    username: username
                )
                
                // Replace optimistic with real comment (silent replacement)
                await MainActor.run {
                    if let threadId = selectedThreadId {
                        if let index = privateThreads[threadId]?.firstIndex(where: { $0.id == optimisticComment.id }) {
                            privateThreads[threadId]?[index] = comment
                        }
                    } else {
                        if let index = publicComments.firstIndex(where: { $0.id == optimisticComment.id }) {
                            publicComments[index] = comment
                        }
                    }
                    
                    // Sync from MessagingService (simple, minimal updates)
                    publicComments = messagingService.getPublicComments(for: content.SK)
                    
                    if let messagingThreads = messagingService.privateThreads[content.SK] {
                        for (threadId, messages) in messagingThreads {
                            privateThreads[threadId] = messages
                        }
                    }
                    
                    cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                    isPosting = false
                    
                    // Scroll to bottom
                    NotificationCenter.default.post(
                        name: NSNotification.Name("ScrollCommentsToBottom"),
                        object: nil,
                        userInfo: ["threadId": selectedThreadId as Any]
                    )
                }
                
                // For private threads: Update unread counts after posting
                // CRITICAL: This is the PRIMARY way indicators are shown - works even if recipient isn't online
                // WebSocket is just for real-time updates when both users are online
                if selectedThreadId != nil {
                    Task.detached {
                        // Wait a bit for backend to process the message and mark it as unread
                        try? await Task.sleep(nanoseconds: 1000_000_000) // 1.0s delay
                        
                        // Check unread counts - this will show the indicator for the OTHER user when they open the video
                        try? await messagingService.loadUnreadCounts(for: content.SK)
                        await MainActor.run {
                            messagingService.updateCachedUserThreads(for: content.SK)
                            cachedUserThreads = messagingService.getCachedUserThreads(for: content.SK)
                            
                            // Update thread unread status for orange highlights
                            for threadId in privateThreads.keys {
                                let key = "\(content.SK)_\(threadId)"
                                threadUnreadStatus[threadId] = messagingService.threadUnreadStatus[key] == true
                            }
                            
                            // Update red badge
                            let unreadCount = messagingService.getUnreadCount(for: content.SK)
                            NotificationCenter.default.post(
                                name: NSNotification.Name("CommentsViewed"),
                                object: nil,
                                userInfo: [
                                    "videoId": content.SK,
                                    "unreadCount": unreadCount
                                ]
                            )
                            print("✅ [FloatingCommentView] Updated unread counts after posting: \(unreadCount) unread")
                        }
                    }
                }
            } catch {
                print("❌ [FloatingCommentView] Error posting comment: \(error)")
                await MainActor.run {
                    newCommentText = commentText // Restore text on error
                    isPosting = false
                }
            }
        }
    }
    
    private func toggleLike(for comment: Comment) {
        Task {
            do {
                // Optimistic update - immediate UI feedback
                await MainActor.run {
                    let newIsLiked = !comment.isLiked
                    
                    // Update public comments
                    if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
                        publicComments[index].isLiked = newIsLiked
                        publicComments[index].likeCount += newIsLiked ? 1 : -1
                    } else {
                        // Update private threads
                        for (parentId, var thread) in privateThreads {
                            if let index = thread.firstIndex(where: { $0.id == comment.id }) {
                                thread[index].isLiked = newIsLiked
                                thread[index].likeCount += newIsLiked ? 1 : -1
                                privateThreads[parentId] = thread
                                break
                            }
                        }
                    }
                }
                
                // Update on server (WebSocket will confirm)
                // Preserve optimistic messages before syncing
                let preservedPrivateThreads = privateThreads
                
                try await messagingService.likeMessage(commentId: comment.id, videoId: content.SK)
                
                // Sync state after like (WebSocket may have already updated, but ensure consistency)
                // CRITICAL: Merge with preserved optimistic messages to prevent messages from vanishing
                await MainActor.run {
                    // Reload from MessagingService to ensure consistency
                    publicComments = messagingService.getPublicComments(for: content.SK)
                    let serverThreads = messagingService.privateThreads[content.SK] ?? [:]
                    
                    // Merge server threads with preserved optimistic messages
                    var mergedThreads = serverThreads
                    for (threadId, optimisticMessages) in preservedPrivateThreads {
                        if let serverThread = mergedThreads[threadId] {
                            // Merge: Keep optimistic messages that aren't in server response yet
                            let serverMessageIds = Set(serverThread.map { $0.id })
                            let newOptimisticMessages = optimisticMessages.filter { !serverMessageIds.contains($0.id) }
                            if !newOptimisticMessages.isEmpty {
                                mergedThreads[threadId] = serverThread + newOptimisticMessages
                            }
                        } else {
                            // Thread doesn't exist on server yet - keep optimistic messages
                            mergedThreads[threadId] = optimisticMessages
                        }
                    }
                    privateThreads = mergedThreads
                }
            } catch {
                print("❌ [FloatingCommentView] Error toggling like: \(error)")
                // Revert optimistic update on error
                await MainActor.run {
                    if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
                        publicComments[index].isLiked = comment.isLiked
                        publicComments[index].likeCount = comment.likeCount
                    }
                }
            }
        }
    }
    
    // OLD toggleLike - keeping for reference
    private func toggleLike_OLD(for comment: Comment) {
        guard let userId = authService.userId else { return }
        
        let newIsLiked = !comment.isLiked
        
        // Optimistically update UI - check both public comments and private threads
        if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
            publicComments[index].isLiked = newIsLiked
            publicComments[index].likeCount += newIsLiked ? 1 : -1
        } else {
            // Check private threads
            for (parentId, thread) in privateThreads {
                if let index = thread.firstIndex(where: { $0.id == comment.id }) {
                    privateThreads[parentId]?[index].isLiked = newIsLiked
                    privateThreads[parentId]?[index].likeCount += newIsLiked ? 1 : -1
                    break
                }
            }
        }
        
        // Save optimistic update immediately (WebSocket will confirm)
        saveLikesToCache()
        saveCommentsToCache()
        
        // Update via API (WebSocket will broadcast to all clients)
        Task {
            do {
                let result = try await ChannelService.shared.likeComment(
                    videoId: content.SK,
                    commentId: comment.id,
                    userId: userId,
                    isLiked: newIsLiked
                )
                
                // WebSocket will handle the update for all clients (including this one)
                // Only update if WebSocket hasn't already updated it
                // This prevents double-updates and ensures consistency
                await MainActor.run {
                    // WebSocket should have already updated, but verify
                    // If WebSocket update didn't happen, use API response
                    let currentLikeCount: Int
                    if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
                        currentLikeCount = publicComments[index].likeCount
                    } else {
                        var found = false
                        var count = 0
                        for (parentId, thread) in privateThreads {
                            if let index = thread.firstIndex(where: { $0.id == comment.id }) {
                                count = privateThreads[parentId]?[index].likeCount ?? 0
                                found = true
                                break
                            }
                        }
                        currentLikeCount = found ? count : result.likeCount
                    }
                    
                    // Only update if WebSocket hasn't already updated (fallback)
                    if currentLikeCount != result.likeCount {
                    if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
                        publicComments[index].likeCount = result.likeCount
                        publicComments[index].isLiked = result.isLiked
                    } else {
                        for (parentId, thread) in privateThreads {
                            if let index = thread.firstIndex(where: { $0.id == comment.id }) {
                                privateThreads[parentId]?[index].likeCount = result.likeCount
                                privateThreads[parentId]?[index].isLiked = result.isLiked
                                break
                            }
                        }
                    }
                    saveLikesToCache()
                    saveCommentsToCache()
                    }
                }
            } catch {
                print("❌ [FloatingCommentView] Error liking comment: \(error)")
                // Revert optimistic update on error
                await MainActor.run {
                    if let index = publicComments.firstIndex(where: { $0.id == comment.id }) {
                        publicComments[index].isLiked = !newIsLiked
                        publicComments[index].likeCount += newIsLiked ? -1 : 1
                    } else {
                        for (parentId, thread) in privateThreads {
                            if let index = thread.firstIndex(where: { $0.id == comment.id }) {
                                privateThreads[parentId]?[index].isLiked = !newIsLiked
                                privateThreads[parentId]?[index].likeCount += newIsLiked ? -1 : 1
                                break
                            }
                        }
                    }
                    saveLikesToCache()
                    saveCommentsToCache()
                }
            }
        }
    }
    
    private func markThreadAsRead(threadId: String) {
        Task {
            do {
                try await messagingService.markThreadRead(threadId: threadId, videoId: content.SK)
                
                // Notify inbox to refresh
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: NSNotification.Name("RefreshInboxCount"),
                        object: nil
                    )
                }
            } catch {
                print("❌ [FloatingCommentView] Error marking thread as read: \(error)")
            }
        }
    }
}

struct CommentRowView: View {
    let comment: Comment
    let onLike: () -> Void
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // User avatar
            Image(systemName: "person.circle.fill")
                .font(.system(size: 24))
                .foregroundColor(.twillyCyan)
            
            VStack(alignment: .leading, spacing: 4) {
                // Username and text
                VStack(alignment: .leading, spacing: 2) {
                    Text(comment.username)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                    
                    Text(comment.text)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true) // Allow text to wrap normally
                }
                
                // Like button and count
                HStack(spacing: 8) {
                    Button(action: onLike) {
                        HStack(spacing: 4) {
                            Image(systemName: comment.isLiked ? "heart.fill" : "heart")
                                .font(.system(size: 12))
                                .foregroundColor(comment.isLiked ? .red : .white.opacity(0.6))
                            
                            Text("\(comment.likeCount)")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    
                    Text(timeAgoString(from: comment.createdAt))
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 {
            return "\(Int(interval))s"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m"
        } else if interval < 86400 {
            return "\(Int(interval / 3600))h"
        } else {
            return "\(Int(interval / 86400))d"
        }
    }
}

struct VideoPlayerView: View {
    let url: URL
    let content: ChannelContent
    let channelCreatorEmail: String? // For comment visibility checks
    @Environment(\.dismiss) var dismiss
    
    @StateObject private var playerController = VideoPlayerController()
    @State private var dragOffset: CGFloat = 0
    
    var body: some View {
        let _ = print("🖼️ [VideoPlayerView] body computed - isReady: \(playerController.isReady), isLoading: \(playerController.isLoading), hasPlayer: \(playerController.player != nil)")
        
        return ZStack {
            Color.black.ignoresSafeArea()
            
            // Show player as soon as it exists (don't wait for isReady flag)
            if let player = playerController.player {
                AVPlayerViewControllerRepresentable(player: player, thumbnailUrl: content.thumbnailUrl)
                    .ignoresSafeArea()
                    .onAppear {
                        print("✅ [VideoPlayerView] AVPlayerViewController appeared")
                        // Force play in case it didn't auto-play
                        if player.timeControlStatus != .playing {
                            print("▶️ [VideoPlayerView] Player not playing, forcing play")
                            player.play()
                        }
                    }
            } else {
                ZStack {
                    // Show thumbnail while loading/preparing
                    VStack(spacing: 16) {
                        if let thumbnailUrl = content.thumbnailUrl, !thumbnailUrl.isEmpty {
                            AsyncImage(url: URL(string: thumbnailUrl)) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFit()
                                        .frame(maxHeight: 300)
                                        .cornerRadius(12)
                                case .failure(_), .empty:
                                    ZStack {
                                        Color.gray.opacity(0.3)
                                            .frame(width: 200, height: 150)
                                            .cornerRadius(12)
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    }
                                @unknown default:
                                    Color.gray.opacity(0.3)
                                        .frame(width: 200, height: 150)
                                        .cornerRadius(12)
                                }
                            }
                        } else {
                            ZStack {
                                Color.gray.opacity(0.3)
                                    .frame(width: 200, height: 150)
                                    .cornerRadius(12)
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                        }
                        
                        if playerController.errorMessage == nil {
                            VStack(spacing: 12) {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                                    .scaleEffect(1.5)
                                
                                Text("Playing")
                                    .foregroundColor(.white)
                                    .font(.headline)
                                    .fontWeight(.medium)
                            }
                            .padding(.top, 20)
                        }
                    }
                    
                    if let error = playerController.errorMessage {
                        VStack(spacing: 20) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 50))
                                .foregroundStyle(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.twillyTeal,
                                            Color.twillyCyan
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                            
                            Text("Error Loading Video")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            
                            Text(error)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                                .font(.subheadline)
                            
                            Button(action: {
                                playerController.cleanup()
                                dismiss()
                            }) {
                                HStack {
                                    Image(systemName: "xmark.circle.fill")
                                    Text("Close")
                                }
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 12)
                                .background(Color.blue)
                                .cornerRadius(10)
                            }
                            .padding(.top, 20)
                        }
                    }
                }
            }
        }
        .offset(y: dragOffset)
        .opacity(1.0 - min(abs(dragOffset) / 300.0, 0.5))
        .gesture(
            DragGesture()
                .onChanged { value in
                    // Only allow downward swipes
                    if value.translation.height > 0 {
                        dragOffset = value.translation.height
                    }
                }
                .onEnded { value in
                    // If swiped down more than 100 points, dismiss
                    if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                        playerController.cleanup()
                        dismiss()
                    } else {
                        // Spring back to original position
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            dragOffset = 0
                        }
                    }
                }
        )
        .overlay(alignment: .topTrailing) {
            // Close button overlay for full screen
            Button(action: {
                playerController.cleanup()
                dismiss()
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.white.opacity(0.8))
                    .background(Color.black.opacity(0.5))
                    .clipShape(Circle())
            }
            .padding()
        }
        .overlay(alignment: .trailing) {
            // Floating comment section
            FloatingCommentView(content: content, channelCreatorEmail: channelCreatorEmail)
        }
        .onAppear {
            print("👁️ [VideoPlayerView] View appeared with URL: \(url.absoluteString)")
            print("   - URL scheme: \(url.scheme ?? "nil")")
            print("   - URL host: \(url.host ?? "nil")")
            print("   - URL path: \(url.path)")
            playerController.load(url: url)
        }
        .onDisappear {
            playerController.cleanup()
        }
    }
}

class VideoPlayerController: ObservableObject {
    @Published var player: AVPlayer?
    @Published var isLoading = true
    @Published var isReady = false
    @Published var errorMessage: String?
    
    private var playerItem: AVPlayerItem?
    private var statusObserver: NSKeyValueObservation?
    private var errorObserver: NSKeyValueObservation?
    private var timeObserver: Any?
    
    func load(url: URL) {
        print("🎥 [VideoPlayerController] ========== LOADING VIDEO ==========")
        print("   URL: \(url.absoluteString)")
        print("   Scheme: \(url.scheme ?? "nil")")
        print("   Host: \(url.host ?? "nil")")
        print("   Path: \(url.path)")
        
        // Check if playlist was prefetched
        let hlsUrl = url.absoluteString
        // TODO: VideoPrefetchService call - ensure VideoPrefetchService.swift is added to Xcode target
        // Uncomment this line once VideoPrefetchService.swift is added to the target:
        /*
        if VideoPrefetchService.shared.isPlaylistPrefetched(hlsUrl: hlsUrl) {
            print("⚡ [VideoPlayerController] Playlist was prefetched - instant load!")
        } else {
            print("📥 [VideoPlayerController] Playlist not prefetched - loading from network")
        }
        */
        print("📥 [VideoPlayerController] Loading playlist from network")
        
        isLoading = true
        isReady = false
        errorMessage = nil
        
        // Configure audio session for playback
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try AVAudioSession.sharedInstance().setActive(true)
            print("✅ [VideoPlayerController] Audio session configured")
        } catch {
            print("❌ [VideoPlayerController] Error configuring audio session: \(error)")
        }
        
        // Create AVPlayerItem
        let item = AVPlayerItem(url: url)
        playerItem = item
        print("✅ [VideoPlayerController] AVPlayerItem created")
        
        // Observe status changes
        statusObserver = item.observe(\.status, options: [.new, .initial]) { [weak self] item, _ in
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                print("🔄 [VideoPlayerController] Status changed to: \(item.status.rawValue)")
                self.handleStatusChange(item.status, error: item.error)
            }
        }
        
        // Observe playback status
        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { _ in
            print("✅ [VideoPlayerController] Video playback ended")
        }
        
        // Observe time control status
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name.AVPlayerItemTimeJumped,
            object: item,
            queue: .main
        ) { _ in
            print("⏭️ [VideoPlayerController] Time jumped")
        }
        
        // Create player
        let avPlayer = AVPlayer(playerItem: item)
        
        // Configure for mobile playback
        avPlayer.allowsExternalPlayback = true // Allow AirPlay
        avPlayer.usesExternalPlaybackWhileExternalScreenIsActive = true
        
        // Observe player time control status to detect when playback actually starts
        timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC)), queue: .main) { [weak self] time in
            guard let self = self, let player = self.player else { return }
            let status = player.timeControlStatus
            if status == .playing && !self.isReady {
                print("▶️ [VideoPlayerController] Player is playing but not marked ready - fixing state")
                DispatchQueue.main.async {
                    self.isReady = true
                }
            }
        }
        
        player = avPlayer
        print("✅ [VideoPlayerController] AVPlayer created and assigned")
        print("   - Player timeControlStatus: \(avPlayer.timeControlStatus.rawValue)")
        print("   - Player rate: \(avPlayer.rate)")
    }
    
    private func handleStatusChange(_ status: AVPlayerItem.Status, error: Error?) {
        print("🔄 [VideoPlayerController] handleStatusChange called")
        print("   - Status: \(status.rawValue) (\(status == .readyToPlay ? "readyToPlay" : status == .failed ? "failed" : "unknown"))")
        print("   - Error: \(error?.localizedDescription ?? "nil")")
        if let playerItemError = playerItem?.error {
            print("   - PlayerItem error: \(playerItemError.localizedDescription)")
        }
        
        switch status {
        case .readyToPlay:
            print("✅ [VideoPlayerController] Player item ready to play")
            isLoading = false
            
            // Check if player item has tracks
            if let tracks = playerItem?.tracks {
                print("   - Number of tracks: \(tracks.count)")
                for (index, track) in tracks.enumerated() {
                    let mediaType = track.assetTrack?.mediaType.rawValue ?? "unknown"
                    print("   - Track \(index): \(mediaType)")
                }
            }
            
            // Wait a moment to ensure player is fully ready before marking as ready
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                guard let self = self, let player = self.player else {
                    print("❌ [VideoPlayerController] Player is nil when trying to start playback")
                    return
                }
                
                print("▶️ [VideoPlayerController] Starting playback")
                print("   - Player rate before play: \(player.rate)")
                print("   - Player timeControlStatus: \(player.timeControlStatus.rawValue)")
                
                player.play()
                
                // Mark as ready after a short delay to ensure playback started
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                    guard let self = self, let player = self.player else { return }
                    self.isReady = true
                    print("✅ [VideoPlayerController] Player marked as ready")
                    print("   - Player rate after play: \(player.rate)")
                    print("   - Player timeControlStatus: \(player.timeControlStatus.rawValue)")
                    print("   - Current time: \(CMTimeGetSeconds(player.currentTime()))")
                }
            }
        case .failed:
            let errorMsg = error?.localizedDescription ?? playerItem?.error?.localizedDescription ?? "Failed to load video"
            print("❌ [VideoPlayerController] Player item failed: \(errorMsg)")
            if let nsError = error as NSError? {
                print("   - Error domain: \(nsError.domain)")
                print("   - Error code: \(nsError.code)")
                print("   - Error userInfo: \(nsError.userInfo)")
            }
            isLoading = false
            isReady = false
            errorMessage = errorMsg
        case .unknown:
            print("⏳ [VideoPlayerController] Player item status unknown")
        @unknown default:
            print("❓ [VideoPlayerController] Player item status unknown: \(status.rawValue)")
        }
    }
    
    func cleanup() {
        print("🧹 [VideoPlayerController] Cleaning up")
        player?.pause()
        
        // Remove time observer
        if let observer = timeObserver, let player = player {
            player.removeTimeObserver(observer)
            timeObserver = nil
        }
        
        statusObserver?.invalidate()
        errorObserver?.invalidate()
        NotificationCenter.default.removeObserver(self)
        playerItem = nil
        player = nil
        isReady = false
        isLoading = true
        
        // Deactivate audio session
        do {
            try AVAudioSession.sharedInstance().setActive(false)
        } catch {
            print("❌ [VideoPlayerController] Error deactivating audio session: \(error)")
        }
    }
}

// MARK: - AVPlayerViewController Wrapper for Full Screen Support
struct AVPlayerViewControllerRepresentable: UIViewControllerRepresentable {
    let player: AVPlayer
    let thumbnailUrl: String?
    
    func makeUIViewController(context: Context) -> OrientationAwarePlayerViewController {
        print("🔍 [AVPlayerViewControllerRepresentable] ========== makeUIViewController CALLED ==========")
        print("   - Thumbnail URL: \(thumbnailUrl ?? "none")")
        print("   - Current item exists: \(player.currentItem != nil)")
        let controller = OrientationAwarePlayerViewController()
        controller.player = player
        controller.thumbnailUrl = thumbnailUrl
        controller.showsPlaybackControls = true
        print("   - Controller created, thumbnailUrl set: \(controller.thumbnailUrl ?? "nil")")
        
        // CRITICAL: Try to detect orientation IMMEDIATELY if possible
        // This happens before the view is presented, so we can lock orientation early
        if let currentItem = player.currentItem {
            print("🔍 [AVPlayerViewControllerRepresentable] Attempting EARLY detection...")
            // Try to get video track immediately
            let videoTracks = currentItem.tracks.filter { $0.assetTrack?.mediaType == .video }
            if let videoTrack = videoTracks.first?.assetTrack {
                let videoSize = videoTrack.naturalSize
                print("   - Early detection: Natural size: \(videoSize.width) x \(videoSize.height)")
                
                // Try thumbnail first if available (async to avoid blocking main thread)
                var isPortrait = false
                if let thumbnailUrl = thumbnailUrl, let thumbnailURL = URL(string: thumbnailUrl) {
                    // Load thumbnail asynchronously - explicitly detach to ensure non-blocking
                    Task.detached(priority: .userInitiated) {
                        do {
                            let (imageData, _) = try await URLSession.shared.data(from: thumbnailURL)
                            if let image = UIImage(data: imageData) {
                                let thumbnailIsPortrait = image.size.height > image.size.width
                                await MainActor.run {
                                    isPortrait = thumbnailIsPortrait
                                    print("   - Early thumbnail detection (async): \(image.size.width) x \(image.size.height) → Portrait: \(thumbnailIsPortrait)")
                                }
                            }
                        } catch {
                            print("   - Failed to load thumbnail for early detection: \(error.localizedDescription)")
                        }
                    }
                }
                
                // Fallback to video size (immediate)
                if !isPortrait {
                    isPortrait = videoSize.height > videoSize.width
                    print("   - Early video size detection: Portrait: \(isPortrait)")
                }
                
                // Set detection state IMMEDIATELY
                controller.isPortraitVideo = isPortrait
                controller.hasDetectedVideoOrientation = true
                // CRITICAL: Portrait videos MUST use resizeAspectFill for fullscreen
                let targetGravity: AVLayerVideoGravity = isPortrait ? .resizeAspectFill : .resizeAspect
                // Force set it multiple times to ensure it sticks (AVPlayerViewController sometimes overrides)
                controller.videoGravity = targetGravity
                DispatchQueue.main.async {
                    controller.videoGravity = targetGravity
                }
                print("   - ✅ EARLY DETECTION COMPLETE: isPortrait=\(isPortrait)")
                print("   - ✅ Set videoGravity to: \(targetGravity.rawValue) (will verify in viewWillAppear)")
                
                // CRITICAL: Force portrait orientation immediately if portrait
                if isPortrait {
                    print("   - 🔒 EARLY: Forcing portrait orientation lock immediately")
                    // We can't access windowScene yet, but we'll set it in viewDidAppear
                }
            } else {
                print("   - ⚠️ No video track available for early detection")
            }
        } else {
            print("   - ⚠️ No currentItem available for early detection")
        }
        
        // Start with resizeAspectFill for portrait videos (default to fullscreen)
        // This ensures portrait videos go fullscreen immediately, even before detection
        if !controller.hasDetectedVideoOrientation {
            controller.videoGravity = .resizeAspectFill
            print("🔍 [AVPlayerViewControllerRepresentable] Initial videoGravity set to: \(controller.videoGravity.rawValue)")
            print("   - Setting to resizeAspectFill (fullscreen) as default - will be corrected if landscape")
        }
        controller.allowsPictureInPicturePlayback = false
        
        
        print("🔍 [AVPlayerViewControllerRepresentable] Player currentItem exists: \(player.currentItem != nil)")
        if let currentItem = player.currentItem {
            print("🔍 [AVPlayerViewControllerRepresentable] Checking tracks in makeUIViewController...")
            print("   - asset.tracks count: \(currentItem.asset.tracks(withMediaType: .video).count)")
            print("   - currentItem.tracks count: \(currentItem.tracks.count)")
        }
        print("🔍 [AVPlayerViewControllerRepresentable] ========== makeUIViewController COMPLETE ==========")
        
        return controller
    }
    
    func updateUIViewController(_ uiViewController: OrientationAwarePlayerViewController, context: Context) {
        // Update player if needed
        if uiViewController.player != player {
            uiViewController.player = player
        }
    }
}

// MARK: - Orientation-Aware Player View Controller
class OrientationAwarePlayerViewController: AVPlayerViewController, UIGestureRecognizerDelegate {
    var isPortraitVideo = false  // Made internal so it can be set from makeUIViewController
    var hasDetectedVideoOrientation = false  // Made internal so it can be set from makeUIViewController
    var thumbnailUrl: String?
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        // LOCKED TO PORTRAIT - App only supports portrait mode
        return .portrait
    }
    
    override var shouldAutorotate: Bool {
        // Disable rotation - app is locked to portrait
        return false
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        print("🔄 [OrientationAwarePlayerViewController] ========== viewWillTransition CALLED ==========")
        print("   - New size: \(size.width) x \(size.height)")
        print("   - 🔒 BLOCKING transition - App is locked to portrait mode")
        // Always block transitions - app is locked to portrait
        return
    }
    
    
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        // CRITICAL: Always return portrait for portrait videos, even before detection
        // This prevents AVPlayerViewController from auto-rotating
        if hasDetectedVideoOrientation && isPortraitVideo {
            print("🔒 [preferredInterfaceOrientationForPresentation] Portrait video detected → returning: .portrait")
            return .portrait
        }
        // Before detection, default to portrait to prevent unwanted rotation
        print("🔒 [preferredInterfaceOrientationForPresentation] Not detected yet → returning: .portrait (default)")
        return .portrait
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        print("🔍 [OrientationAwarePlayerViewController] ========== viewDidLoad CALLED ==========")
        modalPresentationStyle = .fullScreen
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(orientationChanged),
            name: UIDevice.orientationDidChangeNotification,
            object: nil
        )
        
        // Pinch gesture removed - no effects on playback, just straight playback
        
        print("   - Thumbnail URL: \(thumbnailUrl ?? "none")")
        print("   - Initial state: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        print("🔍 [OrientationAwarePlayerViewController] ========== viewDidLoad COMPLETE ==========")
    }
    
    // Pinch gesture and zoom effects removed - straight playback only (no effects)
    
    private func updateVideoGravity() {
        print("🔍 [OrientationAwarePlayerViewController] ========== updateVideoGravity CALLED ==========")
        print("   - Current state: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        print("   - Thumbnail URL available: \(thumbnailUrl != nil ? "YES (\(thumbnailUrl!))" : "NO")")
        guard let player = player, let currentItem = player.currentItem else {
            print("⚠️ [OrientationAwarePlayerViewController] Cannot update video gravity - no player or item")
            print("   - player exists: \(player != nil)")
            print("   - currentItem exists: \(player?.currentItem != nil)")
            return
        }
        
        print("🔍 [OrientationAwarePlayerViewController] Checking tracks...")
        print("   - asset.tracks count: \(currentItem.asset.tracks(withMediaType: .video).count)")
        print("   - currentItem.tracks count: \(currentItem.tracks.count)")
        
        // Try asset.tracks first (works for regular videos) - this is what the working version used
        var track: AVAssetTrack?
        var trackSource = "unknown"
        
        if let assetTrack = currentItem.asset.tracks(withMediaType: .video).first {
            track = assetTrack
            trackSource = "asset.tracks"
            print("   ✅ Found track from asset.tracks")
        } else {
            // For HLS streams, asset.tracks might be empty, use currentItem.tracks
            let videoTracks = currentItem.tracks.filter { $0.assetTrack?.mediaType == .video }
            print("   - currentItem.tracks filtered count: \(videoTracks.count)")
            if let firstTrack = videoTracks.first {
                print("   - firstTrack.assetTrack exists: \(firstTrack.assetTrack != nil)")
            }
            track = videoTracks.first?.assetTrack
            trackSource = "currentItem.tracks"
            if track != nil {
                print("   ✅ Found track from currentItem.tracks")
            }
        }
        
        guard let videoTrack = track else {
            // Tracks not ready yet - retry once after a short delay
            // Only retry if we haven't detected yet to prevent multiple updates
            if !hasDetectedVideoOrientation {
                print("⚠️ [OrientationAwarePlayerViewController] No video tracks yet, retrying once...")
                print("   - Track source attempted: \(trackSource)")
                print("   - Player status: \(player.status.rawValue)")
                print("   - Current item status: \(currentItem.status.rawValue)")
                
                // Single retry to prevent multiple updates that cause zoom effects
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                    guard let self = self, !self.hasDetectedVideoOrientation else { return }
                    self.updateVideoGravity()
                }
            } else {
                print("⚠️ [OrientationAwarePlayerViewController] No video tracks but already detected - skipping retry")
            }
            return
        }
        
        let videoSize = videoTrack.naturalSize
        let videoTransform = videoTrack.preferredTransform
        
        print("🔍 [OrientationAwarePlayerViewController] Track details:")
        print("   - Track source: \(trackSource)")
        print("   - Natural size: \(videoSize.width) x \(videoSize.height)")
        print("   - Transform matrix:")
        print("     a=\(videoTransform.a), b=\(videoTransform.b)")
        print("     c=\(videoTransform.c), d=\(videoTransform.d)")
        print("     tx=\(videoTransform.tx), ty=\(videoTransform.ty)")
        
        // PRIMARY: Use thumbnail if available (most reliable, matches what user sees)
        // FALLBACK: Use normal video dimensions (height > width = portrait)
        var videoIsPortrait = false
        var usedThumbnail = false
        
        // Load thumbnail asynchronously (never block main thread)
        if let thumbnailUrl = thumbnailUrl, let thumbnailURL = URL(string: thumbnailUrl) {
            // Always use async URLSession to avoid blocking main thread - explicitly detach
            Task.detached(priority: .userInitiated) { [weak self] in
                do {
                    let (imageData, _) = try await URLSession.shared.data(from: thumbnailURL)
                    if let image = UIImage(data: imageData) {
                        let thumbnailIsPortrait = image.size.height > image.size.width
                        await MainActor.run { [weak self] in
                            guard let self = self else { return }
                            videoIsPortrait = thumbnailIsPortrait
                            usedThumbnail = true
                            print("🔍 [OrientationAwarePlayerViewController] ✅ Using THUMBNAIL detection (async):")
                            print("   - Thumbnail size: \(image.size.width) x \(image.size.height)")
                            print("   - Is Portrait: \(thumbnailIsPortrait) (height > width: \(image.size.height > image.size.width))")
                            
                            // Update video orientation
                            self.isPortraitVideo = thumbnailIsPortrait
                            self.hasDetectedVideoOrientation = true
                            // Set videoGravity immediately (only if different to prevent zoom effects)
                            let targetGravity: AVLayerVideoGravity = thumbnailIsPortrait ? .resizeAspectFill : .resizeAspect
                            if self.videoGravity != targetGravity {
                                self.videoGravity = targetGravity
                                print("   - Updated video orientation from thumbnail: \(targetGravity.rawValue)")
                            } else {
                                print("   - Video orientation already set: \(targetGravity.rawValue)")
                            }
                        }
                    }
                } catch {
                    print("🔍 [OrientationAwarePlayerViewController] ⚠️ Failed to load thumbnail: \(error.localizedDescription)")
                }
            }
        }
        
        // CRITICAL: Check for rotation transform FIRST - this determines actual orientation
        let transform = videoTrack.preferredTransform
        let rotation = atan2(transform.b, transform.a) * 180 / .pi
        print("   - 🔍 Video track transform: a=\(transform.a), b=\(transform.b), c=\(transform.c), d=\(transform.d)")
        print("   - 🔍 Calculated rotation: \(rotation) degrees")
        
        // Determine actual video orientation based on transform
        // If there's a 90° or 270° rotation, the natural size dimensions are swapped
        let hasRotationTransform = abs(rotation) > 0.1 && abs(rotation) < 359.9
        let isRotated90or270 = abs(abs(rotation) - 90) < 1 || abs(abs(rotation) - 270) < 1
        
        if hasRotationTransform {
            print("   - ⚠️ VIDEO HAS ROTATION TRANSFORM: \(rotation) degrees")
            if isRotated90or270 {
                // Natural size is swapped - height is actually width and vice versa
                print("   - 🔄 90°/270° rotation detected - swapping dimensions")
                videoIsPortrait = videoSize.width > videoSize.height
                print("   - ✅ After swap: Natural size \(videoSize.width)x\(videoSize.height) → Portrait: \(videoIsPortrait)")
            } else {
                // 0° or 180° - dimensions are correct
                videoIsPortrait = videoSize.height > videoSize.width
                print("   - ✅ No dimension swap needed: Portrait: \(videoIsPortrait)")
            }
        } else {
            // No rotation transform - use natural dimensions
            videoIsPortrait = videoSize.height > videoSize.width
            print("   - ✅ No rotation transform - using natural size: Portrait: \(videoIsPortrait)")
        }
        
        // Fallback to video dimensions if thumbnail wasn't used
        if !usedThumbnail {
            print("🔍 [OrientationAwarePlayerViewController] Using VIDEO SIZE detection:")
            print("   - Natural size: \(videoSize.width) x \(videoSize.height)")
            print("   - Rotation: \(rotation) degrees")
            print("   - Is Portrait: \(videoIsPortrait)")
        }
        
        print("🎬 [OrientationAwarePlayerViewController] Video orientation detection:")
        print("   - Natural size: \(videoSize.width) x \(videoSize.height)")
        print("   - Rotation transform: \(rotation) degrees")
        print("   - Is Portrait: \(videoIsPortrait)")
        print("   - Current videoGravity: \(videoGravity.rawValue)")
        
        // Store video orientation for orientation lock
        print("🎯 [OrientationAwarePlayerViewController] ========== SETTING DETECTION RESULT ==========")
        print("   - videoIsPortrait: \(videoIsPortrait)")
        print("   - hasRotationTransform: \(hasRotationTransform)")
        print("   - Setting isPortraitVideo = \(videoIsPortrait)")
        print("   - Setting hasDetectedVideoOrientation = true")
        isPortraitVideo = videoIsPortrait
        hasDetectedVideoOrientation = true
        print("   - ✅ State updated: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        
        // CRITICAL: If portrait, force portrait orientation IMMEDIATELY
        if videoIsPortrait {
            print("   - 🔒 FORCING portrait orientation immediately after detection")
            if let windowScene = view.window?.windowScene {
                if #available(iOS 16.0, *) {
                    windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                        if let err = error {
                            print("   - ❌ Failed to force portrait: \(err.localizedDescription)")
                        } else {
                            print("   - ✅ Forced to portrait orientation immediately")
                        }
                    }
                }
            } else {
                print("   - ⚠️ windowScene not available yet, will force in viewDidAppear")
            }
        }
        
        // Portrait videos: set fullscreen and lock orientation (handled by supportedInterfaceOrientations)
        // Landscape videos: set natural aspect and allow rotation
        
        // Portrait videos: Always full screen (resizeAspectFill)
        // Landscape videos: Always natural aspect ratio (resizeAspect) - no zoom
        let targetGravity: AVLayerVideoGravity = videoIsPortrait ? .resizeAspectFill : .resizeAspect
        
        // CRITICAL: Only update if different to prevent zoom effects
        if videoGravity != targetGravity {
            print("   ✅ Setting videoGravity to \(targetGravity.rawValue) (\(videoIsPortrait ? "portrait - full screen" : "landscape - natural aspect, no zoom"))")
            videoGravity = targetGravity
        } else {
            print("   ✅ videoGravity already set to \(targetGravity.rawValue) - no change needed")
        }
        print("🔍 [OrientationAwarePlayerViewController] ========== updateVideoGravity COMPLETE ==========")
        print("   - Final state: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        print("   - Current videoGravity: \(videoGravity.rawValue)")
    }
    
    @objc private func orientationChanged() {
        print("🔄 [OrientationAwarePlayerViewController] ========== orientationChanged CALLED ==========")
        print("   - Device orientation: \(UIDevice.current.orientation.rawValue)")
        print("   - 🔒 IGNORING orientation change - App is locked to portrait mode")
        // Always ignore orientation changes - app is locked to portrait
        return
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("🔍 [OrientationAwarePlayerViewController] ========== viewWillAppear CALLED ==========")
        if let windowScene = view.window?.windowScene {
            print("   - Current interface orientation: \(windowScene.interfaceOrientation.rawValue) (\(windowScene.interfaceOrientation.isPortrait ? "portrait" : "landscape"))")
            print("   - Is portrait: \(windowScene.interfaceOrientation.isPortrait)")
        } else {
            print("   - ⚠️ windowScene is nil!")
        }
        print("   - Device orientation: \(UIDevice.current.orientation.rawValue)")
        print("   - Before detection: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        // Detect video orientation and set videoGravity
        updateVideoGravity()
        print("   - After detection: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        if let windowScene = view.window?.windowScene {
            print("   - After detection, interface orientation: \(windowScene.interfaceOrientation.rawValue) (\(windowScene.interfaceOrientation.isPortrait ? "portrait" : "landscape"))")
        }
        print("🔍 [OrientationAwarePlayerViewController] ========== viewWillAppear COMPLETE ==========")
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("🔍 [OrientationAwarePlayerViewController] ========== viewDidAppear CALLED ==========")
        if let windowScene = view.window?.windowScene {
            print("   - Current interface orientation: \(windowScene.interfaceOrientation.rawValue) (\(windowScene.interfaceOrientation.isPortrait ? "portrait" : "landscape"))")
            
            // CRITICAL: If portrait video detected, FORCE portrait orientation NOW
            if hasDetectedVideoOrientation && isPortraitVideo {
                if !windowScene.interfaceOrientation.isPortrait {
                    print("   - ⚠️ Interface is NOT portrait but video is portrait - FORCING portrait NOW")
                    if #available(iOS 16.0, *) {
                        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                            if let err = error {
                                print("   - ❌ Failed to force portrait: \(err.localizedDescription)")
                            } else {
                                print("   - ✅ Forced to portrait orientation")
                            }
                        }
                    }
                } else {
                    print("   - ✅ Interface is already portrait - locking it")
                    // Lock it again to be sure
                    if #available(iOS 16.0, *) {
                        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                            if let err = error {
                                print("   - ❌ Failed to lock portrait: \(err.localizedDescription)")
                            } else {
                                print("   - ✅ Locked to portrait orientation")
                            }
                        }
                    }
                }
                
                // CRITICAL: Also monitor for orientation changes after viewDidAppear
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    guard let self = self, let windowScene = self.view.window?.windowScene else { return }
                    if !windowScene.interfaceOrientation.isPortrait && self.hasDetectedVideoOrientation && self.isPortraitVideo {
                        print("   - ⚠️⚠️⚠️ ORIENTATION FLIPPED AFTER viewDidAppear! Forcing back to portrait...")
                        if #available(iOS 16.0, *) {
                            windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                                if let err = error {
                                    print("   - ❌ Failed to re-force portrait: \(err.localizedDescription)")
                                } else {
                                    print("   - ✅ Re-forced to portrait orientation")
                                }
                            }
                        }
                    } else {
                        print("   - ✅ Orientation check after 0.5s: still portrait")
                    }
                }
            }
        } else {
            print("   - ⚠️ windowScene is still nil!")
        }
        print("   - Detection state: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        print("   - supportedInterfaceOrientations will return: \(hasDetectedVideoOrientation ? (isPortraitVideo ? "portrait" : "all") : "portrait")")
        print("   - shouldAutorotate will return: \(hasDetectedVideoOrientation && !isPortraitVideo)")
        print("🔍 [OrientationAwarePlayerViewController] ========== viewDidAppear COMPLETE ==========")
    }
    
    deinit {
        UIDevice.current.endGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.removeObserver(self)
    }
}

// ViewModifier to conditionally show scroll indicators based on iOS version
struct ScrollIndicatorsModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) {
            content.scrollIndicators(.visible)
        } else {
            content
        }
    }
}
