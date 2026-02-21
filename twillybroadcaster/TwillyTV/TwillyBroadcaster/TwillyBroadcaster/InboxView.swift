//
//  InboxView.swift
//  TwillyBroadcaster
//
//  Inbox view to display all video processing notifications
//

import SwiftUI

struct InboxView: View {
    @ObservedObject private var notificationService = NotificationService.shared
    @ObservedObject private var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    @State private var selectedChannel: DiscoverableChannel?
    @State private var showingChannelDetail = false
    @State private var followRequests: [FollowRequest] = []
    @State private var isLoadingFollowRequests = false
    
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
                
                if notificationService.notifications.isEmpty && followRequests.isEmpty {
                    emptyStateView
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            // Mark all as read button
                            if notificationService.unreadCount > 0 {
                                Button(action: {
                                    notificationService.markAllAsRead()
                                }) {
                                    HStack {
                                        Image(systemName: "checkmark.circle.fill")
                                        Text("Mark All as Read")
                                    }
                                    .font(.subheadline)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(8)
                                }
                                .padding(.horizontal)
                                .padding(.top)
                            }
                            
                            // Follow Requests Section (if any)
                            if !followRequests.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Follow Requests")
                                        .font(.headline)
                                        .foregroundColor(.white)
                                        .padding(.horizontal)
                                    
                                    ForEach(followRequests) { request in
                                        FollowRequestCard(request: request) {
                                            acceptFollowRequest(request.requesterEmail)
                                        } onDecline: {
                                            declineFollowRequest(request.requesterEmail)
                                        }
                                        .padding(.horizontal)
                                    }
                                }
                                .padding(.vertical, 8)
                            }
                            
                            // Notifications list - sorted with latest unread at top (Gmail style)
                            ForEach(sortedNotifications) { notification in
                                NotificationCard(notification: notification) {
                                    handleNotificationTap(notification)
                                } onDelete: {
                                    notificationService.deleteNotification(notification.id)
                                }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle("Inbox")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white.opacity(0.7))
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    // Unread count badge only (no refresh button - keep it clean like Gmail)
                    if notificationService.unreadCount > 0 {
                        Text("\(notificationService.unreadCount)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.red)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("NewFollowRequestReceived"))) { _ in
            // CRITICAL: When a new follow request is received, refresh the follow requests list
            print("🔄 [InboxView] Received NewFollowRequestReceived notification - refreshing follow requests")
            Task {
                await loadFollowRequests()
            }
        }
        .fullScreenCover(isPresented: $showingChannelDetail) {
            if let channel = selectedChannel {
                ChannelDetailView(channel: channel, forceRefresh: true, canStream: true)
            }
        }
        .task {
            // Silently refresh all processing notifications when inbox appears
            // No loading indicator - keep it clean like Gmail
            refreshProcessingNotifications()
            
            // Also fetch notifications from API (follow requests, etc.)
            if let userEmail = authService.userEmail {
                await notificationService.fetchNotificationsFromAPI(userEmail: userEmail)
                await loadFollowRequests()
            }
        }
    }
    
    // Sort notifications: unread first (newest to oldest), then read (newest to oldest)
    // This matches Gmail's inbox behavior
    private var sortedNotifications: [StreamNotification] {
        let unread = notificationService.notifications.filter { !$0.isRead }
            .sorted { $0.createdAt > $1.createdAt } // Newest first
        
        let read = notificationService.notifications.filter { $0.isRead }
            .sorted { $0.createdAt > $1.createdAt } // Newest first
        
        return unread + read
    }
    
    private func refreshProcessingNotifications() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [InboxView] Cannot refresh: userEmail is nil")
            return
        }
        
        print("🔄 [InboxView] Refreshing processing notifications")
        notificationService.refreshAllProcessingNotifications(userEmail: userEmail)
    }
    
    private func loadFollowRequests() async {
        guard let userEmail = authService.userEmail else { return }
        
        isLoadingFollowRequests = true
        do {
            let response = try await ChannelService.shared.getFollowRequests(userEmail: userEmail, status: "pending")
            await MainActor.run {
                followRequests = response.requests ?? []
                isLoadingFollowRequests = false
                print("✅ [InboxView] Loaded \(followRequests.count) pending follow requests")
            }
        } catch {
            print("❌ [InboxView] Error loading follow requests: \(error.localizedDescription)")
            await MainActor.run {
                isLoadingFollowRequests = false
            }
        }
    }
    
    private func acceptFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.acceptFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        followRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [InboxView] Accepted follow request from \(requesterEmail)")
                        // Refresh notifications to show acceptance notification
                        Task {
                            if let userEmail = authService.userEmail {
                                await notificationService.fetchNotificationsFromAPI(userEmail: userEmail)
                            }
                        }
                        // CRITICAL: Post notification to refresh Twilly TV content for the requester
                        // This allows the requester to see private content immediately after acceptance
                        NotificationCenter.default.post(
                            name: NSNotification.Name("RefreshTwillyTVContent"),
                            object: nil
                        )
                        print("✅ [InboxView] Posted RefreshTwillyTVContent notification for requester")
                    }
                }
            } catch {
                print("❌ [InboxView] Error accepting follow request: \(error.localizedDescription)")
            }
        }
    }
    
    private func declineFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.declineFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        followRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [InboxView] Declined follow request from \(requesterEmail)")
                    }
                }
            } catch {
                print("❌ [InboxView] Error declining follow request: \(error.localizedDescription)")
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 60))
                .foregroundColor(.gray.opacity(0.5))
            Text("No Notifications")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.white)
            Text("You'll receive notifications when your videos are ready or when you have follow requests")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
    
    private func handleNotificationTap(_ notification: StreamNotification) {
        // Mark as read (both locally and on API)
        notificationService.markAsRead(notification.id)
        if let userEmail = authService.userEmail {
            Task {
                await notificationService.markNotificationAsReadAPI(userEmail: userEmail, notificationId: notification.id)
            }
        }
        
        // Handle navigation based on notification type
        if notification.type == .videoReady,
           let channelName = notification.actionUrl?.replacingOccurrences(of: "channel://", with: "") {
            print("🔔 [InboxView] Video ready notification tapped for channel: \(channelName)")
            
            // Navigate to Discover page with channel filter
            NotificationCenter.default.post(
                name: NSNotification.Name("NavigateToChannelViaDiscover"),
                object: nil,
                userInfo: ["channelName": channelName]
            )
            
            dismiss()
        } else if notification.type == .followRequest {
            // Reload follow requests to show the new request
            Task {
                await loadFollowRequests()
            }
        } else if notification.type == .followAccepted {
            // Follow request was accepted - refresh added usernames in Twilly TV
            print("🔔 [InboxView] Follow request accepted notification - user can now see private content")
            // Post notification to refresh Twilly TV content
            NotificationCenter.default.post(
                name: NSNotification.Name("RefreshTwillyTVContent"),
                object: nil
            )
        }
    }
}

// MARK: - Follow Request Card

struct FollowRequestCard: View {
    let request: FollowRequest
    let onAccept: () -> Void
    let onDecline: () -> Void
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Icon
            Image(systemName: "person.badge.plus")
                .font(.system(size: 18))
                .foregroundColor(.twillyTeal)
                .frame(width: 40, height: 40)
                .background(Color.twillyTeal.opacity(0.2))
                .clipShape(Circle())
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(request.requesterUsername)
                    .font(.headline)
                    .foregroundColor(.white)
                
                if let requestedAt = request.requestedAt {
                    Text(timeAgoString(from: parseDate(requestedAt)))
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            
            Spacer()
            
            // Action buttons
            HStack(spacing: 8) {
                Button(action: onAccept) {
                    Text("Accept")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.twillyTeal)
                        .cornerRadius(8)
                }
                
                Button(action: onDecline) {
                    Text("Decline")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.red.opacity(0.7))
                        .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.twillyTeal.opacity(0.5), lineWidth: 2)
                )
        )
    }
    
    private func parseDate(_ dateString: String) -> Date {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: dateString) ?? Date()
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        }
    }
}

// MARK: - Notification Card

struct NotificationCard: View {
    let notification: StreamNotification
    let onTap: () -> Void
    let onDelete: () -> Void
    
    @State private var isExpanded = false
    
    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // Icon
                iconView
                    .frame(width: 40, height: 40)
                
                // Content
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(notification.title)
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        if !notification.isRead {
                            Circle()
                                .fill(Color.twillyTeal)
                                .frame(width: 8, height: 8)
                        }
                        
                        Spacer()
                        
                        // Delete button
                        Button(action: onDelete) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray.opacity(0.6))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    
                    Text(notification.message)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(2)
                    
                    // Channel and time
                    HStack {
                        Text(notification.channelName)
                            .font(.caption)
                            .foregroundColor(.twillyTeal)
                        
                        Spacer()
                        
                        Text(timeAgoString(from: notification.createdAt))
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                
                Spacer()
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(borderColor, lineWidth: notification.isRead ? 1 : 2)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var iconView: some View {
        ZStack {
            Circle()
                .fill(iconBackgroundColor)
            
            Image(systemName: iconName)
                .foregroundColor(iconColor)
                .font(.system(size: 18))
        }
    }
    
    private var iconName: String {
        switch notification.type {
        case .videoReady:
            return "checkmark.circle.fill"
        case .processing:
            return "clock.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        case .followRequest:
            return "person.badge.plus"
        case .followAccepted:
            return "person.crop.circle.badge.checkmark"
        case .followDeclined:
            return "person.crop.circle.badge.xmark"
        }
    }
    
    private var iconColor: Color {
        switch notification.type {
        case .videoReady:
            return .green
        case .processing:
            return .orange
        case .error:
            return .red
        case .followRequest:
            return .twillyTeal
        case .followAccepted:
            return .green
        case .followDeclined:
            return .red
        }
    }
    
    private var iconBackgroundColor: Color {
        switch notification.type {
        case .videoReady:
            return Color.green.opacity(0.2)
        case .processing:
            return Color.orange.opacity(0.2)
        case .error:
            return Color.red.opacity(0.2)
        case .followRequest:
            return Color.twillyTeal.opacity(0.2)
        case .followAccepted:
            return Color.green.opacity(0.2)
        case .followDeclined:
            return Color.red.opacity(0.2)
        }
    }
    
    private var borderColor: Color {
        if !notification.isRead {
            return Color.twillyTeal.opacity(0.5)
        }
        return Color.white.opacity(0.1)
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        }
    }
}
