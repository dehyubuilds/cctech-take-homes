//
//  RecordingPreviewView.swift
//  TwillyBroadcaster
//
//  Snapchat-style preview after local recording
//

import SwiftUI
import AVKit
import AVFoundation

struct RecordingPreviewView: View {
    let videoURL: URL
    @ObservedObject var streamManager: StreamManager
    let recordingOrientation: UIDeviceOrientation
    @Environment(\.dismiss) var dismiss
    @State private var showingChannelSelection = false
    @State private var showingVideoDetails = false
    @State private var showingSimpleChannelPicker = false
    @State private var showingPostChoice = false
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var videoTitle: String = ""
    @State private var videoDescription: String = ""
    @State private var videoPrice: String = ""
    
    var body: some View {
        ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Video preview - full screen playback
                    if streamManager.isMerging {
                        // Show "Preparing playback" while merging
                        Color.black
                            .overlay(
                                VStack(spacing: 20) {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                                        .scaleEffect(1.5)
                                    
                                    Text("Preparing playback...")
                                        .foregroundColor(.white)
                                        .font(.headline)
                                        .fontWeight(.medium)
                                    
                                    Text("Merging your video")
                                        .foregroundColor(.white.opacity(0.6))
                                        .font(.subheadline)
                                }
                            )
                            .ignoresSafeArea()
                    } else if let player = player {
                        RecordingVideoPlayerView(
                            player: player,
                            recordingOrientation: recordingOrientation
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .ignoresSafeArea()
                        .allowsHitTesting(false) // Allow touches to pass through to buttons
                    } else {
                        Color.black
                            .overlay(
                                VStack(spacing: 20) {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: Color.twillyTeal))
                                        .scaleEffect(1.5)
                                    
                                    Text("Loading...")
                                        .foregroundColor(.white)
                                        .font(.headline)
                                        .fontWeight(.medium)
                                }
                            )
                            .ignoresSafeArea()
                    }
                    
                    // Bottom controls - always visible during playback
                    VStack(spacing: 16) {
                        // Recapture button - Twilly themed
                        Button(action: {
                            print("🔍 RecordingPreviewView: Recapture button clicked")
                            
                            // Simple: stop player and clear state
                            player?.pause()
                            streamManager.recordedVideoURL = nil
                            
                            // Dismiss immediately - cleanup will happen in onDisappear
                            dismiss()
                            
                            // Delete file in background (non-blocking)
                            deleteRecording()
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "arrow.counterclockwise")
                                Text("Recapture")
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal.opacity(0.3),
                                        Color.twillyCyan.opacity(0.2)
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 25)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal,
                                                Color.twillyCyan
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                            .cornerRadius(25)
                            .shadow(color: Color.twillyCyan.opacity(0.3), radius: 8, x: 0, y: 4)
                        }
                        
                        // Post to Channel button - Twilly themed
                        Button(action: {
                            print("🔍 RecordingPreviewView: Post to Channel button clicked")
                            showingPostChoice = true
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "arrow.up.circle.fill")
                                Text("Post to Channel")
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal,
                                        Color.twillyCyan,
                                        Color.twillyTeal
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(25)
                            .shadow(color: Color.twillyCyan.opacity(0.5), radius: 12, x: 0, y: 6)
                        }
                        .contentShape(Rectangle()) // Ensure entire button area is tappable
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 24)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.black.opacity(0.8),
                                Color.black.opacity(0.6)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }
                
                // Top controls - Cancel button - Twilly themed
                VStack {
                    HStack {
                        Button(action: {
                            // Clean up player first to prevent frozen frame
                            cleanup()
                            // Delete recording file
                            deleteRecording()
                            // Small delay to ensure cleanup completes
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                dismiss()
                            }
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: "xmark.circle.fill")
                                Text("Cancel")
                            }
                            .foregroundColor(.white.opacity(0.9))
                            .font(.system(size: 17, weight: .semibold))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(
                                Capsule()
                                    .fill(Color.black.opacity(0.4))
                                    .overlay(
                                        Capsule()
                                            .stroke(
                                                LinearGradient(
                                                    gradient: Gradient(colors: [
                                                        Color.twillyTeal.opacity(0.5),
                                                        Color.twillyCyan.opacity(0.3)
                                                    ]),
                                                    startPoint: .leading,
                                                    endPoint: .trailing
                                                ),
                                                lineWidth: 1
                                            )
                                    )
                            )
                        }
                        .padding(.top, 16)
                        .padding(.leading, 20)
                        Spacer()
                    }
                    Spacer()
                }
            }
            .onAppear {
                setupPlayer()
            }
            .onDisappear {
                // Cleanup when view disappears (e.g., when dismissed)
                cleanup()
            }
            .onChange(of: showingPostChoice) { isShowing in
                if isShowing {
                    // Pause video when post choice sheet opens
                    player?.pause()
                    print("⏸️ Paused video playback when post choice opened")
                } else {
                    // Resume video when post choice sheet closes (if not going to another sheet)
                    if !showingVideoDetails && !showingSimpleChannelPicker && streamManager.recordedVideoURL != nil {
                        player?.play()
                        print("▶️ Resumed video playback when post choice closed")
                    }
                }
            }
            .onChange(of: showingVideoDetails) { isShowing in
                if isShowing {
                    // Pause video when video details sheet opens
                    player?.pause()
                    print("⏸️ Paused video playback when video details opened")
                } else {
                    // Resume video when video details sheet closes (if not going to channel picker and video still exists)
                    if !showingSimpleChannelPicker && !showingPostChoice && streamManager.recordedVideoURL != nil {
                        player?.play()
                        print("▶️ Resumed video playback when video details closed")
                    }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("UploadComplete"))) { _ in
                // When upload completes, stop audio IMMEDIATELY and dismiss this preview view
                // ContentView will handle navigation to discover page
                print("✅ [RecordingPreviewView] UploadComplete received - stopping audio IMMEDIATELY")
                
                // Stop audio synchronously - no delays
                if let currentPlayer = player {
                    currentPlayer.pause()
                    currentPlayer.replaceCurrentItem(with: nil)
                }
                
                // Clear player reference
                player = nil
                isPlaying = false
                
                // Dismiss immediately
                dismiss()
            }
            .onChange(of: showingSimpleChannelPicker) { isShowing in
                if isShowing {
                    // Pause video when channel picker opens
                    player?.pause()
                    print("⏸️ Paused video playback when channel picker opened")
                } else {
                    // Resume video when channel picker closes (if video wasn't uploaded)
                    if streamManager.recordedVideoURL != nil {
                        player?.play()
                        print("▶️ Resumed video playback when channel picker closed")
                    }
                }
            }
            .onChange(of: showingChannelSelection) { isShowing in
                if isShowing {
                    // Pause video when channel selection sheet opens
                    player?.pause()
                    print("⏸️ Paused video playback when channel selection opened")
                } else {
                    // When sheet closes, check if video was uploaded (recordedVideoURL is nil)
                    // If uploaded, dismiss this preview view and stop player
                    if streamManager.recordedVideoURL == nil {
                        print("✅ Video was uploaded, dismissing preview and stopping player")
                        cleanup()
                        dismiss()
                    } else {
                        // Resume video when sheet is dismissed (if user comes back without uploading)
                        player?.play()
                        print("▶️ Resumed video playback when channel selection closed")
                    }
                }
            }
            .onChange(of: streamManager.recordedVideoURL) { url in
                // If recordedVideoURL becomes nil (upload completed or deleted), dismiss preview
                print("🔍 RecordingPreviewView: recordedVideoURL changed to \(url?.path ?? "nil")")
                if url == nil && !showingChannelSelection && !showingPostChoice && !showingVideoDetails && !showingSimpleChannelPicker {
                    print("✅ Recorded video URL cleared, dismissing preview")
                    // Immediately stop player to prevent freeze
                    let currentPlayer = player
                    currentPlayer?.pause()
                    currentPlayer?.replaceCurrentItem(with: nil)
                    
                    // Clear player reference
                    player = nil
                    
                    // Immediately dismiss
                    dismiss()
                }
            }
            .fullScreenCover(isPresented: $showingPostChoice) {
                PostChoiceView(
                    onAddDetails: {
                        showingPostChoice = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            showingVideoDetails = true
                        }
                    },
                    onContinuePosting: {
                        // Clear any existing details and go straight to channel picker
                        videoTitle = ""
                        videoDescription = ""
                        videoPrice = ""
                        showingPostChoice = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            showingSimpleChannelPicker = true
                        }
                    }
                )
            }
            .fullScreenCover(isPresented: $showingVideoDetails) {
                VideoDetailsFormView(
                    title: $videoTitle,
                    description: $videoDescription,
                    price: $videoPrice,
                    onSave: {
                        // After saving details, show simple channel picker
                        showingVideoDetails = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            showingSimpleChannelPicker = true
                        }
                    },
                    onCancel: {
                        showingVideoDetails = false
                    }
                )
            }
            .fullScreenCover(isPresented: $showingSimpleChannelPicker) {
                SimpleChannelPickerView(
                    streamManager: streamManager,
                    recordedVideoURL: videoURL,
                    videoTitle: videoTitle,
                    videoDescription: videoDescription,
                    videoPrice: videoPrice
                )
                .onAppear {
                    print("🔍 RecordingPreviewView: Showing SimpleChannelPickerView with values:")
                    print("   videoTitle: '\(videoTitle)'")
                    print("   videoDescription: '\(videoDescription)'")
                    print("   videoPrice: '\(videoPrice)'")
                }
            }
            .gesture(
                DragGesture()
                    .onEnded { value in
                        // Swipe down to dismiss
                        if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                            cleanup()
                            deleteRecording()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                dismiss()
                            }
                        }
                        // Swipe left to dismiss
                        else if value.translation.width < -100 || value.predictedEndTranslation.width < -200 {
                            cleanup()
                            deleteRecording()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                dismiss()
                            }
                        }
                    }
            )
    }
    
    private func setupPlayer() {
        // SIMPLE: Create and play immediately - no delays, no observers
        player = AVPlayer(url: videoURL)
        player?.play()
        isPlaying = true
    }
    
    private func cleanup() {
        // Simple: just stop and clear
        player?.pause()
        player = nil
        isPlaying = false
    }
    
    private func deleteRecording() {
        // Delete the recorded file to free up space
        streamManager.deleteRecordedFile()
    }
}

// MARK: - Custom Video Player View that respects recording orientation
struct RecordingVideoPlayerView: UIViewControllerRepresentable {
    let player: AVPlayer
    let recordingOrientation: UIDeviceOrientation
    
    func makeUIViewController(context: Context) -> RecordingOrientationAwarePlayerViewController {
        let controller = RecordingOrientationAwarePlayerViewController()
        
        // SIMPLE: Always portrait (Twilly only supports portrait)
        print("🔍 RecordingVideoPlayerView - Portrait mode (Twilly only supports portrait)")
        
        // Set orientation lock and video gravity
        controller.isPortraitVideo = true
        controller.hasDetectedVideoOrientation = true
        controller.recordingOrientation = .portrait
        controller.videoGravity = .resizeAspectFill  // Full screen for portrait
        controller.showsPlaybackControls = false  // Hide controls for full screen experience
        
        // Set player after view appears to avoid hang
        controller.pendingPlayer = player
        
        return controller
    }
    
    func updateUIViewController(_ uiViewController: RecordingOrientationAwarePlayerViewController, context: Context) {
        if uiViewController.player != player {
            // Only update if view has appeared to avoid hang
            if uiViewController.hasAppeared {
                uiViewController.player = player
                player.play()
            } else {
                uiViewController.pendingPlayer = player
            }
        }
    }
}

// MARK: - Orientation-Aware Player View Controller for Recording Preview
class RecordingOrientationAwarePlayerViewController: AVPlayerViewController {
    var isPortraitVideo = false
    var hasDetectedVideoOrientation = false
    var recordingOrientation: UIDeviceOrientation = .portrait
    var pendingPlayer: AVPlayer?
    var hasAppeared = false
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        // SIMPLE: Always portrait only (Twilly only supports portrait)
        return .portrait
    }
    
    override var shouldAutorotate: Bool {
        // SIMPLE: Never rotate (Twilly only supports portrait)
        return false
    }
    
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        // SIMPLE: Always portrait (Twilly only supports portrait)
        return .portrait
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        hasAppeared = true
        
        // Set player now that view is ready (prevents hang on initial load)
        if let pendingPlayer = pendingPlayer {
            player = pendingPlayer
            pendingPlayer.play()
            self.pendingPlayer = nil
        }
    }
}

