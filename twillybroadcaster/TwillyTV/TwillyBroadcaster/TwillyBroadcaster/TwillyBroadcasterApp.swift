//
//  TwillyBroadcasterApp.swift
//  TwillyBroadcaster
//
//  Main App Entry Point - Minimal version
//

import SwiftUI

@main
struct TwillyBroadcasterApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var streamManager = StreamManager()
    @ObservedObject private var websocketService = UnifiedWebSocketService.shared
    @ObservedObject private var authService = AuthService.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(streamManager)
                .preferredColorScheme(.dark)
                .onAppear {
                    // Connect to WebSocket when app launches (if user is logged in)
                    if let userEmail = authService.userEmail {
                        let websocketEndpoint = ChannelService.shared.websocketEndpoint
                        websocketService.connect(userEmail: userEmail, websocketEndpoint: websocketEndpoint)
                        
                        // CRITICAL: Check all unreads on app restart and send indicator notifications
                        // This ensures indicators persist across app restarts
                        Task {
                            do {
                                try await ChannelService.shared.checkAllUnreads(viewerEmail: userEmail)
                                print("✅ [TwillyBroadcasterApp] Checked all unreads on app start")
                            } catch {
                                print("⚠️ [TwillyBroadcasterApp] Failed to check all unreads: \(error.localizedDescription)")
                            }
                        }
                        
                        // HYBRID OPTIMIZATION: Preload timeline in background for instant loading
                        // This ensures users never see loading states when navigating to timelines
                        Task.detached { [weak websocketService] in
                            // Wait for WebSocket to connect (ensures we're ready for real-time updates)
                            var attempts = 0
                            while attempts < 10 && (websocketService?.isConnected != true) {
                                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
                                attempts += 1
                            }
                            
                            // Preload "Twilly TV" channel content (most common first view)
                            // This happens in background - doesn't block UI
                            let channelService = ChannelService.shared
                            do {
                                _ = try await channelService.fetchChannelContent(
                                    channelName: "Twilly TV",
                                    creatorEmail: userEmail, // Use user's email as creator
                                    viewerEmail: userEmail,
                                    limit: 20,
                                    nextToken: nil,
                                    forceRefresh: false, // Use cache if available
                                    showPrivateContent: false
                                )
                                print("⚡ [TwillyBroadcasterApp] Preloaded Twilly TV timeline in background")
                            } catch {
                                print("⚠️ [TwillyBroadcasterApp] Failed to preload timeline: \(error.localizedDescription)")
                            }
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // Reconnect WebSocket when app becomes active
                    if let userEmail = authService.userEmail, !websocketService.isConnected {
                        let websocketEndpoint = ChannelService.shared.websocketEndpoint
                        websocketService.connect(userEmail: userEmail, websocketEndpoint: websocketEndpoint)
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
                    // Delay disconnect by 30 seconds (user might switch apps quickly)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
                        if UIApplication.shared.applicationState == .background {
                            websocketService.disconnect()
                        }
                    }
                }
        }
    }
}

// Helper class to manage orientation - allow all orientations by default (locked per view)
class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock = UIInterfaceOrientationMask.all
    
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        return AppDelegate.orientationLock
    }
}
