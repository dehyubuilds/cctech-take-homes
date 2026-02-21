//
//  ComprehensiveMyChannelsView.swift
//  TwillyBroadcaster
//
//  Comprehensive My Channels view matching managefiles.vue functionality
//  Includes: channel selector, poster management, pricing, visibility, description, file listing
//

import SwiftUI

struct ComprehensiveMyChannelsView: View {
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var channelService = ChannelService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var folders: [FolderItem] = []
    @State private var files: [FileItem] = []
    @State private var selectedChannelName: String = "default"
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    // Channel management states
    @State private var showingCreateChannel = false
    @State private var showingDeleteChannelConfirmation = false
    @State private var channelToDelete: String?
    @State private var isRefreshingChannel = false
    
    // Channel settings states
    @State private var channelPosterUrl: String?
    @State private var channelSubscriptionPrice: Double = 0.0
    @State private var channelVisibility: String = "private"
    @State private var channelDescription: String = ""
    @State private var isUpdatingPrice = false
    @State private var isUpdatingVisibility = false
    @State private var isUpdatingDescription = false
    @State private var newSubscriptionPrice: String = ""
    @State private var newChannelDescription: String = ""
    
    // CloudFront base URL
    private let cloudFrontBaseUrl = "https://d3hv50jkrzkiyh.cloudfront.net"
    private let defaultPosterUrl = "https://d4idc5cmwxlpy.cloudfront.net/No_Image_Available.jpg"
    
    // File management states
    @State private var selectedFiles = Set<String>()
    @State private var isSelectionMode = false
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    
    private var filteredFiles: [FileItem] {
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
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Channel Selector Section
                channelSelectorSection
                
                // Channel Poster Section
                if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
                    channelPosterSection
                }
                
                // Subscription Pricing Section
                if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
                    subscriptionPricingSection
                }
                
                // Channel Visibility Section
                if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
                    channelVisibilitySection
                }
                
                // Channel Description Section
                if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
                    channelDescriptionSection
                }
                
                // File Management Section
                fileManagementSection
            }
            .padding()
        }
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .onAppear {
            loadData()
        }
        .alert("Delete Channel", isPresented: $showingDeleteChannelConfirmation) {
            Button("Cancel", role: .cancel) {
                channelToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let channel = channelToDelete {
                    deleteChannel(channel)
                }
            }
        } message: {
            if let channel = channelToDelete {
                Text("Are you sure you want to delete \"\(channel)\"? This action cannot be undone.")
            }
        }
    }
    
    // MARK: - Channel Selector Section
    private var channelSelectorSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "folder")
                    .foregroundColor(.twillyTeal)
                Text("Select Channel")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            HStack(spacing: 12) {
                // Channel Dropdown
                Picker("Channel", selection: $selectedChannelName) {
                    Text("Default Channel").tag("default")
                    ForEach(folders, id: \.name) { folder in
                        Text(folder.name).tag(folder.name)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.1))
                .cornerRadius(10)
                .foregroundColor(.white)
                .onChange(of: selectedChannelName) { _ in
                    loadChannelSettings()
                }
                
                // Create Channel Button
                Button(action: {
                    showingCreateChannel = true
                }) {
                    Image(systemName: "plus")
                        .foregroundColor(.twillyTeal)
                        .padding(10)
                        .background(Color.twillyTeal.opacity(0.2))
                        .cornerRadius(8)
                }
                
                // Delete Channel Button
                if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
                    Button(action: {
                        channelToDelete = selectedChannelName
                        showingDeleteChannelConfirmation = true
                    }) {
                        Image(systemName: "trash")
                            .foregroundColor(.red)
                            .padding(10)
                            .background(Color.red.opacity(0.2))
                            .cornerRadius(8)
                    }
                }
                
                // Refresh Button
                Button(action: {
                    refreshChannel()
                }) {
                    Image(systemName: isRefreshingChannel ? "arrow.clockwise" : "arrow.clockwise")
                        .foregroundColor(.twillyTeal)
                        .padding(10)
                        .background(Color.twillyTeal.opacity(0.2))
                        .cornerRadius(8)
                        .rotationEffect(.degrees(isRefreshingChannel ? 360 : 0))
                        .animation(isRefreshingChannel ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: isRefreshingChannel)
                }
                .disabled(isRefreshingChannel)
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // MARK: - Channel Poster Section
    private var channelPosterSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "photo")
                    .foregroundColor(.purple)
                Text("Channel Poster")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            // Poster preview with proper aspect ratio
            let posterUrl = getCurrentChannelPosterUrl()
            AsyncImage(url: URL(string: posterUrl)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(16/9, contentMode: .fill)
                case .empty:
                    ZStack {
                        Color.gray.opacity(0.3)
                        ProgressView()
                            .tint(.white)
                    }
                case .failure(_):
                    ZStack {
                        Color.gray.opacity(0.3)
                        Image(systemName: "photo")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                    }
                @unknown default:
                    Color.gray.opacity(0.3)
                }
            }
            .frame(height: 180)
            .clipped()
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // Get current channel poster URL (matching managefiles.vue logic)
    private func getCurrentChannelPosterUrl() -> String {
        guard selectedChannelName != "default" && selectedChannelName != "thumbnails" else {
            return defaultPosterUrl
        }
        
        // Find the folder with matching name
        if let folder = folders.first(where: { $0.name == selectedChannelName }),
           let posterUrl = folder.posterUrl, !posterUrl.isEmpty {
            return posterUrl
        }
        
        // Try to construct poster URL from channel name
        let encodedChannelName = selectedChannelName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? selectedChannelName
        let constructedUrl = "\(cloudFrontBaseUrl)/public/series-posters/\(userEmail)/\(encodedChannelName)/default-poster.jpg"
        
        return constructedUrl
    }
    
    // MARK: - Subscription Pricing Section
    private var subscriptionPricingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "dollarsign.circle")
                    .foregroundColor(.green)
                Text("Subscription Pricing")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            HStack {
                Text("Current Price:")
                    .foregroundColor(.gray)
                Spacer()
                Text("$\(String(format: "%.2f", channelSubscriptionPrice))/month")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            HStack(spacing: 12) {
                TextField("0.00", text: $newSubscriptionPrice)
                    .keyboardType(.decimalPad)
                    .padding(12)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
                    .foregroundColor(.white)
                
                Button(action: {
                    updateSubscriptionPrice()
                }) {
                    if isUpdatingPrice {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Update Price")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: [Color.green, Color.green.opacity(0.8)]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(8)
                .disabled(isUpdatingPrice || newSubscriptionPrice.isEmpty)
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // MARK: - Channel Visibility Section
    private var channelVisibilitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "eye")
                    .foregroundColor(.blue)
                Text("Channel Visibility")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            HStack {
                Text("Current Status:")
                    .foregroundColor(.gray)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: visibilityIcon(channelVisibility))
                        .foregroundColor(visibilityColor(channelVisibility))
                    Text(visibilityLabel(channelVisibility))
                        .font(.headline)
                        .foregroundColor(visibilityColor(channelVisibility))
                }
            }
            
            // Visibility Options
            VStack(spacing: 8) {
                VisibilityOptionButton(
                    title: "Public",
                    description: "Visible in discovery and can be subscribed to",
                    icon: "eye.fill",
                    color: .green,
                    isSelected: channelVisibility == "public",
                    isUpdating: isUpdatingVisibility,
                    action: {
                        setChannelVisibility("public")
                    }
                )
                
                VisibilityOptionButton(
                    title: "Searchable",
                    description: "Private but can be found via search",
                    icon: "magnifyingglass",
                    color: .yellow,
                    isSelected: channelVisibility == "searchable",
                    isUpdating: isUpdatingVisibility,
                    action: {
                        setChannelVisibility("searchable")
                    }
                )
                
                VisibilityOptionButton(
                    title: "Private",
                    description: "Only accessible via invite links",
                    icon: "eye.slash.fill",
                    color: .gray,
                    isSelected: channelVisibility == "private",
                    isUpdating: isUpdatingVisibility,
                    action: {
                        setChannelVisibility("private")
                    }
                )
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // MARK: - Channel Description Section
    private var channelDescriptionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "text.alignleft")
                    .foregroundColor(.blue)
                Text("Channel Description")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            Text(channelDescription.isEmpty ? "No description set" : channelDescription)
                .foregroundColor(.gray)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white.opacity(0.05))
                .cornerRadius(8)
            
            TextEditor(text: $newChannelDescription)
                .frame(height: 100)
                .padding(8)
                .background(Color.white.opacity(0.1))
                .cornerRadius(8)
                .foregroundColor(.white)
            
            Button(action: {
                updateChannelDescription()
            }) {
                if isUpdatingDescription {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Update Description")
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [Color.blue, Color.blue.opacity(0.8)]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(8)
            .disabled(isUpdatingDescription || newChannelDescription.isEmpty)
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // MARK: - File Management Section
    private var fileManagementSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "documents")
                    .foregroundColor(.twillyTeal)
                Text("Episodes in \"\(selectedChannelName)\"")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            
            if filteredFiles.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 50))
                        .foregroundColor(.gray.opacity(0.5))
                    Text("No files in this channel")
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                // Mobile-friendly grid: 1 column on small screens, 2 on larger
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ], spacing: 12) {
                    ForEach(filteredFiles) { file in
                        FileCard(file: file, isSelected: selectedFiles.contains(file.id), onTap: {
                            if isSelectionMode {
                                toggleFileSelection(file.id)
                            } else {
                                // TODO: Open file details
                            }
                        })
                    }
                }
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
    
    // MARK: - Helper Functions
    private func loadData() {
        Task {
            await loadFilesAndFolders()
            loadChannelSettings()
        }
    }
    
    private func loadFilesAndFolders() async {
        guard !userEmail.isEmpty else { return }
        
        await MainActor.run {
            isLoading = true
        }
        
        do {
            guard let url = URL(string: "https://twilly.app/api/files/\(userEmail)") else {
                throw URLError(.badURL)
            }
            
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Parse folders (including poster URL)
                if let foldersData = json["folders"] as? [[String: Any]] {
                    var parsedFolders: [FolderItem] = []
                    for folderData in foldersData {
                        guard let name = folderData["name"] as? String,
                              let SK = folderData["SK"] as? String else {
                            continue
                        }
                        
                        // Extract seriesPosterUrl if available
                        var posterUrl: String? = nil
                        if let seriesPosterUrl = folderData["seriesPosterUrl"] {
                            if let urlString = seriesPosterUrl as? String {
                                posterUrl = urlString
                            } else if let urlDict = seriesPosterUrl as? [String: Any] {
                                if let urlString = urlDict["S"] as? String {
                                    posterUrl = urlString
                                }
                            }
                            
                            // Process poster URL to add /public/ and fix CloudFront domain
                            if var url = posterUrl {
                                if !url.contains("/public/") {
                                    url = url.replacingOccurrences(of: "/series-posters/", with: "/public/series-posters/")
                                }
                                url = url.replacingOccurrences(of: "d4idc5cmwxlpy.cloudfront.net", with: "d3hv50jkrzkiyh.cloudfront.net")
                                posterUrl = url
                            }
                        }
                        
                        parsedFolders.append(FolderItem(SK: SK, name: name, posterUrl: posterUrl))
                    }
                    folders = parsedFolders
                }
                
                // Parse files
                if let listings = json["listings"] as? [[String: Any]] {
                    files = listings.compactMap { fileData in
                        guard let SK = fileData["SK"] as? String,
                              let fileName = fileData["fileName"] as? String else {
                            return nil
                        }
                        return FileItem(
                            id: SK,
                            fileName: fileName,
                            folderName: fileData["folderName"] as? String,
                            category: fileData["category"] as? String,
                            isVisible: fileData["isVisible"] as? Bool ?? false,
                            price: fileData["price"] as? Double,
                            hlsUrl: fileData["hlsUrl"] as? String,
                            thumbnailUrl: fileData["thumbnailUrl"] as? String,
                            streamKey: fileData["streamKey"] as? String
                        )
                    }
                }
            }
            
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
    
    private func loadChannelSettings() {
        // Load channel poster from folders
        if selectedChannelName != "default" && selectedChannelName != "thumbnails" {
            if let folder = folders.first(where: { $0.name == selectedChannelName }) {
                // Poster URL will be loaded via getCurrentChannelPosterUrl()
                // which checks folders for seriesPosterUrl
            }
        }
        
        // TODO: Load channel-specific settings (price, visibility, description) from API
        // This will need to query channel data from DynamoDB
    }
    
    private func refreshChannel() {
        isRefreshingChannel = true
        Task {
            await loadFilesAndFolders()
            loadChannelSettings()
            await MainActor.run {
                isRefreshingChannel = false
            }
        }
    }
    
    private func deleteChannel(_ channelName: String) {
        // TODO: Implement channel deletion
    }
    
    private func updateSubscriptionPrice() {
        guard let price = Double(newSubscriptionPrice) else { return }
        isUpdatingPrice = true
        
        Task {
            // TODO: Call API to update subscription price
            await MainActor.run {
                channelSubscriptionPrice = price
                newSubscriptionPrice = ""
                isUpdatingPrice = false
            }
        }
    }
    
    private func setChannelVisibility(_ visibility: String) {
        isUpdatingVisibility = true
        
        Task {
            // TODO: Call API to update visibility
            await MainActor.run {
                channelVisibility = visibility
                isUpdatingVisibility = false
            }
        }
    }
    
    private func updateChannelDescription() {
        isUpdatingDescription = true
        
        Task {
            // TODO: Call API to update description
            await MainActor.run {
                channelDescription = newChannelDescription
                newChannelDescription = ""
                isUpdatingDescription = false
            }
        }
    }
    
    private func toggleFileSelection(_ fileId: String) {
        if selectedFiles.contains(fileId) {
            selectedFiles.remove(fileId)
        } else {
            selectedFiles.insert(fileId)
        }
    }
    
    private func visibilityIcon(_ visibility: String) -> String {
        switch visibility {
        case "public": return "eye.fill"
        case "searchable": return "magnifyingglass"
        default: return "eye.slash.fill"
        }
    }
    
    private func visibilityColor(_ visibility: String) -> Color {
        switch visibility {
        case "public": return .green
        case "searchable": return .yellow
        default: return .gray
        }
    }
    
    private func visibilityLabel(_ visibility: String) -> String {
        switch visibility {
        case "public": return "Public"
        case "searchable": return "Searchable"
        default: return "Private"
        }
    }
}

// MARK: - Supporting Types
struct FolderItem: Identifiable {
    let id: String
    let name: String
    let posterUrl: String?
    
    init(SK: String, name: String, posterUrl: String? = nil) {
        self.id = SK
        self.name = name
        self.posterUrl = posterUrl
    }
}

struct FileItem: Identifiable {
    let id: String
    let fileName: String
    let folderName: String?
    let category: String?
    let isVisible: Bool
    let price: Double?
    let hlsUrl: String?
    let thumbnailUrl: String?
    let streamKey: String?
}

struct VisibilityOptionButton: View {
    let title: String
    let description: String
    let icon: String
    let color: Color
    let isSelected: Bool
    let isUpdating: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(isSelected ? color : .gray)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .foregroundColor(.white)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text(description)
                        .foregroundColor(.gray)
                        .font(.caption)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(color)
                }
            }
            .padding()
            .background(isSelected ? color.opacity(0.2) : Color.white.opacity(0.05))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? color : Color.white.opacity(0.1), lineWidth: isSelected ? 2 : 1)
            )
        }
        .disabled(isUpdating)
    }
}

struct FileCard: View {
    let file: FileItem
    let isSelected: Bool
    let onTap: () -> Void
    
    private let cloudFrontBaseUrl = "https://d3hv50jkrzkiyh.cloudfront.net"
    
    var body: some View {
        Button(action: onTap) {
            cardContent
                .background(backgroundColor)
                .cornerRadius(12)
                .overlay(borderOverlay)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var cardContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            thumbnailView
            badgesView
        }
    }
    
    private var backgroundColor: Color {
        isSelected ? Color.twillyTeal.opacity(0.2) : Color.white.opacity(0.05)
    }
    
    private var borderOverlay: some View {
        let borderColor = isSelected ? Color.twillyTeal : Color.white.opacity(0.1)
        let borderWidth: CGFloat = isSelected ? 2 : 1
        return RoundedRectangle(cornerRadius: 12)
            .stroke(borderColor, lineWidth: borderWidth)
    }
    
    private var thumbnailView: some View {
        ZStack(alignment: .bottom) {
            thumbnailImage
            gradientOverlay
            titleOverlay
        }
        .frame(height: 200)
        .clipped()
    }
    
    private var thumbnailImage: some View {
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
    
    private var gradientOverlay: some View {
        LinearGradient(
            gradient: Gradient(colors: [Color.clear, Color.black.opacity(0.8)]),
            startPoint: .top,
            endPoint: .bottom
        )
    }
    
    private var titleOverlay: some View {
        Text(file.fileName)
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(.white)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private var badgesView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                visibilityBadge
                if let price = file.price, price > 0 {
                    priceBadge(price: price)
                }
                Spacer()
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private var visibilityBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: file.isVisible ? "eye.fill" : "eye.slash.fill")
                .font(.system(size: 10))
            Text(file.isVisible ? "Live" : "Draft")
                .font(.system(size: 10, weight: .medium))
        }
        .foregroundColor(file.isVisible ? .green : .gray)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            (file.isVisible ? Color.green : Color.gray).opacity(0.2)
        )
        .cornerRadius(4)
    }
    
    private func priceBadge(price: Double) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "dollarsign.circle.fill")
                .font(.system(size: 10))
            Text("$\(String(format: "%.2f", price))")
                .font(.system(size: 10, weight: .medium))
        }
        .foregroundColor(.green)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Color.green.opacity(0.2))
        .cornerRadius(4)
    }
    
    // Get video thumbnail URL (matching managefiles.vue getVideoThumbnail logic)
    private func getVideoThumbnailUrl() -> String? {
        // First check if there's a direct thumbnail URL
        if let thumbnailUrl = file.thumbnailUrl {
            // Replace S3 with CloudFront if needed
            let processedUrl = thumbnailUrl.replacingOccurrences(of: "s3.amazonaws.com", with: "d3hv50jkrzkiyh.cloudfront.net")
            return processedUrl
        }
        
        // For stream clips, try to construct thumbnail URL from stream key
        if let streamKey = file.streamKey, !streamKey.isEmpty {
            return "\(cloudFrontBaseUrl)/clips/\(streamKey)/\(streamKey)_thumb.jpg"
        }
        
        // For videos with HLS URL, try to extract stream name
        if let hlsUrl = file.hlsUrl, hlsUrl.contains("/clips/") {
            // Extract stream key from HLS URL pattern: /clips/{streamKey}/
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
