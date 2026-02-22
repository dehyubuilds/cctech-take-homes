import SwiftUI

struct PrivateAccessInboxView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var authService = AuthService.shared
    @State private var notifications: [PrivateAccessNotification] = []
    @State private var isLoading = false
    var onDismiss: (() -> Void)? = nil
    
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
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyCyan))
                } else if notifications.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "envelope.open")
                            .font(.system(size: 60))
                            .foregroundColor(.white.opacity(0.3))
                        
                        Text("No Notifications")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        
                        Text("You'll see notifications here when someone adds you to their private content")
                            .font(.body)
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(notifications) { notification in
                                NotificationRow(notification: notification)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("Access Inbox")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        onDismiss?()
                        dismiss()
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
        }
        .onAppear {
            loadNotifications()
        }
    }
    
    private func loadNotifications() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [PrivateAccessInboxView] Cannot load notifications - userEmail is nil")
            return
        }
        
        isLoading = true
        Task {
            do {
                print("🔍 [PrivateAccessInboxView] Fetching notifications for: \(userEmail)")
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                await MainActor.run {
                    print("📬 [PrivateAccessInboxView] Received \(response.notifications?.count ?? 0) total notifications")
                    
                    // Debug: Log all notification types
                    if let allNotifications = response.notifications {
                        let types = Dictionary(grouping: allNotifications, by: { $0.type })
                        for (type, notifs) in types {
                            print("   📋 Type '\(type)': \(notifs.count) notifications")
                        }
                    }
                    
                    // Filter to only show private_access_granted notifications
                    let privateAccessNotifications = (response.notifications ?? []).filter { notification in
                        let matches = notification.type == "private_access_granted"
                        if !matches {
                            print("   ⏭️ Skipping notification type: '\(notification.type)'")
                        }
                        return matches
                    }
                    
                    print("🔒 [PrivateAccessInboxView] Found \(privateAccessNotifications.count) private_access_granted notifications")
                    
                    // Convert AppNotification to PrivateAccessNotification
                    notifications = privateAccessNotifications.map { notification in
                        print("   📝 Processing notification: id=\(notification.id), message='\(notification.message)', metadata=\(notification.metadata ?? [:])")
                        
                        // Extract ownerUsername from metadata, or try to parse from message
                        var ownerUsername = notification.metadata?["ownerUsername"] ?? "Unknown"
                        if ownerUsername == "Unknown" && !notification.message.isEmpty {
                            // Try to extract from message: "You were added to {username}'s private timeline"
                            let message = notification.message
                            if let range = message.range(of: "to ") {
                                let afterTo = String(message[range.upperBound...])
                                if let apostropheRange = afterTo.range(of: "'s") {
                                    ownerUsername = String(afterTo[..<apostropheRange.lowerBound]).trimmingCharacters(in: .whitespaces)
                                }
                            }
                        }
                        
                        let dateFormatter = ISO8601DateFormatter()
                        let date = dateFormatter.date(from: notification.createdAt) ?? Date()
                        
                        return PrivateAccessNotification(
                            id: notification.id,
                            message: notification.message,
                            timestamp: date,
                            ownerUsername: ownerUsername
                        )
                    }
                    .filter { !$0.message.isEmpty } // Filter out any invalid notifications
                    .sorted { $0.timestamp > $1.timestamp } // Most recent first
                    
                    isLoading = false
                    print("✅ [PrivateAccessInboxView] Loaded \(notifications.count) private access notifications")
                }
            } catch {
                print("❌ [PrivateAccessInboxView] Error loading notifications: \(error)")
                print("   Error details: \(error.localizedDescription)")
                if let decodingError = error as? DecodingError {
                    print("   Decoding error: \(decodingError)")
                }
                await MainActor.run {
                    isLoading = false
                }
            }
        }
    }
}

struct NotificationRow: View {
    let notification: PrivateAccessNotification
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.title3)
                .foregroundColor(.twillyCyan)
                .frame(width: 40, height: 40)
                .background(Color.twillyCyan.opacity(0.2))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(notification.message)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                
                Text(notification.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
            }
            
            Spacer()
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}

struct PrivateAccessNotification: Identifiable {
    let id: String
    let message: String
    let timestamp: Date
    let ownerUsername: String
}
