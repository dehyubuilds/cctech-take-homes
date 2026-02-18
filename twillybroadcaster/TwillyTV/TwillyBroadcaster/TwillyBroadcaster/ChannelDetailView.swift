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
    @State private var isLoading = true // Start as true to show loading immediately on first render
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
    @State private var showAddedUsernamesDropdown = false // Show added usernames dropdown
    @State private var showEmptyMessage = false // Show flash message when all usernames are removed
    @State private var removedUsernames: Set<String> = [] // Track usernames that were explicitly removed (to prevent them from being added back)
    @State private var addingUsernames: Set<String> = [] // Track which usernames are currently being added
    @State private var searchVisibilityFilter: String = "all" // Always show all results (public and private together)
    @State private var sentFollowRequests: [SentFollowRequest] = [] // Track follow requests sent by current user
    @State private var isLoadingSentRequests = false
    @State private var receivedFollowRequests: [FollowRequest] = [] // Track follow requests received by current user
    @State private var isLoadingReceivedRequests = false
    @State private var showingFollowRequests = false // Show follow requests sheet
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
            .sheet(isPresented: $showingEditModal) {
                editContentModal
            }
            .sheet(isPresented: $showingContentManagementPopup) {
                contentManagementPopup
            }
            .sheet(isPresented: $showingFollowRequests) {
                followRequestsSheet
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
                
                // Cancel any pending content loading tasks
                // (Tasks are automatically cancelled when view disappears, but explicit cancellation is safer)
            }
            .onAppear {
                print("👁️ [ChannelDetailView] onAppear called - hasLoaded: \(hasLoaded), content.count: \(content.count), isLoading: \(isLoading), forceRefresh: \(forceRefresh)")
                print("   Channel: \(currentChannel.channelName)")
                print("   Poster URL at onAppear: \(currentChannel.posterUrl.isEmpty ? "EMPTY" : currentChannel.posterUrl)")
                
                // Load cached search results from UserDefaults for instant results
                loadSearchCacheFromUserDefaults()
                
                // Load favorites from UserDefaults
                loadFavoritesFromUserDefaults()
                
                // Load user's schedule and post automatically status (for admin stream button visibility)
                if isAdminUser {
                    loadUserScheduleStatus()
                    loadUserPostAutomatically()
                }
                
                // Load added usernames for Twilly TV and auto-add own username
                if currentChannel.channelName.lowercased() == "twilly tv" {
                    loadAddedUsernames()
                    // Auto-add user's own username to see their own content
                    autoAddOwnUsername()
                    // Load sent follow requests to track request status (for button states)
                    loadSentFollowRequests(mergeWithExisting: false)
                    // Load received follow requests to show badge count
                    loadReceivedFollowRequests()
                }
                
                // Check for local video info to show immediately
                if let localInfo = globalLocalVideoInfo, localInfo.channelName == currentChannel.channelName {
                    print("📹 [ChannelDetailView] Found local video for this channel - showing immediately")
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
                    print("✅ [ChannelDetailView] Local video added to content list - content.count: \(content.count)")
                    
                    // Start polling for thumbnail immediately
                    startThumbnailPolling()
                    
                    // Clear global info after using it
                    globalLocalVideoInfo = nil
                }
                
                // Show cached content immediately if available
                let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
                let hasCachedContent = isTwillyTV ? (!publicContent.isEmpty || !privateContent.isEmpty) : !content.isEmpty
                
                if hasCachedContent {
                    // We have cached content - show it immediately
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
                        hasLoaded = true
                        isLoading = false
                        print("⚡ [ChannelDetailView] Showing cached content immediately - \(content.count) items")
                    } else {
                        // Non-Twilly TV - content array should already have data
                        hasLoaded = true
                        isLoading = false
                        print("⚡ [ChannelDetailView] Showing cached content immediately - \(content.count) items")
                    }
                }
                
                // Always fetch new content in background (unless forceRefresh, then show loading)
                let needsBothViewsReload = isTwillyTV && (!bothViewsLoaded || (publicContent.isEmpty && privateContent.isEmpty))
                let needsReload = content.isEmpty && !isLoading
                
                if !hasCachedContent && (!hasLoaded || forceRefresh || needsBothViewsReload || needsReload) {
                    print("🔄 [ChannelDetailView] Loading server content... (forceRefresh: \(forceRefresh), hasCachedContent: \(hasCachedContent))")
                    if localVideoContent == nil {
                        // Only show loading if we have no cached content
                        isLoading = true
                        if forceRefresh {
                            content = [] // Clear content on force refresh
                        }
                        errorMessage = nil
                    }
                    loadContent()
                } else if hasCachedContent {
                    // We have cached content - fetch new content in background silently
                    print("🔄 [ChannelDetailView] Fetching new content in background (cached content shown)")
                    Task {
                        do {
                            if isTwillyTV {
                                // Fetch both views in background
                                let viewerEmail = authService.userEmail
                                let bothViews = try await channelService.fetchBothViewsContent(
                                    channelName: currentChannel.channelName,
                                    creatorEmail: currentChannel.creatorEmail,
                                    viewerEmail: viewerEmail,
                                    limit: 20,
                                    forceRefresh: false
                                )
                                
                                await MainActor.run {
                                    // Update cached arrays silently
                                    let strictlyPublic = bothViews.publicContent.filter { $0.isPrivateUsername != true }
                                    let strictlyPrivate = bothViews.privateContent.filter { $0.isPrivateUsername == true }
                                    
                                    publicContent = strictlyPublic
                                    privateContent = strictlyPrivate
                                    publicNextToken = bothViews.publicNextToken
                                    privateNextToken = bothViews.privateNextToken
                                    publicHasMore = bothViews.publicHasMore
                                    privateHasMore = bothViews.privateHasMore
                                    bothViewsLoaded = true
                                    
                                    // Update current view if needed
                                    if showPrivateContent {
                                        content = strictlyPrivate
                                        nextToken = privateNextToken
                                        hasMoreContent = privateHasMore
                                    } else {
                                        content = strictlyPublic
                                        nextToken = publicNextToken
                                        hasMoreContent = publicHasMore
                                    }
                                    
                                    cachedUnfilteredContent = publicContent + privateContent
                                    print("✅ [ChannelDetailView] Background refresh complete - public: \(publicContent.count), private: \(privateContent.count)")
                                }
                            } else {
                                // Non-Twilly TV - use single view refresh
                                if let result = try? await refreshChannelContent() {
                                    await MainActor.run {
                                        updateContentWith(result.content, replaceLocal: false)
                                        nextToken = result.nextToken
                                        hasMoreContent = result.hasMore
                                        print("✅ [ChannelDetailView] Background refresh complete - \(result.content.count) items")
                                    }
                                }
                            }
                        } catch {
                            print("⚠️ [ChannelDetailView] Background refresh failed (non-critical): \(error.localizedDescription)")
                        }
                    }
                } else {
                    print("✅ [ChannelDetailView] Already loaded and not forcing refresh, skipping load")
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
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RefreshTwillyTVContent"))) { _ in
                // CRITICAL: When a follow request is accepted, refresh everything to show private content
                print("🔄 [ChannelDetailView] Received RefreshTwillyTVContent notification - follow request was accepted")
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
                        print("✅ [ChannelDetailView] Refreshed content after follow request acceptance")
                    } catch {
                        print("❌ [ChannelDetailView] Error refreshing content after acceptance: \(error.localizedDescription)")
                    }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NewFollowRequestReceived"))) { _ in
                // CRITICAL: When a new follow request is received, refresh the received requests list
                print("🔄 [ChannelDetailView] Received NewFollowRequestReceived notification - refreshing received requests")
                loadReceivedFollowRequests()
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
                                print("✅ [ChannelDetailView] Swipe RIGHT detected → Going to Stream screen")
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
            let _ = print("🎬 [ChannelDetailView] ========== FULLSCREEN COVER OPENED ==========")
            let _ = print("   - showingPlayer: \(showingPlayer)")
            let _ = print("   - selectedContent: \(selectedContent?.fileName ?? "nil")")
            let _ = print("   - selectedContent hlsUrl: \(selectedContent?.hlsUrl ?? "nil")")
            let _ = print("   - selectedContent thumbnailUrl: \(selectedContent?.thumbnailUrl ?? "nil")")
            
            if let content = selectedContent {
                // Check for local file first, then HLS URL
                if let localURL = content.localFileURL {
                    let _ = print("✅ [ChannelDetailView] Opening video player with LOCAL file: \(localURL.path)")
                    VideoPlayerView(url: localURL, content: content)
                } else if let hlsUrl = content.hlsUrl, !hlsUrl.isEmpty, let url = URL(string: hlsUrl) {
                    let _ = print("✅ [ChannelDetailView] Opening video player with HLS URL: \(hlsUrl)")
                    let _ = print("   - Thumbnail URL: \(content.thumbnailUrl ?? "none")")
                    VideoPlayerView(url: url, content: content)
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
            .padding(.leading, 20)
        }
    }
    
    @ViewBuilder
    private var trailingToolbarItems: some View {
        // Follow requests button
        Button(action: {
            showingFollowRequests = true
            loadReceivedFollowRequests()
        }) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "person.badge.plus")
                    .foregroundColor(.white)
                
                // Badge with count of pending requests
                if !receivedFollowRequests.isEmpty {
                    Text("\(receivedFollowRequests.count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.red)
                        .clipShape(Capsule())
                        .offset(x: 8, y: -8)
                }
            }
        }
        
        // Settings button
        Button(action: {
            showingSettings = true
        }) {
            Image(systemName: "gear")
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
                
                // Filter indicator icon
                Image(systemName: showOnlyOwnContent ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(showOnlyOwnContent ? .twillyCyan : .white.opacity(0.7))
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
                .font(.system(size: 14))
                .foregroundColor(showFavoritesOnly ? .yellow : .white.opacity(0.8))
        }
    }
    
    private var privateToggleButton: some View {
        Button(action: handlePrivateToggle) {
            privateToggleButtonContent
        }
    }
    
    private var privateToggleButtonContent: some View {
        HStack(spacing: 4) {
            Image(systemName: showPrivateContent ? "lock.fill" : "lock.open.fill")
                .font(.system(size: 14))
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
        // Always use cached unfiltered content for filtering to avoid server calls
        if showOnlyOwnContent, let username = authService.username {
            // Cache unfiltered content before filtering (if not already cached)
            if cachedUnfilteredContent.isEmpty {
                cachedUnfilteredContent = content
                cachedNextToken = nextToken
                cachedHasMoreContent = hasMoreContent
                print("💾 [ChannelDetailView] Cached unfiltered content: \(cachedUnfilteredContent.count) items")
            }
            // Filter from cached unfiltered content (not current filtered content)
            let sourceContent = cachedUnfilteredContent.isEmpty ? content : cachedUnfilteredContent
            var filtered = sourceContent.filter { item in
                item.creatorUsername?.lowercased() == username.lowercased()
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
            
            print("🔍 [ChannelDetailView] Filtered content (own only\(showPrivateContent ? " + private" : "")\(showFavoritesOnly ? " + favorites" : "")): \(content.count) items")
        } else if wasFiltered {
            // Restore from cache instead of reloading from server
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
    
    private func handlePrivateToggle() {
        // Determine new state before toggling
        let willBePrivate = !showPrivateContent
        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
        
        // Switch between pre-loaded public and private content for instant toggle
        // Use cached content if available, even if bothViewsLoaded is false (might have been set before navigation)
        let hasCachedContent = isTwillyTV && (!publicContent.isEmpty || !privateContent.isEmpty)
        
        if (bothViewsLoaded || hasCachedContent) && isTwillyTV {
            if willBePrivate {
                // CRITICAL SECURITY: Strictly filter privateContent to ensure ONLY private items
                let strictlyPrivate = privateContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if !isPrivate {
                        print("🚫 [ChannelDetailView] CRITICAL SECURITY: Removing public item from privateContent cache: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                    }
                    return isPrivate
                }
                content = strictlyPrivate
                nextToken = privateNextToken
                hasMoreContent = privateHasMore
                // Also update the cache to remove any public items that shouldn't be there
                privateContent = strictlyPrivate
                
                // Apply favorites filter if active
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                
                // Ensure we don't show empty state if content is empty but we're still loading
                if content.isEmpty && !bothViewsLoaded {
                    isLoading = true
                }
                
                print("⚡ [ChannelDetailView] Instantly switched to private view - \(content.count) items (strictly filtered\(showFavoritesOnly ? " + favorites" : ""))")
            } else {
                // CRITICAL SECURITY: Strictly filter publicContent to ensure ONLY public items
                let strictlyPublic = publicContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if isPrivate {
                        print("🚫 [ChannelDetailView] CRITICAL SECURITY: Removing private item from publicContent cache: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                    }
                    return !isPrivate
                }
                content = strictlyPublic
                nextToken = publicNextToken
                hasMoreContent = publicHasMore
                // Also update the cache to remove any private items that shouldn't be there
                publicContent = strictlyPublic
                
                // Apply favorites filter if active
                if showFavoritesOnly {
                    content = content.filter { item in
                        favoriteContentIds.contains(item.SK)
                    }
                }
                
                // Ensure we don't show empty state if content is empty but we're still loading
                if content.isEmpty && !bothViewsLoaded {
                    isLoading = true
                }
                
                print("⚡ [ChannelDetailView] Instantly switched to public view - \(content.count) items (strictly filtered\(showFavoritesOnly ? " + favorites" : ""))")
            }
            
            // If we successfully used cached content, mark bothViewsLoaded as true
            if !bothViewsLoaded && hasCachedContent {
                bothViewsLoaded = true
                print("✅ [ChannelDetailView] Marked bothViewsLoaded = true after using cached content")
            }
        } else {
            // Fallback to filtering if both views aren't loaded yet
            // Set loading state BEFORE filtering to prevent empty state flash
            // Only set loading if we don't have cached content to filter from
            let hasCachedToFilter = !cachedUnfilteredContent.isEmpty || !content.isEmpty
            if !hasCachedToFilter {
                isLoading = true
                // If we don't have cached content and this is Twilly TV, trigger reload of both views
                if isTwillyTV {
                    print("🔄 [ChannelDetailView] No cached content for toggle - reloading both views...")
                    loadContent()
                }
            }
            applyVisibilityFilterInstantly()
            // After filtering, if content is still empty and we don't have previous content, keep loading
            if content.isEmpty && previousContentBeforeFilter.isEmpty && !hasCachedToFilter {
                isLoading = true
            } else if !content.isEmpty {
                isLoading = false
            }
        }
        
        // Toggle the state
        withAnimation {
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
            if showOnlyOwnContent, let username = authService.username {
                filtered = filtered.filter { item in
                    item.creatorUsername?.lowercased() == username.lowercased()
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
                if showOnlyOwnContent, let username = authService.username {
                    content = content.filter { item in
                        item.creatorUsername?.lowercased() == username.lowercased()
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
                            
                            TextField("Search username...", text: $usernameSearchText)
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
    // Shows both "Added" (public) and "Requested" (private) usernames with deselection buttons
    private var addedUsernamesDropdown: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Combine added usernames and requested usernames for display
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
                    Text("No added or requested usernames")
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
                            
                            Spacer()
                            
                            // Deselection buttons - both say "Remove"
                            HStack(spacing: 8) {
                                // "Remove" button for added - only show if added
                                if item.isAdded {
                                    Button(action: {
                                        print("🟡 [ChannelDetailView] Removing Added from dropdown: \(item.username)")
                                        deselectAddedUsername(item.username, email: item.email)
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
                                
                                // "Remove" button for requested - only show if requested
                                if item.isRequested {
                                    Button(action: {
                                        print("🟡 [ChannelDetailView] Removing Requested from dropdown: \(item.username)")
                                        deselectRequestedUsername(item.username, email: item.email)
                                    }) {
                                        Text("Remove")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.orange)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(Color.orange.opacity(0.2))
                                            .cornerRadius(6)
                                    }
                                }
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
    }
    
    // Get all usernames (both added and requested) for dropdown display
    private func getAllUsernamesForDropdown() -> [UsernameDropdownItem] {
        var usernameMap: [String: UsernameDropdownItem] = [:]
        
        // Add all added usernames (filter out empty usernames)
        for addedUsername in addedUsernames {
            let cleanUsername = addedUsername.streamerUsername.trimmingCharacters(in: .whitespaces)
            // Skip empty usernames
            guard !cleanUsername.isEmpty else {
                print("⚠️ [ChannelDetailView] Skipping empty username in addedUsernames")
                continue
            }
            
            let usernameLower = cleanUsername.lowercased()
            usernameMap[usernameLower] = UsernameDropdownItem(
                id: "added-\(usernameLower)",
                username: cleanUsername,
                email: addedUsername.streamerEmail,
                isAdded: true,
                isRequested: false
            )
        }
        
        // Add or update with requested usernames (filter out empty usernames)
        for sentRequest in sentFollowRequests {
            let cleanUsername = sentRequest.requestedUsername.trimmingCharacters(in: .whitespaces)
            // Skip empty usernames
            guard !cleanUsername.isEmpty else {
                print("⚠️ [ChannelDetailView] Skipping empty username in sentFollowRequests")
                continue
            }
            
            let usernameLower = cleanUsername.lowercased()
            let status = sentRequest.status.lowercased()
            
            // Only include pending, active, or accepted requests
            if status == "pending" || status == "active" || status == "accepted" {
                if let existing = usernameMap[usernameLower] {
                    // Update existing entry to include requested state
                    usernameMap[usernameLower] = UsernameDropdownItem(
                        id: existing.id,
                        username: existing.username,
                        email: existing.email ?? sentRequest.requestedUserEmail,
                        isAdded: existing.isAdded,
                        isRequested: true
                    )
                } else {
                    // New entry for requested only
                    usernameMap[usernameLower] = UsernameDropdownItem(
                        id: "requested-\(usernameLower)",
                        username: cleanUsername,
                        email: sentRequest.requestedUserEmail,
                        isAdded: false,
                        isRequested: true
                    )
                }
            }
        }
        
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
    
    // Save added usernames to UserDefaults
    private func saveAddedUsernamesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot save to UserDefaults - userEmail is nil")
            return
        }
        
        let key = addedUsernamesKey(for: userEmail)
        print("🔑 [ChannelDetailView] Saving to UserDefaults with key: \(key)")
        
        do {
            let encoder = JSONEncoder()
            let encoded = try encoder.encode(addedUsernames)
            UserDefaults.standard.set(encoded, forKey: key)
            UserDefaults.standard.synchronize() // Force immediate write
            print("💾 [ChannelDetailView] Saved \(addedUsernames.count) added usernames to UserDefaults (key: \(key))")
            print("   📋 Usernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
        } catch {
            print("❌ [ChannelDetailView] Error saving added usernames to UserDefaults: \(error)")
            print("   Key used: \(key)")
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
            print("   📋 Usernames: \(cached.map { $0.streamerUsername }.joined(separator: ", "))")
            return cached
        } catch {
            print("❌ [ChannelDetailView] Error loading added usernames from UserDefaults: \(error)")
            print("   Key used: \(key)")
            return []
        }
    }
    
    // Load added usernames for Twilly TV filtering
    private func loadAddedUsernames(mergeWithExisting: Bool = false) {
        // Also load sent and received follow requests when loading added usernames
        // Use merge mode to preserve optimistic updates
        // CRITICAL: Only load if mergeWithExisting is true OR if we're doing initial load (not merge)
        // This prevents overwriting optimistic updates when mergeWithExisting is false
        if mergeWithExisting {
            loadSentFollowRequests(mergeWithExisting: true)
        } else {
            // Initial load - safe to load without merge
            loadSentFollowRequests(mergeWithExisting: false)
        }
        loadReceivedFollowRequests()
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
                
                // CRITICAL: Filter out removed usernames from cache
                let filteredCached = cached.filter { username in
                    let lowercased = username.streamerUsername.lowercased()
                    let isRemoved = removedUsernames.contains(lowercased)
                    if isRemoved {
                        print("🚫 [DEBUG] Filtering out removed username from cache: '\(username.streamerUsername)' (lowercased: '\(lowercased)')")
                    }
                    return !isRemoved
                }
                if !filteredCached.isEmpty {
                    addedUsernames = filteredCached
                    print("✅ [ChannelDetailView] Loaded \(filteredCached.count) added usernames from cache (filtered from \(cached.count), excluded \(cached.count - filteredCached.count) removed)")
                } else if !cached.isEmpty {
                    print("⚠️ [ChannelDetailView] All \(cached.count) cached usernames were filtered out (removed)")
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
                            
                            // CRITICAL: Filter out removed usernames from cache
                            let filteredCached = cached.filter { username in
                                let lowercased = username.streamerUsername.lowercased()
                                let isRemoved = removedUsernames.contains(lowercased)
                                if isRemoved {
                                    print("🚫 [DEBUG] Delayed load - Filtering out removed username: '\(username.streamerUsername)' (lowercased: '\(lowercased)')")
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
                    if mergeWithExisting && !addedUsernames.isEmpty {
                        // Merge server data with existing optimistic updates
                        // CRITICAL: Do NOT add back usernames that were explicitly removed
                        let serverUsernames = response.addedUsernames ?? []
                        print("🔍 [DEBUG] Server returned \(serverUsernames.count) usernames: \(serverUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                        print("🔍 [DEBUG] Current removedUsernames: \(removedUsernames.map { $0 }.joined(separator: ", "))")
                        
                        var mergedUsernames: [AddedUsername] = []
                        let existingUsernamesLower = Set(addedUsernames.map { $0.streamerUsername.lowercased() })
                        let removedUsernamesLower = Set(removedUsernames.map { $0.lowercased() })
                        
                        // Start with existing (optimistic) usernames
                        mergedUsernames = addedUsernames
                        
                        // Add server usernames that aren't already in the list AND weren't explicitly removed
                        for serverUsername in serverUsernames {
                            let serverUsernameLower = serverUsername.streamerUsername.lowercased()
                            let isInExisting = existingUsernamesLower.contains(serverUsernameLower)
                            let isRemoved = removedUsernamesLower.contains(serverUsernameLower)
                            
                            print("🔍 [DEBUG] Processing server username: '\(serverUsername.streamerUsername)' (lowercased: '\(serverUsernameLower)') - inExisting: \(isInExisting), isRemoved: \(isRemoved)")
                            
                            if !isInExisting && !isRemoved {
                                mergedUsernames.append(serverUsername)
                                print("   ➕ Added server username: \(serverUsername.streamerUsername)")
                            } else if isRemoved {
                                print("   🚫 Skipping removed username from server: \(serverUsername.streamerUsername)")
                            } else {
                                print("   ⏭️ Skipping username already in existing list: \(serverUsername.streamerUsername)")
                            }
                        }
                        
                        // Update existing entries with server data (more accurate) but keep optimistic ones if server doesn't have them
                        for (index, existing) in mergedUsernames.enumerated() {
                            if let serverVersion = serverUsernames.first(where: { $0.streamerUsername.lowercased() == existing.streamerUsername.lowercased() }) {
                                mergedUsernames[index] = serverVersion
                            } else {
                                // Keep optimistic update if server doesn't have it yet (might be processing)
                                print("   ⚠️ Keeping optimistic username (not in server yet): \(existing.streamerUsername)")
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
                            let lowercased = username.streamerUsername.lowercased()
                            let isRemoved = removedUsernames.contains(lowercased)
                            if isRemoved {
                                print("🚫 [DEBUG] Filtering out removed username from server: '\(username.streamerUsername)' (lowercased: '\(lowercased)')")
                            }
                            return !isRemoved
                        }
                        
                        if !serverUsernames.isEmpty {
                            // Server has data - use it (already filtered)
                            addedUsernames = serverUsernames
                            let originalCount = allServerUsernames.count
                            print("✅ [ChannelDetailView] Loaded \(addedUsernames.count) added usernames from server (initial load, filtered from \(originalCount), excluded \(originalCount - addedUsernames.count) removed)")
                        } else {
                            // Server returned empty - keep cached data if we have it
                            if addedUsernames.isEmpty {
                                // No cached data either - truly empty
                                print("⚠️ [ChannelDetailView] Server returned empty list and no cached data")
                            } else {
                                // Keep cached data since server is empty
                                print("⚠️ [ChannelDetailView] Server returned empty list, keeping \(addedUsernames.count) cached usernames")
                            }
                        }
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
    private func autoAddOwnUsername() {
        guard let userEmail = authService.userEmail,
              let username = authService.username else {
            return
        }
        
        // Check if own username is already added
        let ownUsernameAdded = addedUsernames.contains { $0.streamerUsername.lowercased() == username.lowercased() }
        
        if !ownUsernameAdded {
            print("🔄 [ChannelDetailView] Auto-adding own username to timeline: \(username)")
            Task {
                do {
                    // Request follow with own username (will auto-accept if public)
                    _ = try await ChannelService.shared.requestFollow(requesterEmail: userEmail, requestedUsername: username, requesterUsername: authService.username)
                    // Reload added usernames to get updated list (merge to preserve any optimistic updates)
                    loadAddedUsernames(mergeWithExisting: true)
                } catch {
                    print("⚠️ [ChannelDetailView] Could not auto-add own username: \(error.localizedDescription)")
                }
            }
        }
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
    private func searchLocalUsernames(query: String) -> [UsernameSearchResult] {
        guard !query.isEmpty else { return [] }
        
        return addedUsernames.compactMap { added in
            let username = added.streamerUsername.lowercased()
            let cleanUsername = username.replacingOccurrences(of: "🔒", with: "")
            
            // Match if query is contained in username
            guard cleanUsername.contains(query) || query.contains(cleanUsername) else {
                return nil
            }
            
            // Create result from local data
            return UsernameSearchResult(
                username: added.streamerUsername,
                email: added.streamerEmail,
                userId: added.streamerEmail,
                displayUsername: added.streamerUsername,
                visibility: added.streamerVisibility,
                isPrivate: added.streamerVisibility?.lowercased() == "private",
                isPremium: nil, // Will be updated from API if needed
                subscriptionPrice: nil
            )
        }
    }
    
    // Search all cached results for matches (instant filtering)
    private func searchCachedResults(query: String) -> [UsernameSearchResult] {
        guard !query.isEmpty else { return [] }
        
        var allCached: [UsernameSearchResult] = []
        
        // Search through all cached entries
        for (_, results) in searchCache {
            let filtered = results.filter { result in
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
            print("🔍 [Search] API call for: '\(query)' (visibilityFilter: 'all')")
            let results = try await ChannelService.shared.searchUsernames(query: query, limit: 50, visibilityFilter: "all")
            
            await MainActor.run {
                // Only update if search text hasn't changed
                let currentSearchText = usernameSearchText.trimmingCharacters(in: .whitespaces)
                guard !currentSearchText.isEmpty, currentSearchText.lowercased() == searchKey else {
                    print("⚠️ [Search] Search text changed during API call, ignoring results")
                    return
                }
                
                // Cache the results for future instant access
                searchCache[searchKey] = results
                
                // Also cache individual results for substring matching
                // This allows "jo" to match cached results from "john" searches
                for result in results {
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
                
                // Merge API results with existing local/cached results
                let localResults = searchLocalUsernames(query: searchKey)
                let cachedResults = searchCachedResults(query: searchKey)
                let merged = mergeResults(mergeResults(localResults, cachedResults), results)
                
                // Update results (API results take priority for freshness)
                usernameSearchResults = merged
                showSearchDropdown = !merged.isEmpty
                isSearchingUsernames = false
                
                // Log results
                let publicCount = merged.filter { $0.isPrivate != true }.count
                let privateCount = merged.filter { $0.isPrivate == true }.count
                print("✅ [Search] Complete: \(merged.count) total (Public: \(publicCount), Private: \(privateCount))")
                
                if results.count > 0 {
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
    private func addUsernameInline(_ username: String, email: String? = nil) {
        print("🔵 [ChannelDetailView] ========== REQUEST BUTTON CLICKED ==========")
        print("   📝 Original username: '\(username)'")
        print("   📧 Email: \(email ?? "nil")")
        
        guard let userEmail = authService.userEmail else {
            print("   ❌ ERROR: No user email found - cannot proceed")
            return
        }
        print("   ✅ User email: \(userEmail)")
        
        // Remove 🔒 from username for API call (API expects username without lock)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let isPrivate = username.contains("🔒")
        print("   🧹 Clean username: '\(cleanUsername)'")
        print("   🔒 Is private: \(isPrivate)")
        
        // For private requests, check if request already exists (any status) - if so, skip API call
        if isPrivate {
            let usernameLower = cleanUsername.lowercased()
            let alreadyRequested = sentFollowRequests.contains(where: { 
                $0.requestedUsername.lowercased() == usernameLower && 
                ($0.status.lowercased() == "pending" || $0.status.lowercased() == "accepted" || $0.status.lowercased() == "declined")
            })
            if alreadyRequested {
                print("   ℹ️ Request already exists for private user: \(cleanUsername) - skipping API call")
                // UI should already be showing correct state - don't reload to avoid flicker
                return
            }
        }
        
        // Check if already added - but only return early if it's the same visibility type
        // This allows adding private version even if public version exists (or vice versa)
        if let existingAdded = addedUsernames.first(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
            let existingIsPrivate = existingAdded.streamerVisibility?.lowercased() == "private"
            if existingIsPrivate == isPrivate {
                print("   ℹ️ Username already added with same visibility: \(cleanUsername) (\(isPrivate ? "private" : "public")) - returning early")
                return
            } else {
                print("   ✅ Username exists but with different visibility - allowing request")
                print("      Existing: \(existingIsPrivate ? "private" : "public"), Requesting: \(isPrivate ? "private" : "public")")
            }
        } else {
            print("   ✅ Username not in addedUsernames list")
        }
        
        // Check if already being added - track exact button clicked (public vs private)
        let addingKey = "\(cleanUsername.lowercased()):\(isPrivate ? "private" : "public")"
        if addingUsernames.contains(addingKey) {
            print("   ℹ️ Username already being added: \(cleanUsername) (\(isPrivate ? "private" : "public")) - returning early")
            return
        }
        print("   ✅ Username not currently being added")
        
        // Mark as being added with visibility type
        addingUsernames.insert(addingKey)
        print("   ✅ Added '\(addingKey)' to addingUsernames set")
        print("   📊 Current addingUsernames: \(addingUsernames)")
        
        Task {
            do {
                print("   🚀 Starting API call to requestFollow...")
                print("   📤 Request details:")
                print("      - requesterEmail: \(userEmail)")
                print("      - requestedUsername: \(cleanUsername)")
                print("      - requesterUsername: \(authService.username ?? "nil")")
                
                // Use clean username (without 🔒) for API call
                // Pass requesterUsername from authService (frontend already knows it)
                // Pass isPrivateStreamRequest to indicate this is a private request
                let response = try await ChannelService.shared.requestFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requesterUsername: authService.username,
                    isPrivateStreamRequest: isPrivate
                )
                
                print("   ✅ API call completed!")
                print("   📥 Response received:")
                print("      - success: \(response.success)")
                print("      - autoAccepted: \(response.autoAccepted ?? false)")
                print("      - status: \(response.status ?? "nil")")
                print("      - message: \(response.message ?? "nil")")
                
                await MainActor.run {
                    print("   🔄 Updating UI on main thread...")
                    // Remove from adding set (use same key format as insertion)
                    let removingKey = "\(cleanUsername.lowercased()):\(isPrivate ? "private" : "public")"
                    addingUsernames.remove(removingKey)
                    print("   ✅ Removed '\(removingKey)' from addingUsernames set")
                    print("   📊 Current addingUsernames after removal: \(addingUsernames)")
                    // Check if username is still being added (should be false now)
                    let checkKey = "\(cleanUsername.lowercased()):\(isPrivate ? "private" : "public")"
                    let stillBeingAdded = addingUsernames.contains(checkKey)
                    print("   🔍 isUsernameBeingAdded check for '\(username)' should now return: \(stillBeingAdded ? "true (ERROR!)" : "false (correct)")")
                    
                    // Handle response based on which button was clicked (public vs private)
                    // Public button (Add) → Add to addedUsernames → show "Added"
                    // Private button (Request🔒) → Add to sentFollowRequests → show "Requested"
                    let isAutoAccepted = response.autoAccepted == true
                    let isPending = response.status?.lowercased() == "pending"
                    let isActive = response.status?.lowercased() == "active"
                    let responseStatus = response.status?.lowercased() ?? "unknown"
                    let message = response.message?.lowercased() ?? ""
                    let isAlreadyPending = message.contains("already pending")
                    let isAlreadyAccepted = message.contains("already accepted")
                    
                    print("   📊 Response analysis:")
                    print("      - isAutoAccepted: \(isAutoAccepted)")
                    print("      - isPending: \(isPending)")
                    print("      - isActive: \(isActive)")
                    print("      - responseStatus: \(responseStatus)")
                    print("      - isAlreadyPending: \(isAlreadyPending)")
                    print("      - isAlreadyAccepted: \(isAlreadyAccepted)")
                    
                    // CRITICAL: Always update UI optimistically if we got a response (even if success: false)
                    // This handles cases like "already pending" or "already accepted" where the API
                    // returns success: false but we still want to update the UI
                    if isPrivate {
                        // User clicked "Request🔒" button
                        // ONLY add to sentFollowRequests to show "Requested"
                        // DO NOT add to addedUsernames - user must explicitly click "Add" for that
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        
                        print("   📩 User clicked Request🔒 - adding to sent requests list")
                        print("   📧 Streamer email: \(streamerEmail.isEmpty ? "N/A" : streamerEmail)")
                        
                        // Determine status: use the status from the API response
                        // If status is "pending", "active", or "accepted", use it directly
                        // Otherwise default to "pending" for private requests
                        let requestStatus: String
                        if isPending || isAlreadyPending {
                            requestStatus = "pending"
                        } else if isActive || isAutoAccepted {
                            requestStatus = "active"
                        } else if responseStatus == "accepted" {
                            requestStatus = "accepted"
                        } else {
                            // Default to pending for private requests
                            requestStatus = "pending"
                        }
                        
                        let newSentRequest = SentFollowRequest(
                            requestedUserEmail: streamerEmail,
                            requestedUsername: cleanUsername,
                            requestedAt: ISO8601DateFormatter().string(from: Date()),
                            respondedAt: nil,
                            status: requestStatus
                        )
                        
                        if let existingIndex = sentFollowRequests.firstIndex(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }) {
                            print("   ⚠️ Already in sentFollowRequests list - updating status")
                            sentFollowRequests[existingIndex] = newSentRequest
                            print("   ✅ Updated sent request: \(cleanUsername)")
                        } else {
                            sentFollowRequests.append(newSentRequest)
                            print("   ✅ Added to sent requests: \(cleanUsername)")
                        }
                        print("   📊 Current sentFollowRequests count: \(sentFollowRequests.count)")
                        print("   📋 Current sent requests: \(sentFollowRequests.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
                        
                        // CRITICAL: Verify the update is actually in the array
                        let verifyExists = sentFollowRequests.contains(where: { 
                            $0.requestedUsername.lowercased() == cleanUsername.lowercased() &&
                            ($0.status.lowercased() == "pending" || $0.status.lowercased() == "active" || $0.status.lowercased() == "accepted")
                        })
                        if !verifyExists {
                            print("   🚨 CRITICAL: Request was NOT added to sentFollowRequests! Adding again...")
                            sentFollowRequests.append(newSentRequest)
                        }
                        print("   ✅ Verification: Request exists in array: \(sentFollowRequests.contains(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }))")
                    } else {
                        // User clicked "Add" button (public) - add to addedUsernames → show "Added"
                        // CRITICAL: ONLY update addedUsernames, NEVER touch sentFollowRequests
                        // These are COMPLETELY INDEPENDENT - clicking "Add" should NOT affect "Request🔒" state
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        
                        print("   ✅ Public user - adding to list (ONLY updating addedUsernames, NOT touching sentFollowRequests)")
                        
                        let newAddedUsername = AddedUsername(
                            streamerEmail: streamerEmail,
                            streamerUsername: cleanUsername,
                            addedAt: ISO8601DateFormatter().string(from: Date()),
                            streamerVisibility: "public"
                        )
                        
                        if let existingIndex = addedUsernames.firstIndex(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
                            print("⚠️ [ChannelDetailView] Username \(cleanUsername) already in addedUsernames list - updating")
                            addedUsernames[existingIndex] = newAddedUsername
                        } else {
                            addedUsernames.append(newAddedUsername)
                            print("✅ [ChannelDetailView] Optimistically added username: \(cleanUsername) (email: \(streamerEmail.isEmpty ? "N/A" : streamerEmail))")
                        }
                        
                        // CRITICAL: Remove from removedUsernames set if it was previously removed
                        // This allows the username to be added again if the user wants to
                        if removedUsernames.contains(cleanUsername.lowercased()) {
                            removedUsernames.remove(cleanUsername.lowercased())
                            print("   ✅ Removed '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        print("   📊 Current addedUsernames count: \(addedUsernames.count)")
                        print("   📋 Current usernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                        saveAddedUsernamesToUserDefaults()
                    }
                    
                    // CRITICAL: DO NOT automatically reload after clicking Request🔒
                    // The optimistic update is sufficient - reloading too soon can cause the UI to flip back
                    // Only reload on explicit refresh or when view appears
                    // This prevents the "Requested" button from flipping back to "Request"
                    if !isPrivate {
                        // User clicked "Add" - reload addedUsernames to sync with server
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
                    } else {
                        // User clicked "Request🔒" - DO NOT reload automatically
                        // Trust the optimistic update - it will sync on next view appear or manual refresh
                        print("   📩 [ChannelDetailView] User clicked Request🔒 - NOT reloading (trusting optimistic update)")
                        print("   ✅ Optimistic update will persist until next view appear or manual refresh")
                    }
                    
                    // If auto-accepted (public user), refresh content immediately
                    // If pending (private user), they'll see content after acceptance
                    if response.autoAccepted == true {
                        print("✅ [ChannelDetailView] Public user added - refreshing content")
                        Task {
                            try? await refreshChannelContent()
                        }
                    } else {
                        print("📩 [ChannelDetailView] Follow request sent to private user: \(cleanUsername)")
                        // DON'T reload sent requests immediately - trust the optimistic update
                        // Only reload on next view appear or manual refresh to avoid overwriting optimistic updates
                        print("   ✅ Trusting optimistic update - request button should show 'Requested' now")
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
                    // Remove from adding set on error (use same key format as insertion)
                    let removingKey = "\(cleanUsername.lowercased()):\(isPrivate ? "private" : "public")"
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
                    
                    // CRITICAL: For private requests, ALWAYS update UI optimistically on ANY error
                    // (except "User not found") because the request might have succeeded on the backend
                    // This includes timeouts, HTTP 500 errors, and other server errors
                    if isPrivate && !isUserNotFound {
                        print("   ⚠️ Error occurred for private request - updating UI optimistically (request may have succeeded)")
                        print("      Error type: \(isTimeout ? "timeout" : isServerError ? "server error" : "other")")
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        let newSentRequest = SentFollowRequest(
                            requestedUserEmail: streamerEmail,
                            requestedUsername: cleanUsername,
                            requestedAt: ISO8601DateFormatter().string(from: Date()),
                            respondedAt: nil,
                            status: "pending"
                        )
                        
                        if let existingIndex = sentFollowRequests.firstIndex(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }) {
                            print("   🔄 Updating existing request in sentFollowRequests")
                            sentFollowRequests[existingIndex] = newSentRequest
                        } else {
                            print("   ➕ Adding new request to sentFollowRequests")
                            sentFollowRequests.append(newSentRequest)
                        }
                        print("   ✅ Optimistically updated UI - button should show 'Requested'")
                        print("   📊 Current sentFollowRequests count: \(sentFollowRequests.count)")
                        print("   📋 Contains '\(cleanUsername)': \(sentFollowRequests.contains(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }))")
                        
                        // Show a warning message for server errors but don't block the UI
                        if isServerError || isTimeout {
                            errorMessage = isServerError ? 
                                "Request may have encountered an error, but was sent. Please check your connection." :
                                "Request may have timed out, but request was sent. Please check your connection."
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
                        
                        if isPrivate {
                            // User clicked "Request🔒" - add to sentFollowRequests with "pending" status
                            let newSentRequest = SentFollowRequest(
                                requestedUserEmail: streamerEmail,
                                requestedUsername: cleanUsername,
                                requestedAt: ISO8601DateFormatter().string(from: Date()),
                                respondedAt: nil,
                                status: "pending"
                            )
                            
                            if let existingIndex = sentFollowRequests.firstIndex(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }) {
                                print("   ⚠️ Already in sentFollowRequests list - updating status to pending")
                                sentFollowRequests[existingIndex] = newSentRequest
                            } else {
                                sentFollowRequests.append(newSentRequest)
                                print("   ✅ Optimistically added pending request: \(cleanUsername)")
                            }
                        } else {
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
                            if removedUsernames.contains(cleanUsername.lowercased()) {
                                removedUsernames.remove(cleanUsername.lowercased())
                                print("   ✅ Removed '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                                saveRemovedUsernamesToUserDefaults()
                            }
                            
                            saveAddedUsernamesToUserDefaults()
                        }
                        
                        // Reload sent follow requests to update UI (merge to preserve optimistic updates)
                        loadSentFollowRequests(mergeWithExisting: true)
                        if !isPrivate {
                            // Also reload added usernames for public requests
                            loadAddedUsernames(mergeWithExisting: true)
                        }
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
                        
                        // CRITICAL: Remove from removedUsernames set if it was previously removed
                        if removedUsernames.contains(cleanUsername.lowercased()) {
                            removedUsernames.remove(cleanUsername.lowercased())
                            print("   ✅ Removed '\(cleanUsername.lowercased())' from removedUsernames set (can be added again)")
                            saveRemovedUsernamesToUserDefaults()
                        }
                        
                        saveAddedUsernamesToUserDefaults()
                        
                        // Also update sentFollowRequests with "active" status
                        let newSentRequest = SentFollowRequest(
                            requestedUserEmail: streamerEmail,
                            requestedUsername: cleanUsername,
                            requestedAt: ISO8601DateFormatter().string(from: Date()),
                            respondedAt: nil,
                            status: "active"
                        )
                        
                        if let existingIndex = sentFollowRequests.firstIndex(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }) {
                            sentFollowRequests[existingIndex] = newSentRequest
                        } else {
                            sentFollowRequests.append(newSentRequest)
                        }
                        
                        // Reload both added usernames and sent requests to update UI
                        loadAddedUsernames(mergeWithExisting: true)
                        loadSentFollowRequests(mergeWithExisting: true)
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
    
    // Check if username is already added
    // NOTE: This is completely independent of the "Request🔒" workflow
    // "Add" button tracks public username addition (addedUsernames)
    // "Request🔒" button tracks private request workflow (sentFollowRequests)
    // These should never affect each other
    private func isUsernameAdded(_ username: String) -> Bool {
        // Remove 🔒 from username for comparison (addedUsernames stores clean usernames)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let isAdded = addedUsernames.contains(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() })
        return isAdded
    }
    
    // Check if a follow request was already sent for this username
    // Returns true if there's any request record (pending, accepted, or active)
    // CRITICAL: One-way flow - once "Requested", can't go back to "Request"
    // Standard lifecycle (like Instagram/Snapchat):
    // Request → Requested (pending/declined) → Approved (accepted) → Rejected (if removed)
    // CRITICAL: Once "Requested", can't go back to "Request" (one-way flow)
    // If declined, requester still sees "Requested" (can't request again)
    private func isFollowRequestSent(_ username: String) -> Bool {
        // Remove 🔒 from username for comparison
        let usernameLower = username.lowercased().replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let isSent = sentFollowRequests.contains(where: { 
            let requestedLower = $0.requestedUsername.lowercased()
            let status = $0.status.lowercased()
            // Show "Requested" for:
            // - pending: request sent, waiting for response
            // - declined: request declined, but requester still sees "Requested" (can't request again)
            // - accepted: request approved (but also check if in addedUsernames for "Approved" button)
            // Don't show for rejected (was approved then removed)
            return requestedLower == usernameLower && 
                   (status == "pending" || status == "declined" || status == "accepted")
        })
        if isSent {
            print("✅ [ChannelDetailView] Follow request already sent for: \(username)")
        }
        return isSent
    }
    
    // Check if a follow request was approved (accepted status)
    // If approved, user should see "Approved" with remove option
    private func isFollowRequestApproved(_ username: String) -> Bool {
        let usernameLower = username.lowercased().replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        return sentFollowRequests.contains(where: { 
            $0.requestedUsername.lowercased() == usernameLower && 
            $0.status.lowercased() == "accepted"
        })
    }
    
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
                    
                    // Filter out removed usernames
                    var serverRequests = allPendingRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from pending requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let activeRequests = allActiveRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from active requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let acceptedRequests = allAcceptedRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("🚫 [DEBUG] Filtering out removed username from accepted requests: '\(request.requestedUsername)' (lowercased: '\(lowercased)')")
                        }
                        return !isRemoved
                    }
                    
                    let declinedRequests = allDeclinedRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
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
                        for existingRequest in sentFollowRequests {
                            let existingUsername = existingRequest.requestedUsername.lowercased()
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
                        sentFollowRequests = serverRequests
                        print("✅ [ChannelDetailView] Loaded \(sentFollowRequests.count) sent follow requests (\(pendingResult.requests?.count ?? 0) pending + \(activeRequests.count) active)")
                    }
                    
                    // FINAL VERIFICATION: Double-check that no removed usernames made it through
                    let finalFiltered = sentFollowRequests.filter { request in
                        let lowercased = request.requestedUsername.lowercased()
                        let isRemoved = removedUsernames.contains(lowercased)
                        if isRemoved {
                            print("   🚨 [DEBUG] CRITICAL: Found removed username in final sentFollowRequests list! '\(request.requestedUsername)' (lowercased: '\(lowercased)') - REMOVING IT NOW")
                        }
                        return !isRemoved
                    }
                    
                    if finalFiltered.count != sentFollowRequests.count {
                        print("   🚨 [DEBUG] CRITICAL: Had to remove \(sentFollowRequests.count - finalFiltered.count) removed username(s) from final sentFollowRequests list!")
                        sentFollowRequests = finalFiltered
                    }
                    
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
    private func loadReceivedFollowRequests() {
        guard let userEmail = authService.userEmail else { return }
        
        isLoadingReceivedRequests = true
        Task {
            do {
                let response = try await ChannelService.shared.getFollowRequests(userEmail: userEmail, status: "pending")
                await MainActor.run {
                    receivedFollowRequests = response.requests ?? []
                    isLoadingReceivedRequests = false
                    print("✅ [ChannelDetailView] Loaded \(receivedFollowRequests.count) received follow requests")
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading received follow requests: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingReceivedRequests = false
                }
            }
        }
    }
    
    // Accept a follow request
    private func acceptFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.acceptFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        receivedFollowRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [ChannelDetailView] Accepted follow request from \(requesterEmail)")
                        // Reload added usernames to reflect the new follower
                        loadAddedUsernames(mergeWithExisting: true)
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error accepting follow request: \(error.localizedDescription)")
            }
        }
    }
    
    // Decline a follow request
    private func declineFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.declineFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        receivedFollowRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [ChannelDetailView] Declined follow request from \(requesterEmail)")
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error declining follow request: \(error.localizedDescription)")
            }
        }
    }
    
    // Follow requests sheet
    private var followRequestsSheet: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if isLoadingReceivedRequests {
                    ProgressView()
                        .tint(.white)
                } else if receivedFollowRequests.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("No Follow Requests")
                            .font(.headline)
                            .foregroundColor(.white)
                        Text("You don't have any pending follow requests")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(receivedFollowRequests) { request in
                                HStack(alignment: .center, spacing: 12) {
                                    // Icon and username inline
                                    HStack(spacing: 8) {
                                        Image(systemName: "person.badge.plus")
                                            .font(.system(size: 16))
                                            .foregroundColor(.twillyTeal)
                                        
                                        Text(request.requesterUsername)
                                            .font(.headline)
                                            .foregroundColor(.white)
                                    }
                                    
                                    Spacer()
                                    
                                    // Action buttons
                                    HStack(spacing: 8) {
                                        Button(action: {
                                            acceptFollowRequest(request.requesterEmail)
                                        }) {
                                            Text("Accept")
                                                .font(.subheadline)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.white)
                                                .lineLimit(1)
                                                .fixedSize(horizontal: true, vertical: false)
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 8)
                                                .background(Color.twillyTeal)
                                                .cornerRadius(8)
                                        }
                                        
                                        Button(action: {
                                            declineFollowRequest(request.requesterEmail)
                                        }) {
                                            Text("Decline")
                                                .font(.subheadline)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.white)
                                                .lineLimit(1)
                                                .fixedSize(horizontal: true, vertical: false)
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 8)
                                                .background(Color.red.opacity(0.7))
                                                .cornerRadius(8)
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                                .background(Color.black.opacity(0.2))
                                
                                if request.id != receivedFollowRequests.last?.id {
                                    Divider()
                                        .background(Color.white.opacity(0.1))
                                }
                            }
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle("Private Requests")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        // Refresh follow requests and notifications
                        loadReceivedFollowRequests()
                        // Also trigger notification fetch to get latest notifications
                        if let userEmail = authService.userEmail {
                            Task {
                                // Fetch notifications which will post NewFollowRequestReceived if new requests found
                                do {
                                    let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 50, unreadOnly: false)
                                    // Check if there are new follow request notifications
                                    let hasFollowRequest = (response.notifications ?? []).contains { $0.type == "follow_request" && !$0.isRead }
                                    if hasFollowRequest {
                                        // Trigger refresh
                                        await MainActor.run {
                                            NotificationCenter.default.post(
                                                name: NSNotification.Name("NewFollowRequestReceived"),
                                                object: nil
                                            )
                                        }
                                    }
                                } catch {
                                    print("⚠️ [ChannelDetailView] Error fetching notifications for refresh: \(error.localizedDescription)")
                                }
                            }
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.white)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        showingFollowRequests = false
                    }
                    .foregroundColor(.white)
                }
            }
            .onAppear {
                // Refresh when sheet appears to get latest requests
                loadReceivedFollowRequests()
                // Also fetch notifications to trigger NewFollowRequestReceived if needed
                if let userEmail = authService.userEmail {
                    Task {
                        do {
                            let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 50, unreadOnly: false)
                            let hasFollowRequest = (response.notifications ?? []).contains { $0.type == "follow_request" && !$0.isRead }
                            if hasFollowRequest {
                                await MainActor.run {
                                    NotificationCenter.default.post(
                                        name: NSNotification.Name("NewFollowRequestReceived"),
                                        object: nil
                                    )
                                }
                            }
                        } catch {
                            print("⚠️ [ChannelDetailView] Error fetching notifications on appear: \(error.localizedDescription)")
                        }
                    }
                }
            }
        }
    }
    
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
                        // Reload sent requests to get updated status
                        loadSentFollowRequests(mergeWithExisting: false)
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
    private func deselectAddedUsername(_ username: String, email: String?) {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot deselect - userEmail is nil")
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        print("🔴 [ChannelDetailView] ========== DESELECT ADDED USERNAME ==========")
        print("   📝 Username: '\(username)' -> clean: '\(cleanUsername)'")
        print("   📧 Email parameter: \(email ?? "nil")")
        print("   📊 Current addedUsernames count: \(addedUsernames.count)")
        print("   📋 Current addedUsernames: \(addedUsernames.map { "\($0.streamerUsername) (email: \($0.streamerEmail))" }.joined(separator: ", "))")
        
        // Find the AddedUsername object to get the email
        guard let addedUsername = addedUsernames.first(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) else {
            print("❌ [ChannelDetailView] Could not find username in addedUsernames: \(cleanUsername)")
            print("   🔍 Searched in: \(addedUsernames.map { $0.streamerUsername.lowercased() }.joined(separator: ", "))")
            return
        }
        
        var emailToUse = email ?? addedUsername.streamerEmail
        print("   ✅ Found username in addedUsernames")
        print("   📧 Email from parameter: \(email ?? "nil")")
        print("   📧 Email from addedUsername: \(addedUsername.streamerEmail)")
        print("   📧 Email to use (before lookup): \(emailToUse)")
        
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
                await performRemoveAddedUsername(cleanUsername: cleanUsername, email: emailToUse, userEmail: userEmail)
            }
            return
        }
        
        // Email is available, proceed with removal
        Task {
            await performRemoveAddedUsername(cleanUsername: cleanUsername, email: emailToUse, userEmail: userEmail)
        }
    }
    
    // Helper function to perform the actual removal
    private func performRemoveAddedUsername(cleanUsername: String, email: String, userEmail: String) async {
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
                    // CRITICAL: Always remove from local array optimistically when user clicks "Remove"
                    // This ensures the UI updates immediately, regardless of backend response
                    let beforeCount = addedUsernames.count
                    addedUsernames.removeAll { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }
                    let afterCount = addedUsernames.count
                    print("   📊 Optimistically removed from addedUsernames: \(beforeCount) -> \(afterCount) (removed \(beforeCount - afterCount) item(s))")
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
                    
                    // Track as removed (always, since user explicitly clicked Remove)
                    let lowercasedUsername = cleanUsername.lowercased()
                    removedUsernames.insert(lowercasedUsername)
                    print("   🚫 Added to removedUsernames set: '\(lowercasedUsername)' (original: '\(cleanUsername)')")
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
    
    // Deselect requested username - reverts "Requested" back to "Request🔒"
    // CRITICAL: This should ONLY affect sentFollowRequests, NEVER touch addedUsernames
    private func deselectRequestedUsername(_ username: String, email: String?) {
        // CRITICAL: This function should only be called for pending requests (not approved)
        // Once approved, use removeUsername() which handles the "rejected" status
        guard let userEmail = authService.userEmail else {
            print("⚠️ [ChannelDetailView] Cannot deselect - userEmail is nil")
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        // Find the SentFollowRequest object to get the email
        // Only allow deselection for pending requests (not approved - those use removeUsername)
        guard let sentRequest = sentFollowRequests.first(where: { 
            $0.requestedUsername.lowercased() == cleanUsername.lowercased() && 
            $0.status.lowercased() == "pending"
        }) else {
            print("⚠️ [ChannelDetailView] Could not find pending follow request for username: \(cleanUsername)")
            return
        }
        
        Task {
            do {
                print("🔴 [ChannelDetailView] ========== DESELECT REQUESTED USERNAME ==========")
                print("   📝 Username: '\(username)' -> clean: '\(cleanUsername)'")
                print("   📧 Email: \(email ?? "nil")")
                print("   📊 Current sentFollowRequests count: \(sentFollowRequests.count)")
                print("   📋 Current sentFollowRequests: \(sentFollowRequests.map { "\($0.requestedUsername) (status: \($0.status))" }.joined(separator: ", "))")
                
                // Call remove follow API endpoint (this will cancel the follow request)
                // The backend will delete the FOLLOW_REQUEST entry
                let response = try await ChannelService.shared.removeFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requestedUserEmail: email ?? sentRequest.requestedUserEmail
                )
                
                print("   ✅ API call successful!")
                print("   📥 Response: success=\(response.success), message=\(response.message ?? "nil")")
                
                await MainActor.run {
                    // CRITICAL: Always remove from local array optimistically when user clicks "Remove"
                    // This ensures the UI updates immediately, regardless of backend response
                    let beforeCount = sentFollowRequests.count
                    sentFollowRequests.removeAll { 
                        $0.requestedUsername.lowercased() == cleanUsername.lowercased() && 
                        ($0.status.lowercased() == "pending" || $0.status.lowercased() == "active" || $0.status.lowercased() == "accepted")
                    }
                    let afterCount = sentFollowRequests.count
                    print("   📊 Optimistically removed from sentFollowRequests: \(beforeCount) -> \(afterCount) (removed \(beforeCount - afterCount) item(s))")
                    
                    // Check what was actually deleted based on deletedType (for tracking purposes)
                    let deletedType = response.deletedType?.uppercased() ?? ""
                    print("   📥 Response deletedType: \(deletedType)")
                    
                    // CRITICAL: Do NOT remove from addedUsernames when removing Requested username
                    // Even if backend deleted ADDED_USERNAME, we should NOT remove it from addedUsernames
                    // because the user only clicked "Remove" on Requested, not Added
                    if deletedType == "ADDED_USERNAME" || deletedType == "BOTH" {
                        print("   ⚠️ WARNING: ADDED_USERNAME was also deleted by backend, but user only clicked Remove on Requested")
                        print("   ✅ NOT removing from addedUsernames - preserving public add")
                    }
                    
                    // Track as removed (always, since user explicitly clicked Remove)
                    let lowercasedUsername = cleanUsername.lowercased()
                    removedUsernames.insert(lowercasedUsername)
                    print("   🚫 Added to removedUsernames set: '\(lowercasedUsername)' (original: '\(cleanUsername)')")
                    saveRemovedUsernamesToUserDefaults()
                    
                    // If backend says "not found", it means it was already removed or never existed
                    let responseMessage = response.message?.lowercased() ?? ""
                    if responseMessage.contains("not in timeline") || responseMessage.contains("already removed") || responseMessage.contains("never added") {
                        print("   ℹ️ Backend says entry not found - keeping optimistic removal, NOT reloading from server")
                    } else if deletedType == "FOLLOW_REQUEST" || deletedType == "BOTH" {
                        // Reload only sentFollowRequests (NOT addedUsernames) to sync with server
                        print("   🔄 Backend deleted FOLLOW_REQUEST - reloading sentFollowRequests only")
                        loadSentFollowRequests(mergeWithExisting: true)
                    }
                    
                    print("✅ [ChannelDetailView] Deselected requested username: \(cleanUsername)")
                    
                    // Check if all usernames are now empty - if so, show message and auto-close
                    checkAndAutoCloseIfEmpty()
                }
            } catch {
                print("❌ [ChannelDetailView] Error deselecting requested username: \(error.localizedDescription)")
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
                            
                            TextField("Search username...", text: $usernameSearchText)
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
                                                
                                                Spacer()
                                                
                                                // Deselection buttons - both say "Remove"
                                                HStack(spacing: 8) {
                                                    // "Remove" button for added - only show if added
                                                    if item.isAdded {
                                                        Button(action: {
                                                            print("🟡 [ChannelDetailView] Removing Added from dropdown: \(item.username)")
                                                            deselectAddedUsername(item.username, email: item.email)
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
                                                    
                                                    // "Remove" button for requested - only show if requested
                                                    if item.isRequested {
                                                        Button(action: {
                                                            print("🟡 [ChannelDetailView] Removing Requested from dropdown: \(item.username)")
                                                            deselectRequestedUsername(item.username, email: item.email)
                                                        }) {
                                                            Text("Remove")
                                                                .font(.caption)
                                                                .fontWeight(.semibold)
                                                                .foregroundColor(.orange)
                                                                .padding(.horizontal, 10)
                                                                .padding(.vertical, 4)
                                                                .background(Color.orange.opacity(0.2))
                                                                .cornerRadius(6)
                                                        }
                                                    }
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
        if isLoading {
            loadingView
        } else if let error = errorMessage {
            errorView(error)
        } else if !content.isEmpty {
            // Show current content (filtering happens silently in background)
            contentListView
        } else if !previousContentBeforeFilter.isEmpty {
            // Show previous content if current is empty but we haven't confirmed yet (filtering in background)
            LazyVStack(spacing: 12) {
                ForEach(previousContentBeforeFilter) { item in
                    contentCard(for: item)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 20)
        } else {
            // Show "no content" message ONLY if we've confirmed there's truly no content
            // CRITICAL: Never show empty state unless hasConfirmedNoContent is explicitly true
            // Always show loading if we're loading, haven't loaded yet, or haven't confirmed no content
            if isLoading {
                // Still loading - show loading indicator
                loadingView
            } else if content.isEmpty && hasConfirmedNoContent {
                // Show empty state ONLY after explicitly confirming there's truly no content
                emptyStateView
            } else {
                // Fallback: show loading (don't assume empty until we've confirmed)
                // This handles: content.isEmpty && !hasConfirmedNoContent
                loadingView
            }
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
            // CRITICAL: Ensure sentFollowRequests and addedUsernames are loaded when search results appear
            // This ensures button states (Approved/Requested) are correct
            if sentFollowRequests.isEmpty || addedUsernames.isEmpty {
                print("🔄 [ChannelDetailView] Loading sentFollowRequests and addedUsernames for search results...")
                loadSentFollowRequests(mergeWithExisting: true)
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
        
        // Only show buttons if user has public (with or without private)
        // If user only has private (no public), show nothing
        let hasPublic = publicResult != nil
        let hasOnlyPrivate = privateResult != nil && publicResult == nil
        
        // Don't show row if user only has private (no public)
        if hasOnlyPrivate {
            EmptyView()
        } else {
            HStack {
                Image(systemName: "person.circle.fill")
                    .foregroundColor(.twillyTeal)
                
                Text(displayUsername)
                    .foregroundColor(.white)
                
                Spacer()
                
                // Show buttons based on what exists
                HStack(spacing: 8) {
                    // Only show Add button if public exists (and no private, or both exist)
                    if let publicResult = publicResult {
                        publicAccountButton(for: publicResult)
                    }
                    
                    // Show Request🔒 button if private exists (only if public also exists)
                    if let privateResult = privateResult, publicResult != nil {
                        privateAccountButton(for: privateResult)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.05))
            
            if baseUsernameKey != groupedResults.keys.sorted().last {
                Divider()
                    .background(Color.white.opacity(0.1))
            }
        }
    }
    
    @ViewBuilder
    private func publicAccountButton(for result: UsernameSearchResult) -> some View {
        // Public button should always show Add/Added, never Request
        // Check if already added FIRST - if added, allow deselection
        if isUsernameAdded(result.username) {
            Button(action: {
                print("🟡 [ChannelDetailView] ADDED BUTTON TAPPED - deselecting")
                deselectAddedUsername(result.username, email: result.email)
            }) {
                Text("Added")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.twillyCyan)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.twillyCyan.opacity(0.2))
                    .cornerRadius(6)
            }
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
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
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
                        .cornerRadius(6)
                }
            }
        }
    }
    
    @ViewBuilder
    private func privateAccountButton(for result: UsernameSearchResult) -> some View {
        let cleanPrivateUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        // Priority order: Approved (with remove) > Requested > Being Added (spinner) > Request🔒 button
        // Standard lifecycle (like Instagram/Snapchat):
        // Request → Requested (pending/declined) → Approved (accepted, in addedUsernames) → Rejected (if removed)
        // CRITICAL: Once "Requested", can't go back to "Request" (one-way flow)
        // If declined, requester still sees "Requested" (can't request again)
        
        // Check if request was approved AND user is in addedUsernames (has access)
        let isApproved = isFollowRequestApproved(result.username)
        let isInAddedUsernames = addedUsernames.contains(where: { 
            $0.streamerUsername.lowercased() == cleanPrivateUsername.lowercased() 
        })
        
        // DEBUG: Log button state determination
        print("🔍 [ChannelDetailView] Button state for '\(cleanPrivateUsername)':")
        print("   isApproved: \(isApproved)")
        print("   isInAddedUsernames: \(isInAddedUsernames)")
        print("   sentFollowRequests count: \(sentFollowRequests.count)")
        print("   addedUsernames count: \(addedUsernames.count)")
        if isApproved {
            let approvedRequest = sentFollowRequests.first(where: { 
                $0.requestedUsername.lowercased() == cleanPrivateUsername.lowercased() && 
                $0.status.lowercased() == "accepted"
            })
            print("   Approved request found: \(approvedRequest != nil ? "YES" : "NO")")
            if let req = approvedRequest {
                print("   Request details: username=\(req.requestedUsername), status=\(req.status)")
            }
        }
        if !isInAddedUsernames {
            let matchingAdded = addedUsernames.filter { 
                $0.streamerUsername.lowercased() == cleanPrivateUsername.lowercased() 
            }
            print("   Matching addedUsernames: \(matchingAdded.count)")
            print("   All addedUsernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
        }
        
        if isApproved && isInAddedUsernames {
            // Request was approved - show "Approved" with remove option
            // User is in addedUsernames, can remove which sets status to "rejected"
            Button(action: {
                print("🟡 [ChannelDetailView] APPROVED BUTTON TAPPED - removing")
                removeUsername(cleanPrivateUsername)
            }) {
                Text("Approved")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(6)
            }
        } else if isFollowRequestSent(result.username) {
            // Request was sent but not yet approved (or declined) - show "Requested" (one-way, can't go back)
            // CRITICAL: Once "Requested", button should NOT allow deselection (one-way flow)
            // This includes: pending (waiting), declined (still shows "Requested" from requester's perspective)
            // Only show "Requested" - no action button (can't cancel once requested)
            Text("Requested")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.orange)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.orange.opacity(0.2))
                .cornerRadius(6)
        } else {
            // Check if THIS SPECIFIC private button is being added (not public)
            // Only show spinner for private button if it's the private key being added
            let privateKey = "\(cleanPrivateUsername.lowercased()):private"
            let isPrivateBeingAdded = addingUsernames.contains(privateKey)
            
            if isPrivateBeingAdded {
                // Show spinner while THIS private request is being processed
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
            } else {
                // Private exists, show Request🔒 button
                Button(action: {
                    print("🟢 [ChannelDetailView] REQUEST🔒 BUTTON TAPPED (private)")
                    print("   Username: '\(result.username)'")
                    print("   Email: \(result.email ?? "nil")")
                    addUsernameInline(result.username, email: result.email)
                }) {
                    Text("Request🔒")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
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
            Image(systemName: "video.slash")
                .font(.system(size: 40))
                .foregroundColor(.white.opacity(0.5))
            Text("No Content Available")
                .font(.headline)
                .foregroundColor(.white)
            Text("This channel doesn't have any visible content yet")
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(.top, 40)
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
        let isOwnContent = item.creatorUsername?.lowercased() == authService.username?.lowercased()
        
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
            } : nil,
            isOwnContent: isOwnContent,
            isFavorite: isFavorite(item),
            onFavorite: {
                toggleFavorite(for: item)
            }
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
        // Load more when user scrolls near the end (last 3 items)
        if let index = content.firstIndex(where: { $0.id == item.id }),
           index >= content.count - 3,
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
                hasLoaded = true
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
            return (result.content, result.nextToken, result.hasMore)
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
        let sourceContent = cachedUnfilteredContent.isEmpty ? content : cachedUnfilteredContent
        var filtered = sourceContent.filter { item in
            let isPrivate = item.isPrivateUsername == true
            if showPrivateContent {
                // PRIVATE VIEW: STRICT - only items where isPrivateUsername is EXPLICITLY true
                if !isPrivate {
                    print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in instant filter: \(item.fileName)")
                }
                return isPrivate
            } else {
                // PUBLIC VIEW: STRICT - only items where isPrivateUsername is NOT true
                if isPrivate {
                    print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in instant filter: \(item.fileName)")
                }
                return !isPrivate
            }
        }
        
        // Also apply "own content" filter if active
        if showOnlyOwnContent, let username = authService.username {
            filtered = filtered.filter { item in
                item.creatorUsername?.lowercased() == username.lowercased()
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
                var filtered = result.content.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if showPrivateContent {
                        // PRIVATE VIEW: STRICT - only explicitly private items
                        if !isPrivate {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in background fetch: \(item.fileName)")
                        }
                        return isPrivate
                    } else {
                        // PUBLIC VIEW: STRICT - only non-private items
                        if isPrivate {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in background fetch: \(item.fileName)")
                        }
                        return !isPrivate
                    }
                }
                
                if showOnlyOwnContent, let username = authService.username {
                    filtered = filtered.filter { item in
                        item.creatorUsername?.lowercased() == username.lowercased()
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
                if showPrivateContent {
                    // PRIVATE VIEW: STRICT - only explicitly private items
                    if !isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in optimized filter: \(item.fileName)")
                    }
                    return isPrivate
                } else {
                    // PUBLIC VIEW: STRICT - only non-private items
                    if isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in optimized filter: \(item.fileName)")
                    }
                    return !isPrivate
                }
            }
            
            // Also apply "own content" filter if active
            if showOnlyOwnContent, let username = authService.username {
                filtered = filtered.filter { item in
                    item.creatorUsername?.lowercased() == username.lowercased()
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
                            return isPrivate // PRIVATE VIEW: Show only private videos
                        }
                        
                        // Also apply "own content" filter if active
                        if showOnlyOwnContent, let username = authService.username {
                            filtered = filtered.filter { item in
                                item.creatorUsername?.lowercased() == username.lowercased()
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
        await MainActor.run {
            let filtered = content.filter { item in
                let isPrivate = item.isPrivateUsername == true
                if showPrivateContent {
                    // PRIVATE VIEW: STRICT - only explicitly private items
                    if !isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in visibility filter: \(item.fileName)")
                    }
                    return isPrivate
                } else {
                    // PUBLIC VIEW: STRICT - only non-private items
                    if isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in visibility filter: \(item.fileName)")
                    }
                    return !isPrivate
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
                let filtered = result.content.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if showPrivateContent {
                        // PRIVATE VIEW: STRICT - only explicitly private items
                        if !isPrivate {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view in server filter: \(item.fileName)")
                        }
                        return isPrivate
                    } else {
                        // PUBLIC VIEW: STRICT - only non-private items
                        if isPrivate {
                            print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view in server filter: \(item.fileName)")
                        }
                        return !isPrivate
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
                            // updateContentWith already sets isLoading = false and hasLoaded = true, but ensure it's set
                            isLoading = false
                            hasLoaded = true
                            
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
                                let bothViews = try await channelService.fetchBothViewsContent(
                                    channelName: currentChannel.channelName,
                                    creatorEmail: currentChannel.creatorEmail,
                                    viewerEmail: viewerEmail,
                                    limit: 20,
                                    forceRefresh: true
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
                                    
                                    publicContent = strictlyPublic
                                    privateContent = strictlyPrivate
                                    publicNextToken = bothViews.publicNextToken
                                    privateNextToken = bothViews.privateNextToken
                                    publicHasMore = bothViews.publicHasMore
                                    privateHasMore = bothViews.privateHasMore
                                    
                                    // Update current view - use strictly filtered arrays
                                    if showPrivateContent {
                                        content = strictlyPrivate
                                        nextToken = privateNextToken
                                        hasMoreContent = privateHasMore
                                    } else {
                                        content = strictlyPublic
                                        nextToken = publicNextToken
                                        hasMoreContent = publicHasMore
                                    }
                                    
                                    cachedUnfilteredContent = publicContent + privateContent
                                    isLoading = false
                                    hasLoaded = true
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
                                    hasLoaded = true
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
                                hasLoaded = true
                                print("✅ [ChannelDetailView] Content loaded - isLoading: \(isLoading), hasLoaded: \(hasLoaded), content.count: \(content.count)")
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
                            let bothViews = try await channelService.fetchBothViewsContent(
                                channelName: currentChannel.channelName,
                                creatorEmail: currentChannel.creatorEmail,
                                viewerEmail: viewerEmail,
                                limit: 20,
                                forceRefresh: forceRefresh
                            )
                            
                            // Filter on background thread for performance, then update UI incrementally
                            let strictlyPublic = await Task.detached(priority: .userInitiated) {
                                bothViews.publicContent.filter { item in
                                    let isPrivate = item.isPrivateUsername == true
                                    if isPrivate {
                                        print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned private item in public response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                                    }
                                    return !isPrivate
                                }
                            }.value
                            
                            let strictlyPrivate = await Task.detached(priority: .userInitiated) {
                                bothViews.privateContent.filter { item in
                                    let isPrivate = item.isPrivateUsername == true
                                    if !isPrivate {
                                        print("🚫 [ChannelDetailView] CRITICAL SECURITY: Server returned public item in private response - filtering: \(item.fileName) (creator: \(item.creatorUsername ?? "unknown"))")
                                    }
                                    return isPrivate
                                }
                            }.value
                            
                            // Update UI immediately with filtered content
                            await MainActor.run {
                                // Store both separately - use strictly filtered arrays
                                publicContent = strictlyPublic
                                privateContent = strictlyPrivate
                                publicNextToken = bothViews.publicNextToken
                                privateNextToken = bothViews.privateNextToken
                                publicHasMore = bothViews.publicHasMore
                                privateHasMore = bothViews.privateHasMore
                                bothViewsLoaded = true
                                
                                // Set current content based on showPrivateContent - use strictly filtered arrays
                                if showPrivateContent {
                                    content = strictlyPrivate
                                    nextToken = privateNextToken
                                    hasMoreContent = privateHasMore
                                } else {
                                    content = strictlyPublic
                                    nextToken = publicNextToken
                                    hasMoreContent = publicHasMore
                                }
                                
                                // Update cache with all content
                                cachedUnfilteredContent = publicContent + privateContent
                                
                                isLoading = false
                                hasLoaded = true
                                print("✅ [ChannelDetailView] Both views loaded in single request - public: \(publicContent.count), private: \(privateContent.count), showing: \(showPrivateContent ? "private" : "public")")
                            }
                            
                            // Check and delete short videos after content is loaded (background task)
                            Task.detached(priority: .utility) {
                                await checkAndDeleteShortVideos()
                            }
                        } catch {
                            print("❌ [ChannelDetailView] Error loading both views: \(error.localizedDescription)")
                            // Fallback to single load
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
                                hasLoaded = true
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
                            hasLoaded = true
                            print("✅ [ChannelDetailView] Final state - content.count: \(content.count), isLoading: \(isLoading), hasLoaded: \(hasLoaded), errorMessage: \(errorMessage ?? "nil")")
                            
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
                
                print("❌ [ChannelDetailView] Error fetching content: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                    hasLoaded = true
                    print("❌ [ChannelDetailView] Error state set - errorMessage: \(errorMessage ?? "nil"), isLoading: \(isLoading), hasLoaded: \(hasLoaded)")
                }
            }
        }
    }
    
    private func updateContentWith(_ fetchedContent: [ChannelContent], replaceLocal: Bool = false) {
        // CRITICAL: Optimize for speed - process efficiently, update UI immediately
        let isTwillyTV = currentChannel.channelName.lowercased() == "twilly tv"
        
        // For Twilly TV, split content into public and private arrays for instant toggle
        if isTwillyTV {
            // CRITICAL: Strict separation - public content must NEVER be in private array and vice versa
            // Process filtering efficiently in one pass
            var publicItems: [ChannelContent] = []
            var privateItems: [ChannelContent] = []
            publicItems.reserveCapacity(fetchedContent.count)
            privateItems.reserveCapacity(fetchedContent.count)
            
            for item in fetchedContent {
                if item.isPrivateUsername == true {
                    privateItems.append(item)
                } else {
                    publicItems.append(item)
                }
            }
            
            // Update public and private arrays
            if replaceLocal {
                publicContent = publicItems
                privateContent = privateItems
            } else {
                // Merge with existing, removing duplicates using Set for O(1) lookup
                var seenPublicSKs = Set(publicContent.map { $0.SK })
                var seenPrivateSKs = Set(privateContent.map { $0.SK })
                
                // Add new items efficiently
                for item in publicItems where !seenPublicSKs.contains(item.SK) {
                    publicContent.append(item)
                    seenPublicSKs.insert(item.SK)
                }
                for item in privateItems where !seenPrivateSKs.contains(item.SK) {
                    privateContent.append(item)
                    seenPrivateSKs.insert(item.SK)
                }
            }
            
            // Update current view content immediately
            if showPrivateContent {
                content = privateContent
            } else {
                content = publicContent
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
        
        // Deduplicate by SK (match managefiles.vue behavior) - optimized to reduce logging
        var seenSKs = Set<String>()
        let deduplicatedContent = contentToShow.filter { item in
            if seenSKs.contains(item.SK) {
                return false
            }
            seenSKs.insert(item.SK)
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
        
        // CRITICAL: Apply filters BEFORE preserving titles
        // 1. Filter for own content if active
        // 2. Filter for public/private content
        var filteredSortedContent = sortedContent
        if showOnlyOwnContent, let username = authService.username {
            filteredSortedContent = filteredSortedContent.filter { item in
                item.creatorUsername?.lowercased() == username.lowercased()
            }
            print("🔍 [ChannelDetailView] Filtering to own content: \(filteredSortedContent.count) items (from \(sortedContent.count) total)")
        }
        
        // CRITICAL: Strict public/private separation - SECURITY MEASURE
        // Public content must NEVER appear in private view and vice versa
        if currentChannel.channelName.lowercased() == "twilly tv" {
            if showPrivateContent {
                // PRIVATE VIEW: ONLY show items where isPrivateUsername is EXPLICITLY true
                // Block ALL public items (isPrivateUsername != true)
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if !isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking public item from private view: \(item.fileName) (isPrivateUsername: \(item.isPrivateUsername != nil ? String(describing: item.isPrivateUsername!) : "nil"))")
                    }
                    return isPrivate // STRICT: Only true values pass
                }
                print("🔒 [ChannelDetailView] PRIVATE VIEW: \(filteredSortedContent.count) items (strictly filtered)")
            } else {
                // PUBLIC VIEW: ONLY show items where isPrivateUsername is NOT true
                // Block ALL private items (isPrivateUsername == true)
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if isPrivate {
                        print("🚫 [ChannelDetailView] SECURITY: Blocking private item from public view: \(item.fileName) (isPrivateUsername: true)")
                    }
                    return !isPrivate // STRICT: Only non-true values pass
                }
                print("🌐 [ChannelDetailView] PUBLIC VIEW: \(filteredSortedContent.count) items (strictly filtered)")
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
        
        // Reset flags when content is successfully loaded
        if !content.isEmpty {
            hasConfirmedNoContent = false
            previousContentBeforeFilter = []
        } else {
            // For Twilly TV, never confirm "no content" - content might be in the other view (public/private)
            // Only confirm for non-Twilly TV channels
            if currentChannel.channelName.lowercased() != "twilly tv" {
                hasConfirmedNoContent = true
                print("ℹ️ [ChannelDetailView] Content is empty after update - setting hasConfirmedNoContent = true (non-Twilly TV)")
            } else {
                hasConfirmedNoContent = false
                print("ℹ️ [ChannelDetailView] Content is empty for Twilly TV - not confirming (might be in other view)")
            }
            previousContentBeforeFilter = []
        }
        
        // Minimal final logging to prevent UI freeze
        print("✅ [ChannelDetailView] Updated: \(content.count) items, isLoading: \(isLoading)")
        
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
                            hasLoaded = true
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
                                            hasLoaded = true
                                            // For Twilly TV, never confirm "no content"
                                            if currentChannel.channelName.lowercased() != "twilly tv" {
                                                hasConfirmedNoContent = true
                                            }
                                        }
                                    }
                                } catch {
                                    await MainActor.run {
                                        isLoading = false
                                        hasLoaded = true
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
                                hasLoaded = true
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
                                                hasLoaded = true
                                                // For Twilly TV, never confirm "no content"
                                                if currentChannel.channelName.lowercased() != "twilly tv" {
                                                    hasConfirmedNoContent = true
                                                }
                                            }
                                        }
                                    } catch {
                                        await MainActor.run {
                                            isLoading = false
                                            hasLoaded = true
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
                            hasLoaded = true
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
                                            hasLoaded = true
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
                                        hasLoaded = true
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
                        // Determine server title
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
                            // Extract string value from AnyCodable
                            if let stringValue = titleValue.value as? String, !stringValue.isEmpty {
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
        
        Task {
            do {
                // For Twilly TV, pass viewerEmail to filter by added usernames
                let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
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
                if showOnlyOwnContent, let username = authService.username {
                    filteredContent = result.content.filter { item in
                        item.creatorUsername?.lowercased() == username.lowercased()
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
    
    @State private var videoDuration: TimeInterval? = nil
    @State private var isLoadingDuration = false
    @State private var shouldHide = false // Hide card if duration < 6 seconds
    
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
    
    init(content: ChannelContent, onTap: @escaping () -> Void, onPlay: (() -> Void)? = nil, isLocalVideo: Bool = false, isUploadComplete: Bool = false, isPollingForThumbnail: Bool = false, channelCreatorUsername: String = "", channelCreatorEmail: String = "", isLatestContent: Bool = false, airScheduleLabel: String? = nil, showDeleteButton: Bool = false, onDelete: (() -> Void)? = nil, showEditButton: Bool = false, onEdit: (() -> Void)? = nil, isOwnContent: Bool = false, isFavorite: Bool = false, onFavorite: (() -> Void)? = nil) {
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
                            
                            // Creator username (with lock icon overlay for private streams - doesn't take space)
                            if let username = content.creatorUsername, !username.isEmpty {
                                HStack(spacing: 4) {
                                    Image(systemName: "person.circle.fill")
                                        .font(.system(size: 12))
                                        .foregroundColor(.twillyCyan)
                                    
                                    // Username text - display fully, no truncation
                                    Text(username)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.twillyCyan)
                                        .lineLimit(1) // Force single line
                                        .fixedSize(horizontal: true, vertical: false) // Allow horizontal expansion, prevent wrapping
                                    
                                    // Lock icon overlay - positioned absolutely, doesn't take layout space
                                    if content.isPrivateUsername == true {
                                        Image(systemName: "lock.fill")
                                            .font(.system(size: 10))
                                            .foregroundColor(.orange)
                                            .padding(.leading, 4) // Small spacing after username
                                    }
                                }
                                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading) // Allow HStack to take available space
                            }
                            
                            // Video duration
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
                            
                            // Favorite star button - below video duration
                            if let onFavorite = onFavorite {
                                Button(action: {
                                    onFavorite()
                                }) {
                                    Image(systemName: isFavorite ? "star.fill" : "star")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(isFavorite ? .yellow : .white.opacity(0.6))
                                }
                                .buttonStyle(PlainButtonStyle())
                                .padding(.top, 2)
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

struct VideoPlayerView: View {
    let url: URL
    let content: ChannelContent
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
        
        // Add pinch gesture for zoom
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        pinchGesture.delegate = self
        view.addGestureRecognizer(pinchGesture)
        
        print("   - Thumbnail URL: \(thumbnailUrl ?? "none")")
        print("   - Initial state: hasDetected=\(hasDetectedVideoOrientation), isPortrait=\(isPortraitVideo)")
        print("🔍 [OrientationAwarePlayerViewController] ========== viewDidLoad COMPLETE ==========")
    }
    
    private var initialZoomScale: CGFloat = 1.0
    private var currentZoomScale: CGFloat = 1.0
    private var zoomView: UIView?
    
    @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        // Find the video content view (usually the first subview with video content)
        if zoomView == nil {
            // AVPlayerViewController's content view is typically the view itself or its first subview
            zoomView = view.subviews.first { subview in
                // Look for the view that contains the video layer
                return subview.layer.sublayers?.contains(where: { $0 is AVPlayerLayer }) ?? false
            } ?? view
        }
        
        guard let targetView = zoomView else { return }
        
        switch gesture.state {
        case .began:
            initialZoomScale = currentZoomScale
            
        case .changed:
            let scale = gesture.scale
            let newScale = initialZoomScale * scale
            // Clamp zoom between 1.0 and 3.0
            currentZoomScale = max(1.0, min(3.0, newScale))
            
            // Apply zoom transform to the video view
            targetView.transform = CGAffineTransform(scaleX: currentZoomScale, y: currentZoomScale)
            
        case .ended, .cancelled:
            // Snap back to 1.0 if zoomed out too much
            if currentZoomScale < 1.1 {
                currentZoomScale = 1.0
                UIView.animate(withDuration: 0.3) {
                    targetView.transform = .identity
                }
            }
            
        default:
            break
        }
    }
    
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
    
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
            // Tracks not ready yet - retry after a short delay
            // For portrait videos, we want to be aggressive about detection
            print("⚠️ [OrientationAwarePlayerViewController] No video tracks yet, retrying...")
            print("   - Track source attempted: \(trackSource)")
            print("   - Player status: \(player.status.rawValue)")
            print("   - Current item status: \(currentItem.status.rawValue)")
            
            // Retry with multiple attempts to ensure we catch it
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                self?.updateVideoGravity()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.updateVideoGravity()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.updateVideoGravity()
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
                            
                            // Update video orientation if needed
                            if self.isPortraitVideo != thumbnailIsPortrait {
                                self.isPortraitVideo = thumbnailIsPortrait
                                self.hasDetectedVideoOrientation = true
                                self.videoGravity = thumbnailIsPortrait ? .resizeAspectFill : .resizeAspect
                                print("   - Updated video orientation from thumbnail")
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
        if videoIsPortrait {
            print("   - ✅ DETECTED AS PORTRAIT - will lock orientation and set fullscreen")
            print("   ✅ Setting videoGravity to resizeAspectFill (portrait - full screen)")
            let oldGravity = videoGravity
            videoGravity = .resizeAspectFill
            print("   ✅ VideoGravity changed from \(oldGravity.rawValue) to \(videoGravity.rawValue)")
            
            // CRITICAL: For portrait videos, AVPlayerLayer should handle the transform correctly
            // The video track's preferredTransform will be applied automatically
            // We just need to ensure the view controller is locked to portrait
            if let playerLayer = view.layer.sublayers?.first(where: { $0 is AVPlayerLayer }) as? AVPlayerLayer {
                print("   - 🔍 Found AVPlayerLayer - checking transform")
                let currentTransform = playerLayer.affineTransform()
                print("   - 🔍 Current layer transform: a=\(currentTransform.a), b=\(currentTransform.b), c=\(currentTransform.c), d=\(currentTransform.d)")
                // Don't force identity - let AVPlayerLayer use the video's natural transform
                // The transform is needed for portrait videos that were recorded with rotation metadata
                print("   - ✅ Portrait video - AVPlayerLayer will handle transform automatically")
            } else {
                print("   - ⚠️ Could not find AVPlayerLayer (might not be ready yet)")
            }
            
            // Force view to update layout immediately and ensure it's applied
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                // Ensure video gravity is set
                self.videoGravity = .resizeAspectFill
                self.view.setNeedsLayout()
                self.view.layoutIfNeeded()
                
                // Try to access player layer again after layout
                if let playerLayer = self.view.layer.sublayers?.first(where: { $0 is AVPlayerLayer }) as? AVPlayerLayer {
                    playerLayer.setAffineTransform(.identity)
                    print("   - ✅ Forced identity transform on player layer (after layout)")
                }
                
                // Force another update after a brief delay to ensure it sticks
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    self.videoGravity = .resizeAspectFill
                    self.view.setNeedsLayout()
                    self.view.layoutIfNeeded()
                    print("   ✅ Forced videoGravity update for portrait video")
                }
            }
        } else {
            print("   - ✅ DETECTED AS LANDSCAPE - will allow rotation and set natural aspect")
            print("   ✅ Setting videoGravity to resizeAspect (landscape - natural aspect, no zoom)")
            let oldGravity = videoGravity
            videoGravity = .resizeAspect
            print("   ✅ VideoGravity changed from \(oldGravity.rawValue) to \(videoGravity.rawValue)")
            // Force view to update layout
            view.setNeedsLayout()
            view.layoutIfNeeded()
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
