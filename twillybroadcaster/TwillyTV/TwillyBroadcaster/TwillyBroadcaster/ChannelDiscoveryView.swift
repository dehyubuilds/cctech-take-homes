//
//  ChannelDiscoveryView.swift
//  TwillyBroadcaster
//
//  View for discovering and searching public/searchable channels
//

import SwiftUI

struct ChannelDiscoveryView: View {
    @ObservedObject var channelService = ChannelService.shared
    @Environment(\.dismiss) var dismiss
    
    // Optional channel to navigate to programmatically (e.g., after upload)
    let channelToNavigate: DiscoverableChannel?
    let forceRefreshChannel: Bool
    // Optional channel name to filter/highlight in the list
    let filterChannelName: String?
    // If true, hide the close button (for non-collaborators who can't go back to stream screen)
    let hideCloseButton: Bool
    
    @State private var channels: [DiscoverableChannel] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchQuery: String = ""
    @State private var searchText: String = ""
    @State private var navigateToChannel = false
    @State private var channelToNavigateState: DiscoverableChannel? = nil
    @State private var forceRefreshChannelState = false
    @State private var showingChannelManagement = false
    @State private var showingUsernameUpdate = false
    @State private var showingAddCollaborator = false
    @State private var showingInbox = false
    @State private var showSwipeIndicator = true // Show subtle swipe indicator on discover page
    @ObservedObject private var notificationService = NotificationService.shared
    
    // Collaborator channels - channels user can stream to
    let collaboratorChannels: [Channel]
    
    // Callback to refresh user roles after invite code acceptance
    var onInviteCodeAccepted: (() -> Void)?
    
    // User email from auth system
    @ObservedObject private var authService = AuthService.shared
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    
    init(
        channelToNavigate: DiscoverableChannel? = nil,
        forceRefreshChannel: Bool = false,
        filterChannelName: String? = nil,
        startWithMyChannels: Bool = false,
        hideCloseButton: Bool = false,
        collaboratorChannels: [Channel] = [],
        onInviteCodeAccepted: (() -> Void)? = nil
    ) {
        self.channelToNavigate = channelToNavigate
        self.forceRefreshChannel = forceRefreshChannel
        self.filterChannelName = filterChannelName
        self.hideCloseButton = hideCloseButton
        self.collaboratorChannels = collaboratorChannels
        self.onInviteCodeAccepted = onInviteCodeAccepted
        // Initialize state variables
        _channelToNavigateState = State(initialValue: channelToNavigate)
        _forceRefreshChannelState = State(initialValue: forceRefreshChannel)
    }
    
    var body: some View {
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
                    // Show only Discover content (My Content tab removed)
                    discoverContent
                }
                .simultaneousGesture(
                    // Horizontal swipe gesture - ONLY for admin users
                    DragGesture(minimumDistance: 20)
                        .onEnded { value in
                            // TV Network Model: Only admin can swipe to stream screen
                            let isAdmin = UserRoleService.shared.isAdmin(userEmail: userEmail)
                            guard isAdmin else {
                                print("❌ [ChannelDiscoveryView] Non-admin user attempted to swipe to stream - blocked")
                                return
                            }
                            
                            let horizontalMovement = abs(value.translation.width)
                            let verticalMovement = abs(value.translation.height)
                            
                            // Only process as swipe if horizontal movement is significant and greater than vertical
                            if horizontalMovement > 50 && horizontalMovement > verticalMovement {
                                // Swipe RIGHT (from left to right, positive width) to go to stream screen
                                if value.translation.width > 100 || value.predictedEndTranslation.width > 200 {
                                    // Post notification to show stream screen
                                    print("✅ [ChannelDiscoveryView] Swipe RIGHT detected → Going to Stream screen (admin only)")
                                    NotificationCenter.default.post(
                                        name: NSNotification.Name("ShowStreamScreen"),
                                        object: nil
                                    )
                                }
                            }
                        }
                )
                // Hidden NavigationLink for programmatic navigation (always available regardless of tab)
                // This ensures we can navigate directly to ChannelDetailView with proper navigation stack
                if let channelToNavigate = channelToNavigateState ?? channelToNavigate {
                    // All authenticated users can stream
                    let canStreamForChannel = authService.isAuthenticated
                    NavigationLink(
                        destination: ChannelDetailView(
                            channel: channelToNavigate,
                            forceRefresh: forceRefreshChannelState || forceRefreshChannel,
                            canStream: canStreamForChannel,
                            collaboratorChannels: collaboratorChannels,
                            onInviteCodeAccepted: onInviteCodeAccepted
                        ),
                        isActive: $navigateToChannel
                    ) {
                        EmptyView()
                    }
                    .hidden()
                    .onAppear {
                        // If we have a channel to navigate to, trigger navigation when view appears
                        if channelToNavigateState != nil || channelToNavigate != nil {
                            print("🔍 [ChannelDiscoveryView] NavigationLink appeared - channel: \(channelToNavigate.channelName)")
                            // Small delay to ensure NavigationView is fully ready
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                if !navigateToChannel {
                                    print("✅ [ChannelDiscoveryView] Triggering navigation to channel")
                                    navigateToChannel = true
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Discover Channels")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Only show close button if not hidden (for non-collaborators, there's no stream screen to go back to)
                ToolbarItem(placement: .navigationBarLeading) {
                    if !hideCloseButton {
                        Button(action: {
                            dismiss()
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: "xmark.circle.fill")
                                Text("Close")
                            }
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
                            .font(.system(size: 16, weight: .semibold))
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // Inbox Button
                        Button(action: {
                            showingInbox = true
                        }) {
                            ZStack {
                                Image(systemName: "tray")
                                    .font(.title3)
                                    .foregroundColor(.white)
                                
                                // Unread badge
                                if notificationService.unreadCount > 0 {
                                    Text("\(notificationService.unreadCount)")
                                        .font(.caption2)
                                        .fontWeight(.bold)
                                        .foregroundColor(.white)
                                        .padding(4)
                                        .background(Color.red)
                                        .clipShape(Circle())
                                        .offset(x: 8, y: -8)
                                }
                            }
                        }
                        
                        Menu {
                            // Username Update (for all users)
                            Button(action: {
                                showingUsernameUpdate = true
                            }) {
                                Label("Update Username", systemImage: "person.circle")
                            }
                            
                            // Add Collaborator (admin only)
                            if UserRoleService.shared.isAdmin(userEmail: userEmail) {
                                Button(action: {
                                    showingAddCollaborator = true
                                }) {
                                    Label("Manage Collaborators", systemImage: "person.badge.plus")
                                }
                            }
                            
                            Divider()
                            
                            Button(role: .destructive, action: {
                                Task {
                                    do {
                                        try await AuthService.shared.signOut()
                                    } catch {
                                        print("Error signing out: \(error)")
                                    }
                                }
                            }) {
                                Label("Sign Out", systemImage: "arrow.right.square")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(.white)
                        }
                    }
                }
            }
            .fullScreenCover(isPresented: $showingChannelManagement) {
                ChannelManagementView(userEmail: userEmail)
            }
            .sheet(isPresented: $showingUsernameUpdate) {
                UsernameUpdateView()
            }
            .sheet(isPresented: $showingAddCollaborator) {
                if UserRoleService.shared.isAdmin(userEmail: userEmail) {
                    CollaboratorManagementView()
                }
            }
            .fullScreenCover(isPresented: $showingInbox) {
                InboxView()
            }
            .onAppear {
                // Reset swipe indicator when view appears
                showSwipeIndicator = true
            }
            .task {
                // Use .task instead of .onAppear for async operations to prevent blocking
                print("🔍 [ChannelDiscoveryView] task started - filterChannelName: \(filterChannelName ?? "nil")")
                
                // Small delay to ensure view is fully initialized before doing work
                try? await Task.sleep(nanoseconds: 50_000_000) // 0.05 seconds
                
                // If we have a filter channel name, pre-fill the search and load filtered channels
                if let filterName = filterChannelName {
                    await MainActor.run {
                        searchText = filterName
                        searchQuery = filterName
                        print("🔍 [ChannelDiscoveryView] Pre-filtering for channel: \(filterName)")
                    }
                    // Load channels with the filter applied
                    loadChannels()
                } else {
                    // Load channels asynchronously (non-blocking) without filter
                    loadChannels()
                }
                
                // NOTE: We do NOT auto-navigate when filterChannelName is set
                // User should see the filtered list and click on the channel themselves
                
                // If we have a channel to navigate to (from other sources), trigger navigation immediately
                if let channelToNavigate = channelToNavigate {
                    await MainActor.run {
                        // Navigate to the channel immediately (even if not in list, we have the channel object)
                        print("🔍 [ChannelDiscoveryView] Navigating to channel: \(channelToNavigate.channelName)")
                        // Update state to ensure NavigationLink is available
                        channelToNavigateState = channelToNavigate
                        forceRefreshChannelState = forceRefreshChannel
                        // Small delay to ensure NavigationView is ready, then navigate
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            navigateToChannel = true
                            print("✅ [ChannelDiscoveryView] Navigation triggered - navigateToChannel = true")
                        }
                    }
                }
            }
            .gesture(
                // Vertical swipe to dismiss (only if close button is visible)
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        if !hideCloseButton && (value.translation.height > 100 || value.predictedEndTranslation.height > 200) {
                            dismiss()
                        }
                    }
            )
        }
    }
    
    // Discover Tab Content
    private var discoverContent: some View {
        VStack(spacing: 0) {
            // Search bar - Twilly themed
            HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.twillyCyan)
                        TextField("Search channels...", text: $searchText)
                            .foregroundColor(.white)
                            .onSubmit {
                                searchQuery = searchText
                                loadChannels()
                            }
                        if !searchText.isEmpty {
                            Button(action: {
                                searchText = ""
                                searchQuery = ""
                                loadChannels()
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.twillyTeal.opacity(0.7))
                            }
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.black.opacity(0.3))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal.opacity(0.5),
                                                Color.twillyCyan.opacity(0.3)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                    )
                    .padding(.horizontal)
                    .padding(.top, 8)
                    
                    if isLoading {
                        Spacer()
                        VStack(spacing: 16) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                                .scaleEffect(1.8)
                            
                            Text("Discovering channels...")
                                .foregroundColor(.white)
                                .font(.headline)
                                .fontWeight(.medium)
                            
                            Text("Finding the best content for you")
                                .foregroundColor(.white.opacity(0.6))
                                .font(.subheadline)
                        }
                        .padding(.top, 60)
                        Spacer()
                    } else if let error = errorMessage {
                        Spacer()
                        VStack(spacing: 16) {
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
                            Text("Error")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                            Text(error)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                            Button(action: {
                                loadChannels()
                            }) {
                                Text("Retry")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 24)
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
                                    .cornerRadius(25)
                                    .shadow(color: Color.twillyCyan.opacity(0.4), radius: 8, x: 0, y: 4)
                            }
                        }
                        Spacer()
                    } else if channels.isEmpty {
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "tv.badge.wifi")
                                .font(.system(size: 50))
                                .foregroundColor(.white.opacity(0.5))
                            Text(searchQuery.isEmpty ? "No Public Channels" : "No Channels Found")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                            Text(searchQuery.isEmpty 
                                 ? "No public channels are currently available"
                                 : "Try adjusting your search terms")
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVGrid(columns: [
                                GridItem(.flexible(minimum: 0), spacing: 12),
                                GridItem(.flexible(minimum: 0), spacing: 12)
                            ], spacing: 12) {
                                ForEach(channels) { channel in
                                    // All users can view channels - navigation always works
                                    NavigationLink(destination: ChannelDetailView(
                                        channel: channel,
                                        forceRefresh: filterChannelName != nil && channel.channelName.lowercased() == filterChannelName?.lowercased(),
                                        canStream: authService.isAuthenticated, // All authenticated users can stream
                                        collaboratorChannels: collaboratorChannels,
                                        onInviteCodeAccepted: onInviteCodeAccepted
                                    )) {
                                        DiscoverableChannelCard(channel: channel)
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }
                        
                        // Swipe indicator at bottom (ONLY for admin users)
                        if UserRoleService.shared.isAdmin(userEmail: userEmail) {
                            swipeIndicator
                                .padding(.bottom, 20)
                        }
                    }
                }
    }
    
    // My Channels Tab Content
    private var myChannelsContent: some View {
        SimpleMyChannelsView()
    }
    
    private func loadChannels() {
        errorMessage = nil
        
        // OPTIMIZED: Load cached data immediately (instant), then refresh in background
        Task {
            // Capture current search query (use filterChannelName if searchQuery is empty but filter is set)
            let currentQuery = searchQuery.isEmpty ? (filterChannelName ?? nil) : searchQuery
            let query = currentQuery?.isEmpty == false ? currentQuery : nil
            print("🔍 [ChannelDiscoveryView] loadChannels called with query: \(query ?? "nil"), searchQuery: '\(searchQuery)', filterChannelName: \(filterChannelName ?? "nil")")
            
            // First, try to get cached data immediately (non-blocking)
            do {
                // TV Network Model: Only show "Twilly TV" channel
                let allCachedChannels = try await channelService.fetchDiscoverableChannels(
                    searchQuery: query,
                    forceRefresh: false
                )
                // Filter to only "Twilly TV" channel
                let twillyTVChannels = allCachedChannels.filter { 
                    $0.channelName.lowercased().contains("twilly tv") 
                }
                // Deduplicate by channelId
                var seenChannelIds = Set<String>()
                let uniqueChannels = twillyTVChannels.filter { channel in
                    if seenChannelIds.contains(channel.channelId) {
                        print("⚠️ [ChannelDiscoveryView] Removing duplicate channel: \(channel.channelName) (ID: \(channel.channelId))")
                        return false
                    }
                    seenChannelIds.insert(channel.channelId)
                    return true
                }
                await MainActor.run {
                    channels = uniqueChannels
                    isLoading = false // Hide loading immediately
                    print("📋 Loaded \(channels.count) unique Twilly TV channel(s) from cache (instant)")
                }
            } catch {
                // If cache fails, show loading
                await MainActor.run {
                    isLoading = true
                }
            }
            
            // Then refresh in background to get latest data
            do {
                let allFreshChannels = try await channelService.fetchDiscoverableChannels(
                    searchQuery: query,
                    forceRefresh: true
                )
                // TV Network Model: Filter to only "Twilly TV" channel
                let twillyTVChannels = allFreshChannels.filter { 
                    $0.channelName.lowercased().contains("twilly tv") 
                }
                // Deduplicate by channelId
                var seenChannelIds = Set<String>()
                let uniqueChannels = twillyTVChannels.filter { channel in
                    if seenChannelIds.contains(channel.channelId) {
                        print("⚠️ [ChannelDiscoveryView] Removing duplicate channel: \(channel.channelName) (ID: \(channel.channelId))")
                        return false
                    }
                    seenChannelIds.insert(channel.channelId)
                    return true
                }
                await MainActor.run {
                    // Only update if we got fresh data
                    if uniqueChannels.count > 0 {
                        channels = uniqueChannels
                        print("📋 Refreshed to \(channels.count) unique Twilly TV channel(s) (background update)")
                    }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    // Only show error if we don't have cached data
                    if channels.isEmpty {
                        errorMessage = error.localizedDescription
                    } else {
                        print("⚠️ Background refresh failed, using cached data: \(error.localizedDescription)")
                    }
                    isLoading = false
                }
            }
        }
    }
    
    // Subtle swipe indicator for discover page (disappears after a few seconds)
    private var swipeIndicator: some View {
        HStack {
            Spacer()
            if showSwipeIndicator {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 12, weight: .medium))
                    Text("Swipe to Stream")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundColor(.white.opacity(0.5))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.black.opacity(0.3))
                .cornerRadius(20)
                .transition(.opacity.combined(with: .scale))
                .onAppear {
                    // Auto-hide after 3 seconds
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            showSwipeIndicator = false
                        }
                    }
                }
            }
            Spacer()
        }
        .frame(height: 36)
    }
}

struct DiscoverableChannelCard: View {
    let channel: DiscoverableChannel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Channel poster - fixed size container to prevent expansion
            Color.clear
                .frame(height: 140) // Reserve space first
                .overlay(
                    AsyncImage(url: URL(string: channel.posterUrl)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        case .failure(_), .empty:
                            ZStack {
                                Color.gray.opacity(0.3)
                                Image(systemName: "tv.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(.white.opacity(0.5))
                            }
                        @unknown default:
                            Color.gray.opacity(0.3)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                )
                .clipped() // Clip overflow
                .cornerRadius(12, corners: [.topLeft, .topRight])
            
            // Channel info - fixed height container with consistent padding
            VStack(alignment: .leading, spacing: 6) {
                // Channel name - wraps to 2 lines
                Text(channel.channelName)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Creator username - single line
                Text("by \(channel.creatorUsername)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Price - always reserve space - Twilly themed
                HStack {
                    if let price = channel.subscriptionPrice, price > 0 {
                        Text("$\(String(format: "%.2f", price))")
                            .font(.caption)
                            .fontWeight(.semibold)
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
                    } else {
                        // Invisible spacer to maintain consistent height
                        Text(" ")
                            .font(.caption)
                            .opacity(0)
                    }
                    Spacer(minLength: 0)
                }
                .frame(height: 16) // Fixed height for price line
            }
            .frame(height: 70, alignment: .topLeading) // Fixed height - prevents expansion
            .frame(maxWidth: .infinity) // Fill available width
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .fixedSize(horizontal: false, vertical: true) // Prevent vertical expansion
        .frame(maxWidth: .infinity) // Ensure consistent width within grid cell
        .frame(height: 210) // Fixed total height - prevents any expansion
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.4))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.twillyTeal.opacity(0.4),
                                    Color.twillyCyan.opacity(0.2)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.5
                        )
                )
        )
        .shadow(color: Color.twillyCyan.opacity(0.2), radius: 8, x: 0, y: 4)
        .clipped() // Clip any overflow
    }
}

// Helper extension for corner radius on specific corners
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// Tab Button Component
struct TabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(isSelected ? .white : .gray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                Group {
                    if isSelected {
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.twillyTeal.opacity(0.3),
                                Color.twillyCyan.opacity(0.2)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    } else {
                        Color.clear
                    }
                }
            )
            .overlay(
                Rectangle()
                    .frame(height: 3)
                    .foregroundColor(isSelected ? Color.twillyTeal : Color.clear),
                alignment: .bottom
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

