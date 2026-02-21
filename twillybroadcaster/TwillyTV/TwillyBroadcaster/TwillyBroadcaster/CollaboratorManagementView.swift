//
//  CollaboratorManagementView.swift
//  TwillyBroadcaster
//
//  Admin view for managing collaborators across all channels
//

import SwiftUI

struct CollaboratorManagementView: View {
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var channels: [Channel] = []
    @State private var selectedChannel: Channel? = nil
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    
    private var userEmail: String {
        authService.userEmail ?? ""
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
                
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                        .scaleEffect(1.5)
                } else if channels.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "folder.badge.questionmark")
                            .font(.system(size: 64))
                            .foregroundColor(.gray)
                        Text("No Channels")
                            .font(.title2)
                            .foregroundColor(.white)
                        Text("Create a channel first to manage collaborators")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            // Channel selector
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Select Channel")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                ForEach(channels) { channel in
                                    Button(action: {
                                        selectedChannel = channel
                                    }) {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(channel.name)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundColor(.white)
                                                
                                                if let visibility = channel.visibility {
                                                    Text(visibility.capitalized)
                                                        .font(.caption)
                                                        .foregroundColor(.gray)
                                                }
                                            }
                                            
                                            Spacer()
                                            
                                            if selectedChannel?.id == channel.id {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(.twillyTeal)
                                            }
                                        }
                                        .padding()
                                        .background(
                                            selectedChannel?.id == channel.id ?
                                            Color.twillyTeal.opacity(0.2) :
                                            Color.white.opacity(0.1)
                                        )
                                        .cornerRadius(12)
                                    }
                                }
                            }
                            .padding(.horizontal)
                            
                            // Collaborator management for selected channel
                            if let channel = selectedChannel {
                                AddCollaboratorView(
                                    channelName: channel.name,
                                    userEmail: userEmail,
                                    onCollaboratorAdded: {
                                        successMessage = "Collaborator added successfully"
                                        // Refresh channels to get updated info
                                        loadChannels()
                                    }
                                )
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle("Manage Collaborators")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
            .alert("Success", isPresented: .constant(successMessage != nil)) {
                Button("OK") {
                    successMessage = nil
                }
            } message: {
                if let message = successMessage {
                    Text(message)
                }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let message = errorMessage {
                    Text(message)
                }
            }
            .onAppear {
                loadChannels()
            }
        }
    }
    
    private func loadChannels() {
        guard let userEmail = authService.userEmail else { return }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                // Force refresh to get latest visibility status
                let fetchedChannels = try await channelService.fetchChannels(userEmail: userEmail, forceRefresh: true)
                await MainActor.run {
                    channels = fetchedChannels
                    if selectedChannel == nil && !channels.isEmpty {
                        selectedChannel = channels.first
                    }
                    isLoading = false
                    
                    // Debug: Log visibility for each channel
                    print("📊 Channels loaded with visibility:")
                    for channel in fetchedChannels {
                        print("  - \(channel.name): \(channel.visibility ?? "nil") (isPublic: \(channel.isPublic ?? false))")
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to load channels: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
}
