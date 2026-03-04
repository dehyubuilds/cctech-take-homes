    //
    //  ContentView.swift
    //  TwillyBroadcaster
    //
    //  Minimal working version - we'll build from here incrementally
    //

    import SwiftUI
    import AVFoundation
    import HaishinKit
    import UIKit
    import Combine

    // Stream mode enum for 3-state toggle (public/private/premium)
    enum StreamMode: String, CaseIterable {
        case `public` = "Public"
        case `private` = "Private"
        case premium = "Premium"
        
        var icon: String {
            switch self {
            case .public: return "lock.open.fill"
            case .private: return "lock.fill"
            case .premium: return "dollarsign.circle.fill" // Money icon for premium
            }
        }
        
        var color: Color {
            switch self {
            case .public: return .twillyCyan
            case .private: return .orange
            case .premium: return .yellow
            }
        }
        
        var isPrivateUsername: Bool {
            switch self {
            case .public: return false
            case .private, .premium: return true
            }
        }
        
        var isPremium: Bool {
            switch self {
            case .premium: return true
            case .public, .private: return false
            }
        }
    }

    // Global storage for local video info (to pass to ChannelDetailView)
    var globalLocalVideoInfo: (channelName: String, url: URL, title: String?, description: String?, price: Double?)?

    // Removed globalStreamPlaceholderInfo - using notification system instead

    struct ContentView: View {
        @EnvironmentObject var streamManager: StreamManager
        @ObservedObject var connectionManager = StreamKeyManager.shared
        @ObservedObject var authService = AuthService.shared
        @State private var showingError: Bool = false
        @State private var showingDiscovery = false
        @State private var showingPostStream = false
        @State private var channelShareUrl: String?
        @State private var postStreamChannelName: String?
        @State private var showingNotification = false
        @State private var notificationMessage = ""
        @State private var showingChannelSelectionAlert = false
        @State private var channelToViewAfterStream: DiscoverableChannel?
        @State private var showingChannelAfterStream = false
        @State private var channelFilterNameAfterStream: String?
        @State private var channelToNavigateViaDiscovery: DiscoverableChannel? = nil
        @State private var showingChannelDiscoveryAfterStream = false
        @State private var channelToNavigateDirectly: DiscoverableChannel? = nil
        @State private var showingChannelDirectly = false
        @State private var showingRecordingPreview = false
        @State private var showingPostRecordingActions = false
        @State private var showingChannelSelection = false
        @State private var previewRefreshKey = UUID()
        @State private var showUploadSuccessScreen = false
        @State private var uploadedChannelName: String? = nil
        @State private var isNavigatingToChannel = false // Prevent showing camera during navigation
        // Upload banner removed - now auto-navigates to channel
        @State private var discoverFilterChannelName: String? = nil // Channel name to filter in Discover
        @State private var showingWelcome = false
        @State private var showingUsernameSetup = false
        @State private var isCheckingAuth = true
        @State private var showingUploadCompleteAlert = false
        @State private var uploadCompleteChannelName: String? = nil
        @State private var showingGoLiveChannelPicker = false
        @State private var showingPostStreamMetadata = false
        @State private var showingStreamProcessing = false
        @State private var postStreamKey: String? = nil
        @State private var postStreamFileId: String? = nil // File ID for metadata updates
        @State private var showingCaptureMetadata = false
        @State private var isProducerOrCollaborator: Bool = false
        @State private var isCheckingRole: Bool = true
        @State private var userRoles: UserRoles? = nil
        @State private var collaboratorChannels: [Channel] = []
        @State private var actualUserEmail: String? = nil // Email from username lookup
        @ObservedObject var userRoleService = UserRoleService.shared
        @State private var selectedChannel: DiscoverableChannel? = nil // Selected channel for streaming
        @State private var streamChannelId: String? = nil // Channel ID for current stream
        @State private var streamChannelName: String? = nil // Channel name for current stream
        // Removed MyStreams - now navigating to My Content instead
        // Post stream flow (like zipped project)
        @State private var showingPostChoice = false
        @State private var showingVideoDetails = false
        @State private var showingStreamChannelPicker = false
        @State private var streamVideoTitle: String = ""
        @State private var streamVideoDescription: String = ""
        @State private var streamVideoPrice: String = ""
        @State private var isShowingCountdown = false
        @State private var countdownValue = 3
        @State private var countdownTask: Task<Void, Never>? = nil // Track countdown task for cancellation
        @GestureState private var isButtonPressed = false // Track button press state for visual feedback
        @State private var showingInviteCodeEntry = false
        @State private var hasTwillyTVAccess = false // Track if user has streaming access to Twilly TV
        @State private var showingStreamScreen = false // Show stream screen when navigated from channel detail
        @State private var streamScreenChannel: DiscoverableChannel? = nil // Channel to stream to
        @State private var showSwipeIndicator = true // Show subtle swipe indicator on stream screen
        @State private var twillyTVChannel: DiscoverableChannel? = nil // Twilly TV channel
        @State private var isLoadingTwillyTV = true // Loading Twilly TV channel
        @State private var userScheduleLocked = false // Whether current user has schedule locked
        @State private var userSchedulePaused = false // Whether current user's schedule is paused
        @State private var userPostAutomatically = false // Whether current user has post automatically enabled
        @State private var showingVisibilitySelector = false // Show visibility selector modal
        @State private var isUsernamePublic = true // Current visibility state (defaults to public)
        @State private var isLoadingVisibility = false // Loading visibility state
        @State private var pendingStreamStart = false // Track if we need to start stream after visibility selection
        @State private var wasDismissedWithoutSelection = false // Track if selector was dismissed without selection
        @State private var selectedStreamVisibility: Bool? = nil // User's selected visibility for the current stream (not affected by account-level update failures)
        @State private var streamModeIsPrivate = false // Toggle for public/private stream mode (default: public)
        @State private var streamMode: StreamMode = .public // 3-state: public, private, premium
        @State private var isPremiumEnabled = false // Whether premium mode is enabled in settings
        
        // UserDefaults key for persisting visibility preference
        private let visibilityPreferenceKey = "StreamVisibilityPreference"
        @State private var isUpdatingVisibility = false // Updating visibility state
        
        // 15-minute stream limit
        private let streamTimeLimit: TimeInterval = 15 * 60 // 15 minutes in seconds
        @State private var streamTimeLimitTimer: Timer? = nil // Timer for monitoring stream time limit
        
        // Stream drop: post now vs schedule (persisted so schedule is saved and used on stop)
        private let schedulePostImmediatelyKey = "StreamSchedulePostImmediately"
        private let scheduleDropDateKey = "StreamScheduleDropDate"
        @State private var postImmediately = true
        @State private var scheduledDropDate: Date? = nil
        @State private var showingDatePicker = false
        
        // Landscape mode support
        @State private var isLandscapeMode: Bool = false // Track if device is rotated to landscape
        
    @ViewBuilder
    var body: some View {
        Group {
            if isCheckingAuth {
                authLoadingView
            } else if !authService.isAuthenticated {
                WelcomeView()
            } else if authService.isAuthenticated && authService.isLoadingUsername {
                usernameLoadingView
            } else if authService.isAuthenticated && authService.username == nil {
                UsernameSetupView()
            } else {
                mainAppContent
            }
        }
        .onAppear {
            checkAuthStatus()
            // Load saved visibility preference first (defaults to public)
            loadSavedVisibilityPreference()
            // Load premium enabled from UserDefaults
            loadPremiumEnabled()
            // Load schedule preference so Schedule Drop choice and date are restored
            loadSchedulePreference()
            Task {
                await checkUserRole()
                // Load visibility state from server when view appears (but use saved preference as default)
                loadUsernameVisibility()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("PremiumEnabledChanged"))) { notification in
            // Reload premium enabled when it changes in settings
            if let enabled = notification.userInfo?["enabled"] as? Bool {
                isPremiumEnabled = enabled
                print("✅ [ContentView] Premium enabled updated from settings: \(enabled)")
            } else {
                // Fallback: reload from UserDefaults (when settings sheet is dismissed)
                loadPremiumEnabled()
                print("✅ [ContentView] Premium enabled reloaded from UserDefaults after settings dismissed")
            }
        }
        .overlay(
            // Visibility selector overlay
            Group {
                if showingVisibilitySelector {
                    VisibilitySelectorView(
                        isPresented: $showingVisibilitySelector,
                        isPublic: $isUsernamePublic,
                        onSelect: { isPublic in
                            // Save preference immediately
                            saveVisibilityPreference(isPublic)
                            // Store the selected visibility for the stream (independent of account-level update)
                            selectedStreamVisibility = isPublic
                            // Try to update account-level visibility (but don't let failure affect stream visibility)
                            updateUsernameVisibility(isPublic)
                            // Reset dismissal flag since user made a selection
                            wasDismissedWithoutSelection = false
                            // If we're pending a stream start, start it after visibility is set
                            if pendingStreamStart {
                                pendingStreamStart = false
                                // Start stream after a brief delay to allow visibility update to complete
                                Task {
                                    // Wait a moment for visibility update to process
                                    try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                                    await startStreamToTwillyTV()
                                }
                            }
                        }
                    )
                    .transition(.opacity.combined(with: .scale))
                    .zIndex(1000)
                    .onChange(of: showingVisibilitySelector) { newValue in
                        // If visibility selector is dismissed without selection, mark it
                        if !newValue && pendingStreamStart {
                            print("⚠️ [ContentView] Visibility selector dismissed without selection - will default to public on next click")
                            wasDismissedWithoutSelection = true
                            pendingStreamStart = false
                        } else if newValue {
                            // Reset flag when selector is shown again
                            wasDismissedWithoutSelection = false
                        }
                    }
                }
            }
        )
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("StartStreamingFromChannel"))) { notification in
            if let channelName = notification.userInfo?["channelName"] as? String,
               let channelId = notification.userInfo?["channelId"] as? String {
                // Create DiscoverableChannel from notification data
                let channel = DiscoverableChannel(
                    channelId: channelId,
                    channelName: channelName,
                    creatorEmail: authService.userEmail ?? "",
                    creatorUsername: "",
                    description: "",
                    posterUrl: "",
                    visibility: "public",
                    isPublic: true,
                    subscriptionPrice: nil,
                    contentType: nil
                )
                streamScreenChannel = channel
                // Always show stream screen when Stream button is clicked (admin can stream)
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    showingStreamScreen = true
                }
                print("✅ [ContentView] Received StartStreamingFromChannel notification for: \(channelName)")
                print("   isAdminUser: \(isAdminUser), showingStreamScreen: \(showingStreamScreen)")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ShowStreamScreen"))) { _ in
            // CRITICAL: Block navigation to stream screen if already streaming
            // User must stop current stream before navigating
            if streamManager.isStreaming {
                print("🚫 [ContentView] Navigation blocked - stream is active. Stop stream to navigate.")
                return
            }
            
            // TV Network Model: All authenticated users can access stream screen via swipe
            if authService.isAuthenticated {
                // Don't auto-select a channel - let user select from the channel picker
                streamScreenChannel = nil
                selectedChannel = nil
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    showingStreamScreen = true
                }
                print("✅ [ContentView] Showing stream screen from swipe gesture")
            } else {
                print("❌ [ContentView] Unauthenticated user attempted to access stream screen - blocked")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ShowDiscoverFromChannel"))) { notification in
            // Discover page removed for all accounts - stay on Twilly TV
            print("🚫 [ContentView] Discover page removed - staying on Twilly TV")
        }
        .onChange(of: authService.isAuthenticated) { isAuthenticated in
            if !isAuthenticated {
                showingWelcome = true
            }
        }
        .onChange(of: authService.username) { username in
            // Username was set, we're ready
            print("🔍 [ContentView] Username changed: \(username ?? "nil")")
            if username != nil {
                showingUsernameSetup = false
            }
        }
        .onChange(of: authService.isLoadingUsername) { isLoading in
            // Prevent flash by waiting for loading to complete
            print("🔍 [ContentView] isLoadingUsername changed: \(isLoading)")
            if !isLoading && authService.isAuthenticated {
                print("   - username: \(authService.username ?? "nil")")
                print("   - showingUsernameSetup will be: \(authService.username == nil)")
            }
        }
    }
    
    @ViewBuilder
    private var authLoadingView: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                .scaleEffect(1.5)
        }
    }
    
    @ViewBuilder
    private var usernameLoadingView: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                .scaleEffect(1.5)
        }
    }
    
    @ViewBuilder
    private var mainAppContent: some View {
        if isCheckingRole {
            roleLoadingView
        } else {
            if showingStreamScreen {
                streamScreenView
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                twillyTVChannelView
                    .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
    }
    
    @ViewBuilder
    private var roleLoadingView: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                .scaleEffect(1.5)
        }
    }
        
    private var cameraPreviewWithModifiers: some View {
            cameraPreviewView
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onEnded { value in
                            // CRITICAL: Block all swipes while streaming is active
                            // User can only leave by explicitly stopping or 15-minute timer ending
                            guard !streamManager.isStreaming else {
                                print("🚫 [CameraPreview] Swipe blocked - stream is active. Stop stream to navigate away.")
                                return
                            }
                            
                            // Only process swipe when on stream screen and in portrait mode
                            guard showingStreamScreen else { return }
                            guard !streamManager.isLandscapeMode else { return } // Only allow swipe in portrait mode
                            
                            // Swipe LEFT (negative width = finger moving left) to go to Twilly TV
                            // User swipes from right edge going left
                            let swipeLeft = value.translation.width < -80 || value.predictedEndTranslation.width < -150
                            
                            print("🔍 [CameraPreview] Swipe detected - width: \(value.translation.width), predicted: \(value.predictedEndTranslation.width), showingStreamScreen: \(showingStreamScreen), landscape: \(streamManager.isLandscapeMode)")
                            
                            if swipeLeft {
                                // Discover page removed for all accounts - just go back to Twilly TV
                                print("✅ [CameraPreview] LEFT swipe (from right) → Going back to Twilly TV")
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    showingStreamScreen = false
                                }
                            }
                        }
                )
                .onChange(of: streamManager.recordedVideoURL) { url in
                    if url == nil {
                        showingRecordingPreview = false
                        showingChannelSelection = false
                        withAnimation(.easeInOut(duration: 0.2)) {
                            previewRefreshKey = UUID()
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RefreshPreviewKey"))) { _ in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        previewRefreshKey = UUID()
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ForceRefreshPreview"))) { _ in
                    print("🔍 ContentView: ForceRefreshPreview received - refreshing camera preview")
                    withAnimation(.easeInOut(duration: 0.2)) {
                        previewRefreshKey = UUID()
                    }
                    streamManager.setupCameraPreview()
                }
                .onAppear {
                    streamManager.setupCameraPreview()
                }
        }
        
        private var topControls: some View {
            VStack {
                HStack {
                    // Stream Drop header
                    Text("Stream Drop")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
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
                        .shadow(color: Color.white.opacity(0.7), radius: 8, x: 0, y: 0)
                        .shadow(color: Color.twillyCyan.opacity(0.5), radius: 6, x: 0, y: 2)
                        .padding(.leading, 16)
                    
                    Spacer()
                    
                    // Control buttons at top right
                    HStack(spacing: 12) {
                        
                        // Camera flip button (always visible when not recording, even during streaming)
                        // SNAPCHAT-LIKE: Always available, responsive tap area
                        if !streamManager.isRecording {
                            Button(action: {
                                // Haptic feedback for better UX
                                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                                impactFeedback.impactOccurred()
                                
                                // Prevent multiple rapid taps
                                print("📷 [ContentView] Camera flip button tapped")
                                streamManager.toggleCamera()
                            }) {
                                Image(systemName: "camera.rotate.fill")
                                    .font(.title2)
                                    .foregroundColor(.white)
                                    .padding(12)
                                    .background(Color.black.opacity(0.6))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(PlainButtonStyle()) // Remove default button styling for better responsiveness
                            .contentShape(Circle()) // Ensure entire circle is tappable
                            .simultaneousGesture(
                                // Add tap gesture for immediate response
                                TapGesture()
                                    .onEnded {
                                        // Haptic feedback
                                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                                        impactFeedback.impactOccurred()
                                    }
                            )
                        }
                    }
                    .padding(.trailing, 16)
                }
                .padding(.top, 12)
                Spacer()
            }
        }
        
        // Helper computed property for admin check
        private var emailForAdminCheck: String {
            actualUserEmail ?? authService.userEmail ?? ""
        }
        
        private var isAdminUser: Bool {
            let email = emailForAdminCheck
            let isAdmin = userRoles?.isAdmin ?? userRoleService.isAdmin(userEmail: email)
            // Enhanced debug logging for admin check
            print("🔍 [ContentView] isAdminUser check:")
            print("   emailForAdminCheck: \(email)")
            print("   actualUserEmail: \(actualUserEmail ?? "nil")")
            print("   authService.userEmail: \(authService.userEmail ?? "nil")")
            print("   userRoles?.isAdmin: \(userRoles?.isAdmin ?? false)")
            print("   userRoleService.isAdmin: \(userRoleService.isAdmin(userEmail: email))")
            print("   Final isAdmin: \(isAdmin)")
            if !isAdmin && email.lowercased() == "dehyu.sinyan@gmail.com" {
                print("⚠️ [ContentView] Admin email detected but isAdminUser is false!")
                print("   This should not happen - admin check is failing!")
            }
            return isAdmin
        }
        
        @ViewBuilder
        private var bottomControlsOverlay: some View {
            VStack {
                Spacer()
                
                // TV Network Model: All authenticated users can stream from mobile
                if authService.isAuthenticated {
                    authenticatedControlsView
                }
            }
            .padding(.bottom, 12) // Same padding for both portrait and landscape - UI rotates automatically
        }
        
        @ViewBuilder
        private var authenticatedControlsView: some View {
            // Old working layout: VStack from bottom — button, visibility, Post Immediately, swipe (no .position)
            VStack(spacing: 12) {
                HStack {
                    Spacer()
                    Button(action: {
                                // SNAPCHAT-LIKE: Immediate haptic feedback for responsive feel
                                let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
                                impactFeedback.impactOccurred()
                                
                                print("🎬 [ContentView] Capture button tapped - isStreaming: \(streamManager.isStreaming)")
                                if streamManager.isStreaming {
                                    // Stop streaming - will save to channel and show metadata form
                                    print("🛑 [ContentView] Stopping stream...")
                                    // Use PERSISTED schedule state so schedule is always honored (in-memory can be lost when UI is hidden during stream)
                                    let postNow: Bool
                                    let scheduledDate: Date?
                                    if UserDefaults.standard.object(forKey: schedulePostImmediatelyKey) != nil {
                                        postNow = UserDefaults.standard.bool(forKey: schedulePostImmediatelyKey)
                                        scheduledDate = UserDefaults.standard.object(forKey: scheduleDropDateKey) as? Date
                                    } else {
                                        postNow = postImmediately
                                        scheduledDate = scheduledDropDate
                                    }
                                    print("📅 [ContentView] Schedule for stop: postNow=\(postNow), scheduledDate=\(scheduledDate?.description ?? "nil")")
                                    let streamKey = streamManager.currentStreamKey
                                    let userEmail = authService.userEmail ?? ""
                                    // INSTANT: Update button state immediately
                                    streamManager.isStreaming = false
                                    streamManager.stopStreaming()
                                    // Tell backend to mark as post-now or scheduled (HELD) so premiere shows on timeline
                                    if let key = streamKey, !key.isEmpty, !userEmail.isEmpty {
                                        Task {
                                            do {
                                                _ = try await ChannelService.shared.convertStreamToPost(
                                                    channelName: "Twilly TV",
                                                    streamKey: key,
                                                    userEmail: userEmail,
                                                    postImmediately: postNow,
                                                    scheduledDropDate: postNow ? nil : scheduledDate
                                                )
                                                if !postNow, scheduledDate != nil {
                                                    print("📅 [ContentView] Scheduled drop sent to backend - premiere will show on timeline")
                                                    await MainActor.run {
                                                        NotificationCenter.default.post(name: NSNotification.Name("RefreshTwillyTVContent"), object: nil)
                                                    }
                                                }
                                                // Clear schedule after stop so next stream defaults to Post Immediately
                                                await MainActor.run {
                                                    postImmediately = true
                                                    scheduledDropDate = nil
                                                    showingDatePicker = false
                                                    saveSchedulePreference()
                                                    print("📅 [ContentView] Schedule cleared after stop")
                                                }
                                            } catch {
                                                print("⚠️ [ContentView] convertStreamToPost failed: \(error.localizedDescription)")
                                            }
                                        }
                                    } else {
                                        // No stream key — still clear schedule for next time
                                        postImmediately = true
                                        scheduledDropDate = nil
                                        showingDatePicker = false
                                        saveSchedulePreference()
                                    }
                                } else {
                                    // Cancel countdown if button is pressed during countdown
                                    if isShowingCountdown {
                                        print("🚫 [ContentView] Stream button pressed during countdown - canceling")
                                        // Strong haptic feedback to indicate cancellation
                                        let notificationFeedback = UINotificationFeedbackGenerator()
                                        notificationFeedback.notificationOccurred(.warning)
                                        
                                        // Cancel the countdown
                                        cancelCountdown()
                                        
                                        // Show notification that stream was canceled
                                        showNotification("Stream canceled")
                                        return
                                    }
                                    
                                    // INSTANT: Update button state immediately before any async work
                                    streamManager.isStreaming = true
                                    
                                    // Start streaming directly based on toggle state
                                    print("▶️ [ContentView] Stream button clicked - starting stream with mode: \(streamModeIsPrivate ? "private" : "public")")
                                    // Update visibility state based on toggle
                                    let isPublic = !streamModeIsPrivate
                                    selectedStreamVisibility = isPublic
                                    isUsernamePublic = isPublic
                                    saveVisibilityPreference(isPublic)
                                    updateUsernameVisibility(isPublic)
                                    
                                    // Hide swipe indicator immediately when stream button is pressed
                                    withAnimation(.easeOut(duration: 0.3)) {
                                        showSwipeIndicator = false
                                    }
                                    
                                    // Start stream directly
                                    Task {
                                        await startStreamToTwillyTV()
                                    }
                                }
                            }) {
                                ZStack {
                                    // SNAPCHAT-STYLE: Progress ring when recording (shows recording progress)
                                    if streamManager.isRecording {
                                        // Use recordingDuration for recording, with a max of 15 minutes for visual feedback
                                        Circle()
                                            .trim(from: 0, to: min(1.0, CGFloat(streamManager.recordingDuration) / CGFloat(15 * 60)))
                                            .stroke(
                                                LinearGradient(
                                                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                                    startPoint: .leading,
                                                    endPoint: .trailing
                                                ),
                                                style: StrokeStyle(lineWidth: 4, lineCap: .round)
                                            )
                                            .frame(width: 95, height: 95)
                                            .rotationEffect(.degrees(-90))
                                            .animation(.linear(duration: 0.1), value: streamManager.recordingDuration)
                                    }
                                    
                                    // Pulsing animation when streaming or recording
                                    if streamManager.isStreaming || streamManager.isRecording {
                                        Circle()
                                            .fill(captureButtonGradient.opacity(0.3))
                                            .frame(width: 95, height: 95)
                                            .scaleEffect(streamManager.isStreaming ? 1.2 : 1.1)
                                            .opacity(0.6)
                                            .animation(
                                                Animation.easeInOut(duration: 1.0)
                                                    .repeatForever(autoreverses: true),
                                                value: streamManager.isStreaming || streamManager.isRecording
                                            )
                                    }
                                    
                                    // Fixed size background to prevent position shifts
                                    Circle()
                                        .fill(captureButtonGradient)
                                        .frame(width: 85, height: 85)
                                        .shadow(color: (streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyTeal).opacity(0.3), radius: 12, x: 0, y: 6)
                                    
                                    // Icon centered within fixed frame
                                    Image(systemName: streamManager.isStreaming ? "stop.fill" : "record.circle.fill")
                                        .font(.system(size: 32, weight: .medium))
                                        .foregroundColor(.white)
                                        .frame(width: 85, height: 85)
                                }
                                .scaleEffect(isButtonPressed ? 0.92 : 1.0) // Press down effect
                                .opacity(isButtonPressed ? 0.85 : 1.0) // Slight opacity change on press
                                .animation(.easeInOut(duration: 0.15), value: isButtonPressed)
                                .animation(.easeInOut(duration: 0.25), value: streamManager.isStreaming) // Animate icon/gradient when going live
                            }
                            .frame(width: 85, height: 85) // Fixed frame to prevent position shifts
                            .contentShape(Circle()) // Ensure entire circle is tappable
                            .animation(.easeInOut(duration: 0.25), value: streamManager.isStreaming)
                            .buttonStyle(PlainButtonStyle()) // Remove default button styling for better responsiveness
                            .simultaneousGesture(
                                // Press gesture for visual feedback
                                DragGesture(minimumDistance: 0)
                                    .updating($isButtonPressed) { _, state, _ in
                                        state = true
                                    }
                            )
                    }
                    .frame(width: 85, height: 85)
                    Spacer()
                }
                .frame(height: 85)
                .padding(.horizontal, 20)
                
                // Visibility (or LIVE when streaming) — first row below button
                Group {
                    if streamManager.isStreaming {
                        VStack(spacing: 6) {
                            Text("LIVE")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.red, Color.red.opacity(0.8)]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(6)
                                .shadow(color: Color.red.opacity(0.5), radius: 4, x: 0, y: 2)
                            StreamCountdownTimerView(
                                timeRemaining: max(0, streamTimeLimit - streamManager.duration),
                                isPrivate: streamModeIsPrivate,
                                streamMode: streamMode,
                                onTimeExpired: {
                                    print("⏰ [ContentView] 15-minute limit reached - stopping stream automatically")
                                    streamManager.stopStreaming()
                                }
                            )
                        }
                        .allowsHitTesting(false)
                    } else {
                        if isPremiumEnabled {
                            // 3-state toggle: Public -> Private -> Premium -> Public
                            Button(action: {
                                withAnimation {
                                    switch streamMode {
                                    case .public:
                                        streamMode = .private
                                        streamModeIsPrivate = true
                                    case .private:
                                        streamMode = .premium
                                        streamModeIsPrivate = true
                                    case .premium:
                                        streamMode = .public
                                        streamModeIsPrivate = false
                                    }
                                }
                                // Update selectedStreamVisibility when toggle changes
                                selectedStreamVisibility = streamMode.isPrivateUsername == false
                                isUsernamePublic = streamMode.isPrivateUsername == false
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: streamMode.icon)
                                        .font(.system(size: 14))
                                    Text(streamMode.rawValue)
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background((streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.55))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder((streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.95), lineWidth: 1.5)
                                )
                                .cornerRadius(10)
                                .shadow(color: (streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.35), radius: 6, x: 0, y: 2)
                            }
                        } else {
                            Button(action: {
                                withAnimation {
                                    streamModeIsPrivate.toggle()
                                    streamMode = streamModeIsPrivate ? .private : .public
                                }
                                // Update selectedStreamVisibility when toggle changes
                                selectedStreamVisibility = !streamModeIsPrivate // true = public, false = private
                                isUsernamePublic = !streamModeIsPrivate
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: streamModeIsPrivate ? "lock.fill" : "lock.open.fill")
                                        .font(.system(size: 14))
                                    Text(streamModeIsPrivate ? "Private" : "Public")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background((streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.55))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder((streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.95), lineWidth: 1.5)
                                )
                                .cornerRadius(10)
                                .shadow(color: (streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.35), radius: 6, x: 0, y: 2)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 20)
                .padding(.top, 4)
                
                // Post Immediately / Schedule Drop — always visible (before and during stream) so user can set/change choice
                VStack(spacing: 6) {
                    Button(action: {
                        withAnimation {
                            postImmediately.toggle()
                            if postImmediately {
                                scheduledDropDate = nil
                                showingDatePicker = false
                            } else {
                                // Switch to Schedule Drop: default to 1 hour from now so user can pick a clear air time
                                if scheduledDropDate == nil {
                                    scheduledDropDate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
                                }
                                showingDatePicker = true
                            }
                            saveSchedulePreference()
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: postImmediately ? "paperplane.fill" : "calendar")
                                .font(.system(size: 14, weight: .semibold))
                            Text(postImmediately ? "Post Immediately" : "Schedule Drop")
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background((streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(postImmediately ? 0.5 : 0.65))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder((streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.95), lineWidth: 1.5)
                        )
                        .cornerRadius(10)
                        .shadow(color: (streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan).opacity(0.35), radius: 6, x: 0, y: 2)
                    }
                    if !postImmediately, let date = scheduledDropDate {
                        Button(action: {
                            withAnimation { showingDatePicker = true }
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "calendar.badge.clock")
                                    .font(.system(size: 11))
                                Text("Airs \(formatScheduleDate(date))")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                            }
                            .foregroundColor(.white.opacity(0.95))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    if !postImmediately && showingDatePicker {
                        VStack(spacing: 8) {
                        DatePicker(
                            "Air time",
                            selection: Binding(
                                get: { scheduledDropDate ?? Date() },
                                set: { newDate in scheduledDropDate = newDate; saveSchedulePreference() }
                            ),
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .datePickerStyle(.compact)
                        .accentColor(streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyCyan)
                        .padding(8)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(8)
                            Button("Done") {
                                withAnimation { showingDatePicker = false }
                                saveSchedulePreference()
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(Capsule().fill((streamMode == .premium ? Color.yellow : streamModeIsPrivate ? Color.orange : Color.twillyTeal).opacity(0.9)))
                        }
                        .padding(8)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(8)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 20)
                .padding(.top, 8)
                
                if streamManager.isRecording {
                    HStack(spacing: 8) {
                        Spacer()
                        CaptureWaveView()
                            .frame(width: 30, height: 24)
                        Spacer()
                    }
                    .frame(height: 36)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                }
                
                // Swipe indicator at bottom (same position as old working version)
                swipeIndicator
                    .padding(.top, 8)
                    .padding(.bottom, 12)
            }
        
        
        // MARK: - Username Visibility
        
        // Load saved visibility preference from UserDefaults
        private func loadSavedVisibilityPreference() {
            if let savedPreference = UserDefaults.standard.object(forKey: visibilityPreferenceKey) as? Bool {
                isUsernamePublic = savedPreference
                streamModeIsPrivate = !savedPreference
                streamMode = savedPreference ? .public : .private
                print("✅ [ContentView] Loaded saved visibility preference: \(savedPreference ? "public" : "private")")
            } else {
                // Default to public if no preference saved
                isUsernamePublic = true
                streamModeIsPrivate = false
                streamMode = .public
                print("✅ [ContentView] No saved preference, defaulting to public")
            }
        }
        
        // Save visibility preference to UserDefaults
        private func saveVisibilityPreference(_ isPublic: Bool) {
            UserDefaults.standard.set(isPublic, forKey: visibilityPreferenceKey)
            print("💾 [ContentView] Saved visibility preference: \(isPublic ? "public" : "private")")
        }
        
        // Load schedule preference so Schedule Drop and date are restored (and used when stopping stream)
        private func loadSchedulePreference() {
            if UserDefaults.standard.object(forKey: schedulePostImmediatelyKey) != nil {
                postImmediately = UserDefaults.standard.bool(forKey: schedulePostImmediatelyKey)
            }
            if let stored = UserDefaults.standard.object(forKey: scheduleDropDateKey) as? Date {
                scheduledDropDate = stored
                if !postImmediately {
                    showingDatePicker = false
                }
            }
            normalizeScheduleIfNeeded()
            saveSchedulePreference()
            print("✅ [ContentView] Loaded schedule: postImmediately=\(postImmediately), scheduledDropDate=\(scheduledDropDate?.description ?? "nil")")
        }
        
        // If scheduled time is less than 5 minutes from now, treat as post immediately
        private func normalizeScheduleIfNeeded() {
            guard !postImmediately, let date = scheduledDropDate else { return }
            if date.timeIntervalSinceNow < 5 * 60 {
                postImmediately = true
                scheduledDropDate = nil
                showingDatePicker = false
                print("💾 [ContentView] Schedule < 5 min from now → post immediately")
            }
        }
        
        // Save schedule so it persists and is used on stream stop
        private func saveSchedulePreference() {
            normalizeScheduleIfNeeded()
            UserDefaults.standard.set(postImmediately, forKey: schedulePostImmediatelyKey)
            UserDefaults.standard.set(scheduledDropDate, forKey: scheduleDropDateKey)
            print("💾 [ContentView] Saved schedule: postImmediately=\(postImmediately), scheduledDropDate=\(scheduledDropDate?.description ?? "nil")")
        }
        
        private func formatScheduleDate(_ date: Date) -> String {
            let formatter = DateFormatter()
            formatter.timeZone = TimeZone.current
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        
        // Load premium enabled from UserDefaults
        private func loadPremiumEnabled() {
            // Force synchronize to get latest value
            UserDefaults.standard.synchronize()
            isPremiumEnabled = UserDefaults.standard.bool(forKey: "PremiumEnabled")
            print("✅ [ContentView] Loaded premium enabled: \(isPremiumEnabled)")
        }
        
        private func loadUsernameVisibility() {
            guard let userEmail = authService.userEmail, !isLoadingVisibility, !isUpdatingVisibility else {
                return
            }
            
            isLoadingVisibility = true
            
            Task {
                do {
                    let response = try await ChannelService.shared.getUsernameVisibility(userEmail: userEmail)
                    await MainActor.run {
                        isLoadingVisibility = false
                        isUsernamePublic = response.isPublic ?? true // Default to public if not set
                        print("✅ [ContentView] Loaded username visibility: \(isUsernamePublic ? "public" : "private")")
                    }
                } catch {
                    await MainActor.run {
                        isLoadingVisibility = false
                        print("❌ [ContentView] Error loading username visibility: \(error)")
                        // Default to public on error
                        isUsernamePublic = true
                    }
                }
            }
        }
        
        private func updateUsernameVisibility(_ isPublic: Bool) {
            guard let userEmail = authService.userEmail, !isUpdatingVisibility else {
                return
            }
            
            isUpdatingVisibility = true
            let previousValue = isUsernamePublic
            
            // Update state immediately for responsive UI (eye icon will update immediately)
            withAnimation(.easeInOut(duration: 0.3)) {
                isUsernamePublic = isPublic
            }
            
            Task {
                do {
                    let response = try await ChannelService.shared.setUsernameVisibility(userEmail: userEmail, isPublic: isPublic)
                    await MainActor.run {
                        isUpdatingVisibility = false
                        
                        if response.success {
                            // Verify the response matches what we set
                            // Check both isPublic and usernameVisibility fields
                            let actualValue: Bool
                            if let responseIsPublic = response.isPublic {
                                actualValue = responseIsPublic
                            } else if let visibility = response.usernameVisibility {
                                actualValue = visibility.lowercased() == "public"
                            } else {
                                // Fallback to what we set
                                actualValue = isPublic
                            }
                            
                            if actualValue != isPublic {
                                print("⚠️ [ContentView] API returned different value: expected \(isPublic ? "public" : "private"), got \(actualValue ? "public" : "private")")
                                print("   Response isPublic: \(response.isPublic?.description ?? "nil")")
                                print("   Response usernameVisibility: \(response.usernameVisibility ?? "nil")")
                            }
                            
                            // If API confirms success, use the value we set (user's choice)
                            // Only use API value if it's different and we need to sync
                            let finalValue: Bool
                            if actualValue != isPublic {
                                // API returned different value - log warning but use what we set if API says success
                                print("⚠️ [ContentView] API returned different value, but using user's selection since API confirmed success")
                                finalValue = isPublic // Trust what user selected if API says success
                            } else {
                                // Values match - use what we set
                                finalValue = isPublic
                            }
                            
                            withAnimation(.easeInOut(duration: 0.3)) {
                                isUsernamePublic = finalValue
                            }
                            print("✅ [ContentView] Username visibility updated to: \(isUsernamePublic ? "public" : "private")")
                            print("   User selected: \(isPublic ? "public" : "private"), API returned: \(actualValue ? "public" : "private"), Final state: \(finalValue ? "public" : "private")")
                        } else {
                            // Revert on failure
                            withAnimation(.easeInOut(duration: 0.3)) {
                                isUsernamePublic = previousValue
                            }
                            print("❌ [ContentView] Failed to update visibility, reverted to: \(previousValue ? "public" : "private")")
                        }
                    }
                } catch {
                    await MainActor.run {
                        isUpdatingVisibility = false
                        // Revert state on error
                        isUsernamePublic = previousValue
                        print("❌ [ContentView] Error updating visibility, reverted to: \(previousValue ? "public" : "private")")
                    }
                }
            }
        }
        
        // Cancel countdown and reset state
        private func cancelCountdown() {
            print("🚫 [ContentView] Countdown cancelled by user")
            countdownTask?.cancel()
            countdownTask = nil
            withAnimation(.easeOut(duration: 0.3)) {
                isShowingCountdown = false
                countdownValue = 3
            }
            // Reset stream key if it was set
            streamManager.setStreamKey("", channelName: "")
        }
        
        // Start streaming to Twilly TV (admin only)
        private func startStreamToTwillyTV() async {
            print("🎬 [ContentView] startStreamToTwillyTV() called")
            print("   isAdminUser: \(isAdminUser)")
            print("   emailForAdminCheck: \(emailForAdminCheck)")
            
            // All authenticated users can stream from mobile
            guard authService.isAuthenticated else {
                print("❌ [ContentView] Unauthenticated user attempted to stream from mobile")
                await MainActor.run {
                    showNotification("Please sign in to stream.")
                }
                return
            }
            
            print("✅ [ContentView] User authenticated - proceeding with stream setup")
            
            // No countdown - stream starts immediately
            
            // Find Twilly TV channel - use cached first (instant), then fetch if needed
            var channel: DiscoverableChannel?
            
            // FAST PATH: Use cached Twilly TV channel if available (instant, no API call)
            if let cachedChannel = twillyTVChannel {
                channel = cachedChannel
                print("✅ [ContentView] Using cached Twilly TV channel (instant)")
            } else {
                // Fetch with timeout to prevent freezing (5 second max wait)
                print("⏳ [ContentView] Cached channel not available, fetching...")
                channel = await withTimeout(seconds: 5) {
                    await findTwillyTVChannel()
                }
            }
            
            guard let twillyTVChannel = channel else {
                print("❌ [ContentView] Twilly TV channel not found")
                await MainActor.run {
                    isShowingCountdown = false
                    countdownTask = nil
                    showNotification("Twilly TV channel not found. Please check your connection.")
                }
                return
            }
            
            print("✅ [ContentView] Found Twilly TV channel: \(twillyTVChannel.channelName)")
            
            // Get user info
            guard let userEmail = authService.userEmail,
                  let userId = authService.userId else {
                print("⚠️ [ContentView] User not authenticated")
                await MainActor.run {
                    isShowingCountdown = false
                    countdownTask = nil
                    showNotification("Please sign in to stream")
                }
                return
            }
            
            do {
                // Get or create stream key for Twilly TV
                let streamKey = try await ChannelService.shared.getOrCreateCollaboratorStreamKey(
                    channelId: twillyTVChannel.channelId,
                    channelName: twillyTVChannel.channelName,
                    userId: userId,
                    userEmail: userEmail
                )
                
                print("✅ [ContentView] Got stream key for Twilly TV: \(streamKey)")
                
                // Store channel info
                await MainActor.run {
                    streamChannelId = twillyTVChannel.channelId
                    streamChannelName = twillyTVChannel.channelName
                    selectedChannel = twillyTVChannel
                }
                
                // Set stream key early (before countdown) so button can prepare
                await MainActor.run {
                    streamManager.setStreamKey(streamKey, channelName: twillyTVChannel.channelName)
                    // CRITICAL: Update stream orientation based on landscape mode before starting
                    streamManager.updateStreamOrientation()
                }
                
                // CRITICAL: Set username type for this stream DURING COUNTDOWN (BEFORE stream starts)
                // This ensures the global map is set BEFORE the RTMP connection is established
                // Use the stream mode toggle (streamModeIsPrivate) - this is the primary source
                let isPrivate = await MainActor.run { streamModeIsPrivate }
                let streamIsPublic = !isPrivate
                
                // Get the actual username (e.g., "myusername" or "myusername🔒")
                let baseUsername = authService.username ?? String(userEmail.split(separator: "@")[0])
                let streamUsername = isPrivate ? "\(baseUsername)🔒" : baseUsername
                
                print("🔍 [ContentView] Setting stream privacy DURING COUNTDOWN (BEFORE stream starts)")
                print("   StreamKey: \(streamKey)")
                print("   isPrivateUsername: \(isPrivate)")
                print("   StreamUsername: \(streamUsername)") // Log the actual username being used
                print("   This MUST complete before stream starts!")
                
                do {
                    // CRITICAL: This is BLOCKING - it will complete BEFORE the countdown continues
                    // The EC2 immediate endpoint call inside is also blocking, so global map is set instantly
                    let isPremium = streamMode.isPremium
                    try await ChannelService.shared.setStreamUsernameType(
                        streamKey: streamKey,
                        isPrivateUsername: isPrivate,
                        streamUsername: streamUsername,
                        isPremium: isPremium
                    )
                    print("✅ [ContentView] CRITICAL: Stream privacy set DURING COUNTDOWN - global map is ready!")
                    print("   StreamKey: \(streamKey)")
                    print("   isPrivateUsername: \(isPrivate)")
                    print("   isPremium: \(isPremium)")
                    print("   StreamUsername: \(streamUsername)")
                    print("   Stream will start with correct privacy setting ✅")
                } catch {
                    print("❌ [ContentView] CRITICAL: Failed to set stream username type DURING COUNTDOWN: \(error.localizedDescription)")
                    print("   StreamKey: \(streamKey)")
                    print("   isPrivateUsername: \(isPrivate)")
                    print("   Error type: \(type(of: error))")
                    if let channelError = error as? ChannelServiceError {
                        print("   ChannelServiceError: \(channelError)")
                    }
                    // Continue streaming anyway - but log the critical error
                    print("⚠️ [ContentView] WARNING: Continuing with stream but privacy might not be set correctly!")
                }
                
                // Clear selectedStreamVisibility after use so it doesn't persist for next stream
                selectedStreamVisibility = nil
                
                // Start streaming immediately - no countdown
                // NOTE: isStreaming already set synchronously in button action for instant response
                await MainActor.run {
                    // CRITICAL: Update stream orientation before starting (ensures landscape is applied)
                    streamManager.updateStreamOrientation()
                    streamManager.startStreaming()
                    // Start monitoring for 15-minute limit
                    startStreamTimeLimitMonitoring()
                    // Flash notification that streaming has started
                    showNotification("Streaming!")
                }
            } catch {
                print("❌ [ContentView] Error getting stream key: \(error)")
                await MainActor.run {
                    // Revert optimistic update if streaming failed
                    streamManager.isStreaming = false
                    isShowingCountdown = false
                    countdownTask?.cancel()
                    countdownTask = nil
                    showNotification("Failed to get stream key: \(error.localizedDescription)")
                }
            }
        }
        
        // Find Twilly TV channel
        private func findTwillyTVChannel() async -> DiscoverableChannel? {
            do {
                let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: false)
                return channels.first(where: { 
                    $0.channelName.lowercased().contains("twilly tv") 
                })
            } catch {
                print("❌ [ContentView] Error fetching channels: \(error)")
                return nil
            }
        }
        
        // Helper to add timeout to async operations
        private func withTimeout<T>(seconds: TimeInterval, operation: @escaping () async -> T?) async -> T? {
            await withTaskGroup(of: T?.self) { group in
                // Start the operation
                group.addTask {
                    await operation()
                }
                
                // Start timeout task
                group.addTask {
                    try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                    return nil
                }
                
                // Return first result (either operation result or timeout)
                let result = await group.next()
                group.cancelAll()
                return result ?? nil
            }
        }
        
        private var captureButtonGradient: LinearGradient {
            if streamManager.isStreaming {
                // Stop button - red background
                return LinearGradient(
                    gradient: Gradient(colors: [Color.red, Color.red.opacity(0.8)]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            } else if streamManager.isRecording {
                return LinearGradient(
                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan, Color.twillyTeal]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            } else if streamMode == .premium {
                // Premium mode - yellow gradient
                return LinearGradient(
                    gradient: Gradient(colors: [Color.yellow.opacity(0.9), Color.yellow]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            } else if streamModeIsPrivate {
                // Private mode - orange gradient
                return LinearGradient(
                    gradient: Gradient(colors: [Color.orange.opacity(0.9), Color.orange]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            } else {
                // Public mode - teal/cyan gradient
                return LinearGradient(
                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
        }
        
        private var recordingStatusIndicator: some View {
            HStack(spacing: 12) {
                // Pulsing recording dot
                ZStack {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 12, height: 12)
                        .shadow(color: Color.red.opacity(0.8), radius: 6)
                    
                    Circle()
                        .fill(Color.red.opacity(0.6))
                        .frame(width: 12, height: 12)
                        .scaleEffect(streamManager.isRecording ? 1.5 : 1.0)
                        .opacity(streamManager.isRecording ? 0.0 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 1.0)
                                .repeatForever(autoreverses: true),
                            value: streamManager.isRecording
                        )
                }
                
                CaptureWaveView()
                    .frame(width: 32, height: 26)
                
                Text("LIVE")
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .tracking(2)
                    .shadow(color: Color.black.opacity(0.5), radius: 2)
                
                Text("Capturing")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
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
                    .shadow(color: Color.twillyCyan.opacity(0.7), radius: 6, x: 0, y: 2)
                    .shadow(color: Color.black.opacity(0.3), radius: 3, x: 0, y: 1)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.black.opacity(0.7),
                                Color.black.opacity(0.5)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal.opacity(0.8),
                                        Color.twillyCyan.opacity(0.6),
                                        Color.twillyTeal.opacity(0.8)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2
                            )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.4), radius: 12, x: 0, y: 4)
                    .shadow(color: Color.black.opacity(0.5), radius: 8, x: 0, y: 2)
            )
            .frame(height: 44) // Slightly taller for more presence
        }
        
        // Subtle swipe indicator for stream screen (centered, disappears after 2 seconds or when streaming starts)
        @ViewBuilder
        private var swipeIndicator: some View {
            if showSwipeIndicator {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 12, weight: .medium))
                    Text("Swipe left for Twilly TV")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundColor(.white.opacity(0.7))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(Color.black.opacity(0.4))
                        .overlay(
                            Capsule()
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                )
                .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
                .onAppear {
                    // Auto-hide after 2 seconds
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        withAnimation(.easeOut(duration: 0.6)) {
                            showSwipeIndicator = false
                        }
                    }
                }
            } else {
                EmptyView()
            }
        }
        
        @ViewBuilder
        private var streamDurationView: some View {
            // Use separate views to avoid property access issues with @EnvironmentObject
            StreamDurationDisplayView(streamManager: streamManager)
        }
        }
    
    // Separate view to avoid property access issues with @EnvironmentObject
    struct StreamDurationDisplayView: View {
        @ObservedObject var streamManager: StreamManager
        
        var body: some View {
            StreamElapsedTimeView(duration: streamManager.duration)
        }
    }

    struct StreamCountdownView: View {
        let timeRemaining: TimeInterval
        
        var body: some View {
            Text(countdownText)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(timeRemaining < 60 ? .orange : .white.opacity(0.9))
        }
        
        private var countdownText: String {
            let minutes = Int(timeRemaining) / 60
            let seconds = Int(timeRemaining) % 60
            return String(format: "%d:%02d remaining", minutes, seconds)
        }
    }

    struct StreamElapsedTimeView: View {
        let duration: TimeInterval
        
        var body: some View {
            Group {
                if duration > 0 {
                    Text(formatDuration(duration))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
        }
        
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
    }

    // Drives 1-second countdown so the timer closure always sees current value
    private class StreamCountdownRunner: ObservableObject {
        @Published var displaySeconds: TimeInterval = 0
        private var timer: Timer?
        var onTimeExpired: (() -> Void)?
        
        func start(initial: TimeInterval) {
            displaySeconds = max(0, initial)
            timer?.invalidate()
            guard initial > 0 else { return }
            timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    if self.displaySeconds <= 1 {
                        self.displaySeconds = 0
                        self.timer?.invalidate()
                        self.timer = nil
                        self.onTimeExpired?()
                        return
                    }
                    self.displaySeconds -= 1
                }
            }
            if let t = timer { RunLoop.main.add(t, forMode: .common) }
        }
        
        func stop() {
            timer?.invalidate()
            timer = nil
        }
        
        func syncIfNeeded(from value: TimeInterval) {
            let v = max(0, value)
            if abs(displaySeconds - v) > 2 { displaySeconds = v }
        }
    }
    
    // 15-minute countdown timer for streaming (ticks down by 1 second for smooth display)
    struct StreamCountdownTimerView: View {
        let timeRemaining: TimeInterval
        let isPrivate: Bool
        let streamMode: StreamMode
        let onTimeExpired: () -> Void
        @StateObject private var runner = StreamCountdownRunner()
        
        var body: some View {
            Text(countdownText)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundStyle(
                    LinearGradient(
                        gradient: Gradient(colors: countdownColors),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .shadow(color: shadowColor.opacity(0.9), radius: 10, x: 0, y: 2)
                .shadow(color: shadowColor.opacity(0.8), radius: 20, x: 0, y: 0)
                .shadow(color: shadowColor.opacity(0.6), radius: 30, x: 0, y: 0)
                .shadow(color: shadowColor.opacity(0.4), radius: 40, x: 0, y: 0)
                .onAppear {
                    runner.onTimeExpired = onTimeExpired
                    if timeRemaining <= 0 {
                        onTimeExpired()
                        return
                    }
                    runner.start(initial: max(0, timeRemaining))
                }
                .onChange(of: timeRemaining) { newValue in
                    runner.syncIfNeeded(from: newValue)
                    if newValue <= 0 {
                        runner.displaySeconds = 0
                        runner.stop()
                        onTimeExpired()
                    }
                }
                .onDisappear {
                    runner.stop()
                }
        }
        
        private var displaySeconds: TimeInterval { runner.displaySeconds }
        
        private var countdownColors: [Color] {
            if displaySeconds < 60 {
                // Less than 1 minute remaining - red/orange warning
                return [Color.red, Color.orange]
            } else if streamMode == .premium {
                // Premium mode - yellow gradient (matches stream button)
                return [Color.yellow.opacity(0.9), Color.yellow]
            } else if isPrivate {
                // Private mode - orange gradient (matches stream button)
                return [Color.orange.opacity(0.9), Color.orange]
            } else {
                // Public mode - teal/cyan gradient (matches stream button)
                return [Color.twillyTeal, Color.twillyCyan]
            }
        }
        
        private var shadowColor: Color {
            if displaySeconds < 60 {
                return Color.red
            } else if streamMode == .premium {
                return Color.yellow
            } else if isPrivate {
                return Color.orange
            } else {
                return Color.twillyCyan
            }
        }
        
        private var countdownText: String {
            if displaySeconds <= 0 {
                return "0:00"
            }
            let minutes = Int(displaySeconds) / 60
            let seconds = Int(displaySeconds) % 60
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
    
    // ContentView struct continues with helper methods in extension below
    extension ContentView {
        
        // MARK: - Helper Functions
        
        func formatTimeRemaining(_ timeRemaining: TimeInterval) -> String {
            let minutes = Int(timeRemaining) / 60
            let seconds = Int(timeRemaining) % 60
            return String(format: "%d:%02d", minutes, seconds)
        }
        
            // Monitor stream time limit (15 minutes)
        private func startStreamTimeLimitMonitoring() {
            // Stop any existing timer first
            stopStreamTimeLimitMonitoring()
            
            // Capture streamTimeLimit by value (it's a constant)
            let limit = streamTimeLimit
            
            // Create and store timer
            // Note: Using [weak streamManager] since StreamManager is a class
            // streamTimeLimit is captured by value, so no retain cycle
            streamTimeLimitTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak streamManager] timer in
                guard let streamManager = streamManager else {
                    timer.invalidate()
                    return
                }
                
                // Stop monitoring if stream is not active
                if !streamManager.isStreaming {
                    // Timer will be invalidated when stream stops
                    return
                }
                
                // Check if 15 minutes have elapsed
                if streamManager.duration >= limit {
                    print("⏰ [ContentView] 15-minute limit reached - stopping stream automatically")
                    streamManager.stopStreaming()
                }
            }
        }
        
        // Stop stream time limit monitoring
        private func stopStreamTimeLimitMonitoring() {
            streamTimeLimitTimer?.invalidate()
            streamTimeLimitTimer = nil
        }
        
        private var liveStatusIndicator: some View {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                            .shadow(color: Color.red.opacity(0.8), radius: 4)
                        
                        Text("LIVE")
                            .font(.subheadline)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Color.red.opacity(0.2))
                            .overlay(
                                Capsule()
                                    .stroke(Color.red, lineWidth: 1.5)
                            )
                    )
                    
                    // Show duration or time remaining based on stream type
                    streamDurationView
                }
                
                // Show stream key for easy viewing/copying (for ALL streams)
                if let streamKey = streamManager.currentStreamKey {
                    Button(action: {
                        // Copy stream key to clipboard
                        UIPasteboard.general.string = streamKey
                        print("✅ [ContentView] Stream key copied to clipboard: \(streamKey)")
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                            Text("Stream Key: \(streamKey)")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.white.opacity(0.8))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.5))
                                .overlay(
                                    Capsule()
                                        .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                )
                        )
                    }
                    .onTapGesture {
                        UIPasteboard.general.string = streamKey
                        print("✅ [ContentView] Stream key copied to clipboard (tap): \(streamKey)")
                    }
                    
                    // Show viewing URL hint
                    Text("View at: twilly.app/stream-test")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.6))
                } else {
                    // Log when stream key is missing (debugging)
                    let _ = print("⚠️ [ContentView] Stream is active but currentStreamKey is nil - streamKey should be set!")
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        
        private func handleNavigateToChannel(_ notification: Notification) {
            // Handle navigation to channel after upload or inbox tap
            // For inbox notifications, navigate DIRECTLY to channel (not through Discover)
            if let channelName = notification.userInfo?["channelName"] as? String {
                print("🔍 ContentView: Received NavigateToChannel notification for channel: \(channelName)")
                
                Task {
                    do {
                        // Force refresh to get latest channels
                        let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                        print("🔍 ContentView: Fetched \(channels.count) discoverable channels")
                        
                        // Try exact match first (case-insensitive)
                        let matchedChannel = channels.first(where: {
                            $0.channelName.lowercased() == channelName.lowercased() ||
                            $0.channelName == channelName
                        })
                        
                        await MainActor.run {
                            if let channel = matchedChannel {
                                print("✅ ContentView: Found channel '\(channelName)' - navigating DIRECTLY to channel")
                                channelToNavigateDirectly = channel
                                showingChannelDirectly = true
                            } else {
                                print("⚠️ ContentView: Channel '\(channelName)' not found in discoverable channels, creating minimal channel for navigation")
                                print("   Available channels: \(channels.map { $0.channelName }.joined(separator: ", "))")
                                // Create a minimal DiscoverableChannel (ChannelDetailView will fetch full details)
                                let minimalChannel = DiscoverableChannel(
                                    channelId: channelName,
                                    channelName: channelName,
                                    creatorEmail: authService.userEmail ?? "",
                                    creatorUsername: "",
                                    description: "",
                                    posterUrl: "",
                                    visibility: "public",
                                    isPublic: true,
                                    subscriptionPrice: nil,
                                    contentType: nil
                                )
                                channelToNavigateDirectly = minimalChannel
                                showingChannelDirectly = true
                            }
                        }
                    } catch {
                        print("❌ ContentView: Error fetching channels: \(error.localizedDescription)")
                        // On error, still navigate with a minimal channel
                        await MainActor.run {
                            let minimalChannel = DiscoverableChannel(
                                channelId: channelName,
                                channelName: channelName,
                                creatorEmail: authService.userEmail ?? "",
                                creatorUsername: "",
                                description: "",
                                posterUrl: "",
                                visibility: "public",
                                isPublic: true,
                                subscriptionPrice: nil,
                                contentType: nil
                            )
                            channelToNavigateDirectly = minimalChannel
                            showingChannelDirectly = true
                        }
                    }
                }
            }
        }
        
        private func handleNavigateToChannelViaDiscover(_ notification: Notification) {
            // Discover page removed - navigate directly to channel detail view
            if let channelName = notification.userInfo?["channelName"] as? String {
                print("🔍 ContentView: Received NavigateToChannelViaDiscover notification for channel: \(channelName)")
                
                Task {
                    do {
                        // Fetch channels to find the matching one
                        let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                        print("🔍 ContentView: Fetched \(channels.count) discoverable channels")
                        
                        // Try exact match first (case-insensitive)
                        if let channel = channels.first(where: {
                            $0.channelName.lowercased() == channelName.lowercased() ||
                            $0.channelName == channelName
                        }) {
                            await MainActor.run {
                                channelToViewAfterStream = channel
                                showingChannelAfterStream = true
                            }
                            print("✅ ContentView: Navigated directly to channel: \(channelName)")
                        } else {
                            // Create minimal channel if not found
                            let minimalChannel = DiscoverableChannel(
                                channelId: channelName,
                                channelName: channelName,
                                creatorEmail: authService.userEmail ?? "",
                                creatorUsername: "",
                                description: "",
                                posterUrl: "",
                                visibility: "public",
                                isPublic: true,
                                subscriptionPrice: nil,
                                contentType: nil
                            )
                            await MainActor.run {
                                channelToViewAfterStream = minimalChannel
                                showingChannelAfterStream = true
                            }
                            print("✅ ContentView: Navigated directly to channel (minimal): \(channelName)")
                        }
                    } catch {
                        print("❌ ContentView: Error fetching channels: \(error.localizedDescription)")
                        // On error, create minimal channel anyway
                        let minimalChannel = DiscoverableChannel(
                            channelId: channelName,
                            channelName: channelName,
                            creatorEmail: authService.userEmail ?? "",
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        await MainActor.run {
                            channelToViewAfterStream = minimalChannel
                            showingChannelAfterStream = true
                        }
                        print("✅ ContentView: Navigated directly to channel (minimal, error case): \(channelName)")
                    }
                }
            }
        }
        
        // Stream screen view (shown when navigated from channel detail)
        private var streamScreenView: some View {
            mainContentBase
                .alert("Channel Required", isPresented: $showingChannelSelectionAlert) {
                    Button("OK", role: .cancel) { 
                        print("🔔 [ContentView] Alert dismissed from stream screen")
                    }
                } message: {
                    Text("Please select a channel before starting to capture.")
                }
                .onAppear {
                    // Always default to Public mode when streamer page appears
                    streamMode = .public
                    streamModeIsPrivate = false
                    selectedStreamVisibility = true // true = public
                    isUsernamePublic = true
                    print("✅ [ContentView] Reset stream mode to Public on stream screen appear")
                    
                    // LOCK TO PORTRAIT: Streamer page must stay in portrait
                    AppDelegate.orientationLock = .portrait
                    
                    // Force portrait orientation (iOS 16+)
                    if #available(iOS 16.0, *) {
                        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                            windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { (error: Error?) in
                                if let error = error {
                                    print("❌ [ContentView] Failed to lock stream screen to portrait: \(error.localizedDescription)")
                                } else {
                                    print("✅ [ContentView] Stream screen locked to portrait mode")
                                }
                            }
                        }
                    } else {
                        // iOS < 16: Use UIDevice
                        UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
                        print("✅ [ContentView] Stream screen locked to portrait mode (iOS < 16)")
                    }
                    
                    // CRITICAL: Stream screen must appear instantly - no blocking operations
                    // All operations are non-blocking and happen in background
                    print("✅ [ContentView] Stream screen appeared - setting up non-blocking")
                    
                    // Reset swipe indicator immediately (no async)
                    showSwipeIndicator = true
                    
                    // Set selected channel immediately (no API calls, just use cached data)
                    // This is instant - no network calls that could freeze the UI
                    Task { @MainActor in
                        // Use cached collaboratorChannels (already loaded) - no API call
                        if let channel = streamScreenChannel {
                            // Find matching channel in collaboratorChannels (instant lookup)
                            if let matchingChannel = collaboratorChannels.first(where: { $0.name.lowercased() == channel.channelName.lowercased() }) {
                                // Create DiscoverableChannel from Channel (instant)
                                let discoverableChannel = DiscoverableChannel(
                                    channelId: matchingChannel.id,
                                    channelName: matchingChannel.name,
                                    creatorEmail: authService.userEmail ?? "",
                                    creatorUsername: "",
                                    description: "",
                                    posterUrl: "",
                                    visibility: "public",
                                    isPublic: true,
                                    subscriptionPrice: nil,
                                    contentType: nil
                                )
                                selectedChannel = discoverableChannel
                                print("✅ [ContentView] Set selected channel for streaming: \(matchingChannel.name)")
                            }
                        } else {
                            // No channel pre-selected - user will select from picker
                            selectedChannel = nil
                            print("✅ [ContentView] Stream screen opened - no channel pre-selected, user must select")
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("StartStreamingFromChannel"))) { notification in
                    if let channelName = notification.userInfo?["channelName"] as? String,
                       let channelId = notification.userInfo?["channelId"] as? String {
                        // Create DiscoverableChannel from notification data
                        let channel = DiscoverableChannel(
                            channelId: channelId,
                            channelName: channelName,
                            creatorEmail: authService.userEmail ?? "",
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        streamScreenChannel = channel
                        showingStreamScreen = true
                        print("✅ [ContentView] Received StartStreamingFromChannel notification for: \(channelName)")
                    }
                }
                // Discover page removed for all accounts
                // .fullScreenCover(isPresented: $showingDiscovery) {
                //     ChannelDiscoveryView(...)
                // }
                .onChange(of: streamManager.isStreaming) { isStreaming in
                    if !isStreaming {
                        // Stream stopped - video will appear in channel automatically
                        print("🎬 [StreamScreenView] Stream stopped - video will appear in channel when ready")
                        
                        // Clear stream state
                        streamManager.currentStreamKey = nil
                        streamChannelId = nil
                        streamChannelName = nil
                    } else {
                        // Stream started - prevent navigation away
                        print("🔒 [StreamScreenView] Stream started - navigation locked until stream stops")
                    }
                }
                // CRITICAL: Prevent navigation away while streaming
                // Block any attempts to change showingStreamScreen while stream is active
                .onChange(of: showingStreamScreen) { newValue in
                    // If trying to hide stream screen while streaming, block it
                    if !newValue && streamManager.isStreaming {
                        print("🚫 [StreamScreenView] Navigation blocked - stream is active. Stop stream to navigate away.")
                        // Force stream screen to stay visible
                        DispatchQueue.main.async {
                            showingStreamScreen = true
                        }
                    }
                }
        }
        
        // TV Network Model: Show Twilly TV channel directly (no discover page)
        private var twillyTVChannelView: some View {
            ZStack {
                // Background gradient matching Twilly aesthetic
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if isLoadingTwillyTV {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                        .scaleEffect(1.5)
                } else if let channel = twillyTVChannel {
                    NavigationView {
                        ChannelDetailView(
                            channel: channel,
                            forceRefresh: false,
                            canStream: authService.isAuthenticated, // All authenticated users can stream
                            collaboratorChannels: collaboratorChannels,
                            onInviteCodeAccepted: {
                                Task {
                                    await checkUserRole()
                                }
                            }
                        )
                    }
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "tv.slash")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("Twilly TV Channel Not Found")
                            .font(.headline)
                            .foregroundColor(.white)
                        Text("Please check your connection and try again")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                }
            }
            .onAppear {
                loadTwillyTVChannel()
            }
        }
        
        private func loadTwillyTVChannel() {
            Task { @MainActor in
                isLoadingTwillyTV = true
                
                do {
                    let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: false)
                    let twillyTV = channels.first(where: { 
                        $0.channelName.lowercased().contains("twilly tv") 
                    })
                    
                    twillyTVChannel = twillyTV
                    isLoadingTwillyTV = false
                    
                    if twillyTV == nil {
                        print("⚠️ [ContentView] Twilly TV channel not found in discoverable channels")
                    } else {
                        print("✅ [ContentView] Loaded Twilly TV channel: \(twillyTV!.channelName)")
                    }
                } catch {
                    print("❌ [ContentView] Error loading Twilly TV channel: \(error)")
                    isLoadingTwillyTV = false
                }
            }
        }
        
        private var mainContentBase: some View {
            ZStack {
                cameraPreviewWithModifiers
                topControls
                bottomControlsOverlay
                
                // Swipe indicator is now inside bottomControlsOverlay (same position as old working version)
            }
            .onAppear {
                // Always default to Public mode when main content appears
                streamMode = .public
                streamModeIsPrivate = false
                selectedStreamVisibility = true // true = public
                isUsernamePublic = true
                print("✅ [ContentView] Reset stream mode to Public on main content appear")
                
                // Ensure orientation is unlocked for main content (streaming interface)
                AppDelegate.orientationLock = .all
                
                // Force unlock by requesting all orientations (iOS 16+)
                if #available(iOS 16.0, *) {
                    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .all)) { (error: Error?) in
                            if let error = error {
                                print("❌ [ContentView] Failed to unlock orientations: \(error.localizedDescription)")
                            } else {
                                print("✅ [ContentView] Successfully unlocked all orientations for main content")
                            }
                        }
                    }
                }
                
                // Enable orientation notifications
                UIDevice.current.beginGeneratingDeviceOrientationNotifications()
                
                // Set initial orientation based on current device orientation
                let currentOrientation = UIDevice.current.orientation
                let initialIsLandscape = currentOrientation == .landscapeLeft || currentOrientation == .landscapeRight
                isLandscapeMode = initialIsLandscape
                streamManager.setLandscapeMode(initialIsLandscape, deviceOrientation: currentOrientation)
                print("🔄 [ContentView] Initial orientation: \(initialIsLandscape ? "landscape" : "portrait") (device orientation: \(currentOrientation.rawValue))")
            }
            .onDisappear {
                // Disable orientation notifications when view disappears
                UIDevice.current.endGeneratingDeviceOrientationNotifications()
            }
            .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
                // Detect device rotation - UI will rotate automatically, we just need to update stream orientation
                let orientation = UIDevice.current.orientation
                
                print("🔄 [ContentView] Orientation notification received: \(orientation.rawValue) (\(orientation == .landscapeLeft ? "landscapeLeft" : orientation == .landscapeRight ? "landscapeRight" : orientation == .portrait ? "portrait" : "other"))")
                
                // Only respond to valid orientations (ignore face up/down, unknown, flat)
                guard orientation.isValidInterfaceOrientation,
                      orientation != .faceUp,
                      orientation != .faceDown,
                      orientation != .unknown else {
                    print("⚠️ [ContentView] Ignoring invalid orientation: \(orientation.rawValue)")
                    return
                }
                
                // Snapchat-like: Track actual device orientation for always right-side-up video
                let newIsLandscape = orientation == .landscapeLeft || orientation == .landscapeRight
                
                // Always update device orientation (even if landscape state hasn't changed, orientation might have)
                let orientationChanged = isLandscapeMode != newIsLandscape || streamManager.deviceOrientation != orientation
                
                print("🔄 [ContentView] Current isLandscapeMode: \(isLandscapeMode), newIsLandscape: \(newIsLandscape), deviceOrientation: \(orientation.rawValue)")
                
                if orientationChanged {
                    isLandscapeMode = newIsLandscape
                    streamManager.setLandscapeMode(newIsLandscape, deviceOrientation: orientation)
                    previewRefreshKey = UUID()
                    print("✅ [ContentView] Device rotated to: \(newIsLandscape ? "landscape" : "portrait") (orientation: \(orientation.rawValue))")
                } else {
                    print("ℹ️ [ContentView] Orientation unchanged: \(newIsLandscape ? "landscape" : "portrait")")
                }
            }
        }
        
        @ViewBuilder
    private var mainContentViewWithSheets: some View {
            mainContentBase
                // Discover page removed for all accounts
                // .fullScreenCover(isPresented: $showingDiscovery) {
                //     ChannelDiscoveryView(...)
                // }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NavigateToChannel"))) { notification in
                handleNavigateToChannel(notification)
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NavigateToChannelViaDiscover"))) { notification in
                handleNavigateToChannelViaDiscover(notification)
            }
            // Removed CaptureMetadataView and GoLiveChannelPickerView - not needed for RTMP streaming flow
            // .sheet(isPresented: $showingCaptureMetadata) {
            //     CaptureMetadataView(streamManager: streamManager)
            // }
            // .sheet(isPresented: $showingGoLiveChannelPicker) {
            //     GoLiveChannelPickerView(streamManager: streamManager)
            // }
            // Removed PostStreamMetadataView blocking flow - video now processes in background
            // Video will appear in channel when ready - user can edit details there (like managefiles.vue)
            // TODO: Create inbox/notification system to notify when video is ready
            // TODO: Add edit functionality to ChannelDetailView (like managefiles.vue)
            .sheet(isPresented: $showingPostStream) {
                PostStreamView(
                    shareUrl: channelShareUrl,
                    channelName: postStreamChannelName ?? streamManager.currentChannelName ?? "",
                    onViewChannel: { channel in
                        channelToViewAfterStream = channel
                        showingPostStream = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            showingChannelAfterStream = true
                        }
                    }
                )
            }
        }
        
        @ViewBuilder
    private var mainContentViewWithFullScreenCovers: some View {
            mainContentViewWithSheets
            // Discover page removed for all accounts
            // Navigate directly to channel instead of discover page
            // .fullScreenCover(isPresented: $showingChannelDiscoveryAfterStream) {
            //     ChannelDiscoveryView(...)
            // }
            // Navigate to channel detail for other scenarios (upload success, etc.)
            .fullScreenCover(isPresented: $showingChannelAfterStream) {
                if let channel = channelToViewAfterStream {
                    ChannelDetailView(channel: channel, canStream: authService.isAuthenticated) // All authenticated users can stream
                }
            }
            // Navigate DIRECTLY to channel (from inbox notifications) - same as clicking from Discover
            // We need to wrap it in NavigationView with a back button to match Discover navigation
            .fullScreenCover(isPresented: $showingChannelDirectly) {
                if let channel = channelToNavigateDirectly {
                    NavigationView {
                        ChannelDetailViewWithBackButton(
                            channel: channel,
                            onBack: {
                                showingChannelDirectly = false
                                channelToNavigateDirectly = nil
                            },
                            canStream: authService.isAuthenticated, // All authenticated users can stream
                            collaboratorChannels: collaboratorChannels,
                            onInviteCodeAccepted: {
                                Task {
                                    await checkUserRole()
                                }
                            }
                        )
                    }
                    .navigationViewStyle(StackNavigationViewStyle())
                } else {
                    // Fallback: Show loading state if channel is nil
                    ZStack {
                        LinearGradient(
                            gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .ignoresSafeArea()
                        
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                    }
                }
            }
            .fullScreenCover(isPresented: $showingRecordingPreview) {
                if let videoURL = streamManager.recordedVideoURL {
                    RecordingPreviewView(
                        videoURL: videoURL,
                        streamManager: streamManager,
                        recordingOrientation: streamManager.recordingStopOrientation
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .onChange(of: showingRecordingPreview) { isShowing in
                if !isShowing {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        previewRefreshKey = UUID()
                    }
                    NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                    streamManager.setupCameraPreview()
                }
            }
            .fullScreenCover(isPresented: $showingPostRecordingActions) {
                postRecordingActionsContent
            }
            .fullScreenCover(isPresented: $showingChannelSelection) {
                if let videoURL = streamManager.recordedVideoURL {
                    ChannelSelectionView(streamManager: streamManager, recordedVideoURL: videoURL)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .onChange(of: showingChannelSelection) { isShowing in
                if !isShowing {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        previewRefreshKey = UUID()
                    }
                    NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                    NotificationCenter.default.post(name: NSNotification.Name("RefreshPreviewKey"), object: nil)
                    streamManager.setupCameraPreview()
                }
            }
            .sheet(isPresented: $showingInviteCodeEntry) {
                InviteCodeEntryView {
                    // On success, refresh user role to check for channel access
                    Task {
                        await checkUserRole()
                    }
                }
            }
            .fullScreenCover(isPresented: $showUploadSuccessScreen) {
                uploadSuccessContent
            }
        }
        
        private var mainContentView: some View {
            mainContentViewWithNotifications
        }
        
        private var mainContentViewWithNotifications: some View {
            let base = mainContentViewWithFullScreenCovers
                .modifier(NotificationModifier(
                    showingNotification: $showingNotification,
                    notificationMessage: notificationMessage,
                    uploadedChannelName: $uploadedChannelName,
                    showUploadSuccessScreen: $showUploadSuccessScreen,
                    onUploadComplete: handleUploadCompleteNotification
                ))
                .animation(.spring(response: 0.3), value: showingNotification)
            return base
            .onAppear {
                // CRITICAL: Camera preview setup must be non-blocking
                // Use Task to ensure it doesn't block the UI thread
                Task { @MainActor in
                    if !streamManager.isStreaming {
                        // Setup camera preview asynchronously (non-blocking)
                        streamManager.setupCameraPreview()
                    }
                    connectionManager.selectedKeyId = nil
                }
            }
            .onDisappear {
                // CRITICAL: Clean up resources when view disappears to prevent crashes
                // Stop stream time limit monitoring
                stopStreamTimeLimitMonitoring()
                
                // Cancel countdown task if still running
                countdownTask?.cancel()
                countdownTask = nil
                
                // Stop camera preview if not streaming (cleanup camera resources)
                if !streamManager.isStreaming {
                    streamManager.stopCameraPreview()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
                connectionManager.selectedKeyId = nil
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willTerminateNotification)) { _ in
                connectionManager.selectedKeyId = nil
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RecordingStarted"))) { _ in
                print("🔍 ContentView: Received RecordingStarted notification")
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("RecordingFinished"))) { _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    if streamManager.recordedVideoURL != nil {
                        showingRecordingPreview = true
                    }
                }
            }
            .onChange(of: connectionManager.selectedKeyId) { _ in
                if !streamManager.isStreaming, let selected = connectionManager.selectedStreamKey {
                    streamManager.setStreamKey(selected.url, channelName: selected.name)
                }
            }
            // Orientation change listener disabled - app is locked to portrait mode
            // .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
            //     streamManager.updateStreamOrientation()
            // }
            .onChange(of: streamManager.currentCameraPosition) { _ in
                // Force preview update when camera flips to prevent black screen
                withAnimation(.easeInOut(duration: 0.2)) {
                    previewRefreshKey = UUID()
                }
                // Also trigger force refresh notification
                NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                print("🔄 [ContentView] Camera position changed - forcing preview refresh")
            }
            .onChange(of: streamManager.currentStreamKey) { newKey in
                if let key = newKey {
                    print("🔍 [ContentView] Stream key changed: \(key)")
                    print("   ✅ Stream key is now available in UI")
                } else {
                    print("⚠️ [ContentView] Stream key cleared (set to nil)")
                }
            }
            .onChange(of: streamManager.isStreaming) { isStreaming in
                print("🔍 [ContentView] isStreaming changed: \(isStreaming)")
                if isStreaming {
                    print("   📝 currentStreamKey: \(streamManager.currentStreamKey ?? "nil")")
                    // Note: shouldAutoStop is a @Published property, access it directly if needed
                    // print("   📝 shouldAutoStop: \(streamManager.shouldAutoStop)")
                    if streamManager.currentStreamKey == nil {
                        print("   ⚠️ WARNING: Stream started but currentStreamKey is nil!")
                    }
                } else {
                    // Stream stopped - video will appear in channel automatically
                    print("🎬 [ContentView] Stream stopped - video will appear in channel when ready")
                    
                    // Clear stream state
                    streamManager.currentStreamKey = nil
                    streamChannelId = nil
                    streamChannelName = nil
                }
            }
            .alert("Stream Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                if case .error(let message) = streamManager.status {
                    Text(message)
                } else {
                    Text("An error occurred")
                }
            }
            .alert("Channel Required", isPresented: $showingChannelSelectionAlert) {
                Button("OK", role: .cancel) { 
                    print("🔔 [ContentView] Alert dismissed")
                }
            } message: {
                Text("Please select a channel before starting to capture.")
            }
            .onChange(of: showingChannelSelectionAlert) { newValue in
                print("🔔 [ContentView] showingChannelSelectionAlert changed to: \(newValue)")
            }
            .onChange(of: streamManager.status) { newStatus in
                if case .error = newStatus {
                    showingError = true
                }
            }
        }
        
        @ViewBuilder
        private var postRecordingActionsContent: some View {
            if let videoURL = streamManager.recordedVideoURL {
                PostRecordingActionsView(
                    onPost: {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showingPostRecordingActions = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            if streamManager.recordedVideoURL != nil {
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    showingChannelSelection = true
                                }
                            }
                        }
                    },
                    onView: {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showingPostRecordingActions = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            if streamManager.recordedVideoURL != nil {
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    showingRecordingPreview = true
                                }
                            }
                        }
                    },
                    onRecapture: {
                        showingPostRecordingActions = false
                        streamManager.recordedVideoURL = nil
                        Task { @MainActor in
                            streamManager.deleteRecordedFile()
                            NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                        }
                    }
                )
                .transition(.opacity)
            }
        }
        
        @ViewBuilder
        private var uploadSuccessContent: some View {
            if let channelName = uploadedChannelName {
                UploadSuccessView(
                    channelName: channelName,
                    onViewChannel: {
                        handleUploadSuccessViewChannel(channelName: channelName)
                    },
                    onDone: {
                        showUploadSuccessScreen = false
                        uploadedChannelName = nil
                    }
                )
            }
        }
        
        private func handleUploadSuccessViewChannel(channelName: String) {
            isNavigatingToChannel = true
            Task {
                do {
                    let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                    let targetChannel: DiscoverableChannel
                    if let channel = channels.first(where: { 
                        $0.channelName.lowercased() == channelName.lowercased() || 
                        $0.channelName == channelName 
                    }) {
                        targetChannel = channel
                    } else {
                        let defaultEmail = authService.userEmail ?? ""
                        let similarChannel = channels.first { 
                            $0.channelName.lowercased().contains(channelName.lowercased()) || 
                            channelName.lowercased().contains($0.channelName.lowercased()) 
                        }
                        targetChannel = DiscoverableChannel(
                            channelId: channelName,
                            channelName: channelName,
                            creatorEmail: similarChannel?.creatorEmail ?? defaultEmail,
                            creatorUsername: similarChannel?.creatorUsername ?? "",
                            description: similarChannel?.description ?? "",
                            posterUrl: similarChannel?.posterUrl ?? "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                    }
                    await MainActor.run {
                        channelToViewAfterStream = targetChannel
                        showingChannelAfterStream = true
                        showUploadSuccessScreen = false
                        isNavigatingToChannel = false
                    }
                } catch {
                    let minimalChannel = DiscoverableChannel(
                        channelId: channelName,
                        channelName: channelName,
                        creatorEmail: authService.userEmail ?? "",
                        creatorUsername: "",
                        description: "",
                        posterUrl: "",
                        visibility: "public",
                        isPublic: true,
                        subscriptionPrice: nil,
                        contentType: nil
                    )
                    await MainActor.run {
                        channelToViewAfterStream = minimalChannel
                        showingChannelAfterStream = true
                        showUploadSuccessScreen = false
                        isNavigatingToChannel = false
                    }
                }
            }
        }
        
        private func handleUploadCompleteNotification(_ notification: Notification) {
            if let channelName = notification.userInfo?["channelName"] as? String {
                print("🔔 ContentView: Received UploadComplete notification for channel: \(channelName)")
                
                var localVideoInfo: (url: URL, title: String?, description: String?, price: Double?)? = nil
                if let localPath = notification.userInfo?["localVideoURL"] as? String,
                   let localURL = URL(string: "file://\(localPath)") {
                    let title = notification.userInfo?["videoTitle"] as? String
                    let description = notification.userInfo?["videoDescription"] as? String
                    let price = notification.userInfo?["videoPrice"] as? String
                    let priceDouble = price != nil ? Double(price!) : nil
                    localVideoInfo = (localURL, title, description, priceDouble)
                }
                
                if let localInfo = localVideoInfo {
                    globalLocalVideoInfo = (channelName: channelName, url: localInfo.url, title: localInfo.title, description: localInfo.description, price: localInfo.price)
                }
                
                showingRecordingPreview = false
                showingChannelSelection = false
                
                // Discover page removed for all accounts - navigate directly to channel instead
                // Navigate directly to channel detail view
                Task {
                    do {
                        let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                        if let channel = channels.first(where: { 
                            $0.channelName.lowercased() == channelName.lowercased() || 
                            $0.channelName == channelName 
                        }) {
                            await MainActor.run {
                                channelToViewAfterStream = channel
                                showingChannelAfterStream = true
                            }
                            print("✅ [ContentView] Navigated directly to channel: \(channelName)")
                        } else {
                            // Create minimal channel if not found
                            let minimalChannel = DiscoverableChannel(
                                channelId: channelName,
                                channelName: channelName,
                                creatorEmail: authService.userEmail ?? "",
                                creatorUsername: "",
                                description: "",
                                posterUrl: "",
                                visibility: "public",
                                isPublic: true,
                                subscriptionPrice: nil,
                                contentType: nil
                            )
                            await MainActor.run {
                                channelToViewAfterStream = minimalChannel
                                showingChannelAfterStream = true
                            }
                            print("✅ [ContentView] Navigated directly to channel (minimal): \(channelName)")
                        }
                    } catch {
                        print("❌ [ContentView] Error navigating to channel: \(error.localizedDescription)")
                    }
                }
            }
        }
        
        @ViewBuilder
        private var cameraPreviewView: some View {
            // Don't show camera if navigating to channel or showing channel view (prevents flash of camera view)
            if !isNavigatingToChannel && !showingChannelAfterStream {
                // Full screen camera preview (Snapchat-style)
                // Show recording preview layer when recording AND session is ready, otherwise show RTMP stream preview
                // This prevents flash by keeping RTMP preview visible until recording preview is ready
                ZStack {
                    // Background color to prevent black screen while camera initializes
                    Color.black
                        .ignoresSafeArea()
                    
                    Group {
                        if streamManager.isRecording && streamManager.isRecordingSessionReady {
                            // Direct preview layer view for recording (like Snapchat)
                            // Only show when session is actually running to prevent black flash
                            if let previewLayer = streamManager.getRecordingPreviewLayer() {
                                RecordingPreviewLayerView(previewLayer: previewLayer, streamManager: streamManager)
                                    .ignoresSafeArea()
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .transition(.opacity) // Smooth transition
                                    .animation(.easeInOut(duration: 0.2), value: streamManager.isRecording)
                            } else {
                                // Fallback to RTMP preview if preview layer not ready
                                CameraPreviewView(streamManager: streamManager)
                                    .ignoresSafeArea()
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .transition(.opacity)
                            }
                        } else {
                            // Normal RTMP stream preview (also shown while recording session is starting)
                            // Use key to force refresh when recapture happens or landscape mode changes
                            CameraPreviewView(streamManager: streamManager)
                                .id(previewRefreshKey)
                                .ignoresSafeArea()
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .transition(.opacity)
                        }
                    }
                    
                    // 3-second countdown overlay - fades out smoothly as stream starts
                    if isShowingCountdown {
                        ZStack {
                            Color.black.opacity(streamManager.isStreaming ? 0.0 : 0.7)
                                .ignoresSafeArea()
                                .animation(.easeOut(duration: 0.4), value: streamManager.isStreaming)
                                .onTapGesture {
                                    // Allow tapping to cancel countdown
                                    if !streamManager.isStreaming {
                                        cancelCountdown()
                                    }
                                }
                            
                            VStack(spacing: 20) {
                                // Cancel button in top corner
                                if !streamManager.isStreaming {
                                    HStack {
                                        Spacer()
                                        Button(action: {
                                            cancelCountdown()
                                        }) {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 32))
                                                .foregroundColor(.white.opacity(0.8))
                                        }
                                        .padding(.top, 20)
                                        .padding(.trailing, 20)
                                    }
                                }
                                
                                if streamManager.isLandscapeMode {
                                    Spacer()
                                        .frame(height: 0) // Removed spacer to move countdown up above text
                                } else {
                                    Spacer()
                                }
                                
                                Text("\(countdownValue)")
                                    .offset(y: streamManager.isLandscapeMode ? -40 : 0) // Move up in landscape to be above text
                                    .font(.system(size: 120, weight: .bold))
                                    .foregroundStyle(
                                        LinearGradient(
                                            colors: streamMode == .premium ? [.yellow.opacity(0.9), .yellow] : streamModeIsPrivate ? [.orange.opacity(0.9), .orange] : [.twillyTeal, .twillyCyan],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .shadow(color: streamMode == .premium ? .yellow.opacity(0.5) : streamModeIsPrivate ? .orange.opacity(0.5) : .twillyCyan.opacity(0.5), radius: 20)
                                    .scaleEffect(streamManager.isStreaming ? 0.3 : 1.0)
                                    .opacity(streamManager.isStreaming ? 0.0 : 1.0)
                                    .animation(.easeOut(duration: 0.3), value: streamManager.isStreaming)
                                
                                if streamManager.isStreaming {
                                    Text("Streaming!")
                                        .font(.system(size: 28, weight: .bold))
                                        .foregroundStyle(
                                            LinearGradient(
                                                colors: [.twillyTeal, .twillyCyan],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                        .shadow(color: .twillyCyan.opacity(0.6), radius: 10)
                                        .transition(.scale.combined(with: .opacity))
                                } else {
                                    VStack(spacing: 8) {
                                        Text("Starting stream...")
                                            .font(.system(size: 24, weight: .semibold))
                                            .foregroundColor(streamMode == .premium ? .yellow.opacity(0.9) : streamModeIsPrivate ? .orange.opacity(0.9) : .twillyCyan.opacity(0.9))
                                            .transition(.opacity)
                                        
                                        Text("Tap to cancel")
                                            .font(.system(size: 16, weight: .medium))
                                            .foregroundColor(.white.opacity(0.6))
                                    }
                                    .transition(.opacity)
                                    .contentShape(Rectangle()) // Make tappable area larger
                                    .padding(.top, streamManager.isLandscapeMode ? -80 : 0) // Move up more in landscape to be under button
                                    .onTapGesture {
                                        // Only cancel countdown if not streaming
                                        if !streamManager.isStreaming {
                                            cancelCountdown()
                                        }
                                    }
                                }
                                
                                Spacer()
                            }
                        }
                        .transition(.opacity)
                        .zIndex(1000)
                        .animation(.easeInOut(duration: 0.3), value: streamManager.isStreaming)
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: streamManager.isRecording)
            } else {
                // Show black background when navigating (prevents frozen frames)
                Color.black
                    .ignoresSafeArea()
            }
        }
        
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
        
        private func handlePostStream() async {
            // Live streams are NOT saved/recorded - just live viewing only
            // Stream stops and that's it - no metadata form, no post-processing
            print("✅ Stream stopped - live-only mode (no saving/recording/clipping)")
            // Do nothing - stream is already stopped, just keep it simple
        }
        
        private func extractStreamKey(from url: String) -> String? {
            if let lastSlashIndex = url.lastIndex(of: "/") {
                let streamKey = String(url[url.index(after: lastSlashIndex)...])
                return streamKey.isEmpty ? nil : streamKey
            }
            return nil
        }
        
        private func fetchChannelShareUrlAndMarkVisible(channelName: String, streamKey: String?) async {
            guard let email = authService.userEmail else {
                print("⚠️ [ContentView] No user email available for share URL")
                return
            }
            
            // Show notification that stream is being processed
            await MainActor.run {
                showNotification("Stream posted successfully!")
            }
            
            // Mark content as visible (if stream key available)
            if let streamKey = streamKey {
                do {
                    _ = try await ChannelService.shared.markContentVisible(
                        streamKey: streamKey,
                        userEmail: email
                    )
                } catch {
                    print("Failed to mark content as visible: \(error)")
                    // Continue anyway - content might still be processing
                }
            }
            
            // Get share URL
            do {
                let shareUrl = try await ChannelService.shared.getShareUrl(
                    userEmail: email,
                    channelName: channelName,
                    username: nil as String?
                )
                
                await MainActor.run {
                    channelShareUrl = shareUrl
                    postStreamChannelName = channelName
                    showingPostStream = true
                }
            } catch {
                print("Failed to fetch share URL: \(error)")
                await MainActor.run {
                    postStreamChannelName = channelName
                    showingPostStream = true
                }
            }
        }
        
        private func navigateToChannelAfterUpload(channelName: String) {
            print("🔍 [ContentView] Navigating to channel after upload: \(channelName)")
            // Hide banner
            withAnimation {
                // Banner removed - auto-navigation handles this now
            }
            
            // Navigate directly to channel (same as UploadSuccessView does)
            Task {
                // Wait 3 seconds for video to be processed and written to DynamoDB
                // Lambda processing can take 5-10 seconds, so wait a bit before navigating
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                
                do {
                    // Force refresh to get latest channels
                    let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                    print("🔍 [ContentView] Fetched \(channels.count) discoverable channels")
                    
                    // Try exact match first (case-insensitive)
                    if let channel = channels.first(where: { 
                        $0.channelName.lowercased() == channelName.lowercased() || 
                        $0.channelName == channelName 
                    }) {
                        print("✅ [ContentView] Found channel '\(channelName)' - showing detail view")
                        await MainActor.run {
                            channelToViewAfterStream = channel
                            // Small delay to ensure banner is dismissed first
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                showingChannelAfterStream = true
                            }
                        }
                    } else {
                        print("⚠️ [ContentView] Channel '\(channelName)' not found, creating minimal channel")
                        // Create minimal channel (API will fetch actual info when loading content)
                        let minimalChannel = DiscoverableChannel(
                            channelId: channelName,
                            channelName: channelName,
                            creatorEmail: authService.userEmail ?? "",
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        await MainActor.run {
                            channelToViewAfterStream = minimalChannel
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                showingChannelAfterStream = true
                            }
                        }
                    }
                } catch {
                    print("❌ [ContentView] Error fetching channels: \(error.localizedDescription)")
                    // On error, create minimal channel anyway
                    let minimalChannel = DiscoverableChannel(
                        channelId: channelName,
                        channelName: channelName,
                        creatorEmail: authService.userEmail ?? "",
                        creatorUsername: "",
                        description: "",
                        posterUrl: "",
                        visibility: "public",
                        isPublic: true,
                        subscriptionPrice: nil,
                        contentType: nil
                    )
                    await MainActor.run {
                        channelToViewAfterStream = minimalChannel
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            showingChannelAfterStream = true
                        }
                    }
                }
            }
        }
        
        private func navigateToDiscoverWithChannel(channelName: String) {
            print("🔍 [ContentView] Navigating directly to channel (discover page removed): \(channelName)")
            
            // Discover page removed - navigate directly to channel detail view
            Task {
                do {
                    let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: true)
                    if let channel = channels.first(where: { 
                        $0.channelName.lowercased() == channelName.lowercased() || 
                        $0.channelName == channelName 
                    }) {
                        await MainActor.run {
                            channelToViewAfterStream = channel
                            showingChannelAfterStream = true
                        }
                        print("✅ [ContentView] Navigated directly to channel: \(channelName)")
                    } else {
                        // Create minimal channel if not found
                        let minimalChannel = DiscoverableChannel(
                            channelId: channelName,
                            channelName: channelName,
                            creatorEmail: authService.userEmail ?? "",
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        await MainActor.run {
                            channelToViewAfterStream = minimalChannel
                            showingChannelAfterStream = true
                        }
                        print("✅ [ContentView] Navigated directly to channel (minimal): \(channelName)")
                    }
                } catch {
                    print("❌ [ContentView] Error navigating to channel: \(error.localizedDescription)")
                }
            }
        }
        
        private func checkAuthStatus() {
            // Check auth status immediately (no delay to prevent black screen)
            Task { @MainActor in
                // Check immediately without delay
                isCheckingAuth = false
                
                if !authService.isAuthenticated {
                    showingWelcome = true
                } else if authService.username == nil {
                    showingUsernameSetup = true
                }
            }
        }
        
        // OLD: Start capture to selected channel (replaced by startStreamToTwillyTV for admin)
        private func startStreamToChannel() async {
            print("🎬 [ContentView] startStreamToChannel() called")
            
            // Ensure we have a selected channel
            guard let channel = selectedChannel else {
                print("⚠️ [ContentView] No channel selected")
                // Use Task to ensure this runs on main thread and view updates
                await MainActor.run {
                    print("🔔 [ContentView] Setting showingChannelSelectionAlert = true")
                    self.showingChannelSelectionAlert = true
                    print("🔔 [ContentView] showingChannelSelectionAlert is now: \(self.showingChannelSelectionAlert)")
                    // Also show notification banner
                    self.showNotification("Channel must be selected")
                }
                // Give SwiftUI a moment to process the state change
                try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
                return
            }
            
            print("✅ [ContentView] Selected channel: \(channel.channelName) (id: \(channel.channelId))")
            
            // Get user info
            guard let userEmail = authService.userEmail,
                  let userId = authService.userId else {
                print("⚠️ [ContentView] User not authenticated")
                await MainActor.run {
                    self.showNotification("Please sign in to stream")
                }
                return
            }
            
            print("✅ [ContentView] User authenticated: \(userEmail), userId: \(userId)")
            
            do {
                // Get or create collaborator stream key for this channel
                print("🔍 [ContentView] Requesting collaborator stream key...")
                let streamKey = try await ChannelService.shared.getOrCreateCollaboratorStreamKey(
                    channelId: channel.channelId,
                    channelName: channel.channelName,
                    userId: userId,
                    userEmail: userEmail
                )
                
                print("✅ [ContentView] Got collaborator stream key: \(streamKey)")
                
                // Store channel info for post-stream flow
                await MainActor.run {
                    streamChannelId = channel.channelId
                    streamChannelName = channel.channelName
                }
                
                // CRITICAL: Set username type for this stream BEFORE stream starts
                // Use the stream mode toggle (streamModeIsPrivate)
                let isPrivate = await MainActor.run { streamModeIsPrivate }
                let baseUsername = authService.username ?? String(userEmail.split(separator: "@")[0])
                let streamUsername = isPrivate ? "\(baseUsername)🔒" : baseUsername
                
                do {
                    let isPremium = streamMode.isPremium
                    try await ChannelService.shared.setStreamUsernameType(streamKey: streamKey, isPrivateUsername: isPrivate, streamUsername: streamUsername, isPremium: isPremium)
                    print("✅ [ContentView] Stream privacy set for channel stream: isPrivate=\(isPrivate), isPremium=\(isPremium)")
                } catch {
                    print("⚠️ [ContentView] Failed to set stream username type: \(error.localizedDescription)")
                }
                
                // Start streaming immediately - no countdown
                // NOTE: isStreaming already set synchronously in button action for instant response
                await MainActor.run {
                    streamManager.setStreamKey(streamKey, channelName: channel.channelName)
                    streamManager.startStreaming()
                    // Start monitoring for 15-minute limit
                    startStreamTimeLimitMonitoring()
                    // Flash notification that streaming has started
                    showNotification("Streaming!")
                }
            } catch {
                print("❌ [ContentView] Error getting collaborator stream key: \(error)")
                print("   Error details: \(error.localizedDescription)")
                if let urlError = error as? URLError {
                    print("   URLError code: \(urlError.code.rawValue)")
                }
                await MainActor.run {
                    // Revert optimistic update if streaming failed
                    streamManager.isStreaming = false
                    showingNotification = true
                    notificationMessage = "Failed to get stream key: \(error.localizedDescription)"
                }
            }
        }
        
        private func startCaptureToDefaultChannel() async {
            guard let userEmail = authService.userEmail else {
                print("❌ [ContentView] No user email available for capture")
                return
            }
            
            let defaultChannelName = "default"
            
            do {
                print("🎬 [ContentView] Starting capture to default channel: \(defaultChannelName)")
                print("   📧 User email: \(userEmail)")
                
                // Get or generate stream key for "default" channel
                let streamKey = try await ChannelService.shared.getOrGenerateStreamKey(
                    userEmail: userEmail,
                    channelName: defaultChannelName
                )
                
                print("✅ [ContentView] Stream key received: \(streamKey)")
                print("   📝 Channel: \(defaultChannelName)")
                print("   📝 Stream key: \(streamKey)")
                
                // Start stream without auto-stop (for now - can add time limit later if needed)
                await MainActor.run {
                    streamManager.setStreamKey(streamKey, channelName: defaultChannelName)
                    streamManager.startStreaming()
                    // Note: shouldAutoStop defaults to false, so no need to set it explicitly
                }
            } catch {
                print("❌ [ContentView] Error starting capture: \(error)")
                await MainActor.run {
                    showingError = true
                }
            }
        }
        
        private func checkUserRole() async {
            guard authService.isAuthenticated,
                  let userEmail = authService.userEmail else {
                print("⚠️ [ContentView] checkUserRole: Not authenticated or no email")
                isProducerOrCollaborator = false
                isCheckingRole = false
                return
            }
            
            print("🔍 [ContentView] checkUserRole: Checking roles for email: \(userEmail)")
            
            await MainActor.run {
                isCheckingRole = true
            }
            
            let userId = authService.userId ?? ""
            let username = authService.username ?? ""
            
            // Get the actual email from username (username can change, email shouldn't)
            // This ensures we check admin status using the correct email
            var actualEmail = userEmail
            if !username.isEmpty {
                do {
                    if let emailFromUsername = try await ChannelService.shared.getEmailFromUsername(username: username) {
                        actualEmail = emailFromUsername
                        await MainActor.run {
                            self.actualUserEmail = emailFromUsername
                        }
                        print("✅ [ContentView] Got email from username: \(emailFromUsername) (username: \(username))")
                    } else {
                        print("⚠️ [ContentView] Could not get email from username, using userEmail: \(userEmail)")
                        await MainActor.run {
                            self.actualUserEmail = userEmail
                        }
                    }
                } catch {
                    print("⚠️ [ContentView] Error getting email from username: \(error.localizedDescription), using userEmail: \(userEmail)")
                    await MainActor.run {
                        self.actualUserEmail = userEmail
                    }
                }
            } else {
                await MainActor.run {
                    self.actualUserEmail = userEmail
                }
            }
            
            // Check admin status using the actual email (from username lookup or userEmail)
            let isAdminCheck = userRoleService.isAdmin(userEmail: actualEmail)
            print("🔍 [ContentView] Admin check result: \(isAdminCheck) for email: \(actualEmail)")
            
            // Fetch user roles using new UserRoleService (use actualEmail)
            let roles = await userRoleService.getUserRoles(userId: userId, userEmail: actualEmail)
            print("🔍 [ContentView] getUserRoles returned: isAdmin=\(roles.isAdmin), isCollaborator=\(roles.isCollaborator)")
            
            // Fetch channels based on role (use actualEmail)
            var channels: [Channel] = []
            if roles.isAdmin {
                // Admin: fetch all their own channels (they own all channels)
                do {
                    channels = try await ChannelService.shared.fetchChannels(userEmail: actualEmail, forceRefresh: false)
                    print("✅ [ContentView] Admin - fetched \(channels.count) owned channels")
                } catch {
                    print("⚠️ [ContentView] Error fetching admin channels: \(error.localizedDescription)")
                }
            } else if roles.isCollaborator {
                // Collaborator: fetch only channels they're a collaborator of
                do {
                    channels = try await ChannelService.shared.fetchCollaboratorChannels(
                        userId: userId,
                        userEmail: actualEmail,
                        username: username
                    )
                    print("✅ [ContentView] Collaborator - fetched \(channels.count) collaborator channels")
                } catch {
                    print("⚠️ [ContentView] Error fetching collaborator channels: \(error.localizedDescription)")
                }
            }
            
            await MainActor.run {
                self.userRoles = roles
                self.collaboratorChannels = channels
                // Admin or collaborator can stream
                self.isProducerOrCollaborator = roles.isAdmin || roles.isCollaborator
                self.isCheckingRole = false
                print("🔍 [ContentView] User role check:")
                print("   - isAdmin: \(roles.isAdmin)")
                print("   - isCollaborator: \(roles.isCollaborator)")
                print("   - channels: \(channels.count)")
                print("   - canStream: \(self.isProducerOrCollaborator)")
            }
        }
        
        // Load current user's schedule status (for stream button visibility)
        private func loadUserScheduleStatus() async {
            guard let userEmail = authService.userEmail else {
                return
            }
            
            do {
                let response = try await ChannelService.shared.getAirSchedule(userEmail: userEmail)
                if let schedule = response.schedule {
                    await MainActor.run {
                        userScheduleLocked = schedule.isLocked ?? false
                        userSchedulePaused = schedule.isPaused ?? false
                        print("✅ [ContentView] User schedule status - locked: \(userScheduleLocked), paused: \(userSchedulePaused)")
                    }
                }
            } catch {
                print("⚠️ [ContentView] Could not load user schedule status: \(error.localizedDescription)")
            }
        }
        
        // Load current user's post automatically status (for stream button visibility)
        private func loadUserPostAutomatically() async {
            guard let userEmail = authService.userEmail else {
                return
            }
            
            do {
                let postAuto = try await ChannelService.shared.getPostAutomatically(userEmail: userEmail)
                await MainActor.run {
                    userPostAutomatically = postAuto
                    print("✅ [ContentView] User post automatically: \(userPostAutomatically)")
                }
            } catch {
                print("⚠️ [ContentView] Could not load post automatically status: \(error.localizedDescription)")
            }
        }
        
        @MainActor
        private func showNotification(_ message: String) {
            print("🔔 [ContentView] Showing notification: \(message)")
            self.notificationMessage = message
            self.showingNotification = true
            print("🔔 [ContentView] Notification state - showingNotification: \(self.showingNotification), message: \(self.notificationMessage)")
            
            // Auto-hide after 3 seconds
            Task { @MainActor in
                print("🔔 [ContentView] Starting 3-second timer for notification")
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                print("🔔 [ContentView] 3 seconds elapsed, hiding notification")
                self.showingNotification = false
                print("🔔 [ContentView] Notification auto-hidden")
            }
        }
        
        private func fetchChannelShareUrl(channelName: String) async {
            guard let email = self.authService.userEmail else {
                print("⚠️ [ContentView] No user email available for share URL")
                return
            }
            do {
                let shareUrl = try await ChannelService.shared.getShareUrl(
                    userEmail: email,
                    channelName: channelName,
                    username: nil as String?
                )
                await MainActor.run {
                    self.channelShareUrl = shareUrl
                    self.showingPostStream = true
                }
            } catch {
                print("Failed to fetch share URL: \(error)")
                await MainActor.run {
                    self.showingPostStream = true
                }
            }
        }
    }

    // MARK: - Notification Banner

    struct NotificationBanner: View {
        let message: String
        
        // Determine if this is an error/warning message
        private var isError: Bool {
            message.lowercased().contains("must") || 
            message.lowercased().contains("error") || 
            message.lowercased().contains("failed") ||
            message.lowercased().contains("please sign in")
        }
        
        var body: some View {
            HStack(spacing: 12) {
                Image(systemName: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                    .foregroundColor(isError ? .orange : .green)
                Text(message)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                Color.black.opacity(0.9)
                    .background(.ultraThinMaterial)
            )
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.5), radius: 10, x: 0, y: 4)
        }
    }

    // MARK: - Camera Preview View

    struct CameraPreviewView: UIViewRepresentable {
        let streamManager: StreamManager
        func makeUIView(context: Context) -> MTHKView {
            // Initialize with full screen size to ensure proper filling (especially for landscape)
            let screenSize = UIScreen.main.bounds.size
            let hkView = MTHKView(frame: CGRect(x: 0, y: 0, width: screenSize.width, height: screenSize.height))
            hkView.backgroundColor = UIColor.black
            hkView.videoGravity = .resizeAspectFill
            hkView.clipsToBounds = true
            
            // Use preview orientation (accounts for camera position)
            hkView.videoOrientation = streamManager.getPreviewOrientation()
            
            // Mirror front-facing camera in portrait mode (like a mirror - move right, see right)
            // Back-facing camera: no mirroring (natural view)
            // Landscape: no mirroring for either camera
            let isFrontCamera = streamManager.currentCameraPosition == .front
            hkView.isMirrored = isFrontCamera && !streamManager.isLandscapeMode
            
            // Store reference in coordinator
            context.coordinator.view = hkView
            context.coordinator.streamManager = streamManager
            
            // Add pinch gesture recognizer for two-finger zoom (only active when streaming)
            let pinchGesture = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
            pinchGesture.delegate = context.coordinator
            hkView.addGestureRecognizer(pinchGesture)
            
            // Add pan gesture recognizer for one-finger zoom (only active when streaming)
            let panGesture = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
            panGesture.delegate = context.coordinator
            panGesture.maximumNumberOfTouches = 1 // Only one finger
            panGesture.minimumNumberOfTouches = 1
            hkView.addGestureRecognizer(panGesture)
            
            // Listen for camera ready notification
            NotificationCenter.default.addObserver(
                context.coordinator,
                selector: #selector(Coordinator.cameraReady),
                name: NSNotification.Name("CameraReady"),
                object: nil
            )
            
            // Listen for force refresh notifications
            NotificationCenter.default.addObserver(
                context.coordinator,
                selector: #selector(Coordinator.forceRefreshPreview),
                name: NSNotification.Name("ForceRefreshPreview"),
                object: nil
            )
            
            // SNAPCHAT-STYLE: Listen for seamless camera flip notifications
            NotificationCenter.default.addObserver(
                context.coordinator,
                selector: #selector(Coordinator.cameraFlipStarting(notification:)),
                name: NSNotification.Name("CameraFlipStarting"),
                object: nil
            )
            
            NotificationCenter.default.addObserver(
                context.coordinator,
                selector: #selector(Coordinator.cameraFlipComplete),
                name: NSNotification.Name("CameraFlipComplete"),
                object: nil
            )
            
            NotificationCenter.default.addObserver(
                context.coordinator,
                selector: #selector(Coordinator.cameraFlipFailed),
                name: NSNotification.Name("CameraFlipFailed"),
                object: nil
            )
            
            // Wait for proper layout and camera to be ready before attaching stream
            DispatchQueue.main.async {
                // Check if camera is already attached, if not wait for notification
                if streamManager.getCurrentCamera() != nil {
                    context.coordinator.attachStreamIfReady(streamManager: streamManager)
                } else {
                    // Wait for camera to be ready
                    var observer: NSObjectProtocol?
                    observer = NotificationCenter.default.addObserver(
                        forName: NSNotification.Name("CameraReady"),
                        object: nil,
                        queue: .main
                    ) { _ in
                        context.coordinator.attachStreamIfReady(streamManager: streamManager)
                        if let observer = observer {
                            NotificationCenter.default.removeObserver(observer)
                        }
                    }
                }
            }
            
            return hkView
        }
        
        func updateUIView(_ uiView: MTHKView, context: Context) {
            // CRITICAL: All UI updates must be on main thread
            // SwiftUI may call this from background threads when @Published properties change
            guard Thread.isMainThread else {
                DispatchQueue.main.async {
                    self.updateUIView(uiView, context: context)
                }
                return
            }
            
            // Only update if necessary to reduce performance overhead
            // Avoid unnecessary updates that cause freezing
            
            // Ensure coordinator has view reference
            if context.coordinator.view == nil {
                context.coordinator.view = uiView
            }
            
            // CRITICAL: Ensure view fills entire screen (especially important for landscape mode)
            // Update frame to match screen size to prevent black space
            let screenSize = UIScreen.main.bounds.size
            let currentSize = uiView.frame.size
            if abs(currentSize.width - screenSize.width) > 1 || abs(currentSize.height - screenSize.height) > 1 {
                uiView.frame = CGRect(origin: .zero, size: screenSize)
                uiView.setNeedsLayout()
                uiView.layoutIfNeeded()
            }
            
            // Ensure clipsToBounds is set for proper filling
            if !uiView.clipsToBounds {
                uiView.clipsToBounds = true
            }
            
            // Only update properties if they've changed to reduce overhead
            let currentOrientation = streamManager.getPreviewOrientation()
            if uiView.videoOrientation != currentOrientation {
                uiView.videoOrientation = currentOrientation
            }
            
            // Update video gravity (usually constant, but check anyway)
            if uiView.videoGravity != .resizeAspectFill {
                uiView.videoGravity = .resizeAspectFill
            }
            
            // Mirror front-facing camera in portrait mode (like a mirror - move right, see right)
            // Back-facing camera: no mirroring (natural view)
            // Landscape: no mirroring for either camera
            let isFrontCamera = streamManager.currentCameraPosition == .front
            let shouldMirror = isFrontCamera && !streamManager.isLandscapeMode
            if uiView.isMirrored != shouldMirror {
                uiView.isMirrored = shouldMirror
            }
            
            // If recording, switch to recording session preview, otherwise use RTMP stream
            if streamManager.isRecording {
                // Only switch if we weren't recording before (avoid repeated switches)
                if !context.coordinator.wasRecording {
                    context.coordinator.wasRecording = true // Mark that we're recording
                    context.coordinator.switchToRecordingPreview(streamManager: streamManager, view: uiView)
                }
                // Update preview layer frame if it exists (only if bounds changed)
                if let previewLayer = streamManager.getRecordingPreviewLayer(), 
                   previewLayer.frame != uiView.bounds {
                    previewLayer.frame = uiView.bounds
                }
            } else {
                // Normal preview - attach RTMP stream
                // CRITICAL: Only clear and refresh if we just came back from recording
                let wasRecording = context.coordinator.wasRecording
                context.coordinator.wasRecording = false // Reset flag
                
                if wasRecording {
                    // CRITICAL: Remove any recording preview layers first to prevent frozen frame
                    uiView.layer.sublayers?.forEach { layer in
                        if layer is AVCaptureVideoPreviewLayer {
                            print("🔍 CameraPreviewView: Removing recording preview layer")
                            layer.removeFromSuperlayer()
                        }
                    }
                    
                    // CRITICAL: Clear the view completely to remove any frozen frames
                    print("🔍 CameraPreviewView: Just came back from recording - clearing view and forcing fresh attach")
                    uiView.attachStream(nil)
                    uiView.backgroundColor = UIColor.black
                    context.coordinator.hasAttached = false
                    context.coordinator.lastCameraPosition = nil // Reset to force reattach
                    
                    // Reattach immediately (no delay to prevent frozen frames)
                    DispatchQueue.main.async {
                        print("🔍 CameraPreviewView: Reattaching stream immediately")
                        context.coordinator.attachStreamIfReady(streamManager: streamManager)
                    }
                } else {
                    // Normal case - ensure RTMP stream is attached for live preview
                    // Always try to attach (might not have been ready before or after recording)
                    context.coordinator.attachStreamIfReady(streamManager: streamManager)
                }
            }
        }
        
        func makeCoordinator() -> Coordinator {
            Coordinator()
        }
        
        static func dismantleUIView(_ uiView: MTHKView, coordinator: Coordinator) {
            NotificationCenter.default.removeObserver(coordinator)
            coordinator.view?.attachStream(nil)
            coordinator.view = nil
            coordinator.hasAttached = false
        }
        
        class Coordinator: NSObject, UIGestureRecognizerDelegate {
            weak var view: MTHKView?
            weak var streamManager: StreamManager?
            var hasAttached: Bool = false
            var lastCameraPosition: AVCaptureDevice.Position?
            private var initialZoomFactor: CGFloat = 1.0
            private var initialPanY: CGFloat = 0.0 // For one-finger zoom
            private var cameraWaitAttempts = 0
            private let maxCameraWaitAttempts = 15 // Max 3 seconds (15 * 0.2s)
            var wasRecording: Bool = false // Track if we were recording to detect transition
            
            @objc func cameraReady() {
                // Camera is ready - attach stream if not already attached
                guard let streamManager = streamManager else { return }
                DispatchQueue.main.async {
                    // Check if camera position changed - if so, we need to reattach
                    let currentPosition = streamManager.currentCameraPosition
                    if let lastPosition = self.lastCameraPosition, lastPosition != currentPosition {
                        // Camera position changed - need to reattach
                        print("📷 Camera position changed from \(lastPosition == .back ? "back" : "front") to \(currentPosition == .back ? "back" : "front")")
                        if let view = self.view {
                            view.attachStream(nil)
                        }
                        self.hasAttached = false
                        self.lastCameraPosition = currentPosition
                        // Small delay to ensure detach completes
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                            self.attachStreamIfReady(streamManager: streamManager)
                        }
                    } else {
                        // Camera position hasn't changed - just ensure stream is attached
                        self.lastCameraPosition = currentPosition
                        self.attachStreamIfReady(streamManager: streamManager)
                    }
                }
            }
            
            @objc func forceRefreshPreview() {
                // SNAPCHAT-STYLE: Force refresh preview with seamless transition
                guard let streamManager = streamManager else { return }
                DispatchQueue.main.async {
                    // CRITICAL: Update video orientation for landscape mode
                    if let view = self.view {
                        let previewOrientation = streamManager.getPreviewOrientation()
                        view.videoOrientation = previewOrientation
                        view.videoGravity = .resizeAspectFill
                        print("🔍 ForceRefreshPreview - Updated orientation to: \(previewOrientation.rawValue) (landscape: \(streamManager.isLandscapeMode))")
                    }
                    
                    // During streaming, camera is managed by the stream - just ensure preview is connected
                    if streamManager.isStreaming {
                        // Stream manages camera attachment - just ensure preview view is connected to stream
                        if !self.hasAttached {
                            self.attachStreamIfReady(streamManager: streamManager)
                        }
                        return
                    }
                    
                    // Not streaming - handle camera position changes
                    let currentPosition = streamManager.currentCameraPosition
                    if let lastPosition = self.lastCameraPosition, lastPosition == currentPosition {
                        // Position hasn't changed - just ensure stream is attached
                        if !self.hasAttached {
                            self.attachStreamIfReady(streamManager: streamManager)
                        }
                        return
                    }
                    
                    // Camera position changed - update and reattach
                    self.lastCameraPosition = currentPosition
                    // SNAPCHAT-STYLE: Keep old preview visible during transition
                    // Don't detach immediately - let new camera attach first
                    self.hasAttached = false
                    // Reattach immediately (new camera should already be attached to stream)
                    self.attachStreamIfReady(streamManager: streamManager)
                }
            }
            
            @objc func cameraFlipStarting(notification: Notification) {
                // SNAPCHAT-STYLE: Prepare for seamless camera flip
                // Keep current preview visible during transition
                guard let userInfo = notification.userInfo,
                      let newPosition = userInfo["newPosition"] as? AVCaptureDevice.Position else { return }
                print("📷 Camera flip starting - keeping current preview visible until new camera is ready")
                // Don't detach stream yet - keep old preview visible
            }
            
            @objc func cameraFlipComplete() {
                // SNAPCHAT-STYLE: New camera is ready - refresh preview seamlessly
                guard let streamManager = streamManager else { return }
                DispatchQueue.main.async {
                    print("✅ Camera flip complete - refreshing preview")
                    self.lastCameraPosition = streamManager.currentCameraPosition
                    
                    // CRITICAL: Update video orientation for landscape mode
                    // Always use landscapeLeft for landscape (as if turning left) regardless of which way phone is turned
                    if let view = self.view {
                        let previewOrientation = streamManager.getPreviewOrientation()
                        view.videoOrientation = previewOrientation
                        view.videoGravity = .resizeAspectFill
                        print("🔍 Camera flip complete - Updated orientation to: \(previewOrientation.rawValue) (landscape: \(streamManager.isLandscapeMode), device orientation: \(UIDevice.current.orientation.rawValue))")
                    }
                    
                    // During streaming, camera is already attached to stream - just ensure preview is connected
                    if streamManager.isStreaming {
                        // Stream already has the new camera attached, just ensure preview view is connected
                        if !self.hasAttached {
                            self.attachStreamIfReady(streamManager: streamManager)
                        }
                    } else {
                        // Not streaming - need to attach camera to preview
                        self.hasAttached = false
                        self.attachStreamIfReady(streamManager: streamManager)
                    }
                }
            }
            
            @objc func cameraFlipFailed() {
                // Camera flip failed - ensure preview is still working
                guard let streamManager = streamManager else { return }
                DispatchQueue.main.async {
                    print("⚠️ Camera flip failed - ensuring preview is still attached")
                    // Try to reattach current stream
                    self.attachStreamIfReady(streamManager: streamManager)
                }
            }
            
            deinit {
                NotificationCenter.default.removeObserver(self)
            }
            
            // Allow simultaneous gesture recognition
            func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
                return true
            }
            
            @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
                guard let streamManager = streamManager else { return }
                
                // Allow zoom both when streaming and when just previewing (camera preview)
                // This enables 2-finger zoom for camera preview at all times
                
                switch gesture.state {
                case .began:
                    initialZoomFactor = streamManager.currentZoomFactor
                    // Stop any ongoing zoom animation
                    streamManager.stopZoomAnimation()
                    // Haptic feedback for better UX
                    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                    impactFeedback.impactOccurred()
                    
                case .changed:
                    // SNAPCHAT-LIKE: Smooth, responsive zoom calculation
                    // Use logarithmic scale for more natural zoom feel
                    let scale = gesture.scale
                    
                    // Apply logarithmic scaling for smoother zoom (feels more natural)
                    // This makes zoom feel more responsive at lower levels and smoother at higher levels
                    let logScale = log10(max(0.1, scale)) + 1.0
                    let adjustedScale = pow(10, logScale - 1.0)
                    
                    // Calculate new zoom factor
                    let newZoomFactor = initialZoomFactor * adjustedScale
                    
                    // Apply zoom immediately (no animation during gesture for responsiveness)
                    streamManager.setZoomFactor(newZoomFactor, animated: false)
                    
                case .ended:
                    // SNAPCHAT-LIKE: Add momentum/inertia when gesture ends
                    let velocity = gesture.velocity
                    
                    // Calculate final zoom with momentum
                    let scale = gesture.scale
                    let logScale = log10(max(0.1, scale)) + 1.0
                    let adjustedScale = pow(10, logScale - 1.0)
                    let finalZoomFactor = initialZoomFactor * adjustedScale
                    
                    // Apply with velocity for smooth momentum effect
                    streamManager.setZoomFactorWithVelocity(finalZoomFactor, velocity: velocity)
                    
                    // Haptic feedback on release
                    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                    impactFeedback.impactOccurred()
                    
                case .cancelled:
                    // Snap back to current zoom smoothly
                    streamManager.setZoomFactor(streamManager.currentZoomFactor, animated: true)
                    
                default:
                    break
                }
            }
            
            @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
                guard let streamManager = streamManager,
                      let view = view else { return }
                
                // Only allow zoom when streaming has started
                guard streamManager.isStreaming else { return }
                
                // Only handle single finger pan
                guard gesture.numberOfTouches == 1 else { return }
                
                let location = gesture.location(in: view)
                let translation = gesture.translation(in: view)
                
                switch gesture.state {
                case .began:
                    initialZoomFactor = streamManager.currentZoomFactor
                    initialPanY = location.y
                    // Stop any ongoing zoom animation
                    streamManager.stopZoomAnimation()
                    // Haptic feedback for better UX
                    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                    impactFeedback.impactOccurred()
                    
                case .changed:
                    // Calculate zoom based on vertical pan distance
                    // Panning up (negative Y) = zoom in, panning down (positive Y) = zoom out
                    let panDistance = initialPanY - location.y // Negative when panning up (zoom in)
                    
                    // Get view height for relative calculation
                    let viewHeight = view.bounds.height
                    
                    // Calculate zoom factor: 1.0 at start, increase/decrease based on pan distance
                    // Use a sensitivity factor (adjust this to make zoom more/less sensitive)
                    let sensitivity: CGFloat = 0.003 // Adjust this value to change zoom sensitivity
                    let zoomDelta = panDistance * sensitivity
                    
                    // Calculate new zoom factor
                    let newZoomFactor = max(1.0, initialZoomFactor + zoomDelta)
                    
                    // Apply zoom (StreamManager will handle max zoom clamping internally)
                    streamManager.setZoomFactor(newZoomFactor, animated: false)
                    
                case .ended, .cancelled:
                    // Haptic feedback on release
                    let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                    impactFeedback.impactOccurred()
                    
                default:
                    break
                }
            }
            
            
            func attachStreamIfReady(streamManager: StreamManager) {
                guard let view = view else { return }
                
                // Don't attach if currently recording (recording uses its own preview)
                if streamManager.isRecording {
                    return
                }
                
                // CRITICAL: Ensure view frame fills entire screen (especially for landscape mode)
                // Update frame to match screen size to prevent black space
                let screenSize = UIScreen.main.bounds.size
                if view.frame.size != screenSize {
                    view.frame = CGRect(origin: .zero, size: screenSize)
                    view.setNeedsLayout()
                    view.layoutIfNeeded()
                }
                
                // SNAPCHAT-STYLE: Check if camera is actually available before attaching stream
                guard let camera = streamManager.getCurrentCamera(), camera.isConnected else {
                    print("⚠️ Camera not ready yet, waiting for camera to be attached...")
                    // Wait for camera to be ready with exponential backoff
                    cameraWaitAttempts += 1
                    if cameraWaitAttempts < maxCameraWaitAttempts {
                        let delay = min(0.2 * Double(cameraWaitAttempts), 1.0) // Max 1 second delay
                        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                            self.attachStreamIfReady(streamManager: streamManager)
                        }
                    } else {
                        print("⚠️ Max camera wait attempts reached, giving up")
                        cameraWaitAttempts = 0 // Reset for next attempt
                    }
                    return
                }
                
                // Reset wait attempts on success
                cameraWaitAttempts = 0
                
                // Check if camera position changed - if so, detach and reattach to refresh preview
                if let lastPosition = lastCameraPosition, lastPosition != streamManager.currentCameraPosition {
                    print("🔍 Camera position changed from \(lastPosition == .back ? "back" : "front") to \(streamManager.currentCameraPosition == .back ? "back" : "front")")
                    // Detach old stream first
                    view.attachStream(nil)
                    hasAttached = false
                    lastCameraPosition = streamManager.currentCameraPosition
                } else if lastCameraPosition == nil {
                    lastCameraPosition = streamManager.currentCameraPosition
                }
                
                // If already attached and position hasn't changed, skip
                if hasAttached && lastCameraPosition == streamManager.currentCameraPosition {
                    return
                }
                
                let frame = view.bounds
                // Check for valid, non-zero dimensions
                guard frame.width > 0 && frame.height > 0 && 
                      !frame.width.isNaN && !frame.height.isNaN &&
                      frame.width != .infinity && frame.height != .infinity else {
                    // Try again after a short delay if dimensions aren't ready
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        self.attachStreamIfReady(streamManager: streamManager)
                    }
                    return
                }
                
                // CRITICAL: Ensure video gravity is set to fill (prevents black space)
                view.videoGravity = .resizeAspectFill
                view.clipsToBounds = true
                
                // Attach stream
                view.attachStream(streamManager.rtmpStream)
                hasAttached = true
                print("✅ Camera stream attached to preview view (frame: \(frame.width)x\(frame.height))")
            }
            
            func switchToRecordingPreview(streamManager: StreamManager, view: MTHKView) {
                // During recording, detach RTMP stream and use recording session's preview layer
                view.attachStream(nil)
                hasAttached = false
                
                // Get recording preview layer and add it to the view
                if let previewLayer = streamManager.getRecordingPreviewLayer() {
                    // Remove any existing preview layers and RTMP stream layers
                    view.layer.sublayers?.forEach { layer in
                        layer.removeFromSuperlayer()
                    }
                    
                    // Add recording preview layer with proper frame
                    previewLayer.frame = view.bounds
                    previewLayer.videoGravity = .resizeAspectFill
                    
                    // Ensure preview layer is properly configured
                    // CRITICAL: NEVER change orientation here - the preview layer orientation was already set correctly
                    // when recording started. Changing it here causes the UI to flip!
                    if let connection = previewLayer.connection, connection.isVideoOrientationSupported {
                        let currentOrientation = connection.videoOrientation
                        print("🔍 switchToRecordingPreview - Current preview layer orientation: \(currentOrientation.rawValue)")
                        print("🔍 switchToRecordingPreview - Device orientation: \(UIDevice.current.orientation.rawValue)")
                        print("🔍 switchToRecordingPreview - PRESERVING orientation (DO NOT CHANGE)")
                        // DO NOT change the orientation - it was set correctly when recording started
                    }
                    
                    // Insert at bottom so it's behind any UI elements
                    view.layer.insertSublayer(previewLayer, at: 0)
                    
                    // Update frame immediately and set up for future updates
                    previewLayer.frame = view.bounds
                    
                    // Use CADisplayLink or observe bounds changes to keep frame updated
                    // For now, update frame in updateUIView
                } else {
                    print("⚠️ Recording preview layer not available yet")
                }
            }
        }
    }

    // Helper view to avoid toolbar ambiguity
    struct ChannelDetailViewWithBackButton: View {
        let channel: DiscoverableChannel
        let onBack: () -> Void
        let canStream: Bool
        let collaboratorChannels: [Channel]
        let onInviteCodeAccepted: () -> Void
        
        var body: some View {
            ZStack {
                // Background gradient to prevent black screen during transition
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                ChannelDetailView(
                    channel: channel,
                    forceRefresh: true,
                    canStream: canStream,
                    collaboratorChannels: collaboratorChannels,
                    onInviteCodeAccepted: onInviteCodeAccepted
                )
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .foregroundColor(.white)
                    }
                }
            }
        }
    }
