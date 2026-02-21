//
//  ChannelManagementView.swift
//  TwillyBroadcaster
//
//  Phase 1: Channel Creation & Management
//  Allows users to create channels, set visibility, subscription prices, and manage channel settings
//

import SwiftUI

struct ChannelManagementView: View {
    @ObservedObject var channelService = ChannelService.shared
    @State private var myChannels: [ChannelService.MyChannel] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingCreateChannel = false
    @State private var selectedChannel: ChannelService.MyChannel?
    @State private var showingChannelSettings = false
    
    // User email - TODO: Get from auth system
    let userEmail: String
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 0.06, green: 0.09, blue: 0.16),
                        Color(red: 0.12, green: 0.16, blue: 0.23),
                        Color(red: 0.20, green: 0.25, blue: 0.33)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("My Content")
                                    .font(.system(size: 32, weight: .bold))
                                    .foregroundColor(.white)
                                Text("Manage your content channels")
                                    .font(.system(size: 14))
                                    .foregroundColor(.gray)
                            }
                            Spacer()
                            
                            // Create Channel Button
                            Button(action: {
                                showingCreateChannel = true
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 18, weight: .semibold))
                                    Text("Create")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                                .background(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color(red: 0.0, green: 0.8, blue: 0.7),
                                            Color(red: 0.0, green: 0.7, blue: 0.9)
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(12)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 20)
                        
                        // Error Message
                        if let error = errorMessage {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text(error)
                                    .foregroundColor(.red)
                                    .font(.system(size: 14))
                            }
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.horizontal, 20)
                        }
                        
                        // Loading State
                        if isLoading && myChannels.isEmpty {
                            VStack(spacing: 16) {
                                ProgressView()
                                    .scaleEffect(1.2)
                                    .tint(.teal)
                                Text("Loading channels...")
                                    .foregroundColor(.gray)
                                    .font(.system(size: 14))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 60)
                        }
                        
                        // Channels List
                        if !myChannels.isEmpty {
                            LazyVStack(spacing: 16) {
                                ForEach(myChannels) { channel in
                                    MyChannelCard(
                                        channel: channel,
                                        onTap: {
                                            selectedChannel = channel
                                            showingChannelSettings = true
                                        }
                                    )
                                }
                            }
                            .padding(.horizontal, 20)
                        } else if !isLoading {
                            // Empty State
                            VStack(spacing: 20) {
                                Image(systemName: "folder.badge.plus")
                                    .font(.system(size: 64))
                                    .foregroundColor(.gray.opacity(0.5))
                                
                                Text("No Channels Yet")
                                    .font(.system(size: 20, weight: .semibold))
                                    .foregroundColor(.white)
                                
                                Text("Create your first channel to start sharing content")
                                    .font(.system(size: 14))
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 40)
                                
                                Button(action: {
                                    showingCreateChannel = true
                                }) {
                                    HStack(spacing: 8) {
                                        Image(systemName: "plus.circle.fill")
                                        Text("Create Channel")
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 24)
                                    .padding(.vertical, 14)
                                    .background(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color(red: 0.0, green: 0.8, blue: 0.7),
                                                Color(red: 0.0, green: 0.7, blue: 0.9)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .cornerRadius(12)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 80)
                        }
                    }
                    .padding(.bottom, 40)
                }
            }
            .onAppear {
                loadMyChannels()
            }
            .refreshable {
                await loadMyChannelsAsync()
            }
            .sheet(isPresented: $showingCreateChannel) {
                NavigationView {
                    CreateChannelView(
                        userEmail: userEmail,
                        onChannelCreated: { channel in
                            showingCreateChannel = false
                            loadMyChannels()
                        }
                    )
                }
            }
            .sheet(isPresented: $showingChannelSettings) {
                if let channel = selectedChannel {
                    NavigationView {
                        ChannelSettingsView(
                            channel: channel,
                            userEmail: userEmail,
                            onSettingsUpdated: {
                                showingChannelSettings = false
                                loadMyChannels()
                            }
                        )
                    }
                }
            }
        }
    }
    
    private func loadMyChannels() {
        Task {
            await loadMyChannelsAsync()
        }
    }
    
    private func loadMyChannelsAsync() async {
        // Check if userEmail is available
        guard !userEmail.isEmpty else {
            await MainActor.run {
                errorMessage = "User email not available. Please sign in again."
                isLoading = false
            }
            return
        }
        
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        do {
            let channels = try await channelService.fetchMyChannels(creatorEmail: userEmail)
            await MainActor.run {
                myChannels = channels
                isLoading = false
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to load channels: \(error.localizedDescription)"
                isLoading = false
            }
        }
    }
}

// Channel Card Component
struct MyChannelCard: View {
    let channel: ChannelService.MyChannel
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Channel Poster/Icon
                ZStack {
                    if let posterUrl = channel.posterUrl, let url = URL(string: posterUrl) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            ZStack {
                                Color.gray.opacity(0.3)
                                Image(systemName: "play.rectangle.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(.gray)
                            }
                        }
                    } else {
                        ZStack {
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 0.0, green: 0.8, blue: 0.7),
                                    Color(red: 0.0, green: 0.7, blue: 0.9)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            Image(systemName: "play.rectangle.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                }
                .frame(width: 80, height: 80)
                .cornerRadius(12)
                
                // Channel Info
                VStack(alignment: .leading, spacing: 8) {
                    Text(channel.channelName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    
                    // Visibility Badge
                    HStack(spacing: 8) {
                        Image(systemName: visibilityIcon(channel.visibility))
                            .font(.system(size: 12))
                            .foregroundColor(visibilityColor(channel.visibility))
                        Text(visibilityLabel(channel.visibility))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(visibilityColor(channel.visibility))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(visibilityColor(channel.visibility).opacity(0.2))
                    .cornerRadius(6)
                    
                    // Subscription Price
                    if channel.subscriptionPrice > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "dollarsign.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(.green)
                            Text("$\(String(format: "%.2f", channel.subscriptionPrice))/month")
                                .font(.system(size: 12))
                                .foregroundColor(.green)
                        }
                    } else {
                        Text("Free")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.gray)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.white.opacity(0.1),
                                        Color.white.opacity(0.05)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
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

// Create Channel View
struct CreateChannelView: View {
    let userEmail: String
    let onChannelCreated: (ChannelService.MyChannel) -> Void
    
    @Environment(\.dismiss) var dismiss
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject private var authService = AuthService.shared
    
    @State private var channelName = ""
    @State private var description = ""
    @State private var visibility = "private"
    @State private var subscriptionPrice = ""
    @State private var isCreating = false
    @State private var errorMessage: String?
    
    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.06, green: 0.09, blue: 0.16),
                    Color(red: 0.12, green: 0.16, blue: 0.23)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            ScrollView {
                    VStack(spacing: 24) {
                        // Channel Name
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Channel Name")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            TextField("Enter channel name", text: $channelName)
                                .textFieldStyle(ChannelTextFieldStyle())
                        }
                        
                        // Description
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description (Optional)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            TextEditor(text: $description)
                                .frame(minHeight: 80, maxHeight: 120)
                                .padding(8)
                                .background(Color.white.opacity(0.05))
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                                )
                                .foregroundColor(.white)
                        }
                        
                        // Visibility
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Visibility")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            
                            VStack(spacing: 12) {
                                VisibilityOption(
                                    title: "Public",
                                    description: "Visible in discovery and can be subscribed to",
                                    icon: "eye.fill",
                                    color: .green,
                                    isSelected: visibility == "public",
                                    onTap: { visibility = "public" }
                                )
                                
                                VisibilityOption(
                                    title: "Searchable",
                                    description: "Private but can be found via search",
                                    icon: "magnifyingglass",
                                    color: .yellow,
                                    isSelected: visibility == "searchable",
                                    onTap: { visibility = "searchable" }
                                )
                                
                                VisibilityOption(
                                    title: "Private",
                                    description: "Only accessible via invite links",
                                    icon: "eye.slash.fill",
                                    color: .gray,
                                    isSelected: visibility == "private",
                                    onTap: { visibility = "private" }
                                )
                            }
                        }
                        
                        // Subscription Price
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Subscription Price (Optional)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            TextField("0.00", text: $subscriptionPrice)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(ChannelTextFieldStyle())
                            Text("Set to $0.00 for free channel")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        // Error Message
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 14))
                                .foregroundColor(.red)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        // Create Button
                        Button(action: createChannel) {
                            HStack {
                                if isCreating {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Create Channel")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color(red: 0.0, green: 0.8, blue: 0.7),
                                        Color(red: 0.0, green: 0.7, blue: 0.9)
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(12)
                        }
                        .disabled(isCreating || channelName.isEmpty)
                        .opacity((isCreating || channelName.isEmpty) ? 0.6 : 1.0)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Create Channel")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .navigationBarItems(leading: Button("Cancel") {
                dismiss()
            }.foregroundColor(.white))
    }
    
    private func createChannel() {
        guard !channelName.isEmpty else { return }
        
        isCreating = true
        errorMessage = nil
        
        let price = Double(subscriptionPrice) ?? 0.0
        
        Task {
            do {
                let response = try await channelService.createChannel(
                    channelName: channelName,
                    creatorEmail: userEmail,
                    creatorUsername: authService.username,
                    visibility: visibility,
                    subscriptionPrice: price,
                    description: description
                )
                
                await MainActor.run {
                    if response.success, let channelInfo = response.channel {
                        // Create a MyChannel object from the response
                        let newChannel = ChannelService.MyChannel(
                            channelId: channelInfo.channelId,
                            channelName: channelInfo.channelName,
                            visibility: channelInfo.visibility,
                            subscriptionPrice: channelInfo.subscriptionPrice,
                            description: description,
                            category: "Mixed",
                            posterUrl: nil,
                            createdAt: channelInfo.createdAt,
                            updatedAt: channelInfo.createdAt,
                            creatorUsername: userEmail
                        )
                        onChannelCreated(newChannel)
                    } else {
                        errorMessage = response.message ?? "Failed to create channel"
                        isCreating = false
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                    isCreating = false
                }
            }
        }
    }
}

// Visibility Option Component
struct VisibilityOption: View {
    let title: String
    let description: String
    let icon: String
    let color: Color
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(color.opacity(isSelected ? 0.2 : 0.1))
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 18))
                        .foregroundColor(isSelected ? color : .gray)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                    Text(description)
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(color)
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? color.opacity(0.1) : Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isSelected ? color.opacity(0.5) : Color.white.opacity(0.1), lineWidth: isSelected ? 2 : 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// Text Field Style
struct ChannelTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(16)
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .foregroundColor(.white)
    }
}

// Channel Settings View (for editing existing channels)
struct ChannelSettingsView: View {
    let channel: ChannelService.MyChannel
    let userEmail: String
    let onSettingsUpdated: () -> Void
    
    @Environment(\.dismiss) var dismiss
    @ObservedObject var channelService = ChannelService.shared
    
    @State private var visibility: String
    @State private var subscriptionPrice: String
    @State private var description: String
    @State private var isUpdating = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var showingAddCollaborator = false
    @ObservedObject private var authService = AuthService.shared
    
    init(channel: ChannelService.MyChannel, userEmail: String, onSettingsUpdated: @escaping () -> Void) {
        self.channel = channel
        self.userEmail = userEmail
        self.onSettingsUpdated = onSettingsUpdated
        _visibility = State(initialValue: channel.visibility)
        _subscriptionPrice = State(initialValue: channel.subscriptionPrice > 0 ? String(format: "%.2f", channel.subscriptionPrice) : "")
        _description = State(initialValue: channel.description)
    }
    
    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.06, green: 0.09, blue: 0.16),
                    Color(red: 0.12, green: 0.16, blue: 0.23)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 24) {
                    // Channel Name (read-only)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Channel Name")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                        Text(channel.channelName)
                            .font(.system(size: 16))
                            .foregroundColor(.gray)
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.white.opacity(0.05))
                            .cornerRadius(12)
                    }
                        
                        // Description
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            TextEditor(text: $description)
                                .frame(minHeight: 80, maxHeight: 120)
                                .padding(8)
                                .background(Color.white.opacity(0.05))
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                                )
                                .foregroundColor(.white)
                        }
                        
                        // Visibility
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Visibility")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            
                            VStack(spacing: 12) {
                                VisibilityOption(
                                    title: "Public",
                                    description: "Visible in discovery and can be subscribed to",
                                    icon: "eye.fill",
                                    color: .green,
                                    isSelected: visibility == "public",
                                    onTap: { visibility = "public" }
                                )
                                
                                VisibilityOption(
                                    title: "Searchable",
                                    description: "Private but can be found via search",
                                    icon: "magnifyingglass",
                                    color: .yellow,
                                    isSelected: visibility == "searchable",
                                    onTap: { visibility = "searchable" }
                                )
                                
                                VisibilityOption(
                                    title: "Private",
                                    description: "Only accessible via invite links",
                                    icon: "eye.slash.fill",
                                    color: .gray,
                                    isSelected: visibility == "private",
                                    onTap: { visibility = "private" }
                                )
                            }
                        }
                        
                        // Subscription Price
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Subscription Price")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            TextField("0.00", text: $subscriptionPrice)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(ChannelTextFieldStyle())
                            Text("Set to $0.00 for free channel")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        
                        // Collaborator Management (Admin Only)
                        if UserRoleService.shared.isAdmin(userEmail: userEmail) {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Collaborators")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.white)
                                
                                Button(action: {
                                    showingAddCollaborator = true
                                }) {
                                    HStack {
                                        Image(systemName: "person.badge.plus")
                                        Text("Add Collaborator")
                                    }
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color(red: 0.0, green: 0.8, blue: 0.7),
                                                Color(red: 0.0, green: 0.7, blue: 0.9)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .cornerRadius(12)
                                }
                            }
                        }
                        
                        // Messages
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 14))
                                .foregroundColor(.red)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        if let success = successMessage {
                            Text(success)
                                .font(.system(size: 14))
                                .foregroundColor(.green)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.green.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        // Save Button
                        Button(action: saveSettings) {
                            HStack {
                                if isUpdating {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Save Changes")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color(red: 0.0, green: 0.8, blue: 0.7),
                                        Color(red: 0.0, green: 0.7, blue: 0.9)
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(12)
                        }
                        .disabled(isUpdating)
                        .opacity(isUpdating ? 0.6 : 1.0)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Channel Settings")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .navigationBarItems(leading: Button("Done") {
                dismiss()
            }.foregroundColor(.white))
            .sheet(isPresented: $showingAddCollaborator) {
                AddCollaboratorView(
                    channelName: channel.channelName,
                    userEmail: userEmail,
                    onCollaboratorAdded: {
                        showingAddCollaborator = false
                        successMessage = "Collaborator added successfully"
                    }
                )
            }
    }
    
    private func saveSettings() {
        isUpdating = true
        errorMessage = nil
        successMessage = nil
        
        let price = Double(subscriptionPrice) ?? 0.0
        
        Task {
            // Update visibility if changed
            if visibility != channel.visibility {
                do {
                    let response = try await channelService.updateChannelVisibility(
                        channelId: channel.channelId,
                        channelName: channel.channelName,
                        creatorUsername: channel.creatorUsername,
                        visibility: visibility
                    )
                    
                    if !response.success {
                        await MainActor.run {
                            errorMessage = response.message ?? "Failed to update visibility"
                            isUpdating = false
                        }
                        return
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = "Error updating visibility: \(error.localizedDescription)"
                        isUpdating = false
                    }
                    return
                }
            }
            
            // Update subscription price if changed
            if price != channel.subscriptionPrice {
                do {
                    let response = try await channelService.updateChannelSubscriptionPrice(
                        channelId: channel.channelId,
                        channelName: channel.channelName,
                        creatorUsername: channel.creatorUsername,
                        newPrice: price
                    )
                    
                    if !response.success {
                        await MainActor.run {
                            errorMessage = response.message ?? "Failed to update subscription price"
                            isUpdating = false
                        }
                        return
                    }
                } catch {
                    await MainActor.run {
                        errorMessage = "Error updating price: \(error.localizedDescription)"
                        isUpdating = false
                    }
                    return
                }
            }
            
            await MainActor.run {
                successMessage = "Settings updated successfully"
                isUpdating = false
                
                // Dismiss after a short delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    onSettingsUpdated()
                }
            }
        }
    }
}

