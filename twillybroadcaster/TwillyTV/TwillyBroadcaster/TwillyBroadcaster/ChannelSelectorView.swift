//
//  ChannelSelectorView.swift
//  TwillyBroadcaster
//
//  Channel selector component to replace Discover button
//

import SwiftUI

struct ChannelSelectorView: View {
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject var authService = AuthService.shared
    @Binding var selectedChannel: DiscoverableChannel?
    // Accept collaborator channels from parent (only channels user can stream to)
    let collaboratorChannels: [Channel]
    let isAdmin: Bool // If true, show all public channels; if false, show only collaborator channels (default: false)
    @State private var channels: [DiscoverableChannel] = []
    @State private var isLoading = false
    @State private var showingChannelPicker = false
    
    var body: some View {
        HStack(spacing: 8) {
            // Channel Selector Button
            Button(action: {
                showingChannelPicker = true
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "tv.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text(selectedChannel?.channelName ?? "Select Channel")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.black.opacity(0.4))
                .cornerRadius(20)
            }
        }
        .sheet(isPresented: $showingChannelPicker) {
            ChannelPickerSheet(
                channels: channels,
                selectedChannel: $selectedChannel,
                isLoading: $isLoading,
                collaboratorChannels: collaboratorChannels
            )
        }
        .onAppear {
            loadChannels()
            // Don't auto-select a channel - show "Select Channel" as default
        }
        .onChange(of: isAdmin) { _ in
            // Reload channels when admin status changes
            loadChannels()
        }
        .onChange(of: collaboratorChannels.count) { _ in
            // Reload channels when collaborator channels change
            if !isAdmin {
                loadChannels()
            }
        }
        .onChange(of: showingChannelPicker) { isShowing in
            if isShowing {
                loadChannels()
            }
        }
    }
    
    private func loadChannels() {
        Task {
            isLoading = true
            do {
                var discoverableChannels: [DiscoverableChannel] = []
                
                // TV Network Model: Only show "Twilly TV" channel
                print("🔍 [ChannelSelectorView] Loading Twilly TV channel only")
                let allChannels = try await channelService.fetchDiscoverableChannels(forceRefresh: false)
                
                // Filter to only "Twilly TV" channel
                if let twillyTV = allChannels.first(where: { 
                    $0.channelName.lowercased().contains("twilly tv") 
                }) {
                    discoverableChannels = [twillyTV]
                    print("✅ [ChannelSelectorView] Found Twilly TV channel: \(twillyTV.channelName)")
                } else {
                    print("⚠️ [ChannelSelectorView] Twilly TV channel not found in discoverable channels")
                    // If not found, try to find it in collaborator channels
                    if let twillyTVCollaborator = collaboratorChannels.first(where: {
                        $0.name.lowercased().contains("twilly tv")
                    }) {
                        let minimalChannel = DiscoverableChannel(
                            channelId: twillyTVCollaborator.id,
                            channelName: twillyTVCollaborator.name,
                            creatorEmail: authService.userEmail ?? "",
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        discoverableChannels = [minimalChannel]
                        print("✅ [ChannelSelectorView] Created Twilly TV from collaborator channel")
                    }
                }
                
                await MainActor.run {
                    channels = discoverableChannels
                    // Auto-select Twilly TV if found
                    if let twillyTV = discoverableChannels.first {
                        selectedChannel = twillyTV
                    }
                    isLoading = false
                }
            } catch {
                print("❌ [ChannelSelectorView] Error loading channels: \(error)")
                await MainActor.run {
                    isLoading = false
                }
            }
        }
    }
    
    private func setDefaultChannel() {
        // Find "Twilly TV" channel (by partial match) or use first public channel
        if let twillyTV = channels.first(where: { 
            $0.channelName.lowercased().contains("twilly tv") 
        }) {
            selectedChannel = twillyTV
        } else if let firstPublic = channels.first(where: { $0.isPublic }) {
            selectedChannel = firstPublic
        } else if !channels.isEmpty {
            selectedChannel = channels.first
        }
    }
}

struct ChannelPickerSheet: View {
    let channels: [DiscoverableChannel]
    @Binding var selectedChannel: DiscoverableChannel?
    @Binding var isLoading: Bool
    let collaboratorChannels: [Channel] // Channels user can stream to
    @Environment(\.dismiss) var dismiss
    @State private var searchText = ""
    @State private var showingInviteCodeEntry: DiscoverableChannel? = nil
    
    var filteredChannels: [DiscoverableChannel] {
        if searchText.isEmpty {
            return channels
        }
        return channels.filter { $0.channelName.localizedCaseInsensitiveContains(searchText) }
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
                
                VStack(spacing: 0) {
                    // Search bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        TextField("Search channels...", text: $searchText)
                            .foregroundColor(.white)
                    }
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(10)
                    .padding(.horizontal)
                    .padding(.top)
                    
                    if isLoading {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                        Spacer()
                    } else if filteredChannels.isEmpty {
                        Spacer()
                        Text("No channels found")
                            .foregroundColor(.gray)
                        Spacer()
                    } else {
                        // Channel list
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(filteredChannels) { channel in
                                    let canStream = collaboratorChannels.contains { $0.name == channel.channelName }
                                    ChannelRow(
                                        channel: channel,
                                        isSelected: selectedChannel?.channelId == channel.channelId,
                                        canStream: canStream
                                    ) {
                                        if canStream {
                                            selectedChannel = channel
                                            dismiss()
                                        } else {
                                            // Show invite code entry for channels user can't stream to
                                            showingInviteCodeEntry = channel
                                        }
                                    }
                                }
                            }
                            .padding()
                        }
                    }
                }
            }
            .navigationTitle("Select Channel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
            .sheet(isPresented: Binding(
                get: { showingInviteCodeEntry != nil },
                set: { if !$0 { showingInviteCodeEntry = nil } }
            )) {
                if let channel = showingInviteCodeEntry {
                    InviteCodeEntryView(channelName: channel.channelName) {
                        // On success, refresh and select the channel
                        Task {
                            // Refresh user roles to get updated collaborator channels
                            // This will be handled by the parent ContentView
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

struct ChannelRow: View {
    let channel: DiscoverableChannel
    let isSelected: Bool
    let canStream: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Channel poster or placeholder
                AsyncImage(url: URL(string: channel.posterUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                }
                .frame(width: 60, height: 40)
                .cornerRadius(8)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(channel.channelName)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(channel.creatorUsername)
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                
                Spacer()
                
                if canStream {
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.twillyTeal)
                    }
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "ticket.fill")
                            .font(.caption)
                        Text("Invite")
                            .font(.caption)
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
            .padding()
            .background(isSelected ? Color.twillyTeal.opacity(0.2) : Color.white.opacity(0.05))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.twillyTeal : Color.clear, lineWidth: 2)
            )
        }
    }
}
