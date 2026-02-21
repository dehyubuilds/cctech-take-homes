//
//  TwillyBroadcasterApp.swift
//  TwillyBroadcaster
//
//  Main App Entry Point - Minimal version
//

import SwiftUI

@main
struct TwillyBroadcasterApp: App {
    @StateObject private var streamManager = StreamManager()
    
    init() {
        // Lock app to portrait mode
        UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(streamManager)
                .preferredColorScheme(.dark)
                .onAppear {
                    // Ensure portrait mode is locked
                    AppDelegate.orientationLock = .portrait
                }
        }
    }
}

// Helper class to manage orientation locking
class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock = UIInterfaceOrientationMask.portrait
    
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        return AppDelegate.orientationLock
    }
}
