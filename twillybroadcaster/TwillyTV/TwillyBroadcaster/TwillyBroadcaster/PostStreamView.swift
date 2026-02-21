//
//  PostStreamView.swift
//  TwillyBroadcaster
//
//  View shown after streaming ends with option to view channel in the app
//

import SwiftUI

struct PostStreamView: View {
    let shareUrl: String?
    let channelName: String?
    let onViewChannel: (DiscoverableChannel) -> Void
    @Environment(\.dismiss) var dismiss
    @ObservedObject private var authService = AuthService.shared
    @State private var isLoadingChannel = false
    
    init(shareUrl: String?, channelName: String? = nil, onViewChannel: @escaping (DiscoverableChannel) -> Void) {
        self.shareUrl = shareUrl
        self.channelName = channelName
        self.onViewChannel = onViewChannel
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
                
                VStack(spacing: 24) {
                    // Success icon
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.green, Color(red: 0, green: 0.7, blue: 0.5)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 100, height: 100)
                        
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 50))
                            .foregroundColor(.white)
                    }
                    
                    Text("Stream Complete!")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    Text("Your stream has been saved and is now available on your channel")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    
                    // View Channel Button - navigates to channel in app
                    Button(action: {
                        loadAndNavigateToChannel()
                    }) {
                        HStack(spacing: 12) {
                            if isLoadingChannel {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Image(systemName: "play.circle.fill")
                            }
                            Text(isLoadingChannel ? "Loading..." : "View Channel")
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 0.2, green: 0.8, blue: 0.9),
                                    Color(red: 0.1, green: 0.5, blue: 0.8)
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(25)
                        .disabled(isLoadingChannel)
                    }
                    .padding(.horizontal, 32)
                }
                .padding(.vertical, 40)
            }
            .navigationTitle("Stream Complete")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
        }
    }
    
    private func loadAndNavigateToChannel() {
        guard let channelName = channelName else {
            // Try to extract channel name from shareUrl
            guard let shareUrl = shareUrl,
                  let url = URL(string: shareUrl) else {
                return
            }
            
            // Extract channel name from URL
            // Format: https://twilly.app/username/channel-slug or https://twilly.app/menu/share/email/channel-slug
            let pathComponents = url.pathComponents.filter { $0 != "/" }
            
            var extractedChannelName: String?
            
            // Check for /username/channel-slug format
            if pathComponents.count >= 2 && pathComponents[0] != "menu" {
                let slug = pathComponents[1]
                // Decode URL encoding and convert slug to readable name
                extractedChannelName = slug
                    .removingPercentEncoding ?? slug
                    .replacingOccurrences(of: "-", with: " ")
                    .capitalized
            }
            // Check for /menu/share/email/channel-slug format
            else if pathComponents.count >= 4 && pathComponents[0] == "menu" && pathComponents[1] == "share" {
                let slug = pathComponents[3]
                // Decode URL encoding and convert slug to readable name
                extractedChannelName = slug
                    .removingPercentEncoding ?? slug
                    .replacingOccurrences(of: "-", with: " ")
                    .capitalized
            }
            
            guard let channelName = extractedChannelName else {
                return
            }
            
            loadChannelByName(channelName)
            return
        }
        
        loadChannelByName(channelName)
    }
    
    private func loadChannelByName(_ channelName: String) {
        isLoadingChannel = true
        
        Task {
            do {
                // Fetch discoverable channels and find the matching one
                let channels = try await ChannelService.shared.fetchDiscoverableChannels(searchQuery: nil)
                
                // Find channel by name (case-insensitive, handle emojis)
                let matchingChannel = channels.first { channel in
                    channel.channelName.lowercased() == channelName.lowercased() ||
                    channel.channelName == channelName
                }
                
                await MainActor.run {
                    isLoadingChannel = false
                    
                    if let channel = matchingChannel {
                        // Call the callback to navigate to channel in ContentView
                        onViewChannel(channel)
                        dismiss()
                    } else {
                        // Channel not found in discoverable channels - create a minimal channel object
                        // This will allow viewing the channel content even if it's not in discoverable list
                        let minimalChannel = DiscoverableChannel(
                            channelId: channelName,
                            channelName: channelName,
                            creatorEmail: authService.userEmail ?? "", // Get from auth
                            creatorUsername: "",
                            description: "",
                            posterUrl: "",
                            visibility: "public",
                            isPublic: true,
                            subscriptionPrice: nil,
                            contentType: nil
                        )
                        // Call the callback to navigate to channel in ContentView
                        onViewChannel(minimalChannel)
                        dismiss()
                    }
                }
            } catch {
                await MainActor.run {
                    isLoadingChannel = false
                    print("Failed to load channel: \(error)")
                }
            }
        }
    }
}

