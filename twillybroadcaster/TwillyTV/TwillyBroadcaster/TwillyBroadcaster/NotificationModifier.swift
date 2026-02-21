//
//  NotificationModifier.swift
//  TwillyBroadcaster
//
//  View modifier to handle notifications and avoid type-checking timeouts
//

import SwiftUI

struct NotificationModifier: ViewModifier {
    @Binding var showingNotification: Bool
    let notificationMessage: String
    @Binding var uploadedChannelName: String?
    @Binding var showUploadSuccessScreen: Bool
    let onUploadComplete: (Notification) -> Void
    
    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("ShowUploadSuccess"))) { notification in
                if let channelName = notification.userInfo?["channelName"] as? String {
                    uploadedChannelName = channelName
                    showUploadSuccessScreen = true
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("UploadComplete"))) { notification in
                onUploadComplete(notification)
            }
            .overlay(alignment: .top) {
                if showingNotification {
                    NotificationBanner(message: notificationMessage)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .padding(.top, 50)
                        .padding(.horizontal, 20)
                        .zIndex(10000) // Very high z-index to ensure it appears above everything
                        .onAppear {
                            print("🔔 [NotificationModifier] NotificationBanner appeared with message: \(notificationMessage)")
                        }
                }
            }
            .onChange(of: showingNotification) { newValue in
                print("🔔 [NotificationModifier] showingNotification changed to: \(newValue), message: \(notificationMessage)")
            }
    }
}
