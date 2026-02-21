//
//  SimpleChannelPickerView.swift
//  TwillyBroadcaster
//
//  Simple channel picker that immediately posts when a channel is selected
//

import SwiftUI

struct SimpleChannelPickerView: View {
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject var streamManager: StreamManager
    @Environment(\.dismiss) var dismiss
    
    let recordedVideoURL: URL
    let videoTitle: String
    let videoDescription: String
    let videoPrice: String
    
    @State private var channels: [Channel] = []
    @State private var filteredChannels: [Channel] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isUploading = false
    @State private var uploadingChannelName: String? = nil
    @State private var uploadProgress: Double = 0.0
    @State private var waitingForThumbnail: Bool = false
    // Removed countdownSeconds - now tracking actual progress
    @ObservedObject private var authService = AuthService.shared
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    @State private var searchQuery: String = ""
    
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
                
                if isLoading {
                    VStack(spacing: 20) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                            .scaleEffect(1.8)
                        Text("Loading channels...")
                            .foregroundColor(.white)
                            .font(.headline)
                    }
                } else if let error = errorMessage {
                    VStack(spacing: 20) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 50))
                            .foregroundColor(.twillyTeal)
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
                            .foregroundColor(.twillyTeal.opacity(0.7))
                        Text(searchQuery.isEmpty ? "No Channels Available" : "No Channels Found")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        Text(searchQuery.isEmpty 
                             ? "Generate a stream key for a public channel to post to it"
                             : "Try adjusting your search terms")
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                } else {
                    VStack(spacing: 0) {
                        // Search bar
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.twillyCyan)
                            TextField("Search channels...", text: $searchQuery)
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
                                    Button(action: {
                                        postToChannel(channel)
                                    }) {
                                        HStack(spacing: 16) {
                                            // Channel icon
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
                                                
                                                Image(systemName: "play.circle.fill")
                                                    .font(.system(size: 24))
                                                    .foregroundColor(.white)
                                            }
                                            
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(channel.name)
                                                    .font(.headline)
                                                    .foregroundColor(.white)
                                                
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
                                            
                                            Spacer()
                                            
                                            if isUploading && uploadingChannelName == channel.name {
                                                ProgressCircleView(progress: 1.0)
                                                    .frame(width: 24, height: 24)
                                            } else {
                                                Image(systemName: "arrow.right")
                                                    .foregroundColor(.twillyCyan)
                                            }
                                        }
                                        .padding(16)
                                        .background(
                                            RoundedRectangle(cornerRadius: 16)
                                                .fill(Color.black.opacity(0.3))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 16)
                                                        .stroke(
                                                            LinearGradient(
                                                                gradient: Gradient(colors: [
                                                                    Color.twillyTeal.opacity(0.2),
                                                                    Color.twillyCyan.opacity(0.1)
                                                                ]),
                                                                startPoint: .topLeading,
                                                                endPoint: .bottomTrailing
                                                            ),
                                                            lineWidth: 1
                                                        )
                                                )
                                        )
                                        .opacity((isUploading && uploadingChannelName != channel.name) ? 0.5 : 1.0)
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(isUploading && uploadingChannelName != channel.name)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                        }
                    }
                }
                
                // Full-screen progress overlay when uploading
                if isUploading {
                    ZStack {
                        // Gradient background with Twilly aesthetic
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.black.opacity(0.95),
                                Color.twillyTeal.opacity(0.1)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .ignoresSafeArea()
                        
                        VStack(spacing: 32) {
                            // Progress circle with Twilly colors
                            ZStack {
                                // Outer glow effect
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyCyan.opacity(0.3),
                                                Color.twillyTeal.opacity(0.1)
                                            ]),
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 100, height: 100)
                                    .blur(radius: 20)
                                
                                ProgressCircleView(progress: uploadProgress)
                                    .frame(width: 80, height: 80)
                            }
                            
                            VStack(spacing: 12) {
                                // Show message based on progress state
                                if uploadProgress >= 1.0 {
                                    // Upload complete - show success message
                                    VStack(spacing: 8) {
                                        Text("Upload complete!")
                                            .font(.system(size: 24, weight: .semibold, design: .rounded))
                                            .foregroundStyle(
                                                LinearGradient(
                                                    gradient: Gradient(colors: [
                                                        Color.twillyCyan,
                                                        Color.twillyTeal
                                                    ]),
                                                    startPoint: .leading,
                                                    endPoint: .trailing
                                                )
                                            )
                                        
                                        // Subtle checkmark or success indicator
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.system(size: 32))
                                            .foregroundStyle(
                                                LinearGradient(
                                                    gradient: Gradient(colors: [
                                                        Color.twillyCyan,
                                                        Color.twillyTeal
                                                    ]),
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                )
                                            )
                                            .shadow(color: Color.twillyCyan.opacity(0.5), radius: 8)
                                    }
                                } else if uploadProgress < 0.5 {
                                    // Uploading phase (0-50%)
                                    Text("Uploading to \(uploadingChannelName ?? "channel")...")
                                        .font(.system(size: 18, weight: .medium, design: .rounded))
                                        .foregroundColor(.white.opacity(0.9))
                                } else if uploadProgress < 0.75 {
                                    // Processing thumbnail phase (50-75%)
                                    Text("Processing thumbnail...")
                                        .font(.system(size: 18, weight: .medium, design: .rounded))
                                        .foregroundColor(.white.opacity(0.9))
                                } else {
                                    // Processing HLS phase (75-100%)
                                    Text("Processing video...")
                                        .font(.system(size: 18, weight: .medium, design: .rounded))
                                        .foregroundColor(.white.opacity(0.9))
                                }
                            }
                        }
                    }
                    .transition(.opacity)
                }
            }
            .navigationTitle("Select Channel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .disabled(isUploading)
                }
            }
            .onAppear {
                loadChannels()
            }
        }
    }
    
    private func filterChannels() {
        if searchQuery.isEmpty {
            filteredChannels = channels.filter { channel in
                let visibilityCheck = channel.visibility == "public"
                let isPublicCheck = channel.isPublic == true
                let isPublic = visibilityCheck || isPublicCheck
                let hasStreamKey = channel.hasStreamKey
                return isPublic && hasStreamKey
            }
        } else {
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
        let email = userEmail
        
        Task {
            do {
                let cachedChannels = try await channelService.fetchChannels(userEmail: email, forceRefresh: false)
                await MainActor.run {
                    channels = cachedChannels
                    filterChannels()
                    isLoading = false
                }
                
                // Refresh in background
                let freshChannels = try await channelService.fetchChannels(userEmail: email, forceRefresh: true)
                await MainActor.run {
                    if freshChannels.count > 0 {
                        channels = freshChannels
                        filterChannels()
                    }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    if channels.isEmpty {
                        errorMessage = error.localizedDescription
                    }
                    isLoading = false
                }
            }
        }
    }
    
    private func postToChannel(_ channel: Channel) {
        guard !isUploading else { 
            print("⚠️ [SimpleChannelPickerView] Upload already in progress, ignoring")
            return 
        }
        
        print("🚀 [SimpleChannelPickerView] postToChannel called for: \(channel.name)")
        print("🚀 [SimpleChannelPickerView] recordedVideoURL: \(recordedVideoURL.path)")
        
        // Prepare local video info
        let localVideoURL = streamManager.recordedVideoURL
        
        // Show progress overlay and animate circle
        isUploading = true
        uploadingChannelName = channel.name
        uploadProgress = 0.0
        
        print("🚀 [SimpleChannelPickerView] Showing progress overlay...")
        
        // Prepare upload parameters
        let email = userEmail
        let trimmedTitle = videoTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = videoDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPrice = videoPrice.trimmingCharacters(in: .whitespacesAndNewlines)
        
        let finalTitle = trimmedTitle.isEmpty ? nil : trimmedTitle
        let finalDescription = trimmedDescription.isEmpty ? nil : trimmedDescription
        let finalPrice = trimmedPrice.isEmpty ? nil : Double(trimmedPrice)
        
        // Start upload in background and poll for thumbnail
        // When thumbnail is ready (local video is already ready) → complete spinner and navigate
        Task { @MainActor in
            // Prevent screen from sleeping during upload
            UIApplication.shared.isIdleTimerDisabled = true
            print("🔋 [SimpleChannelPickerView] Disabled idle timer to prevent screen sleep during upload")
            
            // Generate uploadId BEFORE starting upload task (so we can use it in polling)
            let uniqueUploadId = UUID().uuidString
            print("🚀 [SimpleChannelPickerView] Generated uploadId: \(uniqueUploadId)")
            
            // Track overall progress phases:
            // 0-50%: Uploading file
            // 50-75%: Processing thumbnail
            // 75-100%: Processing HLS
            let overallStartTime = Date()
            uploadProgress = 0.0
            
            // Start upload task and track progress
            let uploadTask = Task.detached(priority: .userInitiated) {
                do {
                    let streamKey: String
                    
                    print("🚀 [SimpleChannelPickerView] Getting stream key...")
                    // Get or generate stream key for the channel
                    if let existingKey = channel.streamKey, channel.hasStreamKey {
                        streamKey = existingKey
                        print("🚀 [SimpleChannelPickerView] Using existing stream key: \(streamKey)")
                    } else {
                        print("🚀 [SimpleChannelPickerView] Generating new stream key...")
                        streamKey = try await channelService.getOrGenerateStreamKey(
                            userEmail: email,
                            channelName: channel.name
                        )
                        print("🚀 [SimpleChannelPickerView] Generated stream key: \(streamKey)")
                    }
                    
                    print("🚀 [SimpleChannelPickerView] Using uploadId: \(uniqueUploadId)")
                    
                    // Update progress: 0-50% during upload
                    await MainActor.run {
                        uploadProgress = 0.1 // Start at 10%
                    }
                    
                    print("🚀 [SimpleChannelPickerView] Starting upload...")
                    let uploadStartTime = Date()
                    let uploadResponse = try await channelService.uploadVideoFile(
                        fileURL: recordedVideoURL,
                        channelName: channel.name,
                        userEmail: email,
                        streamKey: streamKey,
                        uploadId: uniqueUploadId,
                        title: finalTitle,
                        description: finalDescription,
                        price: finalPrice
                    )
                    
                    let uploadDuration = Date().timeIntervalSince(uploadStartTime)
                    print("✅ [SimpleChannelPickerView] Upload successful! Took \(String(format: "%.1f", uploadDuration)) seconds")
                    
                    // Upload complete - progress to 50%
                    await MainActor.run {
                        uploadProgress = 0.5
                    }
                    
                    return (uploadResponse, uniqueUploadId)
                } catch {
                    print("❌ [SimpleChannelPickerView] Upload error: \(error.localizedDescription)")
                    throw error
                }
            }
            
            // Wait for upload to complete first
            do {
                // Wait for upload task to complete
                let (uploadResponse, _) = try await uploadTask.value
                print("✅ [SimpleChannelPickerView] Upload task completed")
                
                // Give server a moment to start processing (2 seconds)
                print("⏳ [SimpleChannelPickerView] Waiting 2 seconds for server to start processing...")
                try await Task.sleep(nanoseconds: 2_000_000_000)
                
                // Now poll for video to be ready (thumbnail + HLS)
                // Progress: 50-75% while waiting for thumbnail, 75-100% while waiting for HLS
                var videoReady = false
                var attempts = 0
                let maxAttempts = 90 // Poll for up to 90 seconds total
                
                print("🔍 [SimpleChannelPickerView] Starting to poll for video to be ready (thumbnail + HLS)...")
                waitingForThumbnail = true
                
                while attempts < maxAttempts && !videoReady && !Task.isCancelled {
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                    attempts += 1
                    
                    // Update progress: 50% + (attempts/maxAttempts * 50%) = 50-100%
                    let progressIncrement = Double(attempts) / Double(maxAttempts) * 0.5 // 0 to 0.5
                    await MainActor.run {
                        uploadProgress = min(0.5 + progressIncrement, 0.99) // 50% to 99%
                    }
                    
                    print("🔍 [SimpleChannelPickerView] Polling attempt \(attempts)/\(maxAttempts) - checking for video...")
                    
                    do {
                        let result = try await channelService.fetchChannelContent(
                            channelName: channel.name,
                            creatorEmail: email,
                            limit: 10,
                            nextToken: nil
                        )
                        
                        // Look for our video with BOTH hlsUrl AND thumbnailUrl
                        if let video = result.content.first(where: { item in
                            // Match by uploadId first
                            let uploadIdMatch = item.uploadId == uniqueUploadId || item.fileId == "file-\(uniqueUploadId)"
                            
                            // Fallback: match by title/description/price
                            let titleMatch = (finalTitle == nil && item.title == nil) || item.title == finalTitle
                            let descMatch = (finalDescription == nil && item.description == nil) || item.description == finalDescription
                            let priceMatch = (finalPrice == nil && item.price == nil) || item.price == finalPrice
                            let fallbackMatch = titleMatch && descMatch && priceMatch
                            
                            let isMatch = uploadIdMatch || fallbackMatch
                            let hasHLS = item.hlsUrl != nil && !item.hlsUrl!.isEmpty
                            let hasThumbnail = item.thumbnailUrl != nil && !item.thumbnailUrl!.isEmpty
                            
                            return isMatch && hasHLS && hasThumbnail
                        }) {
                            print("✅ [SimpleChannelPickerView] Video ready with 1080p + thumbnail after \(attempts) seconds!")
                            videoReady = true
                            
                            // Progress to 100%
                            await MainActor.run {
                                uploadProgress = 1.0
                                waitingForThumbnail = false
                            }
                        } else {
                            // Update progress message based on what we're waiting for
                            // Check if we have thumbnail but not HLS yet
                            if let partialVideo = result.content.first(where: { item in
                                let uploadIdMatch = item.uploadId == uniqueUploadId || item.fileId == "file-\(uniqueUploadId)"
                                let titleMatch = (finalTitle == nil && item.title == nil) || item.title == finalTitle
                                let descMatch = (finalDescription == nil && item.description == nil) || item.description == finalDescription
                                let priceMatch = (finalPrice == nil && item.price == nil) || item.price == finalPrice
                                let fallbackMatch = titleMatch && descMatch && priceMatch
                                return uploadIdMatch || fallbackMatch
                            }) {
                                let hasThumbnail = partialVideo.thumbnailUrl != nil && !partialVideo.thumbnailUrl!.isEmpty
                                let hasHLS = partialVideo.hlsUrl != nil && !partialVideo.hlsUrl!.isEmpty
                                
                                if hasThumbnail && !hasHLS {
                                    print("⏳ [SimpleChannelPickerView] Thumbnail ready, waiting for HLS...")
                                } else if !hasThumbnail {
                                    print("⏳ [SimpleChannelPickerView] Waiting for thumbnail...")
                                }
                            } else {
                                print("⏳ [SimpleChannelPickerView] Video not found yet (attempt \(attempts))")
                            }
                        }
                    } catch {
                        print("❌ [SimpleChannelPickerView] Error fetching channel content: \(error.localizedDescription)")
                        // Continue polling on error
                    }
                }
                
                // Show "Upload complete!" for 1.5 seconds, then navigate
                print("✅ [SimpleChannelPickerView] Upload complete! Showing success message for 1.5 seconds...")
                try? await Task.sleep(nanoseconds: 1_500_000_000) // Show success message for 1.5 seconds
                
                // Post notification - video is ready on server
                var userInfo: [String: Any] = ["channelName": channel.name]
                NotificationCenter.default.post(
                    name: NSNotification.Name("UploadComplete"),
                    object: nil,
                    userInfo: userInfo
                )
                
                // Don't delete local file yet - channel page needs it until HLS is ready
                // It will be deleted when HLS processing completes in ChannelDetailView
                
                // Dismiss and navigate
                isUploading = false
                uploadingChannelName = nil
                uploadProgress = 0.0
                waitingForThumbnail = false
                dismiss()
                
                // Re-enable idle timer
                UIApplication.shared.isIdleTimerDisabled = false
                
            } catch {
                print("❌ [SimpleChannelPickerView] Error during upload/thumbnail polling: \(error.localizedDescription)")
                isUploading = false
                uploadingChannelName = nil
                uploadProgress = 0.0
                waitingForThumbnail = false
                UIApplication.shared.isIdleTimerDisabled = false
                
                // Don't delete file on error - user might want to retry
                print("⚠️ [SimpleChannelPickerView] Keeping local file due to error")
            }
        }
    }
    
}

// Custom progress circle that animates completion
struct ProgressCircleView: View {
    let progress: Double // Current progress (0.0 to 1.0)
    @State private var displayProgress: Double = 0
    
    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(Color.white.opacity(0.2), lineWidth: 3)
            
            // Animated progress circle
            Circle()
                .trim(from: 0, to: displayProgress)
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.twillyTeal,
                            Color.twillyCyan
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .rotationEffect(.degrees(-90)) // Start from top
                .animation(.linear(duration: 0.1), value: displayProgress)
        }
        .onChange(of: progress) { newValue in
            displayProgress = newValue
        }
        .onAppear {
            displayProgress = progress
        }
    }
}

