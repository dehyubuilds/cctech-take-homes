//
//  SimpleMyChannelsView.swift
//  TwillyBroadcaster
//
//  Simplified My Channels view - only shows videos with watch/hide/delete actions
//

import SwiftUI

struct SimpleMyChannelsView: View {
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var channelService = ChannelService.shared
    
    @State private var channels: [Channel] = []
    @State private var files: [VideoFileItem] = []
    @State private var selectedChannelName: String = "default"
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    // File management states
    @State private var streamToDelete: VideoFileItem?
    @State private var showingDeleteConfirmation = false
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    
    private var filteredFiles: [VideoFileItem] {
        files.filter { file in
            // Exclude .mp4 and .gif files
            let fileNameLower = file.fileName.lowercased()
            if fileNameLower.hasSuffix(".mp4") || fileNameLower.hasSuffix(".gif") {
                return false
            }
            
            // Only show files with HLS URL (.m3u8) - these are processed stream files
            guard let hlsUrl = file.hlsUrl, !hlsUrl.isEmpty, hlsUrl.contains(".m3u8") else {
                return false
            }
            
            // Filter by channel
            if selectedChannelName == "default" {
                return file.folderName == nil || file.folderName == "default" || file.folderName?.lowercased() == "mixed"
            }
            return file.folderName == selectedChannelName
        }
        .sorted { file1, file2 in
            // Sort by creation date (newest first)
            let date1 = file1.createdAt ?? ""
            let date2 = file2.createdAt ?? ""
            return date1 > date2
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                            .scaleEffect(1.5)
                        Text("Loading videos...")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                } else if filteredFiles.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "video.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.gray.opacity(0.5))
                        Text("No Videos")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        Text("You haven't streamed to \(selectedChannelName == "default" ? "any channel" : selectedChannelName) yet.")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            // Channel Selector
                            channelSelector
                            
                            // Videos Grid
                            LazyVGrid(columns: [
                                GridItem(.flexible(), spacing: 12),
                                GridItem(.flexible(), spacing: 12)
                            ], spacing: 12) {
                                ForEach(filteredFiles) { file in
                                    VideoCard(
                                        file: file,
                                        onWatch: {
                                            // TODO: Open video player
                                        },
                                        onToggleVisibility: {
                                            toggleVisibility(file: file)
                                        },
                                        onDelete: {
                                            streamToDelete = file
                                            showingDeleteConfirmation = true
                                        }
                                    )
                                }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle(selectedChannelName == "default" ? "My Content" : selectedChannelName)
            .navigationBarTitleDisplayMode(.inline)
            .alert("Delete Video", isPresented: $showingDeleteConfirmation, presenting: streamToDelete) { file in
                Button("Delete", role: .destructive) {
                    deleteVideo(file: file)
                }
                Button("Cancel", role: .cancel) {
                    streamToDelete = nil
                }
            } message: { file in
                Text("Are you sure you want to delete \"\(file.fileName)\"? This action cannot be undone.")
            }
        }
        .onAppear {
            loadData()
        }
    }
    
    // MARK: - Channel Selector
    private var channelSelector: some View {
        Picker("Channel", selection: $selectedChannelName) {
            Text("All Channels").tag("default")
            ForEach(channels, id: \.id) { channel in
                Text(channel.name).tag(channel.name)
            }
        }
        .pickerStyle(.menu)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.1))
        .cornerRadius(10)
    }
    
    // MARK: - Helper Functions
    private func loadData() {
        Task {
            await loadChannelsAndFiles()
        }
    }
    
    private func loadChannelsAndFiles() async {
        guard !userEmail.isEmpty else { return }
        
        await MainActor.run {
            isLoading = true
        }
        
        // Fetch channels and files in parallel
        async let channelsTask = loadChannels()
        async let filesTask = loadFiles()
        
        do {
            _ = try await channelsTask
            _ = try await filesTask
            await MainActor.run {
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = "Failed to load data: \(error.localizedDescription)"
            }
        }
    }
    
    private func loadChannels() async throws {
        let fetchedChannels = try await channelService.fetchChannels(userEmail: userEmail, forceRefresh: false)
        await MainActor.run {
            channels = fetchedChannels
        }
        
        // Refresh in background
        Task.detached { [weak channelService] in
            if let freshChannels = try? await channelService?.fetchChannels(userEmail: userEmail, forceRefresh: true) {
                await MainActor.run {
                    if !freshChannels.isEmpty {
                        channels = freshChannels
                    }
                }
            }
        }
    }
    
    private func loadFiles() async throws {
        guard let url = URL(string: "https://twilly.app/api/files/\(userEmail)") else {
            throw URLError(.badURL)
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // Parse files
            if let listings = json["listings"] as? [[String: Any]] {
                var parsedFiles: [VideoFileItem] = []
                for fileData in listings {
                    guard let SK = fileData["SK"] as? String,
                          let fileName = fileData["fileName"] as? String else {
                        continue
                    }
                    parsedFiles.append(VideoFileItem(
                        id: SK,
                        fileName: fileName,
                        folderName: fileData["folderName"] as? String,
                        category: fileData["category"] as? String,
                        isVisible: fileData["isVisible"] as? Bool ?? false,
                        price: fileData["price"] as? Double,
                        hlsUrl: fileData["hlsUrl"] as? String,
                        thumbnailUrl: fileData["thumbnailUrl"] as? String,
                        streamKey: fileData["streamKey"] as? String,
                        createdAt: fileData["createdAt"] as? String ?? fileData["timestamp"] as? String,
                        fileId: SK
                    ))
                }
                await MainActor.run {
                    files = parsedFiles
                }
            }
        }
    }
    
    private func toggleVisibility(file: VideoFileItem) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let newVisibility = !file.isVisible
                try await ChannelService.shared.updateContentVisibility(
                    fileId: file.fileId,
                    pk: "USER#\(userEmail)",
                    isVisible: newVisibility
                )
                
                await MainActor.run {
                    if let index = files.firstIndex(where: { $0.id == file.id }) {
                        files[index].isVisible = newVisibility
                    }
                }
            } catch {
                print("⚠️ [SimpleMyChannelsView] Error toggling visibility: \(error.localizedDescription)")
            }
        }
    }
    
    private func deleteVideo(file: VideoFileItem) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                guard let url = URL(string: "https://twilly.app/api/files/delete") else {
                    throw URLError(.badURL)
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "userId": userEmail,
                    "fileId": file.fileId,
                    "fileName": file.fileName,
                    "folderName": file.folderName ?? "default"
                ]
                
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200 else {
                    throw URLError(.badServerResponse)
                }
                
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success {
                    await MainActor.run {
                        files.removeAll { $0.id == file.id }
                        streamToDelete = nil
                    }
                } else {
                    throw URLError(.badServerResponse)
                }
            } catch {
                print("⚠️ [SimpleMyChannelsView] Error deleting video: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - Video Card
struct VideoCard: View {
    let file: VideoFileItem
    let onWatch: () -> Void
    let onToggleVisibility: () -> Void
    let onDelete: () -> Void
    
    private let cloudFrontBaseUrl = "https://d3hv50jkrzkiyh.cloudfront.net"
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Thumbnail
            thumbnailView
                .frame(height: 180)
                .clipped()
            
            // Video info and actions
            VStack(alignment: .leading, spacing: 8) {
                Text(file.fileName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .lineLimit(2)
                
                HStack(spacing: 12) {
                    // Watch button
                    Button(action: onWatch) {
                        HStack(spacing: 4) {
                            Image(systemName: "play.fill")
                                .font(.caption)
                            Text("Watch")
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(8)
                    }
                    
                    Spacer()
                    
                    // Hide/Show button
                    Button(action: onToggleVisibility) {
                        Image(systemName: file.isVisible ? "eye.fill" : "eye.slash.fill")
                            .font(.caption)
                            .foregroundColor(file.isVisible ? .twillyTeal : .gray)
                            .padding(6)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(6)
                    }
                    
                    // Delete button
                    Button(action: onDelete) {
                        Image(systemName: "trash.fill")
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(6)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(6)
                    }
                }
            }
            .padding(12)
        }
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
    
    private var thumbnailView: some View {
        Group {
            if let thumbnailUrl = getVideoThumbnailUrl(), let url = URL(string: thumbnailUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .empty:
                        placeholderView(showProgress: true)
                    case .failure(_):
                        placeholderView(showProgress: false)
                    @unknown default:
                        Color.black
                    }
                }
            } else {
                placeholderView(showProgress: false)
            }
        }
    }
    
    private func placeholderView(showProgress: Bool) -> some View {
        ZStack {
            Color.black
            if showProgress {
                ProgressView()
                    .tint(.white)
            } else {
                Image(systemName: "play.rectangle.fill")
                    .font(.system(size: 30))
                    .foregroundColor(.gray.opacity(0.5))
            }
        }
    }
    
    private func getVideoThumbnailUrl() -> String? {
        if let thumbnailUrl = file.thumbnailUrl {
            return thumbnailUrl.replacingOccurrences(of: "s3.amazonaws.com", with: "d3hv50jkrzkiyh.cloudfront.net")
        }
        
        if let streamKey = file.streamKey, !streamKey.isEmpty {
            return "\(cloudFrontBaseUrl)/clips/\(streamKey)/\(streamKey)_thumb.jpg"
        }
        
        if let hlsUrl = file.hlsUrl, hlsUrl.contains("/clips/") {
            let components = hlsUrl.components(separatedBy: "/clips/")
            if components.count > 1 {
                let afterClips = components[1]
                let streamKey = afterClips.components(separatedBy: "/").first ?? ""
                if !streamKey.isEmpty {
                    return "\(cloudFrontBaseUrl)/clips/\(streamKey)/\(streamKey)_thumb.jpg"
                }
            }
        }
        
        return nil
    }
}

// MARK: - Supporting Types
struct VideoFileItem: Identifiable {
    let id: String
    let fileName: String
    let folderName: String?
    let category: String?
    var isVisible: Bool // Changed to var to allow modification
    let price: Double?
    let hlsUrl: String?
    let thumbnailUrl: String?
    let streamKey: String?
    let createdAt: String?
    let fileId: String
}
