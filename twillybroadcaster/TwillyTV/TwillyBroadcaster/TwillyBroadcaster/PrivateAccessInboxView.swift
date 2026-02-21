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
                let response = try await ChannelService.shared.getNotifications(userEmail: userEmail, limit: 100, unreadOnly: false)
                await MainActor.run {
                    // Filter to only show private_access_granted notifications
                    let privateAccessNotifications = (response.notifications ?? []).filter { notification in
                        notification.type == "private_access_granted"
                    }
                    
                    // Convert AppNotification to PrivateAccessNotification
                    notifications = privateAccessNotifications.map { notification in
                        let ownerUsername = notification.metadata?["ownerUsername"] ?? "Unknown"
                        let dateFormatter = ISO8601DateFormatter()
                        let date = dateFormatter.date(from: notification.createdAt) ?? Date()
                        
                        return PrivateAccessNotification(
                            id: notification.id,
                            message: notification.message,
                            timestamp: date,
                            ownerUsername: ownerUsername
                        )
                    }
                    .sorted { $0.timestamp > $1.timestamp } // Most recent first
                    
                    isLoading = false
                    print("✅ [PrivateAccessInboxView] Loaded \(notifications.count) private access notifications")
                }
            } catch {
                print("❌ [PrivateAccessInboxView] Error loading notifications: \(error)")
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
