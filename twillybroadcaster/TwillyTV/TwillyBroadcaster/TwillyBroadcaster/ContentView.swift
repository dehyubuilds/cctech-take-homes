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
    
    // UserDefaults key for persisting visibility preference
    private let visibilityPreferenceKey = "StreamVisibilityPreference"
    @State private var isUpdatingVisibility = false // Updating visibility state
    
    // 15-minute stream limit
    private let streamTimeLimit: TimeInterval = 15 * 60 // 15 minutes in seconds
    
    var body: some View {
        Group {
            if isCheckingAuth {
                // Show loading while checking auth
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
            } else if !authService.isAuthenticated {
                // Show welcome/sign in if not authenticated
                WelcomeView()
            } else if authService.isAuthenticated && authService.isLoadingUsername {
                // Show loading while checking username
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
            } else if authService.isAuthenticated && authService.username == nil {
                // Show username setup if authenticated but no username
                UsernameSetupView()
            } else {
                // Show main app if authenticated with username
                // Check if user is collaborator or admin - if not, show only Discover
                if isCheckingRole {
                    // Still checking role - show loading
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
                } else {
                    // TV Network Model: Show Twilly TV channel directly (no discover page)
                    // IMPORTANT: checkUserRole() is called on onAppear to ensure collaborator status is loaded
                    if showingStreamScreen {
                        // Show stream screen when navigated from channel detail (admin only)
                        streamScreenView
                    } else {
                        twillyTVChannelView
                    }
                }
            }
        }
        .onAppear {
            checkAuthStatus()
            // Load saved visibility preference first (defaults to public)
            loadSavedVisibilityPreference()
            Task {
                await checkUserRole()
                // Load visibility state from server when view appears (but use saved preference as default)
                loadUsernameVisibility()
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
    
    private var cameraPreviewWithModifiers: some View {
        cameraPreviewView
            .simultaneousGesture(
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        // Only process swipe when on stream screen
                        guard showingStreamScreen else { return }
                        
                        // Swipe LEFT (negative width = finger moving left) to go to Discover
                        // User swipes from right edge going left
                        let swipeLeft = value.translation.width < -80 || value.predictedEndTranslation.width < -150
                        
                        print("🔍 [CameraPreview] Swipe detected - width: \(value.translation.width), predicted: \(value.predictedEndTranslation.width), showingStreamScreen: \(showingStreamScreen)")
                        
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
                // Twilly logo at top left - same gradient as Twilly TV
                Text("Twilly")
                    .font(.system(size: 26, weight: .black, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.6), radius: 6, x: 0, y: 3)
                    .padding(.leading, 16)
                
                Spacer()
                
                // Only show camera flip button at top right (stream screen only)
                if !streamManager.isRecording {
                    Button(action: {
                        streamManager.toggleCamera()
                    }) {
                        Image(systemName: "camera.rotate.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                    }
                }
            }
            .padding(.top, 12)
            .padding(.trailing, 16)
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
    
    private var bottomControlsOverlay: some View {
        VStack {
            Spacer()
            
            // TV Network Model: All authenticated users can stream from mobile
            if authService.isAuthenticated {
                // Show streaming controls for "Twilly TV" channel
                VStack(spacing: 12) {
                    // Capture button - circular around icon (fixed position)
                    // Positioned lower like Snapchat's record button
                    HStack {
                        Spacer()
                        Button(action: {
                            print("🎬 [ContentView] Capture button tapped - isStreaming: \(streamManager.isStreaming)")
                            if streamManager.isStreaming {
                                // Stop streaming - will save to channel and show metadata form
                                print("🛑 [ContentView] Stopping stream...")
                                streamManager.stopStreaming()
                            } else {
                                // Prevent opening visibility selector during countdown
                                if isShowingCountdown {
                                    print("⏸️ [ContentView] Countdown active - cannot open visibility selector")
                                    return
                                }
                                
                                // If visibility selector is already showing, clicking again = dismiss and default to public
                                if showingVisibilitySelector {
                                    print("▶️ [ContentView] Stream button clicked while selector is open - dismissing and defaulting to public")
                                    // Dismiss selector
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                        showingVisibilitySelector = false
                                    }
                                    // Reset flags
                                    pendingStreamStart = false
                                    wasDismissedWithoutSelection = false
                                    // Set to public and start streaming
                                    isUsernamePublic = true
                                    selectedStreamVisibility = true // Store selection for stream
                                    saveVisibilityPreference(true)
                                    updateUsernameVisibility(true)
                                    // Start stream after a brief delay to allow visibility update
                                    Task {
                                        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                                        await startStreamToTwillyTV()
                                    }
                                } else if wasDismissedWithoutSelection {
                                    // User previously dismissed selector - default to public and stream
                                    print("▶️ [ContentView] Stream button clicked after previous dismissal - defaulting to public and streaming")
                                    wasDismissedWithoutSelection = false
                                    isUsernamePublic = true
                                    selectedStreamVisibility = true // Store selection for stream
                                    saveVisibilityPreference(true)
                                    updateUsernameVisibility(true)
                                    // Start stream after a brief delay
                                    Task {
                                        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                                        await startStreamToTwillyTV()
                                    }
                                } else {
                                    // Show visibility selector when play button is clicked
                                    print("▶️ [ContentView] Play button clicked - showing visibility selector...")
                                    // Load saved preference to show current selection
                                    loadSavedVisibilityPreference()
                                    // Mark that we need to start stream after visibility is selected
                                    pendingStreamStart = true
                                    // Load current visibility from server if not loaded (for display)
                                    if !isLoadingVisibility && !isUpdatingVisibility {
                                        loadUsernameVisibility()
                                    }
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                        showingVisibilitySelector = true
                                    }
                                }
                            }
                        }) {
                            ZStack {
                                // Fixed size background to prevent position shifts
                                Circle()
                                    .fill(captureButtonGradient)
                                    .frame(width: 85, height: 85)
                                    .shadow(color: Color.twillyTeal.opacity(0.3), radius: 12, x: 0, y: 6)
                                
                                // Icon centered within fixed frame
                                Image(systemName: streamManager.isStreaming ? "stop.fill" : "record.circle.fill")
                                    .font(.system(size: 32, weight: .medium))
                                    .foregroundColor(.white)
                                    .frame(width: 85, height: 85)
                            }
                            .animation(nil, value: streamManager.isStreaming) // Disable automatic animations
                        }
                        .frame(width: 85, height: 85) // Fixed frame to prevent position shifts
                        .contentShape(Circle()) // Ensure entire circle is tappable
                        .animation(nil, value: streamManager.isStreaming) // Disable button container animations
                        Spacer()
                    }
                    .frame(height: 85) // Fixed container height to accommodate larger button
                    .padding(.horizontal, 20)
                    
                    // 15-minute countdown timer - reserve space to prevent button movement
                    HStack(spacing: 8) {
                        Spacer()
                        if streamManager.isStreaming {
                            StreamCountdownTimerView(
                                timeRemaining: max(0, streamTimeLimit - streamManager.duration),
                                onTimeExpired: {
                                    // Automatically stop stream when 15 minutes is reached
                                    print("⏰ [ContentView] 15-minute limit reached - stopping stream automatically")
                                    streamManager.stopStreaming()
                                }
                            )
                        } else {
                            // Invisible placeholder to reserve space when not streaming
                            Color.clear
                                .frame(height: 36)
                        }
                        Spacer()
                    }
                    .frame(height: 36) // Fixed height to prevent layout shifts
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                    .animation(nil, value: streamManager.isStreaming) // Disable animation to prevent position shifts
                    
                    if streamManager.isRecording {
                        // Show wave animation when recording (not streaming)
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
                    
                    // Swipe indicator - shows then disappears
                    swipeIndicator
                        .padding(.top, 8)
                }
                .padding(.bottom, 12) // Snapchat-style positioning - close to bottom edge
                    } else {
                        // Non-admin: Show info message
                        VStack(spacing: 12) {
                            VStack(spacing: 8) {
                                Image(systemName: "tv.fill")
                                    .font(.title2)
                                    .foregroundColor(.twillyTeal)
                                Text("Twilly TV")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                Text("Configure your streaming setup in Settings")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }
                            .padding(.vertical, 20)
                            .frame(maxWidth: .infinity)
                            .background(Color.black.opacity(0.4))
                            .cornerRadius(20)
                            .padding(.horizontal, 20)
                        }
                        .padding(.bottom, 40)
                    }
        }
    }
    
    
    // MARK: - Username Visibility
    
    // Load saved visibility preference from UserDefaults
    private func loadSavedVisibilityPreference() {
        if let savedPreference = UserDefaults.standard.object(forKey: visibilityPreferenceKey) as? Bool {
            isUsernamePublic = savedPreference
            print("✅ [ContentView] Loaded saved visibility preference: \(savedPreference ? "public" : "private")")
        } else {
            // Default to public if no preference saved
            isUsernamePublic = true
            print("✅ [ContentView] No saved preference, defaulting to public")
        }
    }
    
    // Save visibility preference to UserDefaults
    private func saveVisibilityPreference(_ isPublic: Bool) {
        UserDefaults.standard.set(isPublic, forKey: visibilityPreferenceKey)
        print("💾 [ContentView] Saved visibility preference: \(isPublic ? "public" : "private")")
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
        
        // Show immediate feedback - start countdown overlay early to indicate processing
        await MainActor.run {
            // Dismiss visibility selector if it's open when countdown starts
            if showingVisibilitySelector {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    showingVisibilitySelector = false
                }
            }
            isShowingCountdown = true
            countdownValue = 3
        }
        
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
            }
            
            // CRITICAL: Set username type for this stream DURING COUNTDOWN (BEFORE stream starts)
            // This ensures the global map is set BEFORE the RTMP connection is established
            // Use the user's selected visibility, not isUsernamePublic (which may have been reverted)
            // If selectedStreamVisibility is nil, fall back to isUsernamePublic
            let streamIsPublic = selectedStreamVisibility ?? isUsernamePublic
            let isPrivate = !streamIsPublic
            
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
                try await ChannelService.shared.setStreamUsernameType(streamKey: streamKey, isPrivateUsername: isPrivate, streamUsername: streamUsername)
                print("✅ [ContentView] CRITICAL: Stream privacy set DURING COUNTDOWN - global map is ready!")
                print("   StreamKey: \(streamKey)")
                print("   isPrivateUsername: \(isPrivate)")
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
            
            // Start countdown task that can be cancelled
            let task = Task {
                // Check for cancellation before each step
                guard !Task.isCancelled else { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run { countdownValue = 2 }
                
                guard !Task.isCancelled else { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run { countdownValue = 1 }
                
                guard !Task.isCancelled else { return }
                // Start streaming during "1" countdown for seamless transition
                try? await Task.sleep(nanoseconds: 500_000_000) // Half second into "1"
                guard !Task.isCancelled else { return }
                
                await MainActor.run {
                    guard !Task.isCancelled else { return }
                    streamManager.startStreaming()
                    // Start monitoring for 15-minute limit
                    startStreamTimeLimitMonitoring()
                }
                
                guard !Task.isCancelled else { return }
                // Hide countdown overlay after stream starts (smooth transition)
                try? await Task.sleep(nanoseconds: 500_000_000) // Remaining half second
                await MainActor.run {
                    withAnimation(.easeOut(duration: 0.3)) {
                        isShowingCountdown = false
                        countdownTask = nil
                    }
                }
            }
            
            await MainActor.run {
                countdownTask = task
            }
            
            // Wait for task to complete or be cancelled
            await task.value
        } catch {
            print("❌ [ContentView] Error getting stream key: \(error)")
            await MainActor.run {
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
        } else {
            return LinearGradient(
                gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }
    
    private var recordingStatusIndicator: some View {
        HStack(spacing: 10) {
            CaptureWaveView()
                .frame(width: 30, height: 24)
            Text("Capturing")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(
                    LinearGradient(
                        gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .shadow(color: Color.twillyCyan.opacity(0.5), radius: 4, x: 0, y: 2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(height: 40) // Match ChannelSelectorView height to prevent layout shift
    }
    
    // Subtle swipe indicator for stream screen (disappears after a few seconds)
    private var swipeIndicator: some View {
        HStack {
            Spacer()
            if showSwipeIndicator {
                HStack(spacing: 8) {
                    Text("Swipe for Twilly TV")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    LinearGradient(
                        colors: [Color.twillyTeal.opacity(0.9), Color.twillyCyan.opacity(0.9)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(25)
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                .transition(.opacity.combined(with: .scale))
                .onAppear {
                    // Auto-hide after 8 seconds (longer visibility)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            showSwipeIndicator = false
                        }
                    }
                }
            }
            Spacer()
        }
        .frame(height: 36)
        .frame(maxWidth: .infinity)
    }
    
    @ViewBuilder
    private var streamDurationView: some View {
        // Use separate views to avoid property access issues with @EnvironmentObject
        StreamDurationDisplayView(streamManager: streamManager)
    }
    
    // All other properties and methods are in the extension below
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

// 15-minute countdown timer for streaming
struct StreamCountdownTimerView: View {
    let timeRemaining: TimeInterval
    let onTimeExpired: () -> Void
    @State private var timer: Timer?
    
    var body: some View {
        Text(countdownText)
            .font(.headline)
            .fontWeight(.bold)
            .foregroundStyle(
                LinearGradient(
                    gradient: Gradient(colors: [
                        timeRemaining < 60 ? Color.red : Color.twillyTeal,
                        timeRemaining < 60 ? Color.orange : Color.twillyCyan
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .shadow(color: (timeRemaining < 60 ? Color.red : Color.twillyCyan).opacity(0.6), radius: 4, x: 0, y: 2)
            .onAppear {
                // Check if time has expired
                if timeRemaining <= 0 {
                    onTimeExpired()
                }
            }
            .onChange(of: timeRemaining) { newValue in
                // Check if time has expired
                if newValue <= 0 {
                    onTimeExpired()
                }
            }
    }
    
    private var countdownText: String {
        let minutes = Int(timeRemaining) / 60
        let seconds = Int(timeRemaining) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

extension ContentView {
    
    // MARK: - Helper Functions
    
    func formatTimeRemaining(_ timeRemaining: TimeInterval) -> String {
        let minutes = Int(timeRemaining) / 60
        let seconds = Int(timeRemaining) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
    
    // Monitor stream time limit (15 minutes)
    private func startStreamTimeLimitMonitoring() {
        // Check every second if stream has reached 15 minutes
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            // Stop monitoring if stream is not active
            if !self.streamManager.isStreaming {
                timer.invalidate()
                return
            }
            
            // Check if 15 minutes have elapsed
            if self.streamManager.duration >= self.streamTimeLimit {
                print("⏰ [ContentView] 15-minute limit reached - stopping stream automatically")
                self.streamManager.stopStreaming()
                timer.invalidate()
            }
        }
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
        }
    }
    
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
                        // Use key to force refresh when recapture happens
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
                            
                            Spacer()
                            
                            Text("\(countdownValue)")
                                .font(.system(size: 120, weight: .bold))
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.twillyTeal, .twillyCyan],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .shadow(color: .twillyCyan.opacity(0.5), radius: 20)
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
                                        .foregroundColor(.white.opacity(0.9))
                                        .transition(.opacity)
                                    
                                    Text("Tap to cancel")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundColor(.white.opacity(0.6))
                                }
                                .transition(.opacity)
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
            
            // Show 3-second countdown before starting stream
            await MainActor.run {
                isShowingCountdown = true
                countdownValue = 3
            }
            
            // Countdown: 3, 2, 1
            // Wait 1 second before showing 2
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            await MainActor.run {
                countdownValue = 2
            }
            
            // Wait 1 second before showing 1
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            await MainActor.run {
                countdownValue = 1
            }
            
            // Wait 1 second to show "1" before starting stream
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            
            // Start streaming after countdown completes
            await MainActor.run {
                isShowingCountdown = false
                streamManager.setStreamKey(streamKey, channelName: channel.channelName)
                streamManager.startStreaming()
            }
        } catch {
            print("❌ [ContentView] Error getting collaborator stream key: \(error)")
            print("   Error details: \(error.localizedDescription)")
            if let urlError = error as? URLError {
                print("   URLError code: \(urlError.code.rawValue)")
            }
            await MainActor.run {
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
        // Initialize with a reasonable default size
        let hkView = MTHKView(frame: CGRect(x: 0, y: 0, width: 375, height: 300))
        hkView.backgroundColor = UIColor.black
        hkView.videoGravity = .resizeAspectFill
        
        // Use preview orientation (accounts for camera position)
        hkView.videoOrientation = streamManager.getPreviewOrientation()
        
        // SNAPCHAT-STYLE: No mirroring - natural selfie view
        hkView.isMirrored = false
        
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
        
        // Wait for proper layout before attaching stream (like working backup)
        DispatchQueue.main.async {
            context.coordinator.attachStreamIfReady(streamManager: streamManager)
        }
        
        return hkView
    }
    
    func updateUIView(_ uiView: MTHKView, context: Context) {
        // Only update if necessary to reduce performance overhead
        // Avoid unnecessary updates that cause freezing
        
        // Ensure coordinator has view reference
        if context.coordinator.view == nil {
            context.coordinator.view = uiView
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
        
        // SNAPCHAT-STYLE: No mirroring - natural selfie view
        if uiView.isMirrored {
            uiView.isMirrored = false
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
            // Force refresh preview - reset attachment state and reattach
            guard let streamManager = streamManager else { return }
            DispatchQueue.main.async {
                // Update last camera position to current position to force reattach
                self.lastCameraPosition = streamManager.currentCameraPosition
                // Detach old stream first
                if let view = self.view {
                    view.attachStream(nil)
                }
                self.hasAttached = false
                // Small delay to ensure detach completes before reattaching
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    self.attachStreamIfReady(streamManager: streamManager)
                }
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
            
            // Attach stream
            view.attachStream(streamManager.rtmpStream)
            hasAttached = true
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
