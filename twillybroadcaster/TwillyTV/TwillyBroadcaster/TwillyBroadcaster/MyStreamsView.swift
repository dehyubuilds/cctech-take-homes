//
//  MyStreamsView.swift
//  TwillyBroadcaster
//
//  View showing all user's streams with processing indicators
//  Allows editing details and toggling visibility when ready
//

import SwiftUI

struct StreamItem: Identifiable {
    let id: String
    let fileId: String // Full SK (FILE#file-123)
    let streamKey: String
    let channelName: String
    let fileName: String
    var title: String?
    var description: String?
    var price: Double?
    let createdAt: String?
    var isProcessing: Bool // Processing status
    var isReady: Bool // Has HLS URL and thumbnail
    var isVisible: Bool // Visibility status
    var hasHlsUrl: Bool
    var hasThumbnail: Bool
}

struct MyStreamsView: View {
    let channelName: String? // Filter by channel name
    let expectedStreamKey: String? // Stream key we're waiting for (may not exist in DB yet)
    
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var channelService = ChannelService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var streams: [StreamItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var editingStream: StreamItem?
    @State private var showingEditModal = false
    @State private var pollTasks: [String: Task<Void, Never>] = [:] // Track polling tasks per streamKey
    @State private var navigateToChannelName: String?
    @State private var showingDiscovery = false
    @State private var isWaitingForStream = false // Waiting for stream to appear in DB
    @State private var selectedChannelFilter: String? // Currently selected channel filter
    @State private var streamToDelete: StreamItem? // Stream to delete
    @State private var showingDeleteConfirmation = false // Show delete confirmation
    
    // Get unique channel names from all streams
    private var availableChannels: [String] {
        let channels = Set(streams.map { $0.channelName })
        return Array(channels).sorted()
    }
    
    // Computed property to filter streams by selected channel
    private var filteredStreams: [StreamItem] {
        let channelFilter = selectedChannelFilter ?? channelName
        return streams.filter { stream in
            if let channelFilter = channelFilter {
                return stream.channelName == channelFilter
            }
            return true // Show all if no filter
        }.sorted { stream1, stream2 in
            // Sort: processing streams first, then by createdAt (newest first)
            if stream1.isProcessing && !stream2.isProcessing {
                return true // stream1 is processing, stream2 is not
            }
            if !stream1.isProcessing && stream2.isProcessing {
                return false // stream2 is processing, stream1 is not
            }
            // Both have same processing status, sort by date (newest first)
            let date1 = stream1.createdAt ?? ""
            let date2 = stream2.createdAt ?? ""
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
                
                if isLoading || isWaitingForStream {
                    VStack(spacing: 16) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                            .scaleEffect(1.5)
                        if isWaitingForStream {
                            Text("Waiting for stream...")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                                .padding(.top, 8)
                        }
                    }
                } else {
                    VStack(spacing: 0) {
                        // Channel filter picker
                        if availableChannels.count > 1 {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    // "All" option
                                    ChannelFilterButton(
                                        title: "All",
                                        isSelected: selectedChannelFilter == nil && channelName == nil,
                                        action: {
                                            selectedChannelFilter = nil
                                        }
                                    )
                                    
                                    // Channel options
                                    ForEach(availableChannels, id: \.self) { channel in
                                        ChannelFilterButton(
                                            title: channel,
                                            isSelected: selectedChannelFilter == channel || (selectedChannelFilter == nil && channelName == channel),
                                            action: {
                                                selectedChannelFilter = channel
                                            }
                                        )
                                    }
                                }
                                .padding(.horizontal)
                            }
                            .padding(.vertical, 12)
                            .background(Color.black.opacity(0.3))
                        }
                        
                        // Streams list
                        if filteredStreams.isEmpty {
                            VStack(spacing: 16) {
                                Image(systemName: "video.slash")
                                    .font(.system(size: 60))
                                    .foregroundColor(.gray.opacity(0.5))
                                Text("No Streams")
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                if let filter = selectedChannelFilter ?? channelName {
                                    Text("No streams found for \(filter)")
                                        .font(.subheadline)
                                        .foregroundColor(.gray)
                                } else {
                                    Text("Start streaming to see your streams here")
                                        .font(.subheadline)
                                        .foregroundColor(.gray)
                                }
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            ScrollView {
                                LazyVStack(spacing: 16) {
                                    ForEach(filteredStreams) { stream in
                                        StreamCard(
                                            stream: stream,
                                            onToggleVisibility: {
                                                if stream.isVisible {
                                                    // If visible, open edit modal
                                                    editingStream = stream
                                                    showingEditModal = true
                                                } else {
                                                    // If not visible, make it visible
                                                    toggleVisibility(stream: stream)
                                                }
                                            },
                                            onDelete: {
                                                streamToDelete = stream
                                                showingDeleteConfirmation = true
                                            },
                                            onPostWithoutDetails: {
                                                // Make visible without editing details
                                                toggleVisibility(stream: stream)
                                            },
                                            onEditDetails: {
                                                editingStream = stream
                                                showingEditModal = true
                                            }
                                        )
                                    }
                                }
                                .padding()
                            }
                        }
                    }
                }
            }
            .navigationTitle("My Streams")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white.opacity(0.7))
                }
            }
            .onAppear {
                // Set initial channel filter from parameter
                selectedChannelFilter = channelName
                
                Task {
                    await loadStreams()
                    
                    // If we have an expected streamKey but no streams yet, start waiting
                    if let expectedStreamKey = expectedStreamKey, streams.isEmpty {
                        isWaitingForStream = true
                        waitForStreamToAppear(streamKey: expectedStreamKey)
                    }
                }
            }
            .onDisappear {
                stopAllPolling()
            }
            .sheet(isPresented: $showingEditModal) {
                if let stream = editingStream {
                    StreamEditView(
                        stream: stream,
                        onSave: { title, description, price, makeVisible in
                            saveStreamDetails(stream: stream, title: title, description: description, price: price, makeVisible: makeVisible)
                        }
                    )
                }
            }
            .fullScreenCover(isPresented: $showingDiscovery) {
                if let channelName = navigateToChannelName {
                    ChannelDiscoveryView(filterChannelName: channelName)
                }
            }
            .alert("Delete Stream", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {
                    streamToDelete = nil
                }
                Button("Delete", role: .destructive) {
                    if let stream = streamToDelete {
                        deleteStream(stream: stream)
                    }
                    streamToDelete = nil
                }
            } message: {
                if let stream = streamToDelete {
                    Text("Are you sure you want to delete \"\(stream.title ?? stream.fileName)\"? This action cannot be undone.")
                }
            }
        }
    }
    
    @MainActor
    private func loadStreams() async {
        guard let userEmail = authService.userEmail else {
            errorMessage = "Please sign in"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            // Fetch user files from API
            guard let url = URL(string: "https://twilly.app/api/files/\(userEmail)") else {
                throw URLError(.badURL)
            }
            
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let listings = json["listings"] as? [[String: Any]] {
                
                print("🔍 [MyStreamsView] Loaded \(listings.count) total listings from API")
                
                // Filter for videos with streamKey (or videos that might be streams)
                let streamFiles = listings.compactMap { item -> StreamItem? in
                    // Must be a video
                    guard let category = item["category"] as? String, category == "Videos" else {
                        return nil
                    }
                    
                    // Must have SK and fileName
                    guard let SK = item["SK"] as? String,
                          let fileName = item["fileName"] as? String else {
                        print("⚠️ [MyStreamsView] Skipping item - missing SK or fileName")
                        return nil
                    }
                    
                    // Get streamKey (may be empty for newly created streams)
                    let streamKey = item["streamKey"] as? String ?? ""
                    
                    // Get folderName (channel name) - required
                    guard let folderName = item["folderName"] as? String else {
                        print("⚠️ [MyStreamsView] Skipping item \(fileName) - missing folderName")
                        return nil
                    }
                    
                    // Include if:
                    // 1. Has streamKey (normal case)
                    // 2. OR we're waiting for a stream and this video is from the expected channel (might be the new stream)
                    let expectedChannel = channelName ?? selectedChannelFilter
                    let isFromExpectedChannel = expectedChannel != nil && folderName == expectedChannel
                    let shouldInclude = !streamKey.isEmpty || (expectedStreamKey != nil && isFromExpectedChannel)
                    
                    if !shouldInclude {
                        print("⚠️ [MyStreamsView] Skipping item \(fileName) - no streamKey, expectedChannel: \(expectedChannel ?? "nil"), item channel: \(folderName)")
                        return nil
                    }
                    
                    let hasHlsUrl = (item["hlsUrl"] as? String)?.isEmpty == false
                    let hasThumbnail = (item["thumbnailUrl"] as? String)?.isEmpty == false
                    let isReady = hasHlsUrl && hasThumbnail
                    let isVisible = item["isVisible"] as? Bool ?? false
                    
                    print("✅ [MyStreamsView] Including stream: \(fileName), streamKey: \(streamKey.isEmpty ? "empty" : streamKey), channel: \(folderName), isReady: \(isReady)")
                    
                    return StreamItem(
                        id: SK,
                        fileId: SK,
                        streamKey: streamKey.isEmpty ? (expectedStreamKey ?? "") : streamKey, // Use expectedStreamKey if streamKey is empty
                        channelName: folderName,
                        fileName: fileName,
                        title: item["title"] as? String,
                        description: item["description"] as? String,
                        price: item["price"] as? Double,
                        createdAt: item["createdAt"] as? String ?? item["timestamp"] as? String,
                        isProcessing: !isReady,
                        isReady: isReady,
                        isVisible: isVisible,
                        hasHlsUrl: hasHlsUrl,
                        hasThumbnail: hasThumbnail
                    )
                }
                
                print("✅ [MyStreamsView] Filtered to \(streamFiles.count) stream files")
                
                // Sort by createdAt (newest first)
                let sortedStreams = streamFiles.sorted { stream1, stream2 in
                    let date1 = stream1.createdAt ?? ""
                    let date2 = stream2.createdAt ?? ""
                    return date1 > date2
                }
                
                streams = sortedStreams
                isLoading = false
                
                print("✅ [MyStreamsView] Final streams count: \(streams.count)")
                if let expectedStreamKey = expectedStreamKey {
                    print("🔍 [MyStreamsView] Looking for expected streamKey: \(expectedStreamKey)")
                    let foundExpectedStream = streams.contains { $0.streamKey == expectedStreamKey }
                    print("🔍 [MyStreamsView] Expected stream found: \(foundExpectedStream)")
                    
                    if !foundExpectedStream {
                        // Stream not found yet, keep waiting
                        print("⏳ [MyStreamsView] Expected stream not found, starting wait...")
                        isWaitingForStream = true
                        waitForStreamToAppear(streamKey: expectedStreamKey)
                    } else {
                        // Stream found, stop waiting
                        print("✅ [MyStreamsView] Expected stream found, stopping wait")
                        isWaitingForStream = false
                    }
                } else {
                    print("ℹ️ [MyStreamsView] No expected streamKey to wait for")
                }
                
                // Start polling for ALL processing streams (regardless of channel filter)
                let streamsToPoll = streams.filter { $0.isProcessing }
                
                for stream in streamsToPoll {
                    startPolling(stream: stream)
                }
            } else {
                throw URLError(.badServerResponse)
            }
        } catch {
            isLoading = false
            errorMessage = "Failed to load streams: \(error.localizedDescription)"
        }
    }
    
    private func waitForStreamToAppear(streamKey: String) {
        guard let userEmail = authService.userEmail else { return }
        
        let task = Task {
            var pollCount = 0
            let maxPollAttempts = 30 // Poll for up to 1 minute (30 * 2 seconds)
            let pollInterval: TimeInterval = 2.0 // Poll every 2 seconds
            
            while pollCount < maxPollAttempts && !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
                pollCount += 1
                
                do {
                    // Check if stream file exists
                    guard let url = URL(string: "https://twilly.app/api/files/check-stream-file") else {
                        continue
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
                    
                    if let httpResponse = response as? HTTPURLResponse,
                       httpResponse.statusCode == 200,
                       let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        let exists = json["exists"] as? Bool ?? false
                        let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
                        let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
                        
                        print("🔍 [MyStreamsView] Stream check result: exists=\(exists), hasHlsUrl=\(hasHlsUrl), hasThumbnail=\(hasThumbnail)")
                        
                        if exists {
                            // Stream appeared in DB! Reload streams
                            print("✅ [MyStreamsView] Stream found in DB, reloading...")
                            await MainActor.run {
                                isWaitingForStream = false
                                Task {
                                    await loadStreams()
                                }
                            }
                            break
                        }
                    }
                } catch {
                    print("⚠️ [MyStreamsView] Error waiting for stream: \(error.localizedDescription)")
                }
            }
            
            // If we exhausted all attempts, stop waiting
            if pollCount >= maxPollAttempts {
                await MainActor.run {
                    isWaitingForStream = false
                }
            }
        }
        
        pollTasks[streamKey] = task
    }
    
    private func startPolling(stream: StreamItem) {
        // Stop existing polling for this stream
        pollTasks[stream.streamKey]?.cancel()
        
        guard let userEmail = authService.userEmail else { return }
        
        let task = Task {
            var pollCount = 0
            let maxPollAttempts = 120 // Poll for up to 2 minutes
            let pollInterval: TimeInterval = 2.0 // Poll every 2 seconds
            
            while pollCount < maxPollAttempts && !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
                pollCount += 1
                
                do {
                    // Check stream status
                    guard let url = URL(string: "https://twilly.app/api/files/check-stream-file") else {
                        continue
                    }
                    
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    
                    let body: [String: Any] = [
                        "userEmail": userEmail,
                        "streamKey": stream.streamKey
                    ]
                    
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)
                    
                    let (data, response) = try await URLSession.shared.data(for: request)
                    
                    if let httpResponse = response as? HTTPURLResponse,
                       httpResponse.statusCode == 200,
                       let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        let exists = json["exists"] as? Bool ?? false
                        let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
                        let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
                        let isVisible = json["isVisible"] as? Bool ?? false
                        
                        if exists && hasHlsUrl && hasThumbnail {
                            // Stream is ready!
                            await MainActor.run {
                                if let index = streams.firstIndex(where: { $0.id == stream.id }) {
                                    streams[index].isProcessing = false
                                    streams[index].isReady = true
                                    streams[index].hasHlsUrl = true
                                    streams[index].hasThumbnail = true
                                    streams[index].isVisible = isVisible
                                }
                                pollTasks[stream.streamKey] = nil
                                
                                // If this was the last processing stream for this channel, show completion
                                // The view will automatically update since processingStreams is computed
                            }
                            break
                        }
                    }
                } catch {
                    print("⚠️ [MyStreamsView] Error polling stream \(stream.streamKey): \(error.localizedDescription)")
                }
            }
        }
        
        pollTasks[stream.streamKey] = task
    }
    
    private func stopAllPolling() {
        for (_, task) in pollTasks {
            task.cancel()
        }
        pollTasks.removeAll()
    }
    
    private func toggleVisibility(stream: StreamItem) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let newVisibility = !stream.isVisible
                try await channelService.updateContentVisibility(
                    fileId: stream.fileId,
                    pk: "USER#\(userEmail)",
                    isVisible: newVisibility
                )
                
                // Update visibility
                await MainActor.run {
                    if let index = streams.firstIndex(where: { $0.id == stream.id }) {
                        streams[index].isVisible = newVisibility
                    }
                }
            } catch {
                print("⚠️ [MyStreamsView] Error toggling visibility: \(error.localizedDescription)")
            }
        }
    }
    
    private func saveStreamDetails(stream: StreamItem, title: String?, description: String?, price: Double?, makeVisible: Bool? = nil) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                // Update details and optionally visibility
                try await channelService.updateContentDetails(
                    fileId: stream.fileId,
                    pk: "USER#\(userEmail)",
                    title: title,
                    description: description,
                    price: price,
                    isVisible: makeVisible
                )
                
                // Update stream metadata
                await MainActor.run {
                    if let index = streams.firstIndex(where: { $0.id == stream.id }) {
                        streams[index].title = title
                        streams[index].description = description
                        streams[index].price = price
                        if let makeVisible = makeVisible {
                            streams[index].isVisible = makeVisible
                        }
                    }
                    showingEditModal = false
                }
            } catch {
                print("⚠️ [MyStreamsView] Error saving details: \(error.localizedDescription)")
            }
        }
    }
    
    private func deleteStream(stream: StreamItem) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                // Call delete API endpoint
                guard let url = URL(string: "https://twilly.app/api/files/delete") else {
                    throw URLError(.badURL)
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "userId": userEmail,
                    "fileId": stream.fileId,
                    "fileName": stream.fileName,
                    "folderName": stream.channelName
                ]
                
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200 else {
                    let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                    print("⚠️ [MyStreamsView] Delete failed: \(errorMessage)")
                    throw URLError(.badServerResponse)
                }
                
                // Check response
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success {
                    // Remove from local array
                    await MainActor.run {
                        streams.removeAll { $0.id == stream.id }
                    }
                } else {
                    throw URLError(.badServerResponse)
                }
            } catch {
                print("⚠️ [MyStreamsView] Error deleting stream: \(error.localizedDescription)")
            }
        }
    }
}

struct StreamCard: View {
    let stream: StreamItem
    let onToggleVisibility: () -> Void
    let onDelete: () -> Void
    let onPostWithoutDetails: () -> Void
    let onEditDetails: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(stream.channelName)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    if let title = stream.title, !title.isEmpty {
                        Text(title)
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    } else {
                        // Show friendly message instead of file name
                        Text("No details set")
                            .font(.subheadline)
                            .foregroundColor(.gray.opacity(0.7))
                            .italic()
                    }
                }
                
                Spacer()
                
                if stream.isProcessing {
                    VStack(spacing: 8) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                        Text("Processing...")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                } else if stream.isReady {
                    // For ready streams, show eye icon and delete icon
                    HStack(spacing: 16) {
                        // Eye icon - click to toggle visibility or edit if already visible
                        Button(action: onToggleVisibility) {
                            Image(systemName: stream.isVisible ? "eye.fill" : "eye.slash.fill")
                                .font(.title3)
                                .foregroundColor(stream.isVisible ? .twillyTeal : .gray)
                        }
                        
                        // Delete icon
                        Button(action: onDelete) {
                            Image(systemName: "trash")
                                .font(.title3)
                                .foregroundColor(.red.opacity(0.7))
                        }
                    }
                }
            }
            
            // Show action buttons only when stream is ready AND visible
            if stream.isReady && stream.isVisible {
                HStack(spacing: 12) {
                    // Post without details button
                    Button(action: onPostWithoutDetails) {
                        Text("Post Without Details")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(Color.gray.opacity(0.3))
                            .cornerRadius(8)
                    }
                    
                    // Add details button
                    Button(action: onEditDetails) {
                        Text("Add Details")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(8)
                    }
                }
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
}

// Channel filter button component
struct ChannelFilterButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : .gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.twillyTeal : Color.white.opacity(0.1))
                .cornerRadius(20)
        }
    }
}

struct StreamEditView: View {
    let stream: StreamItem
    let onSave: (String?, String?, Double?, Bool?) -> Void
    
    @State private var title: String
    @State private var description: String
    @State private var price: String
    @State private var makeOffline: Bool = false
    @Environment(\.dismiss) var dismiss
    
    init(stream: StreamItem, onSave: @escaping (String?, String?, Double?, Bool?) -> Void) {
        self.stream = stream
        self.onSave = onSave
        _title = State(initialValue: stream.title ?? "")
        _description = State(initialValue: stream.description ?? "")
        _price = State(initialValue: stream.price.map { String($0) } ?? "")
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
                
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Title")
                                .font(.headline)
                                .foregroundColor(.white)
                            TextField("Enter title", text: $title)
                                .padding(12)
                                .background(Color.white.opacity(0.15))
                                .cornerRadius(8)
                                .foregroundColor(.white)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(.headline)
                                .foregroundColor(.white)
                            TextEditor(text: $description)
                                .frame(height: 120)
                                .padding(4)
                                .background(Color.white.opacity(0.15))
                                .cornerRadius(8)
                                .foregroundColor(.white)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Price (optional)")
                                .font(.headline)
                                .foregroundColor(.white)
                            TextField("0.00", text: $price)
                                .padding(12)
                                .keyboardType(.decimalPad)
                                .background(Color.white.opacity(0.15))
                                .cornerRadius(8)
                                .foregroundColor(.white)
                        }
                        
                        // Mark offline option (only if stream is currently visible)
                        if stream.isVisible {
                            Toggle(isOn: $makeOffline) {
                                Text("Mark Offline (Hide from channel)")
                                    .foregroundColor(.white)
                            }
                            .toggleStyle(SwitchToggleStyle(tint: .twillyTeal))
                            .padding(.vertical, 8)
                        }
                        
                        Button(action: {
                            let priceValue = Double(price)
                            let visibility: Bool? = makeOffline ? false : nil // Only change if marking offline
                            onSave(title.isEmpty ? nil : title, description.isEmpty ? nil : description, priceValue, visibility)
                            dismiss()
                        }) {
                            Text("Save")
                                .fontWeight(.semibold)
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
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Add Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white.opacity(0.7))
                }
            }
        }
    }
}