//
//  PostStreamMetadataView.swift
//  TwillyBroadcaster
//
//  View for adding metadata (title, description, price) after streaming stops
//  Matches managefiles.vue behavior - simple update after video is ready
//

import SwiftUI

struct PostStreamMetadataView: View {
    let streamKey: String
    let channelName: String?
    let channelId: String?
    let onComplete: () -> Void // Called after metadata is updated (or skipped)
    let onNavigateToChannel: (String?) -> Void // Called to navigate to channel
    
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var price: String = ""
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?
    @State private var isPollingForVideo: Bool = true // Poll for video readiness
    @State private var videoReady: Bool = false // Track when video is ready
    @State private var fileId: String? = nil // Store fileId when video is ready
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var channelService = ChannelService.shared
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Header - Twilly themed
                        VStack(spacing: 16) {
                            // Status indicator
                            if videoReady {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 60))
                                    .foregroundStyle(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal,
                                                Color.twillyCyan
                                            ]),
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .shadow(color: Color.twillyCyan.opacity(0.5), radius: 8)
                            } else {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                                    .scaleEffect(1.5)
                            }
                            
                            Text(videoReady ? "Stream Ready!" : "Processing Stream...")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundStyle(
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
                                .shadow(color: Color.twillyCyan.opacity(0.5), radius: 4, x: 0, y: 2)
                            
                            if !videoReady {
                                Text("Enter details below - they'll be saved when video is ready")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.7))
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }
                            
                            if let channelName = channelName {
                                Text("Add details for your video in \(channelName)")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.6))
                            } else {
                                Text("Add details for your video")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                        .padding(.top, 20)
                        
                        // Form
                        VStack(spacing: 20) {
                            // Title
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Title")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                TextField("Enter video title", text: $title)
                                    .padding(12)
                                    .background(Color.white.opacity(0.15))
                                    .cornerRadius(8)
                                    .foregroundColor(.white)
                                    .accentColor(.twillyTeal)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                    )
                            }
                            
                            // Description
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Description")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                ZStack(alignment: .topLeading) {
                                    if description.isEmpty {
                                        Text("Enter video description")
                                            .foregroundColor(.white.opacity(0.4))
                                            .padding(.horizontal, 4)
                                            .padding(.top, 8)
                                    }
                                    TextEditor(text: $description)
                                        .frame(height: 120)
                                        .padding(4)
                                        .background(Color.white.opacity(0.15))
                                        .cornerRadius(8)
                                        .foregroundColor(.white)
                                        .accentColor(.twillyTeal)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                        )
                                }
                            }
                            
                            // Price
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Price (optional)")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                TextField("0.00", text: $price)
                                    .padding(12)
                                    .background(Color.white.opacity(0.15))
                                    .cornerRadius(8)
                                    .keyboardType(.decimalPad)
                                    .foregroundColor(.white)
                                    .accentColor(.twillyTeal)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.horizontal, 24)
                        
                        // Error message
                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .foregroundColor(.red)
                                .font(.subheadline)
                                .padding(.horizontal, 24)
                        }
                        
                        // Submit button
                        Button(action: {
                            submitMetadata(shouldStripDefaults: false)
                        }) {
                            HStack {
                                if isSubmitting {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Post to Channel")
                                        .fontWeight(.semibold)
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(25)
                            .shadow(color: Color.twillyCyan.opacity(0.3), radius: 8, x: 0, y: 4)
                            .disabled(isSubmitting || !videoReady)
                            .opacity((isSubmitting || !videoReady) ? 0.6 : 1.0)
                        }
                        .padding(.horizontal, 24)
                        
                        // Skip button
                        Button(action: {
                            submitMetadata(shouldStripDefaults: true) // Strip defaults when skipping
                        }) {
                            Text("Skip (Post Without Details)")
                                .foregroundColor(.white.opacity(0.6))
                                .font(.subheadline)
                        }
                        .padding(.bottom, 40)
                        .disabled(isSubmitting || !videoReady)
                        .opacity((isSubmitting || !videoReady) ? 0.5 : 1.0)
                    }
                }
            }
            .navigationTitle("Add Video Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        // Cancel - strip defaults and navigate to channel
                        Task {
                            await stripDefaultsAndComplete()
                        }
                    }
                    .foregroundColor(.white.opacity(0.7))
                }
            }
            .onAppear {
                // Start polling for video readiness in background
                startPollingForVideo()
            }
        }
    }
    
    // Poll for video readiness in background (same as managefiles.vue - simple wait for ready)
    private func startPollingForVideo() {
        guard let userEmail = authService.userEmail else {
            return
        }
        
        Task {
            var pollCount = 0
            let maxPollAttempts = 60 // Poll for up to 60 seconds
            let pollInterval: TimeInterval = 1.0 // Poll every 1 second
            
            while isPollingForVideo && pollCount < maxPollAttempts {
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
                pollCount += 1
                
                do {
                    // Check if file exists for this streamKey
                    let (fileExists, foundFileId) = try await checkStreamFileExists(userEmail: userEmail, streamKey: streamKey)
                    
                    if fileExists, let foundFileId = foundFileId {
                        await MainActor.run {
                            print("✅ [PostStreamMetadataView] Video is ready! fileId: \(foundFileId)")
                            fileId = foundFileId
                            videoReady = true
                            isPollingForVideo = false
                        }
                        break
                    } else {
                        print("⏳ [PostStreamMetadataView] Video not ready yet (attempt \(pollCount)/\(maxPollAttempts))")
                    }
                } catch {
                    print("⚠️ [PostStreamMetadataView] Error checking video readiness: \(error.localizedDescription)")
                }
            }
            
            if pollCount >= maxPollAttempts {
                await MainActor.run {
                    print("⚠️ [PostStreamMetadataView] Polling timeout - video may not be ready yet")
                    isPollingForVideo = false
                }
            }
        }
    }
    
    // Check if stream file exists (same logic as StreamProcessingView)
    private func checkStreamFileExists(userEmail: String, streamKey: String) async throws -> (Bool, String?) {
        guard let url = URL(string: "https://twilly.app/api/files/check-stream-file") else {
            throw URLError(.badURL)
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
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode != 200 {
            print("⚠️ [PostStreamMetadataView] Non-200 status: \(httpResponse.statusCode)")
            return (false, nil)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let exists = json["exists"] as? Bool ?? false
            let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
            let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
            let isVisible = json["isVisible"] as? Bool ?? false
            let fileId = json["fileId"] as? String
            
            print("🔍 [PostStreamMetadataView] Response: exists=\(exists), hasHlsUrl=\(hasHlsUrl), hasThumbnail=\(hasThumbnail), isVisible=\(isVisible), fileId=\(fileId ?? "nil")")
            
            // Video is ready when it exists, has HLS URL, has thumbnail, and is visible
            if exists && hasHlsUrl && hasThumbnail && isVisible {
                return (true, fileId)
            }
        }
        
        return (false, nil)
    }
    
    // Submit metadata - same simple update as managefiles.vue
    private func submitMetadata(shouldStripDefaults: Bool) {
        guard let userEmail = authService.userEmail else {
            errorMessage = "Please sign in to post"
            return
        }
        
        guard let fileId = fileId else {
            errorMessage = "Video not ready yet. Please wait..."
            return
        }
        
        isSubmitting = true
        errorMessage = nil
        
        Task {
            do {
                // Parse price
                let priceValue: Double? = {
                    if shouldStripDefaults {
                        return nil
                    }
                    let trimmed = price.trimmingCharacters(in: .whitespacesAndNewlines)
                    if trimmed.isEmpty {
                        return nil
                    }
                    return Double(trimmed)
                }()
                
                let titleValue: String? = shouldStripDefaults ? nil : (title.isEmpty ? nil : title)
                let descriptionValue: String? = shouldStripDefaults ? nil : (description.isEmpty ? nil : description)
                
                // Simple update - same as managefiles.vue (no streamKey, just fileId and PK)
                print("📝 [PostStreamMetadataView] Updating metadata using fileId: \(fileId) (same as managefiles.vue)")
                let _ = try await channelService.updateVideoDetails(
                    PK: "USER#\(userEmail)",
                    fileId: fileId, // Full SK format (FILE#file-123) from check-stream-file
                    streamKey: nil, // Don't pass streamKey - single file update only (same as managefiles.vue)
                    title: titleValue,
                    description: descriptionValue,
                    price: priceValue
                )
                
                // Navigate after metadata update
                await MainActor.run {
                    isSubmitting = false
                    dismiss()
                    onComplete()
                    onNavigateToChannel(channelName)
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = "Failed to update video: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func stripDefaultsAndComplete() async {
        guard let userEmail = authService.userEmail else {
            await MainActor.run {
                dismiss()
                onComplete()
                onNavigateToChannel(channelName)
            }
            return
        }
        
        guard let fileId = fileId else {
            // If video not ready, just navigate (no update)
            await MainActor.run {
                dismiss()
                onComplete()
                onNavigateToChannel(channelName)
            }
            return
        }
        
        do {
            // Strip defaults - same simple update as managefiles.vue
            print("📝 [PostStreamMetadataView] Stripping defaults using fileId: \(fileId) (same as managefiles.vue)")
            let _ = try await channelService.updateVideoDetails(
                PK: "USER#\(userEmail)",
                fileId: fileId,
                streamKey: nil,
                title: nil,
                description: nil,
                price: nil
            )
            
            // Navigate after update
            await MainActor.run {
                dismiss()
                onComplete()
                onNavigateToChannel(channelName)
            }
        } catch {
            print("⚠️ [PostStreamMetadataView] Error stripping defaults: \(error.localizedDescription)")
            // Navigate anyway even if update fails
            await MainActor.run {
                dismiss()
                onComplete()
                onNavigateToChannel(channelName)
            }
        }
    }
}