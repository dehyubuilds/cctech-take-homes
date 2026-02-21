//
//  ChannelSelectionView.swift
//  TwillyBroadcaster
//
//  Snapchat-style sleek UI for selecting channels to stream to
//

import SwiftUI

struct ChannelSelectionView: View {
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject var streamManager: StreamManager
    @ObservedObject var connectionManager = StreamKeyManager.shared
    @Environment(\.dismiss) var dismiss
    
    let recordedVideoURL: URL? // Optional: if provided, upload file instead of streaming
    
    @State private var channels: [Channel] = []
    @State private var filteredChannels: [Channel] = []
    @State private var isLoading = true  // Start with loading true
    @State private var errorMessage: String?
    @State private var selectedChannel: Channel?
    @State private var isGeneratingKey = false
    @State private var isUploading = false
    @State private var uploadingChannelName: String? = nil
    @State private var uploadProgress: Double = 0.0
    @State private var showUploadError = false
    @State private var uploadErrorMessage: String? = nil
    @State private var uploadCompleteChannel: Channel? = nil // Channel that just finished uploading
    @State private var channelToNavigate: DiscoverableChannel? = nil
    @State private var showingChannelDetail = false
    @ObservedObject private var authService = AuthService.shared
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    @State private var searchQuery: String = ""
    
    // Video details form state (collapsible)
    @State private var isVideoDetailsExpanded = false
    @State private var pendingChannel: Channel? = nil
    @State private var videoTitle: String = ""
    @State private var videoDescription: String = ""
    @State private var videoPrice: String = ""
    
    // Pre-filled video details (from VideoDetailsFormView)
    let preFilledTitle: String?
    let preFilledDescription: String?
    let preFilledPrice: String?
    
    init(streamManager: StreamManager, recordedVideoURL: URL? = nil, preFilledTitle: String? = nil, preFilledDescription: String? = nil, preFilledPrice: String? = nil) {
        self.streamManager = streamManager
        self.recordedVideoURL = recordedVideoURL
        self.preFilledTitle = preFilledTitle
        self.preFilledDescription = preFilledDescription
        self.preFilledPrice = preFilledPrice
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient (Snapchat-style dark theme)
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if isLoading {
                    VStack(spacing: 20) {
                        VStack(spacing: 16) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                                .scaleEffect(1.8)
                            
                            Text("Loading channels...")
                                .foregroundColor(.white)
                                .font(.headline)
                                .fontWeight(.medium)
                            
                            Text("Getting your channels ready")
                                .foregroundColor(.white.opacity(0.6))
                                .font(.subheadline)
                        }
                        .padding(.top, 60)
                    }
                } else if let error = errorMessage {
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
                        Text("Error")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        Text(error)
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        Button("Retry") {
                            loadChannels()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else if filteredChannels.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "folder.badge.questionmark")
                            .font(.system(size: 50))
                            .foregroundStyle(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal.opacity(0.7),
                                        Color.twillyCyan.opacity(0.5)
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        Text(searchQuery.isEmpty ? "No Streamable Channels" : "No Channels Found")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        Text(searchQuery.isEmpty 
                             ? "Generate a stream key for a public channel in managefiles to capture to it"
                             : "Try adjusting your search terms")
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                } else {
                    VStack(spacing: 0) {
                        // Search bar - Twilly themed
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.twillyCyan)
                            TextField("Search searchable channels...", text: $searchQuery)
                                .foregroundColor(.white)
                                .onChange(of: searchQuery) { _ in
                                    filterChannels()
                                }
                            if !searchQuery.isEmpty {
                                Button(action: {
                                    searchQuery = ""
                                    filterChannels()
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
                        
                        ScrollView {
                            VStack(spacing: 16) {
                                ForEach(filteredChannels) { channel in
                                    ChannelCard(
                                        channel: channel,
                                        isSelected: selectedChannel?.id == channel.id,
                                        isUploading: isUploading && uploadingChannelName == channel.name,
                                        isUploadComplete: uploadCompleteChannel?.id == channel.id,
                                        isDisabled: isUploading && uploadingChannelName != channel.name, // Disable other channels during upload
                                        onSelect: {
                                            // Don't allow selecting other channels during upload
                                            if !isUploading || uploadingChannelName == channel.name {
                                                // If details are pre-filled, post immediately
                                                if preFilledTitle != nil || preFilledDescription != nil || preFilledPrice != nil {
                                                    pendingChannel = channel
                                                    handleVideoDetailsSave()
                                                } else {
                                                    // Otherwise, show form for editing
                                                    selectedChannel = channel
                                                    pendingChannel = channel
                                                    // Form will appear collapsed (header only) when channel is selected
                                                    // User can tap to expand if they want to add details
                                                }
                                            }
                                        },
                                        onStream: {
                                            streamToChannel(channel)
                                        },
                                        onGoToChannel: {
                                            navigateToChannel(channel)
                                        }
                                    )
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                            .padding(.bottom, selectedChannel != nil ? (isVideoDetailsExpanded ? 400 : 80) : 0) // Add padding for collapsed/expanded form
                        }
                    }
                }
                
                // Collapsible Video Details Form (appears at bottom when channel is selected)
                // Only show when channel is selected AND we have a recorded video
                if selectedChannel != nil, recordedVideoURL != nil {
                    VStack(spacing: 0) {
                        Spacer()
                        
                        VStack(spacing: 0) {
                            // Collapsed header (always visible when channel selected)
                            Button(action: {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    isVideoDetailsExpanded.toggle()
                                }
                            }) {
                                HStack {
                                    Image(systemName: isVideoDetailsExpanded ? "chevron.down" : "chevron.up")
                                        .foregroundColor(.twillyCyan)
                                        .font(.caption)
                                    
                                    Text("Add Details (Optional)")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(
                                            LinearGradient(
                                                gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                    
                                    Spacer()
                                    
                                    if !videoTitle.isEmpty || !videoDescription.isEmpty || !videoPrice.isEmpty {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(.twillyCyan)
                                            .font(.caption)
                                    }
                                }
                                .padding(.horizontal, 20)
                                .padding(.vertical, 14)
                                .background(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .fill(Color(red: 0.1, green: 0.1, blue: 0.15))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .stroke(
                                                    LinearGradient(
                                                        gradient: Gradient(colors: [Color.twillyTeal.opacity(0.5), Color.twillyCyan.opacity(0.3)]),
                                                        startPoint: .leading,
                                                        endPoint: .trailing
                                                    ),
                                                    lineWidth: 1.5
                                                )
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                            
                            // Expanded form content
                            if isVideoDetailsExpanded {
                                VStack(spacing: 16) {
                                    // Title field
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text("Title (Optional)")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.7))
                                        
                                        TextField("Enter video title", text: $videoTitle)
                                            .padding(10)
                                            .background(Color.black.opacity(0.3))
                                            .cornerRadius(10)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 10)
                                                    .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                                            )
                                            .foregroundColor(.white)
                                    }
                                    
                                    // Description field
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text("Description (Optional)")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.7))
                                        
                                        ZStack(alignment: .topLeading) {
                                            RoundedRectangle(cornerRadius: 10)
                                                .fill(Color.black.opacity(0.3))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 10)
                                                        .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                                                )
                                            
                                            TextEditor(text: $videoDescription)
                                                .frame(minHeight: 80)
                                                .padding(10)
                                                .background(Color.clear)
                                                .foregroundColor(.white)
                                            
                                            if videoDescription.isEmpty {
                                                Text("Enter video description")
                                                    .foregroundColor(.white.opacity(0.4))
                                                    .padding(.leading, 14)
                                                    .padding(.top, -70)
                                                    .allowsHitTesting(false)
                                            }
                                        }
                                    }
                                    
                                    // Price field
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text("Price ($)")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.7))
                                        
                                        HStack {
                                            Text("$")
                                                .foregroundColor(.white.opacity(0.7))
                                            
                                            TextField("0.00", text: $videoPrice)
                                                .keyboardType(.decimalPad)
                                                .padding(10)
                                                .background(Color.black.opacity(0.3))
                                                .cornerRadius(10)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 10)
                                                        .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                                                )
                                                .foregroundColor(.white)
                                        }
                                        
                                        Text("Optional - leave empty for free")
                                            .font(.caption2)
                                            .foregroundColor(.white.opacity(0.5))
                                    }
                                    
                                    // Post button
                                    Button(action: {
                                        handleVideoDetailsSave()
                                    }) {
                                        HStack(spacing: 8) {
                                            Image(systemName: "square.and.arrow.up.fill")
                                            Text("Post")
                                                .font(.system(size: 17, weight: .semibold))
                                        }
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 50)
                                        .background(
                                            LinearGradient(
                                                gradient: Gradient(colors: [
                                                    Color.twillyTeal,
                                                    Color.twillyCyan,
                                                    Color.twillyTeal
                                                ]),
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                        .cornerRadius(25)
                                        .shadow(color: Color.twillyCyan.opacity(0.5), radius: 10, x: 0, y: 5)
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(isUploading)
                                }
                                .padding(.horizontal, 20)
                                .padding(.vertical, 16)
                                .background(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .fill(Color(red: 0.1, green: 0.1, blue: 0.15))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .stroke(
                                                    LinearGradient(
                                                        gradient: Gradient(colors: [Color.twillyTeal.opacity(0.5), Color.twillyCyan.opacity(0.3)]),
                                                        startPoint: .leading,
                                                        endPoint: .trailing
                                                    ),
                                                    lineWidth: 1.5
                                                )
                                        )
                                )
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 20)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.black.opacity(0.95),
                                    Color(red: 0.1, green: 0.1, blue: 0.15).opacity(0.95)
                                ]),
                                startPoint: .top,
                                endPoint: .bottom
                            )
                            .ignoresSafeArea(edges: .bottom)
                        )
                    }
                    .zIndex(100) // Ensure form appears above other content
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                
                // Error toast (auto-dismisses) - only show if upload fails
                if showUploadError {
                    VStack {
                        HStack {
                            Spacer()
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
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
                                Text(uploadErrorMessage ?? "Upload failed")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(Color.orange.opacity(0.9))
                                    .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
                            )
                            .padding(.top, 8)
                            .padding(.trailing, 16)
                        }
                        Spacer()
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                            withAnimation {
                                showUploadError = false
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select Channel")
            .navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $showingChannelDetail) {
                if let channel = channelToNavigate {
                    NavigationView {
                        ChannelDetailView(channel: channel, forceRefresh: true)
                            .toolbar {
                                ToolbarItem(placement: .navigationBarLeading) {
                                    Button("Back") {
                                        showingChannelDetail = false
                                        channelToNavigate = nil
                                    }
                                    .foregroundColor(.white)
                                }
                            }
                    }
                    .navigationViewStyle(StackNavigationViewStyle())
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        // Clear form state when cancelling
                        selectedChannel = nil
                        pendingChannel = nil
                        isVideoDetailsExpanded = false
                        videoTitle = ""
                        videoDescription = ""
                        videoPrice = ""
                        // Allow dismissing even during upload - upload continues in background
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .disabled(false) // Always allow cancel, even during upload
                }
            }
            .onAppear {
                loadChannels()
                // Pre-fill video details if provided
                if let title = preFilledTitle {
                    videoTitle = title
                }
                if let description = preFilledDescription {
                    videoDescription = description
                }
                if let price = preFilledPrice {
                    videoPrice = price
                }
                // Auto-expand form if details are pre-filled
                if preFilledTitle != nil || preFilledDescription != nil || preFilledPrice != nil {
                    isVideoDetailsExpanded = true
                }
            }
            .onDisappear {
                // Clear form state when view disappears
                selectedChannel = nil
                pendingChannel = nil
                isVideoDetailsExpanded = false
                videoTitle = ""
                videoDescription = ""
                videoPrice = ""
            }
        }
        .gesture(
            DragGesture()
                .onEnded { value in
                    // Swipe down to dismiss
                    if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                        // Clear form state when dismissing
                        selectedChannel = nil
                        pendingChannel = nil
                        isVideoDetailsExpanded = false
                        videoTitle = ""
                        videoDescription = ""
                        videoPrice = ""
                        dismiss()
                    }
                    // Swipe left to dismiss
                    else if value.translation.width < -100 || value.predictedEndTranslation.width < -200 {
                        // Clear form state when dismissing
                        selectedChannel = nil
                        pendingChannel = nil
                        isVideoDetailsExpanded = false
                        videoTitle = ""
                        videoDescription = ""
                        videoPrice = ""
                        dismiss()
                    }
                }
        )
    }
    
    private func filterChannels() {
        print("🔍 Filtering \(channels.count) channels...")
        if searchQuery.isEmpty {
            // When not searching: show only public channels that have stream keys
            filteredChannels = channels.filter { channel in
                let visibilityCheck = channel.visibility == "public"
                let isPublicCheck = channel.isPublic == true
                let isPublic = visibilityCheck || isPublicCheck
                let hasStreamKey = channel.hasStreamKey
                
                let shouldInclude = isPublic && hasStreamKey
                if shouldInclude {
                    print("✅ Including: \(channel.name) (visibility: \(channel.visibility ?? "nil"), isPublic: \(channel.isPublic ?? false), hasStreamKey: \(hasStreamKey))")
                } else {
                    print("❌ Excluding: \(channel.name) (visibility: \(channel.visibility ?? "nil"), isPublic: \(channel.isPublic ?? false), hasStreamKey: \(hasStreamKey))")
                }
                
                return shouldInclude
            }
            print("✅ Filtered to \(filteredChannels.count) public channels with stream keys")
        } else {
            // When searching: show both public and searchable channels that match AND have stream keys
            let queryLower = searchQuery.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            filteredChannels = channels.filter { channel in
                let isPublic = channel.visibility == "public" || (channel.isPublic == true)
                let isSearchable = channel.visibility == "searchable"
                let isVisible = isPublic || isSearchable
                let hasStreamKey = channel.hasStreamKey
                let matchesSearch = channel.name.lowercased().contains(queryLower)
                return isVisible && hasStreamKey && matchesSearch
            }
        }
    }
    
    private func loadChannels() {
        errorMessage = nil
        
        // TODO: Get user email from auth
        // For now, using a placeholder - you'll need to integrate with your auth system
        let email = userEmail
        
        // OPTIMIZED: Load cached data immediately (instant), then refresh in background
        Task {
            // First, try to get cached data immediately (non-blocking)
            do {
                let cachedChannels = try await channelService.fetchChannels(userEmail: email, forceRefresh: false)
                await MainActor.run {
                    channels = cachedChannels
                    filterChannels()
                    isLoading = false // Hide loading immediately after cache load
                    print("📋 Loaded \(channels.count) channels from cache (instant)")
                }
            } catch {
                // If cache fails, keep showing spinner until fresh fetch completes
                print("⚠️ Cache load failed: \(error.localizedDescription)")
            }
            
            // Then refresh in background to get latest data (non-blocking)
            do {
                let freshChannels = try await channelService.fetchChannels(userEmail: email, forceRefresh: true)
                await MainActor.run {
                    // Only update if we got fresh data and it's different
                    if freshChannels.count > 0 {
                        channels = freshChannels
                        filterChannels()
                        print("📋 Refreshed to \(channels.count) channels (background update)")
                    }
                    // Ensure loading is hidden (in case cache failed)
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
                    // Ensure loading is hidden
                    isLoading = false
                }
            }
        }
    }
    
    private func streamToChannel(_ channel: Channel) {
        // Prevent duplicate uploads
        // Allow uploads even if one is in progress (non-blocking UX)
        // guard !isUploading else {
        //     print("⚠️ Upload already in progress, ignoring duplicate tap")
        //     return
        // }
        
        // If we have a recorded video, set as selected and show collapsed form
        if recordedVideoURL != nil {
            selectedChannel = channel
            pendingChannel = channel
            // Show collapsed form (header only, not expanded)
            // Don't auto-expand - let user tap to expand
            return
        }
        
        // Otherwise, set up RTMP streaming (legacy flow)
        isGeneratingKey = true
        
        // Capture userEmail before entering Task (Swift 6 concurrency requirement)
        let email = userEmail
        
        Task {
            do {
                let streamKey: String
                
                // Use existing stream key if available, otherwise generate one
                if let existingKey = channel.streamKey, channel.hasStreamKey {
                    streamKey = existingKey
                } else {
                    streamKey = try await channelService.getOrGenerateStreamKey(
                        userEmail: email,
                        channelName: channel.name
                    )
                }
                
                // Build full RTMP URL
                let rtmpURL = channelService.buildRTMPURL(streamKey: streamKey)
                
                // Add to connection manager
                await MainActor.run {
                    connectionManager.addStreamKey(name: channel.name, url: rtmpURL)
                    if let addedKey = connectionManager.streamKeys.last {
                        connectionManager.selectStreamKey(addedKey)
                        streamManager.setStreamKey(rtmpURL, channelName: channel.name)
                    }
                    isGeneratingKey = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to get stream key: \(error.localizedDescription)"
                    isGeneratingKey = false
                }
            }
        }
    }
    
    private func handleVideoDetailsSave() {
        guard let channel = pendingChannel, let videoURL = recordedVideoURL else {
            return
        }
        
        // Collapse form
        withAnimation {
            isVideoDetailsExpanded = false
        }
        
        // Parse price (only if provided)
        let price = videoPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : Double(videoPrice)
        
        // Upload with details (only include non-empty values)
        uploadVideoToChannel(
            videoURL: videoURL,
            channel: channel,
            title: videoTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            description: videoDescription.trimmingCharacters(in: .whitespacesAndNewlines),
            price: price
        )
    }
    
    private func uploadVideoToChannel(videoURL: URL, channel: Channel, title: String = "", description: String = "", price: Double? = nil) {
        print("📤 Starting upload to channel: \(channel.name)")
        
        // IMMEDIATELY show local video and navigate - don't wait for ANYTHING
        let localVideoURL = streamManager.recordedVideoURL
        
        // Post notification with channel name and local video URL IMMEDIATELY
        var userInfo: [String: Any] = ["channelName": channel.name]
        if let videoURL = localVideoURL {
            // Store the local file path temporarily
            userInfo["localVideoURL"] = videoURL.path
            userInfo["videoTitle"] = title.isEmpty ? nil : title
            userInfo["videoDescription"] = description.isEmpty ? nil : description
            userInfo["videoPrice"] = price != nil ? String(price!) : nil
        }
        
        NotificationCenter.default.post(
            name: NSNotification.Name("UploadComplete"),
            object: nil,
            userInfo: userInfo
        )
        
        // Dismiss immediately - upload continues in background
        dismiss()
        
        // Capture userEmail before entering detached task (Swift 6 concurrency requirement)
        let email = userEmail
        
        // NOW start upload in background (non-blocking)
        Task.detached(priority: .userInitiated) {
            // Prevent screen from sleeping during upload
            await MainActor.run {
                UIApplication.shared.isIdleTimerDisabled = true
                print("🔋 Disabled idle timer to prevent screen sleep during upload")
            }
            
            do {
                let streamKey: String
                
                // Get or generate stream key for the channel (in background)
                if let existingKey = channel.streamKey, channel.hasStreamKey {
                    streamKey = existingKey
                } else {
                    streamKey = try await channelService.getOrGenerateStreamKey(
                        userEmail: email,
                        channelName: channel.name
                    )
                }
                
                print("📤 Starting background upload to channel: \(channel.name)")
                print("📤 Video details - Title: \(title.isEmpty ? "none" : title), Description: \(description.isEmpty ? "none" : description), Price: \(price != nil ? String(price!) : "none")")
                
                // Generate unique uploadId for this upload to ensure metadata is unique per video
                let uniqueUploadId = UUID().uuidString
                print("📤 Generated unique uploadId: \(uniqueUploadId)")
                
                // Upload video file to server WITH metadata (so Lambda can apply it)
                let _ = try await ChannelService.shared.uploadVideoFile(
                    fileURL: videoURL,
                    channelName: channel.name,
                    userEmail: email,
                    streamKey: streamKey,
                    uploadId: uniqueUploadId,
                    title: title.isEmpty ? nil : title,
                    description: description.isEmpty ? nil : description,
                    price: price
                )
                
                print("✅ Video upload successful (background)")
                
                // Step 2: Update metadata in background (non-blocking) - don't wait for it
                // IMPORTANT: We do NOT pass streamKey to avoid bulk update - each video should have unique metadata
                if !title.isEmpty || !description.isEmpty || price != nil {
                    print("📤 Updating metadata in background (non-blocking)...")
                    
                    // Capture variables for background task
                    let metadataTitle = title
                    let metadataDescription = description
                    let metadataPrice = price
                    let metadataEmail = email
                    let metadataChannelName = channel.name
                    let metadataStreamKey = streamKey
                    
                    // Run metadata update in background task - don't block UI
                    Task.detached(priority: .background) {
                        do {
                            let PK = "USER#\(metadataEmail)"
                            
                            // Wait for the NEW file to appear (the one without metadata yet)
                            var newFileItem: ChannelContent? = nil
                            var retryCount = 0
                            let maxRetries = 10 // 10 retries = 50 seconds total (Lambda can take time)
                            
                            while newFileItem == nil && retryCount < maxRetries {
                                let content = try await ChannelService.shared.fetchChannelContent(
                                    channelName: metadataChannelName,
                                    creatorEmail: metadataEmail
                                )
                                
                                // Find all files with this streamKey (content is sorted newest first)
                                let filesWithStreamKey = content.filter { item in
                                    item.fileName.contains(metadataStreamKey)
                                }
                                
                                print("📋 Found \(filesWithStreamKey.count) files with streamKey: \(metadataStreamKey)")
                                for (index, file) in filesWithStreamKey.prefix(3).enumerated() {
                                    print("   [\(index)] \(file.fileName) - title: \(file.title ?? "nil"), price: \(file.price ?? 0)")
                                }
                                
                                // Find the first file (newest) that has no metadata
                                newFileItem = filesWithStreamKey.first { item in
                                    (item.title == nil || item.title?.isEmpty == true) &&
                                    (item.description == nil || item.description?.isEmpty == true) &&
                                    (item.price == nil || item.price == 0)
                                }
                                
                                if newFileItem == nil {
                                    retryCount += 1
                                    print("⏳ Waiting for Lambda to create FILE item... (attempt \(retryCount)/\(maxRetries))")
                                    try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                                }
                            }
                            
                            if let fileItem = newFileItem {
                                print("📤 Found NEW file item: \(fileItem.SK), fileName: \(fileItem.fileName)")
                                print("📤 Updating metadata for THIS FILE ONLY (NOT bulk update - each video is unique)")
                                print("📤 Metadata: title=\(metadataTitle.isEmpty ? "nil" : metadataTitle), description=\(metadataDescription.isEmpty ? "nil" : metadataDescription), price=\(metadataPrice != nil ? String(metadataPrice!) : "nil")")
                                // CRITICAL: Do NOT pass streamKey - this updates ONLY this specific file
                                let updateResponse = try await ChannelService.shared.updateVideoDetails(
                                    PK: PK,
                                    fileId: fileItem.SK,
                                    streamKey: nil, // NO streamKey = single file update only
                                    title: metadataTitle.isEmpty ? nil : metadataTitle,
                                    description: metadataDescription.isEmpty ? nil : metadataDescription,
                                    price: metadataPrice
                                )
                                if updateResponse.success {
                                    print("✅ Video details updated in DynamoDB for file: \(fileItem.SK) (single file only)")
                                    print("✅ Update response: \(updateResponse.message ?? "success")")
                                } else {
                                    print("❌ Update failed: \(updateResponse.message ?? "unknown error")")
                                }
                            } else {
                                print("⚠️ No new file found with streamKey \(metadataStreamKey) after \(maxRetries) retries")
                                print("⚠️ Metadata will be updated when file appears (or update manually via web app)")
                            }
                        } catch {
                            print("❌ Error updating video details in background: \(error.localizedDescription)")
                        }
                    }
                }
                
                // Re-enable screen sleep after upload completes
                await MainActor.run {
                    UIApplication.shared.isIdleTimerDisabled = false
                    print("🔋 Re-enabled idle timer after background upload complete")
                }
            } catch {
                print("❌ Background upload error: \(error.localizedDescription)")
                await MainActor.run {
                    UIApplication.shared.isIdleTimerDisabled = false
                    print("🔋 Re-enabled idle timer after background upload error")
                }
            }
        }
    }
    
    private func navigateToChannel(_ channel: Channel) {
        // Convert Channel to DiscoverableChannel for navigation
        // Channel struct has limited properties, so we use defaults for missing ones
        let discoverableChannel = DiscoverableChannel(
            channelId: channel.id,
            channelName: channel.name,
            creatorEmail: userEmail,
            creatorUsername: "", // Channel doesn't have this property
            description: "", // Channel doesn't have this property
            posterUrl: "", // Channel doesn't have this property
            visibility: channel.visibility ?? (channel.isPublic == true ? "public" : "private"),
            isPublic: channel.isPublic ?? false,
            subscriptionPrice: nil, // Channel doesn't have this property
            contentType: nil
        )
        channelToNavigate = discoverableChannel
        showingChannelDetail = true
    }
}

struct ChannelCard: View {
    let channel: Channel
    let isSelected: Bool
    let isUploading: Bool
    let isUploadComplete: Bool // True when upload just completed
    let isDisabled: Bool // Disable card during other uploads
    let onSelect: () -> Void
    let onStream: () -> Void
    let onGoToChannel: () -> Void // Navigate to channel after upload
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 16) {
                // Channel icon - Twilly themed
                ZStack {
                    Circle()
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
                        .frame(width: 50, height: 50)
                        .shadow(color: Color.twillyCyan.opacity(0.5), radius: 8, x: 0, y: 4)
                    
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(channel.name)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    HStack(spacing: 8) {
                        if channel.hasStreamKey {
                            Label("Ready", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.twillyCyan)
                        } else {
                            Label("Setup Required", systemImage: "exclamationmark.circle")
                                .font(.caption)
                                .foregroundColor(.twillyTeal.opacity(0.7))
                        }
                    }
                }
                
                Spacer()
                
                // Stream/Go to Channel button
                Button(action: {
                    if isUploadComplete {
                        onGoToChannel()
                    } else {
                        // Allow uploads even if one is in progress (non-blocking UX)
                        onStream()
                    }
                }) {
                    HStack(spacing: 6) {
                        if isUploading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                            Text("Uploading...")
                                .fontWeight(.semibold)
                        } else if isUploadComplete {
                            Image(systemName: "arrow.right.circle.fill")
                            Text("Go to Channel")
                                .fontWeight(.semibold)
                        } else {
                            Image(systemName: "record.circle.fill")
                            Text("Post")
                                .fontWeight(.semibold)
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: isUploading 
                                ? [Color.twillyTeal.opacity(0.7), Color.twillyCyan.opacity(0.5)]
                                : isUploadComplete
                                ? [Color.twillyTeal, Color.twillyCyan, Color.twillyTeal]
                                : [Color.twillyTeal, Color.twillyCyan]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(20)
                    .shadow(color: isUploadComplete ? Color.twillyCyan.opacity(0.5) : Color.twillyTeal.opacity(0.3), radius: 8, x: 0, y: 4)
                    .opacity(isUploading ? 0.7 : 1.0)
                }
                .buttonStyle(.plain)
                .disabled(isUploading)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.black.opacity(isSelected ? 0.4 : (isDisabled ? 0.2 : 0.3)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                isSelected ? LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal,
                                        Color.twillyCyan
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ) : LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal.opacity(0.2),
                                        Color.twillyCyan.opacity(0.1)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
            .shadow(color: isSelected ? Color.twillyCyan.opacity(0.3) : Color.clear, radius: 8, x: 0, y: 4)
            .opacity(isDisabled ? 0.5 : 1.0)
            .disabled(isDisabled)
        }
        .buttonStyle(.plain)
    }
}

