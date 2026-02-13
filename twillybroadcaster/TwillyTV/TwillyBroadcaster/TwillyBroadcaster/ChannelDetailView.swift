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
                            self.showOnlyOwnContent.toggle()
                        }
                        // Instantly switch between filtered and unfiltered lists
                        if self.showOnlyOwnContent {
                            // Switch to filtered list (owner's videos)
                            self.content = self.filteredOwnContent
                            // Disable pagination for filtered view - all content is already loaded
                            self.hasMoreContent = false
                            self.nextToken = nil
                            print("🔍 [ChannelDetailView] Switched to filtered content: \(self.content.count) items")
                        } else {
                            // Switch back to unfiltered list
                            self.content = self.originalUnfilteredContent
                            print("🔍 [ChannelDetailView] Switched to unfiltered content: \(self.content.count) items")
                        }
                    }) {
                        Image(systemName: self.showOnlyOwnContent ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                            .foregroundColor(self.showOnlyOwnContent ? .twillyCyan : .white)
                    }
                    // Private content toggle - show private content when enabled
                    Button(action: {
                        withAnimation {
                            showPrivateContent.toggle()
                        }
                        // Filter existing content based on private/public
                        Task {
                            await applyVisibilityFilter()
                        }
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: showPrivateContent ? "lock.fill" : "lock.open.fill")
                                .font(.system(size: 14))
                            Text(showPrivateContent ? "Private" : "Public")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(showPrivateContent ? .orange : .twillyCyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(showPrivateContent ? Color.orange.opacity(0.2) : Color.twillyCyan.opacity(0.2))
                        .cornerRadius(8)
                    }
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    showingSettings = true
                }) {
                    Image(systemName: "gear")
                        .foregroundColor(.white)
                }
            }
        }
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
        .onDisappear {
            // CRITICAL: Clean up all background tasks when view disappears
            // Stop polling when view disappears
            stopThumbnailPolling()
            // Stop auto-refresh task
            stopAutoRefresh()
            // Cancel any pending content loading tasks
            // (Tasks are automatically cancelled when view disappears, but explicit cancellation is safer)
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
        .onAppear {
            print("👁️ [ChannelDetailView] onAppear called - hasLoaded: \(hasLoaded), self.content.count: \(self.content.count), isLoading: \(isLoading), forceRefresh: \(forceRefresh)")
            print("   Channel: \(currentChannel.channelName)")
            print("   Poster URL at onAppear: \(currentChannel.posterUrl.isEmpty ? "EMPTY" : currentChannel.posterUrl)")
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
                print("✅ [ChannelDetailView] Local video added to content list - self.content.count: \(self.content.count)")
                // Start polling for thumbnail immediately
                startThumbnailPolling()
                // Clear global info after using it
                globalLocalVideoInfo = nil
            }
            // Always load server content if not already loaded or if forceRefresh
            if !hasLoaded || forceRefresh {
                print("🔄 [ChannelDetailView] Loading server content... (forceRefresh: \(forceRefresh), hasLocalVideo: \(localVideoContent != nil))")
                if localVideoContent == nil {
                    // No local video - show loading spinner
                    isLoading = true
                    if forceRefresh {
                        content = [] // Clear content on force refresh
                    }
                    errorMessage = nil
                }
                loadContent()
            } else {
                print("✅ [ChannelDetailView] Already loaded and not forcing refresh, skipping load")
            }
            // Start auto-refresh to check for new videos
            startAutoRefresh()
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
        .fullScreenCover(isPresented: $showingPlayer) {
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
        .onChange(of: showingPlayer) { newValue in
            print("🔄 [ChannelDetailView] showingPlayer changed to: \(newValue)")
            if newValue {
                print("   - selectedContent at change: \(selectedContent?.fileName ?? "nil")")
            }
        }
    }
    private var channelHeader: some View {
        VStack(alignment: .center, spacing: 12) {
            channelPoster
            channelInfo
        }
        .frame(maxWidth: .infinity)
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
                        SVGImageView(url: url)
                            .scaledToFill()
                            .onAppear {
                                print("✅ [ChannelDetailView] Loading SVG poster")
                                print("   URL: \(currentChannel.posterUrl)")
                            }
                    } else {
                        // Use AsyncImage for raster images (PNG, JPEG, etc.)
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
        .frame(maxWidth: .infinity)
        .frame(height: 200)
        .clipped()
        .cornerRadius(12)
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
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.twillyTeal.opacity(0.2),
                    Color.twillyCyan.opacity(0.1)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "tv.fill")
                .font(.system(size: 60))
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
        // Also load sent follow requests when loading added usernames
        loadSentFollowRequests()
        guard currentChannel.channelName.lowercased() == "twilly tv" else {
            return
        }
        // Try to load from UserDefaults first (even if email is temporarily unavailable)
        if !mergeWithExisting {
            if let userEmail = authService.userEmail {
                let cached = loadAddedUsernamesFromUserDefaults()
                if !cached.isEmpty {
                    addedUsernames = cached
                    print("✅ [ChannelDetailView] Loaded \(cached.count) added usernames from cache (showing immediately)")
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
                            if !cached.isEmpty {
                                addedUsernames = cached
                                print("✅ [ChannelDetailView] Loaded \(cached.count) added usernames from cache (delayed load)")
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
                        let serverUsernames = response.addedUsernames ?? []
                        var mergedUsernames: [AddedUsername] = []
                        let existingUsernamesLower = Set(addedUsernames.map { $0.streamerUsername.lowercased() })
                        let serverUsernamesLower = Set(serverUsernames.map { $0.streamerUsername.lowercased() })
                        // Start with existing (optimistic) usernames
                        mergedUsernames = addedUsernames
                        // Add server usernames that aren't already in the list
                        for serverUsername in serverUsernames {
                            if !existingUsernamesLower.contains(serverUsername.streamerUsername.lowercased()) {
                                mergedUsernames.append(serverUsername)
                                print("   ➕ Added server username: \(serverUsername.streamerUsername)")
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
                        print("✅ [ChannelDetailView] Merged added usernames: \(addedUsernames.count) total (kept optimistic updates)")
                    } else {
                        // Initial load: Replace with server data, but preserve cached data if server returns empty
                        let serverUsernames = response.addedUsernames ?? []
                        if !serverUsernames.isEmpty {
                            // Server has data - use it
                            addedUsernames = serverUsernames
                            print("✅ [ChannelDetailView] Loaded \(addedUsernames.count) added usernames from server (initial load)")
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
                    _ = try await ChannelService.shared.requestFollow(requesterEmail: userEmail, requestedUsername: username)
                    // Reload added usernames to get updated list (merge to preserve any optimistic updates)
                    loadAddedUsernames(mergeWithExisting: true)
                } catch {
                    print("⚠️ [ChannelDetailView] Could not auto-add own username: \(error.localizedDescription)")
                }
            }
        }
    }
    // Search usernames inline
    private func searchUsernamesInline() {
        // Cancel previous search task
        searchTask?.cancel()
        guard !usernameSearchText.isEmpty else {
            usernameSearchResults = []
            showSearchDropdown = false
            isSearchingUsernames = false
            return
        }
        // Debounce search by 300ms to avoid too many API calls
        searchTask = Task {
            do {
                try await Task.sleep(nanoseconds: 300_000_000) // 300ms delay
                // Check if task was cancelled
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    isSearchingUsernames = true
                }
                // Use visibility filter (default: "public")
                let results = try await ChannelService.shared.searchUsernames(query: usernameSearchText, limit: 10, visibilityFilter: searchVisibilityFilter)
                // Check again if task was cancelled
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    print("🔍 [ChannelDetailView] Search completed: Found \(results.count) results for '\(usernameSearchText)'")
                    usernameSearchResults = results
                    showSearchDropdown = !results.isEmpty
                    isSearchingUsernames = false
                    if results.isEmpty {
                        print("⚠️ [ChannelDetailView] No results found for '\(usernameSearchText)' with filter '\(searchVisibilityFilter)'")
                    } else {
                        print("✅ [ChannelDetailView] Showing dropdown with \(results.count) results")
                    }
                }
            } catch {
                guard !Task.isCancelled else { return }
                print("❌ [ChannelDetailView] Error searching usernames: \(error.localizedDescription)")
                await MainActor.run {
                    usernameSearchResults = []
                    showSearchDropdown = false
                    isSearchingUsernames = false
                }
            }
        }
    }
    // Add username inline
    private func addUsernameInline(_ username: String, email: String? = nil) {
        guard let userEmail = authService.userEmail else {
            return
        }
        // Remove 🔒 from username for API call (API expects username without lock)
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        // Check if already added
        if addedUsernames.contains(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
            print("ℹ️ [ChannelDetailView] Username already added: \(cleanUsername)")
            return
        }
        // Check if already being added
        if addingUsernames.contains(cleanUsername.lowercased()) {
            print("ℹ️ [ChannelDetailView] Username already being added: \(cleanUsername)")
            return
        }
        // Mark as being added
        addingUsernames.insert(cleanUsername.lowercased())
        Task {
            do {
                // Use clean username (without 🔒) for API call
                let response = try await ChannelService.shared.requestFollow(requesterEmail: userEmail, requestedUsername: cleanUsername)
                await MainActor.run {
                    // Remove from adding set (use cleanUsername, not username)
                    addingUsernames.remove(cleanUsername.lowercased())
                    // If auto-accepted (public), add to list immediately
                    // If pending (private), add to sent requests list
                    if response.autoAccepted == true {
                        // Optimistically add the username to the list immediately
                        // Use provided email, or find it from search results, or use empty string as fallback
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        let newAddedUsername = AddedUsername(
                            streamerEmail: streamerEmail,
                            streamerUsername: cleanUsername,
                            addedAt: ISO8601DateFormatter().string(from: Date()),
                            streamerVisibility: "public"
                        )
                        // Only add if not already present
                        if !addedUsernames.contains(where: { $0.streamerUsername.lowercased() == cleanUsername.lowercased() }) {
                            addedUsernames.append(newAddedUsername)
                            print("✅ [ChannelDetailView] Optimistically added username: \(cleanUsername) (email: \(streamerEmail.isEmpty ? "N/A" : streamerEmail))")
                            print("   📊 Current addedUsernames count: \(addedUsernames.count)")
                            print("   📋 Current usernames: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                            // Save to UserDefaults immediately
                            saveAddedUsernamesToUserDefaults()
                        } else {
                            print("⚠️ [ChannelDetailView] Username \(cleanUsername) already in addedUsernames list")
                        }
                    } else {
                        // Private user - add to sent requests list
                        let streamerEmail = email ?? usernameSearchResults.first(where: { $0.username.lowercased() == cleanUsername.lowercased() })?.email ?? ""
                        let newSentRequest = SentFollowRequest(
                            requestedUserEmail: streamerEmail,
                            requestedUsername: cleanUsername,
                            requestedAt: ISO8601DateFormatter().string(from: Date()),
                            respondedAt: nil,
                            status: "pending"
                        )
                        if !sentFollowRequests.contains(where: { $0.requestedUsername.lowercased() == cleanUsername.lowercased() }) {
                            sentFollowRequests.append(newSentRequest)
                            print("✅ [ChannelDetailView] Added to sent requests: \(cleanUsername)")
                        }
                    }
                    // Try to reload from server in the background (non-blocking)
                    // Wait a short delay to ensure backend has processed the request
                    Task {
                        do {
                            // Wait 1 second for backend to process (increased from 500ms)
                            try await Task.sleep(nanoseconds: 1_000_000_000)
                            // Use merge mode to preserve optimistic updates
                            loadAddedUsernames(mergeWithExisting: true)
                            // Also reload sent follow requests to update button states
                            loadSentFollowRequests()
                        } catch {
                            // Silently fail - we already have the optimistic update
                            print("⚠️ [ChannelDetailView] Could not refresh added usernames from server: \(error.localizedDescription)")
                            print("   Keeping optimistic update: \(addedUsernames.map { $0.streamerUsername }.joined(separator: ", "))")
                        }
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
                        // Reload sent requests to ensure UI is updated
                        loadSentFollowRequests()
                    }
                }
            } catch {
                print("❌ [ChannelDetailView] Error adding username: \(error)")
                print("   Error type: \(type(of: error))")
                print("   Error description: \(error.localizedDescription)")
                if let channelError = error as? ChannelServiceError {
                    print("   ChannelServiceError: \(channelError)")
                }
                await MainActor.run {
                    // Remove from adding set on error (use cleanUsername, not username)
                    addingUsernames.remove(cleanUsername.lowercased())
                    // Show error to user
                    errorMessage = "Failed to add username: \(error.localizedDescription)"
                }
            }
        }
    }
    // Check if username is already added
    private func isUsernameAdded(_ username: String) -> Bool {
        // CRITICAL: Public and private usernames are SEPARATE accounts
        // Check EXACT match (with or without 🔒) - don't remove locks
        // "POM-J" (public) and "POM-J🔒" (private) are DIFFERENT accounts
        let isAdded = addedUsernames.contains(where: { 
            $0.streamerUsername.lowercased() == username.lowercased() 
        })
        if isAdded {
            print("✅ [ChannelDetailView] Username '\(username)' is in addedUsernames list")
        }
        return isAdded
    }
    // Check if a follow request was already sent for this username
    private func isFollowRequestSent(_ username: String) -> Bool {
        // CRITICAL: Check EXACT match - don't remove locks
        // Public username "POM-J" and private username "POM-J🔒" are SEPARATE
        let isSent = sentFollowRequests.contains(where: { 
            $0.requestedUsername.lowercased() == username.lowercased() && $0.status == "pending"
        })
        if isSent {
            print("✅ [ChannelDetailView] Follow request already sent for: \(username)")
        }
        return isSent
    }
    // Load sent follow requests
    private func loadSentFollowRequests() {
        guard let userEmail = authService.userEmail else { return }
        isLoadingSentRequests = true
        Task {
            do {
                let response = try await ChannelService.shared.getSentFollowRequests(requesterEmail: userEmail, status: "pending")
                await MainActor.run {
                    sentFollowRequests = response.requests ?? []
                    isLoadingSentRequests = false
                    print("✅ [ChannelDetailView] Loaded \(sentFollowRequests.count) sent follow requests")
                }
            } catch {
                print("❌ [ChannelDetailView] Error loading sent follow requests: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingSentRequests = false
                }
            }
        }
    }
    // Check if username is currently being added
    private func isUsernameBeingAdded(_ username: String) -> Bool {
        return addingUsernames.contains(username.lowercased())
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
    private var channelInfo: some View {
        VStack(alignment: .center, spacing: 12) {
            // Hide channel name for Twilly TV
            if currentChannel.channelName.lowercased() != "twilly tv" {
                Text(currentChannel.channelName)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
            if !currentChannel.description.isEmpty {
                Text(currentChannel.description)
                    .font(.body)
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, currentChannel.channelName.lowercased() == "twilly tv" ? 0 : 4)
            }
            // Show badges and buttons based on user role
            VStack(alignment: .leading, spacing: 8) {
                // Collaborator badge - Show above Stream button for all collaborators (admin and non-admin)
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
                // For Twilly TV, show inline username search bar
                if currentChannel.channelName.lowercased() == "twilly tv" {
                    VStack(alignment: .leading, spacing: 8) {
                            // Search bar
                            HStack(spacing: 12) {
                            // Toggle added usernames dropdown (moved to left)
                            Button(action: {
                                withAnimation {
                                    showAddedUsernamesDropdown.toggle()
                                    // Clear search when opening/closing dropdown
                                    if !showAddedUsernamesDropdown {
                                        addedUsernamesSearchText = ""
                                    }
                                    // Close search dropdown when opening added usernames
                                    if showAddedUsernamesDropdown {
                                        showSearchDropdown = false
                                        usernameSearchText = ""
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
                                    if !addedUsernames.isEmpty {
                                        Text("\(addedUsernames.count)")
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
                            // Only show regular search field when added usernames dropdown is closed
                            if !showAddedUsernamesDropdown {
                            TextField("Search username...", text: $usernameSearchText)
                                .foregroundColor(.white)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .onChange(of: usernameSearchText) { newValue in
                                    // Close added usernames dropdown when searching
                                    if !newValue.isEmpty {
                                        showAddedUsernamesDropdown = false
                                        addedUsernamesSearchText = ""
                                        searchUsernamesInline()
                                    } else {
                                        // Cancel any pending search
                                        searchTask?.cancel()
                                        usernameSearchResults = []
                                        showSearchDropdown = false
                                        isSearchingUsernames = false
                                    }
                                }
                                .onTapGesture {
                                    if !usernameSearchText.isEmpty && !usernameSearchResults.isEmpty {
                                        showSearchDropdown = true
                                        showAddedUsernamesDropdown = false
                                    }
                                }
                            if !usernameSearchText.isEmpty {
                                Button(action: {
                                    usernameSearchText = ""
                                    usernameSearchResults = []
                                    showSearchDropdown = false
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white.opacity(0.6))
                                }
                            }
                            // Magnifying glass icon on the right
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.6))
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        // Visibility filter buttons for search
                        if !usernameSearchText.isEmpty {
                            HStack(spacing: 12) {
                                Button(action: {
                                    searchVisibilityFilter = "all"
                                    searchUsernamesInline()
                                }) {
                                    Text("All")
                                        .font(.caption)
                                        .fontWeight(searchVisibilityFilter == "all" ? .bold : .regular)
                                        .foregroundColor(searchVisibilityFilter == "all" ? .white : .gray)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(searchVisibilityFilter == "all" ? Color.twillyCyan.opacity(0.3) : Color.clear)
                                        .cornerRadius(8)
                                }
                                Button(action: {
                                    // Exit search when toggling visibility filter
                                    withAnimation {
                                        searchVisibilityFilter = "public"
                                        showSearchDropdown = false
                                        usernameSearchText = ""
                                        usernameSearchResults = []
                                        showAddedUsernamesDropdown = false
                                        addedUsernamesSearchText = ""
                                    }
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.caption2)
                                        Text("Public")
                                            .font(.caption)
                                            .fontWeight(searchVisibilityFilter == "public" ? .bold : .regular)
                                    }
                                    .foregroundColor(searchVisibilityFilter == "public" ? .white : .gray)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(searchVisibilityFilter == "public" ? Color.twillyCyan.opacity(0.3) : Color.clear)
                                    .cornerRadius(8)
                                }
                                Button(action: {
                                    // Exit search when toggling visibility filter
                                    withAnimation {
                                        searchVisibilityFilter = "private"
                                        showSearchDropdown = false
                                        usernameSearchText = ""
                                        usernameSearchResults = []
                                        showAddedUsernamesDropdown = false
                                        addedUsernamesSearchText = ""
                                    }
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "lock.fill")
                                            .font(.caption2)
                                        Text("Private")
                                            .font(.caption)
                                            .fontWeight(searchVisibilityFilter == "private" ? .bold : .regular)
                                    }
                                    .foregroundColor(searchVisibilityFilter == "private" ? .white : .gray)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(searchVisibilityFilter == "private" ? Color.orange.opacity(0.3) : Color.clear)
                                    .cornerRadius(8)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 8)
                        }
                        // Search results dropdown
                        if showSearchDropdown && !usernameSearchResults.isEmpty {
                            VStack(alignment: .leading, spacing: 0) {
                                ForEach(usernameSearchResults.prefix(5)) { result in
                                    HStack {
                                        Image(systemName: "person.circle.fill")
                                            .foregroundColor(.twillyTeal)
                                        // Show displayUsername if available (includes 🔒 for private), otherwise username
                                        // CRITICAL: Username already contains 🔒 if it's private - don't add lock icon
                                        Text(result.displayName)
                                            .foregroundColor(.white)
                                        Spacer()
                                        // CRITICAL: Public and private usernames are SEPARATE accounts
                                        // Public: "POM-J" → shows "Add" or "Added"
                                        // Private: "POM-J🔒" → shows "Request" or "Requested"
                                        let isPrivate = result.isPrivate == true || result.username.contains("🔒")
                                        if isUsernameBeingAdded(result.username) {
                                            ProgressView()
                                                .tint(.white)
                                                .scaleEffect(0.8)
                                        } else if isPrivate {
                                            // Private username logic: Check if requested or added
                                            if isFollowRequestSent(result.username) {
                                                // Follow request already sent
                                                Button(action: {}) {
                                                    Text("Requested")
                                                        .font(.caption)
                                                        .fontWeight(.semibold)
                                                        .foregroundColor(.orange)
                                                        .padding(.horizontal, 12)
                                                        .padding(.vertical, 6)
                                                        .background(Color.orange.opacity(0.2))
                                                        .cornerRadius(6)
                                                }
                                                .disabled(true)
                                            } else if isUsernameAdded(result.username) {
                                                // Private username was added (after acceptance)
                                                Button(action: {}) {
                                                    Text("Added")
                                                        .font(.caption)
                                                        .fontWeight(.semibold)
                                                        .foregroundColor(.twillyCyan)
                                                        .padding(.horizontal, 12)
                                                        .padding(.vertical, 6)
                                                        .background(Color.twillyCyan.opacity(0.2))
                                                        .cornerRadius(6)
                                                }
                                                .disabled(true)
                                            } else {
                                                // Show "Request" for private usernames
                                                Button(action: {
                                                    addUsernameInline(result.username, email: result.email)
                                                }) {
                                                    Text("Request")
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
                                        } else {
                                            // Public username logic: Check if added
                                            if isUsernameAdded(result.username) {
                                                Button(action: {}) {
                                                    Text("Added")
                                                        .font(.caption)
                                                        .fontWeight(.semibold)
                                                        .foregroundColor(.twillyCyan)
                                                        .padding(.horizontal, 12)
                                                        .padding(.vertical, 6)
                                                        .background(Color.twillyCyan.opacity(0.2))
                                                        .cornerRadius(6)
                                                }
                                                .disabled(true)
                                            } else {
                                                // Show "Add" for public usernames
                                                Button(action: {
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
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(Color.white.opacity(0.05))
                                    if result.id != usernameSearchResults.prefix(5).last?.id {
                                        Divider()
                                            .background(Color.white.opacity(0.1))
                                    }
                                }
                            }
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .padding(.top, 4)
                            .zIndex(1000) // Ensure dropdown appears above other content
                            .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                        }
                        // Debug: Show loading state
                        if isSearchingUsernames && !usernameSearchText.isEmpty {
                            HStack {
                                ProgressView()
                                    .tint(.white)
                                Text("Searching...")
                                    .foregroundColor(.white.opacity(0.7))
                                    .font(.caption)
                            }
                            .padding(.top, 4)
                        }
                        // Debug: Show "no results" message
                        if !isSearchingUsernames && !usernameSearchText.isEmpty && usernameSearchResults.isEmpty && !showSearchDropdown {
                            Text("No users found")
                                .foregroundColor(.white.opacity(0.5))
                                .font(.caption)
                                .padding(.top, 4)
                        }
                        // Added usernames dropdown with search
                        if showAddedUsernamesDropdown {
                            VStack(alignment: .leading, spacing: 0) {
                                // Search field and visibility filter for added usernames
                                VStack(spacing: 8) {
                                    HStack {
                                        Image(systemName: "magnifyingglass")
                                            .foregroundColor(.white.opacity(0.6))
                                        TextField("Search added usernames...", text: $addedUsernamesSearchText)
                                            .foregroundColor(.white)
                                            .autocapitalization(.none)
                                            .autocorrectionDisabled()
                                        if !addedUsernamesSearchText.isEmpty {
                                            Button(action: {
                                                addedUsernamesSearchText = ""
                                            }) {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundColor(.white.opacity(0.6))
                                            }
                                        }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(Color.white.opacity(0.05))
                                    // Visibility filter buttons
                                    HStack(spacing: 12) {
                                        Button(action: {
                                            withAnimation(.easeInOut(duration: 0.2)) {
                                                addedUsernamesVisibilityFilter = "all"
                                            }
                                        }) {
                                            Text("All")
                                                .font(.caption)
                                                .fontWeight(addedUsernamesVisibilityFilter == "all" ? .bold : .regular)
                                                .foregroundColor(addedUsernamesVisibilityFilter == "all" ? .white : .gray)
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 6)
                                                .background(addedUsernamesVisibilityFilter == "all" ? Color.twillyCyan.opacity(0.3) : Color.clear)
                                                .cornerRadius(8)
                                                .animation(.easeInOut(duration: 0.2), value: addedUsernamesVisibilityFilter)
                                        }
                                        Button(action: {
                                            withAnimation(.easeInOut(duration: 0.2)) {
                                                addedUsernamesVisibilityFilter = "public"
                                                showAddedUsernamesDropdown = false
                                                addedUsernamesSearchText = ""
                                                showSearchDropdown = false
                                                usernameSearchText = ""
                                                usernameSearchResults = []
                                            }
                                        }) {
                                            HStack(spacing: 4) {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .font(.caption2)
                                                Text("Public")
                                                    .font(.caption)
                                                    .fontWeight(addedUsernamesVisibilityFilter == "public" ? .bold : .regular)
                                            }
                                            .foregroundColor(addedUsernamesVisibilityFilter == "public" ? .white : .gray)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(addedUsernamesVisibilityFilter == "public" ? Color.twillyCyan.opacity(0.3) : Color.clear)
                                            .cornerRadius(8)
                                            .animation(.easeInOut(duration: 0.2), value: addedUsernamesVisibilityFilter)
                                        }
                                        Button(action: {
                                            withAnimation(.easeInOut(duration: 0.2)) {
                                                addedUsernamesVisibilityFilter = "private"
                                                showAddedUsernamesDropdown = false
                                                addedUsernamesSearchText = ""
                                                showSearchDropdown = false
                                                usernameSearchText = ""
                                                usernameSearchResults = []
                                            }
                                        }) {
                                            HStack(spacing: 4) {
                                                Image(systemName: "lock.fill")
                                                    .font(.caption2)
                                                Text("Private")
                                                    .font(.caption)
                                                    .fontWeight(addedUsernamesVisibilityFilter == "private" ? .bold : .regular)
                                            }
                                            .foregroundColor(addedUsernamesVisibilityFilter == "private" ? .white : .gray)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(addedUsernamesVisibilityFilter == "private" ? Color.orange.opacity(0.3) : Color.clear)
                                            .cornerRadius(8)
                                            .animation(.easeInOut(duration: 0.2), value: addedUsernamesVisibilityFilter)
                                        }
                                        Spacer()
                                    }
                                    .padding(.horizontal, 16)
                                }
                                if !addedUsernames.isEmpty {
                                    // Filter added usernames based on search text and visibility
                                    let filteredAddedUsernames = addedUsernames.filter { username in
                                        // Apply visibility filter (default: show public)
                                        let isPrivate = username.streamerVisibility?.lowercased() == "private"
                                        if addedUsernamesVisibilityFilter == "public" && isPrivate {
                                            return false
                                        }
                                        if addedUsernamesVisibilityFilter == "private" && !isPrivate {
                                            return false
                                        }
                                        // Apply search text filter
                                        if addedUsernamesSearchText.isEmpty {
                                            return true
                                        }
                                        return username.streamerUsername.lowercased().contains(addedUsernamesSearchText.lowercased())
                                    }
                                    if filteredAddedUsernames.isEmpty {
                                        Text("No usernames found")
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                    } else {
                                        ForEach(filteredAddedUsernames) { addedUsername in
                                            HStack {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(.twillyCyan)
                                                Text(addedUsername.streamerUsername)
                                                    .foregroundColor(.white)
                                                if addedUsername.streamerVisibility?.lowercased() == "private" {
                                                    Image(systemName: "lock.fill")
                                                        .foregroundColor(.orange)
                                                        .font(.caption2)
                                                }
                                                Spacer()
                                                Button(action: {
                                                    removeUsername(addedUsername.streamerUsername)
                                                }) {
                                                    Image(systemName: "trash")
                                                        .foregroundColor(.red)
                                                        .font(.caption)
                                                }
                                            }
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                            .background(Color.white.opacity(0.05))
                                            if addedUsername.id != filteredAddedUsernames.last?.id {
                                                Divider()
                                                    .background(Color.white.opacity(0.1))
                                            }
                                        }
                                        }
                                } else {
                                    Text("No added usernames")
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
                                        addedUsernamesSearchText = ""
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
            // Price display removed - will be revealed later
        }
        .padding(.horizontal)
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
        LazyVStack(spacing: 16) { // Standard spacing between cards
            ForEach(content) { item in
                contentCard(for: item)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 20)
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
                deleteContent(item: item)
            } : nil,
            showEditButton: showOnlyOwnContent && isOwnContent, // Show edit button only when filter is active
            onEdit: showOnlyOwnContent && isOwnContent ? {
                // Open title page when edit button is clicked - show text field immediately
                managingContent = item
                editingTitle = item.title ?? ""
                showingTitleField = true // Show title field immediately
                showingContentManagementPopup = true
            } : nil,
            isOwnContent: isOwnContent
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
           index >= self.content.count - 3,
           // Don't paginate when filter is active - all content is already loaded
           hasMoreContent && !isLoadingMore && !showOnlyOwnContent {
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
            initialContentCount = self.content.count
            refreshMessage = nil
        }
        // Refresh both channel metadata (poster) and content
        do {
            async let refreshChannelTask: Bool = refreshChannelMetadata()
            async let refreshContentTask: (content: [ChannelContent], nextToken: String?, hasMore: Bool)? = refreshChannelContent()
            // Wait for both to complete
            let channelUpdated = try await refreshChannelTask
            let contentResult = try await refreshContentTask
                if let result = contentResult {
                    let newCount = result.self.content.count
                    let oldCount = self.content.count
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
    // Filter existing content by public/private visibility
    private func applyVisibilityFilter() async {
        guard currentChannel.channelName.lowercased() == "twilly tv" else { return }
        // First, filter existing content immediately for instant feedback
        // REVERTED: Public videos show all videos where isPrivateUsername != true
        // Private videos show only videos where isPrivateUsername == true
        await MainActor.run {
            let filtered = content.filter { item in
                let isPrivate = item.isPrivateUsername == true
                if showPrivateContent {
                    // PRIVATE VIEW: Show only private videos
                    return isPrivate
                } else {
                    // PUBLIC VIEW: Show all videos where isPrivateUsername != true (revert to working state)
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
                // REVERTED: Public videos show all videos where isPrivateUsername != true
                // Private videos show only videos where isPrivateUsername == true
                let filtered = result.content.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if showPrivateContent {
                        // PRIVATE VIEW: Show only private videos
                        return isPrivate
                    } else {
                        // PUBLIC VIEW: Show all videos where isPrivateUsername != true (revert to working state)
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
        // Don't set isLoading here if we already have content (local video case)
        // Only set it if we don't have content yet
        if content.isEmpty {
            Task { @MainActor in
                isLoading = true
                errorMessage = nil
            }
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
                                    print("   - Content array count: \(self.content.count)")
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
                        let result = try await channelService.fetchChannelContent(
                            channelName: currentChannel.channelName,
                            creatorEmail: currentChannel.creatorEmail,
                            viewerEmail: viewerEmail,
                            limit: 20,
                            nextToken: nil,
                            forceRefresh: true,
                            showPrivateContent: showPrivateContent
                        )
                        print("✅ [ChannelDetailView] Fetched \(result.self.content.count) items from API, hasMore: \(result.hasMore)")
                        await MainActor.run {
                            updateContentWith(result.content, replaceLocal: false)
                            nextToken = result.nextToken
                            hasMoreContent = result.hasMore
                            isLoading = false
                            hasLoaded = true
                            print("✅ [ChannelDetailView] Content loaded - isLoading: \(isLoading), hasLoaded: \(hasLoaded), self.content.count: \(self.content.count)")
                        }
                    }
                } else {
                    // Normal load (no force refresh) - fetch first page
                    print("🔄 [ChannelDetailView] Fetching first page of content... (forceRefresh: \(forceRefresh))")
                    // For Twilly TV, pass viewerEmail to filter by added usernames
                    let viewerEmail = currentChannel.channelName.lowercased() == "twilly tv" ? authService.userEmail : nil
                    let result = try await channelService.fetchChannelContent(
                        channelName: currentChannel.channelName,
                        creatorEmail: currentChannel.creatorEmail,
                        viewerEmail: viewerEmail,
                        limit: 20, // Load 20 items initially
                        nextToken: nil,
                        forceRefresh: forceRefresh,
                        showPrivateContent: showPrivateContent
                    )
                    print("✅ [ChannelDetailView] Fetched \(result.self.content.count) items from API, hasMore: \(result.hasMore)")
                    if result.content.isEmpty {
                        print("⚠️ [ChannelDetailView] WARNING: API returned empty content array!")
                    } else {
                        print("✅ [ChannelDetailView] API returned \(result.self.content.count) items - first item: \(result.content[0].fileName)")
                    }
                    await MainActor.run {
                        print("🔄 [ChannelDetailView] About to call updateContentWith with \(result.self.content.count) items")
                        updateContentWith(result.content, replaceLocal: false)
                        print("🔄 [ChannelDetailView] After updateContentWith - self.content.count: \(self.content.count)")
                        nextToken = result.nextToken
                        hasMoreContent = result.hasMore
                        isLoading = false
                        hasLoaded = true
                        print("✅ [ChannelDetailView] Final state - self.content.count: \(self.content.count), isLoading: \(isLoading), hasLoaded: \(hasLoaded), errorMessage: \(errorMessage ?? "nil")")
                        // Check and delete short videos after content is loaded
                        Task {
                            await checkAndDeleteShortVideos()
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
    @MainActor private func updateContentWith(_ fetchedContent: [ChannelContent], replaceLocal: Bool = false) {
        print("🔄 [ChannelDetailView] ========== UPDATE CONTENT START ==========")
        print("🔄 [ChannelDetailView] Received \(fetchedContent.count) items from API, replaceLocal: \(replaceLocal)")
        print("🔄 [ChannelDetailView] Current self.content.count before update: \(self.content.count)")
        print("🔄 [ChannelDetailView] localVideoContent exists: \(localVideoContent != nil)")
        // Log all received items with details
        print("📋 [ChannelDetailView] === RECEIVED FROM API ===")
        for (index, item) in fetchedContent.enumerated() {
            print("   [\(index)] fileName: \(item.fileName)")
            print("       SK/id: \(item.SK) / \(item.id)")
            print("       hlsUrl: \(item.hlsUrl != nil && !item.hlsUrl!.isEmpty ? "✅" : "❌")")
            print("       thumbnailUrl: \(item.thumbnailUrl != nil && !item.thumbnailUrl!.isEmpty ? "✅" : "❌")")
            print("       createdAt: \(item.createdAt ?? "nil")")
            print("       isVisible: \(item.isVisible ?? true)")
            print("       category: \(item.category ?? "nil")")
            print("       creatorUsername: \(item.creatorUsername ?? "nil")")
            print("       isPrivateUsername: \(item.isPrivateUsername != nil ? String(describing: item.isPrivateUsername!) : "nil")")
            print("       uploadId: \(item.uploadId ?? "nil")")
            print("       fileId: \(item.fileId ?? "nil")")
            print("       localFileURL: \(item.localFileURL != nil ? "✅" : "nil")")
        }
        // Check for duplicates in fetched content (by ID/SK)
        var seenIds = Set<String>()
        var duplicateIds: [String] = []
        for item in fetchedContent {
            if seenIds.contains(item.id) {
                duplicateIds.append(item.id)
                print("⚠️ [ChannelDetailView] DUPLICATE ID FOUND in API response: \(item.id) (fileName: \(item.fileName))")
            } else {
                seenIds.insert(item.id)
            }
        }
        if !duplicateIds.isEmpty {
            print("⚠️ [ChannelDetailView] Found \(duplicateIds.count) duplicate ID(s) in API response: \(duplicateIds)")
        }
        // Check for duplicate fileNames (might indicate same video with different IDs)
        var seenFileNames = Set<String>()
        var duplicateFileNames: [String] = []
        for item in fetchedContent {
            if seenFileNames.contains(item.fileName) {
                duplicateFileNames.append(item.fileName)
                print("⚠️ [ChannelDetailView] DUPLICATE FILENAME FOUND in API response: \(item.fileName) (SK: \(item.SK))")
            } else {
                seenFileNames.insert(item.fileName)
            }
        }
        if !duplicateFileNames.isEmpty {
            print("⚠️ [ChannelDetailView] Found \(duplicateFileNames.count) duplicate fileName(s) in API response: \(duplicateFileNames)")
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
        // Check for duplicates in contentToShow (before sorting)
        var seenIdsBeforeSort = Set<String>()
        var duplicateIdsBeforeSort: [String] = []
        for item in contentToShow {
            if seenIdsBeforeSort.contains(item.id) {
                duplicateIdsBeforeSort.append(item.id)
                print("⚠️ [ChannelDetailView] DUPLICATE ID in contentToShow (before sort): \(item.id) (fileName: \(item.fileName))")
            } else {
                seenIdsBeforeSort.insert(item.id)
            }
        }
        if !duplicateIdsBeforeSort.isEmpty {
            print("⚠️ [ChannelDetailView] Found \(duplicateIdsBeforeSort.count) duplicate ID(s) in contentToShow before sort: \(duplicateIdsBeforeSort)")
        }
        // Deduplicate by SK (match managefiles.vue behavior)
        // managefiles.vue deduplicates by SK: .filter(file => { if (seen.has(file.SK)) return false; seen.add(file.SK); return true; })
        var seenSKs = Set<String>()
        let deduplicatedContent = contentToShow.filter { item in
            if seenSKs.contains(item.SK) {
                print("🔄 [ChannelDetailView] Removing duplicate by SK: \(item.SK) (fileName: \(item.fileName))")
                return false
            }
            seenSKs.insert(item.SK)
            return true
        }
        if contentToShow.count != deduplicatedContent.count {
            print("🔄 [ChannelDetailView] Deduplicated: \(contentToShow.count) → \(deduplicatedContent.count) items (removed \(contentToShow.count - deduplicatedContent.count) duplicate(s) by SK)")
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
                let result = d1 > d2
                // Debug logging for sorting
                if abs(d1.timeIntervalSince(d2)) > 1.0 { // Only log if difference is significant (> 1 second)
                    print("🔄 [ChannelDetailView] Sorting: \(item1.fileName) (\(d1)) vs \(item2.fileName) (\(d2)) -> \(result ? "item1 first" : "item2 first")")
                }
                return result
            }
            // If only one has a date, prioritize it (items with dates come first)
            if date1 != nil && date2 == nil {
                return true
            }
            if date1 == nil && date2 != nil {
                return false
            }
            // If neither has a date, use fileName as fallback (newer files typically have newer names)
            // But this should rarely happen - most items should have createdAt
            print("⚠️ [ChannelDetailView] Both items missing dates - using fileName fallback: \(item1.fileName) vs \(item2.fileName)")
            return item1.fileName > item2.fileName
        }
        // Match managefiles.vue: Show ALL videos (not just latest)
        // managefiles.vue returns all filtered videos sorted by createdAt (newest first)
        // CRITICAL: Apply filters BEFORE preserving titles
        // 1. Filter for public/private content first
        // 2. Filter for own content if active (after visibility filter)
        var filteredSortedContent = sortedContent
        // Filter by public/private visibility (default: show public)
        // REVERTED: Public videos show all videos where isPrivateUsername != true (including nil/false)
        // Private videos show only videos where isPrivateUsername == true
        if currentChannel.channelName.lowercased() == "twilly tv" {
            if showPrivateContent {
                // PRIVATE VIEW: Show only videos where isPrivateUsername == true
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if !isPrivate {
                        print("🔍 [ChannelDetailView] Filtering out public video in private view: \(item.fileName)")
                    }
                    return isPrivate
                }
                print("🔍 [ChannelDetailView] Filtering by visibility: private - \(filteredSortedContent.count) items")
            } else {
                // PUBLIC VIEW: Show all videos where isPrivateUsername != true (revert to working state)
                // This includes videos where isPrivateUsername is false, nil, or not set
                filteredSortedContent = filteredSortedContent.filter { item in
                    let isPrivate = item.isPrivateUsername == true
                    if isPrivate {
                        print("🔍 [ChannelDetailView] Filtering out private video in public view: \(item.fileName)")
                    }
                    return !isPrivate
                }
                print("🔍 [ChannelDetailView] Filtering by visibility: public - \(filteredSortedContent.count) items")
            }
        }
        // CRITICAL: Store original content AFTER visibility filter but BEFORE "own content" filter
        // This allows instant "own content" filter toggle without API calls
        originalUnfilteredContent = filteredSortedContent

        // Always populate filteredOwnContent (owner's videos) regardless of filter state
        // This ensures instant switching when filter is toggled
        if let username = authService.username {
            self.filteredOwnContent = filteredSortedContent.filter { item in
                item.creatorUsername?.lowercased() == username.lowercased()
            }
            print("🔍 [ChannelDetailView] Populated filteredOwnContent: \(self.filteredOwnContent.count) items (from \(originalUnfilteredContent.count) total)")
        } else {
            self.filteredOwnContent = []
        }
        // Now apply "own content" filter if active
        if self.showOnlyOwnContent {
            filteredSortedContent = self.filteredOwnContent
            print("🔍 [ChannelDetailView] Filtering to own content: \(filteredSortedContent.count) items")
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
        print("✅ [ChannelDetailView] self.content.count: \(self.content.count)")
        print("✅ [ChannelDetailView] isLoading: \(isLoading), hasLoaded: \(hasLoaded)")
        // Log final sorted order (newest first)
        print("📋 [ChannelDetailView] Final sorted order (newest first):")
        for (index, item) in sortedContent.enumerated() {
            let dateStr = item.airdate ?? item.createdAt ?? "NO DATE"
            print("   [\(index)] \(item.fileName) - date: \(dateStr)")
        }
        // Summary: Show what videos are displayed and why
        if self.content.count > 1 {
            print("📊 [ChannelDetailView] SUMMARY: Showing \(self.content.count) different videos:")
            for (index, item) in content.enumerated() {
                let dateStr = item.createdAt ?? "unknown date"
                let isNew = index == 0 ? " (🆕 NEWEST)" : ""
                print("   \(index + 1). \(item.fileName) - Created: \(dateStr)\(isNew)")
            }
            print("   ℹ️ These are \(self.content.count) DIFFERENT videos, not duplicates.")
            print("   ℹ️ Each has a unique ID: \(content.map { $0.id }.joined(separator: ", "))")
        } else if self.content.count == 1 {
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
            print("✅ [ChannelDetailView] Content array has \(self.content.count) items")
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
                        print("   - Server returned \(result.self.content.count) videos:")
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
                                    print("   - Content array count: \(self.content.count)")
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
                    let previousCount = self.content.count
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
                                    let newCount = result.self.content.count
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
                        let beforeCount = self.content.count
                        content.removeAll { $0.id == itemId }
                        let afterCount = self.content.count
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
    }
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
        if self.showOnlyOwnContent {
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
                    if response.success {
                        // Overwrite with confirmed data from DynamoDB
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
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
                            // Create updated ChannelContent with confirmed title from DynamoDB
                            let confirmedItem = ChannelContent(
                                SK: self.content[index].SK,
                                fileName: self.content[index].fileName,
                                title: serverTitle, // Use server-confirmed title
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
                            print("✅ [ChannelDetailView] Confirmed update from DynamoDB - title: '\(serverTitle)'")
                        }
                        print("✅ [ChannelDetailView] Content updated successfully on server")
                    } else {
                        print("❌ [ChannelDetailView] Update failed: \(response.message ?? "Unknown error")")
                        errorMessage = response.message ?? "Failed to update video details"
                        // Revert optimistic update on failure
                        if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                            // Revert to original title
                            let revertedItem = ChannelContent(
                                SK: self.content[index].SK,
                                fileName: self.content[index].fileName,
                                title: content.title, // Revert to original
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
                            print("⚠️ [ChannelDetailView] Reverted optimistic update due to server error")
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isUpdatingContent = false
                    print("❌ [ChannelDetailView] Error updating content: \(error.localizedDescription)")
                    errorMessage = "Failed to update video details: \(error.localizedDescription)"
                    // Revert optimistic update on error
                    if let index = self.content.firstIndex(where: { $0.SK == content.SK }) {
                        // Revert to original title
                        let revertedItem = ChannelContent(
                            SK: self.content[index].SK,
                            fileName: self.content[index].fileName,
                            title: content.title, // Revert to original
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
                        print("⚠️ [ChannelDetailView] Reverted optimistic update due to network error")
                    }
                }
            }
        }
    }
    // Load more content (pagination)
    private func loadMoreContent() {
        // Don't paginate when filter is active - all content is already loaded
        guard !showOnlyOwnContent, hasMoreContent, !isLoadingMore, let currentToken = nextToken else {
            print("⚠️ [ChannelDetailView] Cannot load more - hasMore: \(hasMoreContent), isLoadingMore: \(isLoadingMore), nextToken: \(nextToken != nil ? "exists" : "nil")")
            if showOnlyOwnContent {
                print("⚠️ [ChannelDetailView] Pagination disabled - filter is active")
            } else {
            }
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
                if self.showOnlyOwnContent, let username = authService.username {
                    filteredContent = result.content.filter { item in
                        item.creatorUsername?.lowercased() == username.lowercased()
                    }
                }
                print("✅ [ChannelDetailView] Loaded \(filteredContent.count) more items, hasMore: \(result.hasMore)")
                await MainActor.run {
                    // Use updateContentWith to properly merge new content and update filteredOwnContent
                    // This ensures filteredOwnContent stays in sync with all loaded content
                    updateContentWith(filteredContent, replaceLocal: false)
                    nextToken = result.nextToken
                    hasMoreContent = result.hasMore
                    isLoadingMore = false
                    print("📄 [ChannelDetailView] Total content count: \(self.content.count)")
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
    init(content: ChannelContent, onTap: @escaping () -> Void, onPlay: (() -> Void)? = nil, isLocalVideo: Bool = false, isUploadComplete: Bool = false, isPollingForThumbnail: Bool = false, channelCreatorUsername: String = "", channelCreatorEmail: String = "", isLatestContent: Bool = false, airScheduleLabel: String? = nil, showDeleteButton: Bool = false, onDelete: (() -> Void)? = nil, showEditButton: Bool = false, onEdit: (() -> Void)? = nil, isOwnContent: Bool = false) {
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
                                        .fixedSize(horizontal: true, vertical: false) // Display full username without truncation
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
