//
//  StreamManager.swift
//  TwillyBroadcaster
//
//  RTMP Streaming Manager using HaishinKit
//

import Foundation
import AVFoundation
import UIKit
import HaishinKit

enum StreamStatus: Equatable {
    case ready
    case connecting
    case streaming
    case stopped
    case error(String)
    
    static func == (lhs: StreamStatus, rhs: StreamStatus) -> Bool {
        switch (lhs, rhs) {
        case (.ready, .ready), (.connecting, .connecting), (.streaming, .streaming), (.stopped, .stopped):
            return true
        case (.error(let lhsMsg), .error(let rhsMsg)):
            return lhsMsg == rhsMsg
        default:
            return false
        }
    }
}

class StreamManager: NSObject, ObservableObject, AVCaptureFileOutputRecordingDelegate {
    // Stream components
    var rtmpConnection: RTMPConnection
    var rtmpStream: RTMPStream
    private var fullStreamURL: String = ""
    
    // Published properties for UI
    @Published var status: StreamStatus = .ready
    @Published var streamURL: String = ""
    @Published var duration: TimeInterval = 0
    @Published var isStreaming: Bool = false
    
    // Timer for duration tracking
    private var durationTimer: Timer?
    private var streamStartTime: Date?
    
    // Connection timeout timer
    private var connectionTimeoutTimer: Timer?
    
    // Flag to track if we're waiting to publish after connection
    private var pendingPublish: Bool = false
    private var pendingStreamKey: String = ""
    
    // Store channel info for post-stream actions
    @Published var currentChannelName: String?
    @Published var currentStreamKey: String?
    
    // Camera position tracking
    @Published var currentCameraPosition: AVCaptureDevice.Position = .back
    private var currentCamera: AVCaptureDevice?
    private var isAttachingCamera = false // Prevent multiple simultaneous attachments
    
    // Zoom support
    @Published var currentZoomFactor: CGFloat = 1.0
    private var initialZoomFactor: CGFloat = 1.0
    
    // Orientation support
    private var currentOrientation: UIDeviceOrientation = .portrait
    
    // Overlay support - using HaishinKit's Screen API (for client-side)
    // Also sends metadata to backend for server-side encoding
    private var overlayImage: UIImage?
    private var overlayScreenObject: ImageScreenObject?
    private var currentOverlay: StreamOverlay?
    
    // Local recording support (Snapchat-style)
    private var localRecordingSession: AVCaptureSession?
    private var localMovieFileOutput: AVCaptureMovieFileOutput?
    private var recordingPreviewLayer: AVCaptureVideoPreviewLayer?
    // Alternative recording approach (not currently used)
    private var videoDataOutput: AVCaptureVideoDataOutput?
    private var audioDataOutput: AVCaptureAudioDataOutput?
    private var assetWriter: AVAssetWriter?
    private var videoWriterInput: AVAssetWriterInput?
    private var audioWriterInput: AVAssetWriterInput?
    private var recordingQueue = DispatchQueue(label: "com.twilly.recording")
    private var isWritingStarted = false
    @Published var isRecording: Bool = false
    @Published var isRecordingSessionReady: Bool = false // Track when recording session is actually running
    @Published var isMerging: Bool = false // Track merge progress for UI
    @Published var recordedVideoURL: URL?
    @Published var recordingDuration: TimeInterval = 0
    @Published var recordingStopOrientation: UIDeviceOrientation = .portrait
    private var recordingStartTime: Date?
    private var recordingTimer: Timer?
    private var isSwitchingCameraDuringRecording: Bool = false // Flag to prevent delegate from stopping recording
    private var recordingSegments: [URL] = [] // Track all video segments created during recording (one per camera switch)
    private var recordingDidActuallyStart: Bool = false // Track if didStartRecordingTo delegate fired
    
    // Get preview orientation - LOCKED TO PORTRAIT
    func getPreviewOrientation() -> AVCaptureVideoOrientation {
        // Always return portrait - app is locked to portrait mode
        return .portrait
    }
    
    override init() {
        rtmpConnection = RTMPConnection()
        rtmpStream = RTMPStream(connection: rtmpConnection)
        
        super.init()
        
        setupRTMPConnection()
    }
    
    // MARK: - Setup
    
    private func setupRTMPConnection() {
        // Initial orientation setup
        updateStreamOrientation()
        
        rtmpStream.audioSettings = AudioCodecSettings(
            bitRate: 128000 // 128 kbps
        )
        
        // Note: Off-screen rendering may not be needed - Screen API should work without it
        // If overlays don't work, we may need to enable: rtmpStream.videoMixerSettings.mode = .offscreen
        
        // Set up status event listener
        rtmpConnection.addEventListener(.rtmpStatus, selector: #selector(on(status:)), observer: self)
        
        // Also listen for error events
        rtmpConnection.addEventListener(.ioError, selector: #selector(on(error:)), observer: self)
        rtmpStream.addEventListener(.ioError, selector: #selector(on(error:)), observer: self)
    }
    
    // MARK: - Orientation Management
    
    func updateStreamOrientation() {
        // LOCKED TO PORTRAIT - Always use portrait settings regardless of device rotation
        let videoOrientation: AVCaptureVideoOrientation = .portrait
        let videoSize: CGSize = CGSize(width: 720, height: 1280)
        currentOrientation = .portrait
        
        // Update video orientation first - this tells the encoder how to rotate frames
        rtmpStream.videoOrientation = videoOrientation
        
        // Update video settings with correct dimensions
        rtmpStream.videoSettings = VideoCodecSettings(
            videoSize: videoSize,
            bitRate: 2000000 // 2 Mbps
        )
        
        print("📱 Orientation LOCKED to Portrait - \(videoSize.width)x\(videoSize.height), orientation: \(videoOrientation.rawValue)")
    }
    
    @objc private func on(error: Notification) {
        print("❌ RTMP Error Event: \(error)")
        if let errorInfo = error.userInfo {
            print("❌ Error Info: \(errorInfo)")
        }
        DispatchQueue.main.async {
            if case .connecting = self.status {
                self.status = .error("RTMP connection error occurred")
                self.isStreaming = false
                self.pendingPublish = false
                self.stopDurationTimer()
                // Re-enable idle timer on error
                UIApplication.shared.isIdleTimerDisabled = false
            }
        }
    }
    
    // MARK: - Stream URL Management
    
    func setStreamKey(_ url: String, channelName: String? = nil) {
        let input = url.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if input.contains("rtmp://") {
            // Full URL provided: rtmp://100.24.103.57:1935/live/sk_xxxxx
            fullStreamURL = input
        } else {
            // If just key provided, construct full URL
            // Default server: rtmp://100.24.103.57:1935/live
            fullStreamURL = "rtmp://100.24.103.57:1935/live/\(input)"
        }
        
        streamURL = fullStreamURL
        
        // Store channel name if provided
        if let channelName = channelName {
            currentChannelName = channelName
        }
        
        // Extract and store stream key
        if let (_, streamKey) = parseRTMPURL() {
            currentStreamKey = streamKey
        }
    }
    
    private func parseRTMPURL() -> (baseURL: String, streamKey: String)? {
        guard !fullStreamURL.isEmpty else { return nil }
        
        // Parse: rtmp://100.24.103.57:1935/live/sk_xxxxx
        // Base: rtmp://100.24.103.57:1935/live
        // Key: sk_xxxxx
        
        // Find the last '/' to separate base URL from stream key
        guard let lastSlashIndex = fullStreamURL.lastIndex(of: "/") else {
            return nil
        }
        
        // Base URL is everything up to (but not including) the last '/'
        let baseURL = String(fullStreamURL[..<lastSlashIndex])
        
        // Stream key is everything after the last '/'
        let streamKey = String(fullStreamURL[fullStreamURL.index(after: lastSlashIndex)...])
        
        guard !baseURL.isEmpty && !streamKey.isEmpty else {
            return nil
        }
        
        return (baseURL, streamKey)
    }
    
    // MARK: - Overlay Management
    
    func setOverlay(_ overlay: StreamOverlay?) {
        print("🔍 [OVERLAY] setOverlay() called with overlay: \(overlay?.name ?? "nil")")
        
        // Remove existing overlay (client-side)
        removeOverlay()
        
        // Store overlay
        currentOverlay = overlay
        overlayImage = overlay?.getImage()
        
        print("🔍 [OVERLAY] currentOverlay stored: \(currentOverlay != nil ? "YES (\(currentOverlay?.name ?? "unknown"))" : "NO")")
        print("🔍 [OVERLAY] overlayImage loaded: \(overlayImage != nil ? "YES (\(overlayImage?.size.width ?? 0)x\(overlayImage?.size.height ?? 0))" : "NO")")
        
        // Add new overlay if image exists (client-side preview)
        if let overlayImage = overlayImage {
            print("📷 Overlay image loaded: \(overlayImage.size.width)x\(overlayImage.size.height)")
            addOverlay(image: overlayImage, overlayName: overlay?.name ?? "Unknown")
        } else {
            print("ℹ️ Overlay removed from stream")
            if overlay != nil {
                print("⚠️ Warning: Overlay provided but image is nil - check image loading")
            }
        }
    }
    
    private func removeOverlay() {
        if let existingObject = overlayScreenObject {
            rtmpStream.screen.removeChild(existingObject)
            overlayScreenObject = nil
            print("🔄 Previous overlay removed")
        }
    }
    
    private func addOverlay(image: UIImage, overlayName: String) {
        guard let cgImage = image.cgImage else {
            print("❌ Failed to get CGImage from overlay image")
            return
        }
        
        // Create ImageScreenObject
        let imageScreenObject = ImageScreenObject()
        imageScreenObject.cgImage = cgImage
        
        // Position overlay at bottom-right with padding
        // layoutMargin: top, left, bottom, right (from edges)
        imageScreenObject.layoutMargin = .init(top: 0, left: 0, bottom: 16, right: 16)
        
        // Add to screen
        do {
            try rtmpStream.screen.addChild(imageScreenObject)
            overlayScreenObject = imageScreenObject
            print("✅ Overlay '\(overlayName)' added to stream screen (isStreaming: \(isStreaming))")
        } catch {
            print("❌ Failed to add overlay to screen: \(error)")
        }
    }
    
    // MARK: - Camera Setup
    
    func setupCameraPreview() {
        // Don't set up if already attaching or recording
        guard !isAttachingCamera, !isRecording else {
            print("⚠️ Skipping setupCameraPreview - attachment in progress or recording")
            return
        }
        
        // Enable orientation notifications
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        
        // Check if we already have permissions - if so, attach immediately
        let authStatus = AVCaptureDevice.authorizationStatus(for: .video)
        if authStatus == .authorized {
            // Permissions already granted - attach camera immediately
            print("📷 Camera permissions already granted - attaching immediately")
            attachCamera()
        } else {
            // Request permissions (non-blocking)
            requestPermissions { [weak self] granted in
                guard let self = self else { return }
                
                if granted {
                    // Attach camera immediately on main thread
                    DispatchQueue.main.async {
                        self.attachCamera()
                    }
                } else {
                    print("⚠️ Camera permissions not granted")
                }
            }
        }
    }
    
    // Stop camera preview and clean up resources
    func stopCameraPreview() {
        print("📷 [StreamManager] Stopping camera preview and cleaning up resources")
        
        // Stop orientation notifications
        UIDevice.current.endGeneratingDeviceOrientationNotifications()
        
        // Detach camera from RTMP stream
        rtmpStream.attachCamera(nil)
        currentCamera = nil
        isAttachingCamera = false
        
        // Remove event listeners to prevent crashes
        rtmpConnection.removeEventListener(.rtmpStatus, selector: #selector(on(status:)), observer: self)
        rtmpConnection.removeEventListener(.ioError, selector: #selector(on(error:)), observer: self)
        rtmpStream.removeEventListener(.ioError, selector: #selector(on(error:)), observer: self)
        
        print("✅ [StreamManager] Camera preview stopped and resources cleaned up")
    }
    
    func clearCameraAttachmentFlag() {
        // Clear flag to allow fresh attachment (used when returning from preview)
        isAttachingCamera = false
        print("✅ Cleared camera attachment flag")
    }
    
    func toggleCamera() {
        print("🔍 StreamManager: toggleCamera() called - current position: \(currentCameraPosition == .back ? "back" : "front")")
        guard !isRecording else {
            print("⚠️ Cannot flip camera during recording")
            return
        }
        // Switch between front and back camera
        let newPosition: AVCaptureDevice.Position = currentCameraPosition == .back ? .front : .back
        print("🔍 StreamManager: Switching to: \(newPosition == .back ? "back" : "front")")
        switchCamera(to: newPosition)
        // Don't post CameraReady here - it will be posted by attachCamera() when the camera is actually attached
    }
    
    func switchCamera(to position: AVCaptureDevice.Position) {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
            print("❌ Camera not available for position: \(position == .back ? "back" : "front")")
            return
        }
        
        // Clear attachment flag to allow immediate switch
        isAttachingCamera = false
        
        currentCameraPosition = position
        currentCamera = camera
        
        // If recording, switch camera in the recording session
        if isRecording {
            switchCameraDuringRecording(to: camera)
        } else if isStreaming {
            // When streaming, directly attach new camera to RTMP stream without detaching first
            // This prevents black screen during active stream
            print("📷 Switching camera during active stream to: \(position == .back ? "Back" : "Front")")
            
            // Reset zoom when camera changes
            currentZoomFactor = 1.0
            initialZoomFactor = 1.0
            
            // Directly attach new camera to RTMP stream (no detach step to prevent black screen)
            isAttachingCamera = true
            rtmpStream.attachCamera(camera) { [weak self] captureUnit, error in
                guard let self = self else { return }
                
                self.isAttachingCamera = false
                
                if let error = error {
                    DispatchQueue.main.async {
                        print("❌ Camera attachment error during stream: \(error)")
                    }
                } else {
                    DispatchQueue.main.async {
                        print("✅ Camera switched successfully during stream")
                        // Reset zoom after camera switch
                        self.setZoomFactor(1.0)
                        // Update orientation after camera switch
                        self.updateStreamOrientation()
                        // Notify that camera is ready for preview - post multiple times to ensure it's received
                        NotificationCenter.default.post(name: NSNotification.Name("CameraReady"), object: nil)
                        NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                        // Additional notification with slight delay to ensure preview updates
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                            guard self != nil else { return }
                            NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                        }
                    }
                }
            }
        } else {
            // Not streaming or recording - use normal attach flow
            attachCamera(camera)
            // Update orientation after camera switch
            updateStreamOrientation()
            // Post notification to force preview refresh immediately
            DispatchQueue.main.async { [weak self] in
                NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
            }
        }
    }
    
    private func switchCameraDuringRecording(to newCamera: AVCaptureDevice) {
        guard let session = localRecordingSession else {
            print("⚠️ No recording session active, cannot switch camera")
            return
        }
        
        guard let movieOutput = localMovieFileOutput else {
            print("⚠️ No movie output found, cannot switch camera during recording")
            return
        }
        
        // CRITICAL: Prevent multiple simultaneous camera switches
        if isSwitchingCameraDuringRecording {
            print("⚠️ Camera switch already in progress, ignoring duplicate request")
            return
        }
        
        // CRITICAL: Use isRecording flag instead of movieOutput.isRecording
        // movieOutput.isRecording can be false temporarily during session reconfiguration
        // but we're still recording (isRecording flag is true)
        guard isRecording else {
            print("⚠️ Not recording (isRecording=false), cannot switch camera")
            return
        }
        
        print("📷 Switching camera during recording to: \(newCamera.position == .back ? "Back" : "Front")")
        print("📹 Recording status before switch: isRecording=\(movieOutput.isRecording)")
        
        // CRITICAL: Set flag to prevent delegate from stopping recording during switch
        isSwitchingCameraDuringRecording = true
        
        // CRITICAL: Get the video connection BEFORE modifying session
        // This ensures we can reconnect it after switching inputs
        guard let videoConnection = movieOutput.connection(with: .video) else {
            print("❌ No video connection found on movie output")
            isSwitchingCameraDuringRecording = false
            return
        }
        
        // IMPORTANT: We must switch the camera input while recording continues
        // AVCaptureMovieFileOutput cannot be paused, so we switch inputs seamlessly
        session.beginConfiguration()
        
        // Store connection state before removing input (not needed but kept for reference)
        
        // Remove old camera input
        if let oldInput = session.inputs.first(where: { ($0 as? AVCaptureDeviceInput)?.device.hasMediaType(.video) == true }) as? AVCaptureDeviceInput {
            session.removeInput(oldInput)
            print("📷 Removed old camera input")
        }
        
        // Add new camera input
        do {
            let newCameraInput = try AVCaptureDeviceInput(device: newCamera)
            if session.canAddInput(newCameraInput) {
                session.addInput(newCameraInput)
                print("📷 Added new camera input")
            } else {
                print("❌ Cannot add new camera input to session")
                session.commitConfiguration()
                return
            }
        } catch {
            print("❌ Failed to add new camera input: \(error)")
            session.commitConfiguration()
            return
        }
        
        // CRITICAL: The connection should automatically reconnect to the new input
        // We just need to ensure the connection settings are preserved
        // The system will automatically find the new video port after commitConfiguration
        
        // Update movie output connection settings for new camera
        if videoConnection.isVideoOrientationSupported {
            // Use current orientation (supports both portrait and landscape)
            videoConnection.videoOrientation = getPreviewOrientation()
        }
        // Update mirroring for new camera (no mirroring - natural view)
        videoConnection.automaticallyAdjustsVideoMirroring = false
        videoConnection.isVideoMirrored = false // SNAPCHAT-STYLE: No mirroring
        print("📱 Updated movie output: mirrored=false (natural selfie view)")
        
        // Commit configuration - recording continues seamlessly
        session.commitConfiguration()
        
        // CRITICAL: Ensure connection is active after switch
        if !videoConnection.isActive {
            print("⚠️ Video connection is not active, attempting to activate...")
            // The connection should automatically reactivate, but we verify
        }
        
        // CRITICAL: Ensure isRecording stays true - never let it become false during camera switch
        // The UI depends on this to show the correct state
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            // Force isRecording to stay true during camera switch
            if !self.isRecording {
                print("⚠️ isRecording was false, restoring to true during camera switch")
                self.isRecording = true
            }
        }
        
        // Verify recording is still active after switch and clear flag
        // Use a shorter delay to allow faster subsequent switches
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self = self else { return }
            // Clear the flag after switch is complete - allows next switch
            self.isSwitchingCameraDuringRecording = false
            print("✅ Camera switch complete - flag cleared, ready for next switch")
            
            // CRITICAL: Ensure isRecording stays true if we're still supposed to be recording
            // Don't check movieOutput.isRecording as it can be false temporarily during reconfiguration
            if self.isRecording {
                // Recording should continue - verify session is still running
                if let session = self.localRecordingSession, session.isRunning {
                    print("✅ Recording continues after camera switch - session running")
                } else {
                    print("⚠️ WARNING: Session not running after camera switch")
                }
            }
        }
        
        // Update preview layer to show new camera
        if let previewLayer = recordingPreviewLayer {
            if let connection = previewLayer.connection, connection.isVideoOrientationSupported {
                // Use current orientation (supports both portrait and landscape)
                connection.videoOrientation = getPreviewOrientation()
                connection.automaticallyAdjustsVideoMirroring = false
                connection.isVideoMirrored = false // SNAPCHAT-STYLE: No mirroring
                print("📱 Updated preview layer: mirrored=false (natural selfie view)")
            }
        }
        
        // Update current camera reference (but don't call attachCamera as it's for RTMP, not recording)
        currentCamera = newCamera
        
        print("✅ Camera switched during recording - isRecording=\(isRecording), movieOutput.isRecording=\(movieOutput.isRecording)")
        
        // CRITICAL: If recording was stopped by iOS during camera switch, restart it immediately
        // Check after a brief delay to see if recording is still active
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            guard let self = self else { return }
            if self.isRecording, let movieOutput = self.localMovieFileOutput, !movieOutput.isRecording {
                print("🔄 Recording was stopped during camera switch, restarting immediately...")
                self.restartRecordingAfterCameraSwitch()
            }
        }
    }
    
    // Complete recording cleanup and show preview
    private func completeRecordingCleanup() {
        // Reset flag for next recording
        recordingDidActuallyStart = false
        // Stop recording session on background queue
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            self.localRecordingSession?.stopRunning()
            
            DispatchQueue.main.async {
                // CRITICAL: Reattach camera to RTMP stream for preview BEFORE clearing recording state
                // This ensures camera preview is ready immediately when recording ends
                if let camera = self.currentCamera {
                    print("📷 Reattaching camera to RTMP stream for preview after recording")
                    self.attachCamera(camera)
                } else {
                    // Get camera if not set
                    let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: self.currentCameraPosition) ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)!
                    self.currentCamera = camera
                    print("📷 Getting camera and attaching to RTMP stream for preview")
                    self.attachCamera(camera)
                }
                
                // Update orientation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                    guard let self = self else { return }
                    self.updateStreamOrientation()
                }
                
                // Now safe to clear recording resources and update UI
                self.localRecordingSession = nil
                self.localMovieFileOutput = nil
                self.recordingPreviewLayer = nil
                self.isRecording = false
                self.isRecordingSessionReady = false
                self.stopRecordingTimer()
                
                // Clean up segment files (except the final merged one)
                self.cleanupSegmentFiles()
                
                // Post notification to force preview refresh
                NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
                
                // Post notification to auto-show preview - recordedVideoURL is already set
                print("🔍 Posting RecordingFinished notification - recordedVideoURL: \(self.recordedVideoURL?.lastPathComponent ?? "nil")")
                NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
            }
        }
    }
    
    // Merge multiple video segments into one continuous video using AVAssetReader/Writer
    // This approach re-encodes everything, handling codec incompatibilities
    private func mergeVideoSegments(completion: @escaping (URL?) -> Void) {
        guard recordingSegments.count > 1 else {
            completion(recordingSegments.first)
            return
        }
        
        // Filter out segments that don't exist
        let validSegments = recordingSegments.filter { FileManager.default.fileExists(atPath: $0.path) }
        
        guard validSegments.count > 0 else {
            print("❌ No valid segments to merge")
            completion(nil)
            return
        }
        
        if validSegments.count == 1 {
            // Only one valid segment, use it directly
            completion(validSegments.first)
            return
        }
        
        print("🔗 Merging \(validSegments.count) video segments using AVAssetWriter (re-encoding)...")
        
        // Process on background queue
        DispatchQueue.global(qos: .userInitiated).async {
            let tempDir = FileManager.default.temporaryDirectory
            let fileName = "recording_merged_\(UUID().uuidString).mov"
            let outputURL = tempDir.appendingPathComponent(fileName)
            
            // Delete output file if it exists
            try? FileManager.default.removeItem(at: outputURL)
            
            // Create asset writer
            guard let assetWriter = try? AVAssetWriter(outputURL: outputURL, fileType: .mov) else {
                print("❌ Failed to create asset writer")
                completion(nil)
                return
            }
            
            // Configure video output settings (portrait: 720x1280, 30fps)
            let videoSettings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: 720,
                AVVideoHeightKey: 1280,
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: 5_000_000, // 5 Mbps
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
                ]
            ]
            
            let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
            videoInput.expectsMediaDataInRealTime = false
            
            // Configure audio output settings
            let audioSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderBitRateKey: 128000
            ]
            
            let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            audioInput.expectsMediaDataInRealTime = false
            
            guard assetWriter.canAdd(videoInput), assetWriter.canAdd(audioInput) else {
                print("❌ Cannot add inputs to asset writer")
                completion(nil)
                return
            }
            
            assetWriter.add(videoInput)
            assetWriter.add(audioInput)
            
            // Create video adapter BEFORE starting writing
            // The adapter must be created before startWriting() is called
            let videoAdapter = AVAssetWriterInputPixelBufferAdaptor(
                assetWriterInput: videoInput,
                sourcePixelBufferAttributes: [
                    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                    kCVPixelBufferWidthKey as String: 720,
                    kCVPixelBufferHeightKey as String: 1280
                ]
            )
            
            guard assetWriter.startWriting() else {
                print("❌ Failed to start writing: \(assetWriter.error?.localizedDescription ?? "unknown")")
                completion(nil)
                return
            }
            
            var currentTime = CMTime.zero
            var hasError = false
            
            // Process each segment sequentially
            for (index, segmentURL) in validSegments.enumerated() {
                if hasError { break }
                
                let asset = AVAsset(url: segmentURL)
                
                // Load tracks asynchronously
                let loadGroup = DispatchGroup()
                var videoTrack: AVAssetTrack?
                var audioTrack: AVAssetTrack?
                var videoTimeRange: CMTimeRange?
                var videoTransform: CGAffineTransform?
                
                loadGroup.enter()
                asset.loadTracks(withMediaType: .video) { tracks, error in
                    videoTrack = tracks?.first
                    if let track = videoTrack {
                        track.loadValuesAsynchronously(forKeys: ["timeRange", "preferredTransform"]) {
                            var timeRangeError: NSError?
                            var transformError: NSError?
                            let timeRangeStatus = track.statusOfValue(forKey: "timeRange", error: &timeRangeError)
                            let transformStatus = track.statusOfValue(forKey: "preferredTransform", error: &transformError)
                            
                            if timeRangeStatus == .loaded {
                                videoTimeRange = track.timeRange
                            }
                            if transformStatus == .loaded {
                                videoTransform = track.preferredTransform
                            }
                            loadGroup.leave()
                        }
                    } else {
                        loadGroup.leave()
                    }
                }
                
                loadGroup.enter()
                asset.loadTracks(withMediaType: .audio) { tracks, error in
                    audioTrack = tracks?.first
                    loadGroup.leave()
                }
                
                loadGroup.wait()
                
                guard let vTrack = videoTrack else {
                    print("⚠️ Segment \(index) missing video track, skipping")
                    continue
                }
                
                let videoDuration = videoTimeRange?.duration ?? asset.duration
                
                guard videoDuration != .zero else {
                    print("⚠️ Segment \(index) has zero duration, skipping")
                    continue
                }
                
                // Create asset readers for this segment
                guard let videoReader = try? AVAssetReader(asset: asset) else {
                    print("❌ Failed to create video reader for segment \(index)")
                    hasError = true
                    break
                }
                
                // Create audio reader only if audio track exists
                let audioReader = audioTrack != nil ? (try? AVAssetReader(asset: asset)) : nil
                if audioTrack != nil && audioReader == nil {
                    print("⚠️ Failed to create audio reader for segment \(index), continuing without audio")
                }
                
                // Configure video reader output
                let videoOutput = AVAssetReaderTrackOutput(track: vTrack, outputSettings: [
                    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
                ])
                videoOutput.alwaysCopiesSampleData = false
                
                guard videoReader.canAdd(videoOutput) else {
                    print("❌ Cannot add video output to reader")
                    hasError = true
                    break
                }
                videoReader.add(videoOutput)
                
                // Configure audio reader output (if audio track exists)
                // We need to decode audio to uncompressed format since we're re-encoding
                var audioOutput: AVAssetReaderTrackOutput? = nil
                if let aTrack = audioTrack, let audioReader = audioReader {
                    // Decode audio to uncompressed format for re-encoding
                    let audioOutputSettings: [String: Any] = [
                        AVFormatIDKey: kAudioFormatLinearPCM,
                        AVLinearPCMBitDepthKey: 16,
                        AVLinearPCMIsBigEndianKey: false,
                        AVLinearPCMIsFloatKey: false,
                        AVLinearPCMIsNonInterleaved: false
                    ]
                    
                    let tempAudioOutput = AVAssetReaderTrackOutput(track: aTrack, outputSettings: audioOutputSettings)
                    tempAudioOutput.alwaysCopiesSampleData = false
                    
                    if audioReader.canAdd(tempAudioOutput) {
                        audioReader.add(tempAudioOutput)
                        audioOutput = tempAudioOutput
                    } else {
                        print("⚠️ Cannot add audio output to reader, continuing without audio")
                    }
                }
                
                // Start reading
                guard videoReader.startReading() else {
                    print("❌ Failed to start reading video for segment \(index)")
                    hasError = true
                    break
                }
                
                if let audioReader = audioReader {
                    if !audioReader.startReading() {
                        print("⚠️ Failed to start reading audio for segment \(index), continuing without audio")
                    }
                }
                
                // Start session if this is the first segment
                if index == 0 {
                    assetWriter.startSession(atSourceTime: .zero)
                } else {
                    assetWriter.startSession(atSourceTime: currentTime)
                }
                
                // Process video samples using the pre-created adapter
                // Use Core Image context for transformations
                let ciContext = CIContext()
                
                while videoInput.isReadyForMoreMediaData && !hasError {
                    if let sampleBuffer = videoOutput.copyNextSampleBuffer() {
                        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                        let adjustedTime = CMTimeAdd(presentationTime, currentTime)
                        
                        if let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
                            var bufferToAppend: CVPixelBuffer = pixelBuffer
                            
                            // Get original buffer dimensions
                            let originalWidth = CVPixelBufferGetWidth(pixelBuffer)
                            let originalHeight = CVPixelBufferGetHeight(pixelBuffer)
                            
                            // Check if we need to transform or scale
                            let needsTransform = videoTransform != nil && videoTransform != .identity
                            let needsScaling = originalWidth != 720 || originalHeight != 1280
                            
                            if needsTransform || needsScaling {
                                // Create output buffer from pool
                                var outputBuffer: CVPixelBuffer?
                                let status = CVPixelBufferPoolCreatePixelBuffer(nil, videoAdapter.pixelBufferPool!, &outputBuffer)
                                
                                if status == kCVReturnSuccess, let output = outputBuffer {
                                    // Lock buffers
                                    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
                                    CVPixelBufferLockBaseAddress(output, [])
                                    
                                    defer {
                                        CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly)
                                        CVPixelBufferUnlockBaseAddress(output, [])
                                    }
                                    
                                    // Create CIImage from source pixel buffer
                                    let sourceImage = CIImage(cvPixelBuffer: pixelBuffer)
                                    
                                    // Determine the actual dimensions after applying preferredTransform
                                    // The preferredTransform tells us how the video should be displayed
                                    var transformedImage = sourceImage
                                    var effectiveWidth = CGFloat(originalWidth)
                                    var effectiveHeight = CGFloat(originalHeight)
                                    
                                    // Apply preferredTransform if it exists
                                    // This transform rotates/flips the video to correct orientation
                                    if let transform = videoTransform, !transform.isIdentity {
                                        // Apply the transform
                                        transformedImage = sourceImage.transformed(by: transform)
                                        
                                        // Calculate effective dimensions after transform
                                        // For 90/270 degree rotations, swap width/height
                                        let isRotated90or270 = abs(transform.a) < 0.1 || abs(transform.b) > 0.9
                                        if isRotated90or270 {
                                            effectiveWidth = CGFloat(originalHeight)
                                            effectiveHeight = CGFloat(originalWidth)
                                        }
                                    }
                                    
                                    // Scale to target size (720x1280) maintaining aspect ratio
                                    let targetWidth: CGFloat = 720
                                    let targetHeight: CGFloat = 1280
                                    
                                    // Calculate scale to fill (maintain aspect ratio, may crop)
                                    let scaleX = targetWidth / effectiveWidth
                                    let scaleY = targetHeight / effectiveHeight
                                    let scale = max(scaleX, scaleY)
                                    
                                    let scaledWidth = effectiveWidth * scale
                                    let scaledHeight = effectiveHeight * scale
                                    
                                    // Center the scaled image
                                    let xOffset = (scaledWidth - targetWidth) / 2.0
                                    let yOffset = (scaledHeight - targetHeight) / 2.0
                                    
                                    // Apply scale and center transform
                                    var scaleTransform = CGAffineTransform(scaleX: scale, y: scale)
                                    scaleTransform = scaleTransform.translatedBy(x: -xOffset, y: -yOffset)
                                    transformedImage = transformedImage.transformed(by: scaleTransform)
                                    
                                    // Crop to exact target size
                                    transformedImage = transformedImage.cropped(to: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
                                    
                                    // Render to output buffer
                                    ciContext.render(transformedImage, to: output)
                                    
                                    bufferToAppend = output
                                } else {
                                    print("⚠️ Failed to create output buffer, using original")
                                }
                            }
                            
                            if videoAdapter.append(bufferToAppend, withPresentationTime: adjustedTime) {
                                // Success
                            } else {
                                print("⚠️ Failed to append video sample at time \(CMTimeGetSeconds(adjustedTime))")
                                if let error = assetWriter.error {
                                    print("   Error: \(error.localizedDescription)")
                                    hasError = true
                                }
                                break
                            }
                        }
                    } else {
                        // No more samples
                        break
                    }
                }
                
                // Process audio samples (if audio track exists)
                if let audioOutput = audioOutput {
                    while audioInput.isReadyForMoreMediaData && !hasError {
                        if let sampleBuffer = audioOutput.copyNextSampleBuffer() {
                        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                        let adjustedTime = CMTimeAdd(presentationTime, currentTime)
                        
                        if audioInput.append(sampleBuffer) {
                            // Success
                        } else {
                            print("⚠️ Failed to append audio sample at time \(CMTimeGetSeconds(adjustedTime))")
                            if let error = assetWriter.error {
                                print("   Error: \(error.localizedDescription)")
                                hasError = true
                            }
                            break
                        }
                        } else {
                            // No more samples
                            break
                        }
                    }
                }
                
                // Update current time for next segment
                currentTime = CMTimeAdd(currentTime, videoDuration)
                print("✅ Processed segment \(index + 1)/\(validSegments.count) (duration: \(CMTimeGetSeconds(videoDuration))s)")
            }
            
            // Finish writing
            videoInput.markAsFinished()
            audioInput.markAsFinished()
            
            assetWriter.finishWriting {
                if assetWriter.status == .completed {
                    print("✅ Merged video created successfully: \(outputURL.lastPathComponent)")
                    completion(outputURL)
                } else {
                    print("❌ Failed to finish writing: \(assetWriter.error?.localizedDescription ?? "unknown")")
                    if let error = assetWriter.error as NSError? {
                        print("   Error code: \(error.code), domain: \(error.domain)")
                    }
                    completion(nil)
                }
            }
        }
    } // Close mergeVideoSegments function
    
    // Clean up temporary segment files (keep only the final merged video)
    private func cleanupSegmentFiles() {
        guard let finalURL = recordedVideoURL else { return }
        
        for segmentURL in recordingSegments {
            // Don't delete the final merged video
            if segmentURL != finalURL && FileManager.default.fileExists(atPath: segmentURL.path) {
                try? FileManager.default.removeItem(at: segmentURL)
                print("🗑️ Deleted temporary segment: \(segmentURL.lastPathComponent)")
            }
        }
        
        // Clear segments array
        recordingSegments.removeAll()
    }
    
    // Restart recording after camera switch if it was stopped by iOS
    // CRITICAL: Camera switching should NEVER stop recording - only user clicking stop should
    private func restartRecordingAfterCameraSwitch() {
        guard isRecording else {
            print("⚠️ Cannot restart recording - isRecording is false")
            return
        }
        
        guard let movieOutput = localMovieFileOutput else {
            print("⚠️ Cannot restart recording - no movie output")
            return
        }
        
        guard let session = localRecordingSession, session.isRunning else {
            print("⚠️ Cannot restart recording - session not running")
            return
        }
        
        // Create new file URL for the continuation
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "recording_\(UUID().uuidString).mov"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        // Add new segment to tracking array
        recordingSegments.append(fileURL)
        print("📹 Added new recording segment: \(fileURL.lastPathComponent) (total segments: \(recordingSegments.count))")
        
        // Update recordedVideoURL to new file (temporary - will be merged later)
        recordedVideoURL = fileURL
        
        print("🔄 Restarting recording to new file: \(fileURL.lastPathComponent)")
        movieOutput.startRecording(to: fileURL, recordingDelegate: self)
        
        // Ensure isRecording stays true
        if !isRecording {
            isRecording = true
        }
        
        print("✅ Recording restarted after camera switch")
    }
    
    private func attachCamera(_ device: AVCaptureDevice? = nil) {
        // Prevent multiple simultaneous attachments
        guard !isAttachingCamera else {
            print("⚠️ Camera attachment already in progress, skipping duplicate request")
            return
        }
        
        // Use specified device or current camera position
        let cameraDevice: AVCaptureDevice
        if let device = device {
            cameraDevice = device
        } else {
            cameraDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: currentCameraPosition) ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)!
        }
        
        currentCamera = cameraDevice
        
        // Reset zoom when camera changes
        currentZoomFactor = 1.0
        initialZoomFactor = 1.0
        
        print("📷 Attaching camera: \(cameraDevice.position == .back ? "Back" : "Front")")
        isAttachingCamera = true
        
        // Attach camera to stream (for preview and streaming)
        rtmpStream.attachCamera(cameraDevice) { [weak self] captureUnit, error in
            guard let self = self else { return }
            
            self.isAttachingCamera = false // Clear flag on completion
            
            if let error = error {
                DispatchQueue.main.async {
                    print("❌ Camera attachment error: \(error)")
                }
            } else {
                DispatchQueue.main.async {
                    print("✅ Camera attached successfully")
                    // Reset zoom after camera is attached
                    self.setZoomFactor(1.0)
                    // Set RTMP stream orientation based on current device orientation
                    self.updateStreamOrientation()
                    // Notify that camera is ready for preview
                    NotificationCenter.default.post(name: NSNotification.Name("CameraReady"), object: nil)
                }
            }
        }
        
        // Attach microphone (for streaming)
        if let microphone = AVCaptureDevice.default(for: .audio) {
            rtmpStream.attachAudio(microphone) { captureUnit, error in
                if let error = error {
                    DispatchQueue.main.async {
                        print("❌ Microphone attachment error: \(error)")
                    }
                } else {
                    DispatchQueue.main.async {
                        print("✅ Microphone attached successfully")
                    }
                }
            }
        }
    }
    
    // MARK: - Zoom Control
    
    // Optimized zoom with smooth transitions
    private var zoomDisplayLink: CADisplayLink?
    private var targetZoomFactor: CGFloat = 1.0
    private var currentZoomVelocity: CGFloat = 0.0
    private let zoomDamping: CGFloat = 0.85 // Smooth deceleration
    private let zoomSpring: CGFloat = 0.15 // Spring back to target
    
    func setZoomFactor(_ factor: CGFloat, animated: Bool = false) {
        guard let camera = currentCamera else { return }
        
        // Clamp zoom factor between 1.0 and max zoom
        let maxZoom = min(camera.activeFormat.videoMaxZoomFactor, 10.0) // Cap at 10x for performance
        let clampedFactor = max(1.0, min(factor, maxZoom))
        
        targetZoomFactor = clampedFactor
        
        if animated {
            // Start smooth animation
            startZoomAnimation()
        } else {
            // Apply immediately
            applyZoomFactor(clampedFactor)
        }
    }
    
    private func applyZoomFactor(_ factor: CGFloat) {
        guard let camera = currentCamera else { return }
        
        do {
            try camera.lockForConfiguration()
            defer { camera.unlockForConfiguration() }
            
            camera.videoZoomFactor = factor
            currentZoomFactor = factor
            
            // Also apply zoom to recording session if recording
            if isRecording, let recordingCamera = localRecordingSession?.inputs.first(where: { ($0 as? AVCaptureDeviceInput)?.device.hasMediaType(.video) == true }) as? AVCaptureDeviceInput {
                do {
                    try recordingCamera.device.lockForConfiguration()
                    recordingCamera.device.videoZoomFactor = factor
                    recordingCamera.device.unlockForConfiguration()
                } catch {
                    print("⚠️ Failed to set zoom on recording camera: \(error)")
                }
            }
        } catch {
            print("❌ Failed to set zoom: \(error)")
        }
    }
    
    private func startZoomAnimation() {
        // Stop existing animation
        stopZoomAnimation()
        
        // Create display link for smooth 60fps animation
        zoomDisplayLink = CADisplayLink(target: self, selector: #selector(updateZoomAnimation))
        zoomDisplayLink?.preferredFramesPerSecond = 60
        zoomDisplayLink?.add(to: .main, forMode: .common)
    }
    
    func stopZoomAnimation() {
        zoomDisplayLink?.invalidate()
        zoomDisplayLink = nil
        currentZoomVelocity = 0.0
    }
    
    @objc private func updateZoomAnimation() {
        let currentFactor = currentZoomFactor
        let difference = targetZoomFactor - currentFactor
        
        // If very close, snap to target and stop
        if abs(difference) < 0.01 {
            applyZoomFactor(targetZoomFactor)
            stopZoomAnimation()
            return
        }
        
        // Spring-damper physics for smooth animation
        let springForce = difference * zoomSpring
        currentZoomVelocity = (currentZoomVelocity + springForce) * zoomDamping
        
        let newFactor = currentFactor + currentZoomVelocity
        applyZoomFactor(newFactor)
    }
    
    func setZoomFactorWithVelocity(_ factor: CGFloat, velocity: CGFloat) {
        guard let camera = currentCamera else { return }
        
        let maxZoom = min(camera.activeFormat.videoMaxZoomFactor, 10.0)
        let clampedFactor = max(1.0, min(factor, maxZoom))
        
        targetZoomFactor = clampedFactor
        
        // Apply velocity for momentum
        currentZoomVelocity = velocity * 0.1 // Scale velocity for smooth momentum
        startZoomAnimation()
    }
    
    func resetZoom() {
        setZoomFactor(1.0, animated: true)
    }
    
    // MARK: - Local Recording (Snapchat-style)
    
    
    func startLocalRecording() {
        guard !isRecording else {
            print("⚠️ Already recording")
            return
        }
        
        print("📷 Starting recording")
        
        // Create file URL
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "recording_\(UUID().uuidString).mov"
        let fileURL = tempDir.appendingPathComponent(fileName)
        recordedVideoURL = fileURL
        
        // Release camera from RTMP
        rtmpStream.attachCamera(nil)
        
        // Create new recording session
        print("📷 Creating new recording session")
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: currentCameraPosition) else {
            print("❌ Camera not available")
            return
        }
        
        let session = AVCaptureSession()
        session.sessionPreset = .high
        session.beginConfiguration()
        
        do {
            let cameraInput = try AVCaptureDeviceInput(device: camera)
            if session.canAddInput(cameraInput) {
                session.addInput(cameraInput)
            }
        } catch {
            print("❌ Failed to add camera: \(error)")
            session.commitConfiguration()
            return
        }
        
        if let mic = AVCaptureDevice.default(for: .audio) {
            do {
                let micInput = try AVCaptureDeviceInput(device: mic)
                if session.canAddInput(micInput) {
                    session.addInput(micInput)
                }
            } catch {
                print("⚠️ Failed to add mic: \(error)")
            }
        }
        
        let movieOutput = AVCaptureMovieFileOutput()
        if let videoConnection = movieOutput.connection(with: .video) {
            videoConnection.videoOrientation = .portrait
            videoConnection.automaticallyAdjustsVideoMirroring = false
            videoConnection.isVideoMirrored = false
        }
        
        guard session.canAddOutput(movieOutput) else {
            print("❌ Cannot add movie output")
            session.commitConfiguration()
            return
        }
        session.addOutput(movieOutput)
        session.commitConfiguration()
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        if let connection = previewLayer.connection {
            connection.videoOrientation = .portrait
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = false
        }
        
        // Store references
        localRecordingSession = session
        localMovieFileOutput = movieOutput
        recordingPreviewLayer = previewLayer
        
        // Set state
        isRecording = true
        recordingStartTime = Date()
        recordingDidActuallyStart = false
        recordingSegments = [fileURL]
        isRecordingSessionReady = false
        
        // Start session
        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
            
            // Wait for session to start
            var attempts = 0
            while !session.isRunning && attempts < 100 {
                Thread.sleep(forTimeInterval: 0.05)
                attempts += 1
            }
            
            if session.isRunning {
                DispatchQueue.main.async {
                    // Mark session as ready
                    self.isRecordingSessionReady = true
                    
                    // Notify UI
                    NotificationCenter.default.post(name: NSNotification.Name("RecordingStarted"), object: nil)
                    
                    // Start recording after a short delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                        guard let self = self, self.isRecording, session.isRunning else {
                            if !session.isRunning {
                                print("❌ Session stopped before recording could start")
                                self?.isRecording = false
                            }
                            return
                        }
                        
                        // Verify movie output is ready
                        guard movieOutput.connections.count > 0 else {
                            print("❌ Movie output has no connections - cannot start recording")
                            self.isRecording = false
                            return
                        }
                        
                        print("🎬 Starting recording to: \(fileURL.path)")
                        movieOutput.startRecording(to: fileURL, recordingDelegate: self)
                        self.startRecordingTimer()
                    }
                }
            } else {
                print("❌ Session failed to start")
                DispatchQueue.main.async {
                    self.isRecording = false
                }
            }
        }
    }
    
    func stopLocalRecording() {
        guard isRecording else { return }
        
        print("🛑 Stopping recording")
        isRecordingSessionReady = false
        stopRecordingTimer()
        
        // Stop recording
        if let movieOutput = localMovieFileOutput, movieOutput.isRecording {
            movieOutput.stopRecording()
            print("✅ Called stopRecording() - waiting for delegate")
        } else {
            print("⚠️ Movie output not recording, checking if file exists...")
            // Wait a bit for file to be created (in case it's still being written)
            // Only complete manually if recording never actually started
            if recordingDidActuallyStart {
                // Recording started, wait for file to appear
                print("⏳ Recording started, waiting for file to be created...")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    guard let self = self else { return }
                    self.completeRecording()
                }
            } else {
                // Recording never started, just cleanup
                print("❌ Recording never started, cleaning up")
                completeRecording()
            }
        }
        
    }
    
    private func completeRecording() {
        guard let fileURL = recordedVideoURL else {
            print("❌ No file URL - recording never started, cleaning up")
            // Clear state immediately to prevent freeze
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.recordedVideoURL = nil
                self.isRecording = false
                self.isRecordingSessionReady = false
            }
            cleanup()
            return
        }
        
        // Check if file exists (non-blocking check)
        if FileManager.default.fileExists(atPath: fileURL.path) {
            print("✅ File exists: \(fileURL.path)")
            if let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
               let size = attributes[.size] as? Int64 {
                print("📊 File size: \(Double(size) / 1024 / 1024) MB")
            }
            recordedVideoURL = fileURL
            cleanup()
            NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
        } else {
            print("❌ File does not exist - waiting a bit more for file to appear...")
            // Wait a bit more for file to be created (might still be writing)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                guard let self = self else { return }
                if FileManager.default.fileExists(atPath: fileURL.path) {
                    print("✅ File appeared after wait: \(fileURL.path)")
                    self.recordedVideoURL = fileURL
                    self.cleanup()
                    NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
                } else {
                    print("❌ File still doesn't exist after wait - cleaning up")
                    // Only clear if recording never actually started
                    if !self.recordingDidActuallyStart {
                        self.recordedVideoURL = nil
                        self.isRecording = false
                        self.isRecordingSessionReady = false
                    }
                    self.cleanup()
                }
            }
        }
    }
    
    private func cleanup() {
        // CRITICAL: Clear all recording state immediately on main thread (non-blocking)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isRecording = false
            self.isRecordingSessionReady = false
            self.recordingDidActuallyStart = false
            self.recordingPreviewLayer = nil
            self.stopRecordingTimer()
        }
        
        // Stop session on background thread (non-blocking, no sleep)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            
            // Stop session without blocking
            self.localRecordingSession?.stopRunning()
            
            // Clean up immediately without delay (use asyncAfter instead of sleep)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                guard let self = self else { return }
                self.localRecordingSession = nil
                self.localMovieFileOutput = nil
                
                // Re-attach camera to RTMP for preview (only if not recording)
                if !self.isRecording, let camera = self.currentCamera {
                    // Reattach immediately (no delay to prevent freeze)
                    self.attachCamera(camera)
                }
            }
        }
    }
    
    // Fallback method to manually complete recording if delegate doesn't fire
    // Uses the EXACT same logic as fileOutput delegate method
    private func manuallyCompleteRecording() {
        print("🔧 Manually completing recording...")
        
        // CRITICAL: Check if recording actually started
        // If didStartRecordingTo never fired, recording never actually started
        guard recordingDidActuallyStart else {
            print("❌ Recording never actually started (didStartRecordingTo never fired)")
            print("⚠️ Cleaning up without preview")
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.localRecordingSession?.stopRunning()
                self.localRecordingSession = nil
                self.localMovieFileOutput = nil
                self.recordingPreviewLayer = nil
                self.recordedVideoURL = nil
                self.isRecording = false
                self.isRecordingSessionReady = false
                self.stopRecordingTimer()
                self.recordingSegments = []
                self.recordingDidActuallyStart = false
            }
            return
        }
        
        // Get the file URL (should be set by didStartRecordingTo)
        guard let fileURL = recordedVideoURL else {
            print("❌ No recordedVideoURL found, cannot complete recording")
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.recordedVideoURL = nil
                self.isRecording = false
                self.isRecordingSessionReady = false
                self.stopRecordingTimer()
                self.recordingDidActuallyStart = false
            }
            return
        }
        
        // CRITICAL: Wait for file to be created - it's created asynchronously
        // Wait longer to ensure file exists (like the working version did)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self else { return }
            
            // Check if file exists - if not, recording never actually started
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                print("❌ Recorded file does not exist at path: \(fileURL.path)")
                print("⚠️ Recording may have been too short or failed - cleaning up without preview")
                self.localRecordingSession?.stopRunning()
                self.localRecordingSession = nil
                self.localMovieFileOutput = nil
                self.recordingPreviewLayer = nil
                self.recordedVideoURL = nil
                self.isRecording = false
                self.isRecordingSessionReady = false
                self.stopRecordingTimer()
                self.recordingSegments = []
                self.recordingDidActuallyStart = false
                return
            }
            
            // Use the EXACT same logic as the fileOutput delegate method
            // Get file size for logging (same as delegate)
            if let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
               let fileSize = attributes[.size] as? Int64 {
                let fileSizeMB = Double(fileSize) / (1024 * 1024)
                print("✅ Recording finished: \(fileURL.path)")
                print("📊 File size: \(String(format: "%.2f", fileSizeMB)) MB")
            }
            
            // SIMPLE: Single clip recording - no merging needed
            // Just use the file directly
            self.recordedVideoURL = fileURL
            print("✅ Single segment recording: \(fileURL.lastPathComponent)")
            self.completeRecordingCleanup()
        }
    }
    
    private func finishAssetWriterRecording() {
        recordingQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.videoWriterInput?.markAsFinished()
            self.audioWriterInput?.markAsFinished()
            
            self.assetWriter?.finishWriting { [weak self] in
                guard let self = self else { return }
                
                DispatchQueue.main.async {
                    if let error = self.assetWriter?.error {
                        print("❌ Recording error: \(error.localizedDescription)")
                        self.recordedVideoURL = nil
                    } else {
                        print("✅ Recording finished: \(self.recordedVideoURL?.path ?? "unknown")")
                        // Post notification to auto-show preview
                        NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
                    }
                    
                    // Clean up
                    self.assetWriter = nil
                    self.videoWriterInput = nil
                    self.audioWriterInput = nil
                    self.videoDataOutput = nil
                    self.audioDataOutput = nil
                    self.isWritingStarted = false
                }
            }
        }
    }
    
    private func setupLocalRecordingSession(outputURL: URL, camera: AVCaptureDevice, deviceOrientation: UIDeviceOrientation? = nil, interfaceOrientation: UIInterfaceOrientation? = nil) {
        // Clean up any existing session first
        if let existingSession = localRecordingSession {
            existingSession.stopRunning()
            localRecordingSession = nil
        }
        
        let session = AVCaptureSession()
        
        // Use high quality preset for smooth recording
        session.sessionPreset = .high
        
        // Configure session
        session.beginConfiguration()
        
        // Try to configure camera for optimal recording
        do {
            try camera.lockForConfiguration()
            // Set frame rate if supported
            if let format = camera.activeFormat.videoSupportedFrameRateRanges.first {
                camera.activeVideoMinFrameDuration = CMTime(value: 1, timescale: Int32(format.maxFrameRate))
                camera.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: Int32(format.maxFrameRate))
            }
            camera.unlockForConfiguration()
        } catch {
            print("⚠️ Could not configure camera: \(error)")
        }
        
        // Add camera input
        do {
            let cameraInput = try AVCaptureDeviceInput(device: camera)
            if session.canAddInput(cameraInput) {
                session.addInput(cameraInput)
            } else {
                print("❌ Cannot add camera input to session")
                session.commitConfiguration()
                return
            }
        } catch {
            print("❌ Failed to add camera input: \(error)")
            session.commitConfiguration()
            return
        }
        
        // Add microphone input
        if let microphone = AVCaptureDevice.default(for: .audio) {
            do {
                let audioInput = try AVCaptureDeviceInput(device: microphone)
                if session.canAddInput(audioInput) {
                    session.addInput(audioInput)
                }
            } catch {
                print("⚠️ Failed to add audio input: \(error)")
            }
        }
        
        // Add movie file output
        let movieOutput = AVCaptureMovieFileOutput()
        
        // Configure movie output for smooth recording
        // CRITICAL: Set EXACT same settings as preview layer so recording matches preview
        if let connection = movieOutput.connection(with: .video) {
            if connection.isVideoStabilizationSupported {
                connection.preferredVideoStabilizationMode = .auto
            }
            // Support both portrait and landscape
            if connection.isVideoOrientationSupported {
                let videoOrientation: AVCaptureVideoOrientation = getPreviewOrientation()
                connection.videoOrientation = videoOrientation
                
                // CRITICAL: Set mirroring to match preview exactly
                // Front camera = mirror (like Snapchat), Back camera = no mirror
                // This ensures what you see in preview is exactly what gets recorded
                connection.automaticallyAdjustsVideoMirroring = false
                connection.isVideoMirrored = false // SNAPCHAT-STYLE: No mirroring
                
                print("📱 Movie output: orientation=portrait, mirrored=false (natural selfie view)")
            }
        }
        
        if session.canAddOutput(movieOutput) {
            session.addOutput(movieOutput)
            localMovieFileOutput = movieOutput
            // NOTE: Delegate is passed to startRecording() method, not set as a property
            print("✅ Movie output added to session")
        } else {
            print("❌ Cannot add movie output to session")
            session.commitConfiguration()
            return
        }
        
        session.commitConfiguration()
        localRecordingSession = session
        
        // NOTE: Preview layer will be created AFTER session starts running
        // This ensures the preview is live and fluid (like Snapchat)
        // The preview layer creation happens in startLocalRecording() after session.startRunning()
    }
    
    // Get preview layer for recording session (to keep preview live during recording)
    func getRecordingPreviewLayer() -> AVCaptureVideoPreviewLayer? {
        return recordingPreviewLayer
    }
    
    private func startRecordingTimer() {
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, let startTime = self.recordingStartTime else { return }
            self.recordingDuration = Date().timeIntervalSince(startTime)
        }
    }
    
    private func stopRecordingTimer() {
        recordingTimer?.invalidate()
        recordingTimer = nil
    }
    
    func getMaxZoomFactor() -> CGFloat {
        guard let camera = currentCamera else { return 1.0 }
        return min(camera.activeFormat.videoMaxZoomFactor, 10.0)
    }
    
    
    // MARK: - Stream Control
    
    func startStreaming() {
        guard !fullStreamURL.isEmpty else {
            status = .error("Stream URL is required")
            return
        }
        
        guard parseRTMPURL() != nil else {
            status = .error("Invalid RTMP URL format")
            return
        }
        
        // Disable idle timer to prevent phone from sleeping during stream
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = true
        }
        
        // Ensure orientation is set correctly before starting stream
        // This ensures the encoder starts with the correct dimensions
        updateStreamOrientation()
        
        // Request camera and microphone permissions
        requestPermissions { [weak self] granted in
            guard let self = self else { return }
            
            if !granted {
                DispatchQueue.main.async {
                    self.status = .error("Camera and microphone permissions are required")
                }
                return
            }
            
            // Ensure camera is attached before streaming
            if self.currentCamera == nil {
                self.attachCamera()
            }
            
            // Re-add overlay after camera is attached (overlay needs camera to be ready)
            if let overlayImage = self.overlayImage {
                print("🔄 Re-adding overlay after camera attachment before streaming")
                self.removeOverlay()
                self.addOverlay(image: overlayImage, overlayName: "Pre-Stream Overlay")
            }
            
            // Small delay to ensure camera is ready
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.beginStreaming()
            }
        }
    }
    
    private func beginStreaming() {
        guard let (baseURL, streamKey) = parseRTMPURL() else {
            status = .error("Invalid RTMP URL format")
            return
        }
        
        DispatchQueue.main.async {
            self.status = .connecting
        }
        
        // Set up connection timeout (30 seconds - RTMP handshake can take time)
        connectionTimeoutTimer?.invalidate()
        connectionTimeoutTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            if case .connecting = self.status {
                DispatchQueue.main.async {
                    print("⏱️ Connection timeout after 30 seconds")
                    print("⏱️ Connection state: \(self.rtmpConnection.connected)")
                    self.status = .error("Connection timeout - please check your network and stream URL")
                    self.isStreaming = false
                    self.pendingPublish = false
                    self.stopDurationTimer()
                    // Close connection on timeout
                    self.rtmpConnection.close()
                    // Re-enable idle timer on timeout
                    UIApplication.shared.isIdleTimerDisabled = false
                }
            }
        }
        
        // Set flag that we want to publish once connected
        pendingPublish = true
        
        // Store stream key for publishing after connection
        self.pendingStreamKey = streamKey
        
        // Connect to RTMP server base URL (e.g., rtmp://100.24.103.57:1935/live)
        print("🔵 Connecting to RTMP server: \(baseURL)")
        print("🔵 Full stream URL: \(fullStreamURL)")
        print("🔵 Stream key: \(streamKey)")
        print("🔵 Connection state before connect: \(rtmpConnection.connected)")
        
        // Check connection state
        if rtmpConnection.connected {
            print("⚠️ Connection already connected, closing first...")
            rtmpConnection.close()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                print("🔵 Attempting connection after close...")
                self.rtmpConnection.connect(baseURL)
            }
        } else {
            rtmpConnection.connect(baseURL)
        }
        
        // Log connection state after a short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("🔵 Connection state after 1s: \(self.rtmpConnection.connected)")
            print("🔵 Connection URI: \(self.rtmpConnection.uri?.absoluteString ?? "nil")")
            
            // Fallback: If connection is true but we haven't published yet, try to publish
            if self.rtmpConnection.connected && self.pendingPublish {
                print("🔵 Connection is true but status callback may have missed, attempting publish...")
                self.publishStream()
            }
        }
        
        // Additional check after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if self.rtmpConnection.connected && self.pendingPublish {
                print("🔵 Still pending publish after 2s, forcing publish attempt...")
                self.publishStream()
            }
        }
    }
    
    private func publishStream() {
        print("🟢 publishStream() called")
        print("🟢 pendingPublish: \(pendingPublish)")
        print("🟢 pendingStreamKey: \(pendingStreamKey)")
        print("🟢 Connection state: \(rtmpConnection.connected)")
        
        guard pendingPublish else {
            print("⚠️ publishStream: pendingPublish is false, aborting")
            return
        }
        guard !pendingStreamKey.isEmpty else {
            print("⚠️ publishStream: pendingStreamKey is empty, aborting")
            return
        }
        guard rtmpConnection.connected else {
            print("⚠️ publishStream: Connection not connected, waiting...")
            // Wait a bit and try again
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                if self.rtmpConnection.connected {
                    self.publishStream()
                } else {
                    print("❌ publishStream: Connection still not connected after wait")
                    self.status = .error("Connection not ready for publishing")
                }
            }
            return
        }
        
        pendingPublish = false
        let streamKey = pendingStreamKey
        pendingStreamKey = ""
        
        // Send overlay metadata to backend BEFORE publishing
        // Note: Overlay is applied during post-processing of recorded FLV file, NOT during live stream
        if let overlay = currentOverlay {
            print("📤 Sending overlay metadata to backend (will be applied during post-processing)...")
            OverlayMetadataService.shared.sendOverlayMetadata(overlay: overlay, streamKey: streamKey) { [weak self] result in
                switch result {
                case .success:
                    print("✅ Overlay metadata sent to backend successfully")
                case .failure(let error):
                    print("⚠️ Failed to send overlay metadata to backend: \(error.localizedDescription)")
                    // Continue streaming even if metadata send fails (client-side overlay will still work)
                }
                // Continue with publishing regardless of metadata send result
                self?.publishStreamWithKey(streamKey)
            }
        } else {
            // No overlay, clear any existing overlay metadata on backend
            OverlayMetadataService.shared.clearOverlayMetadata(streamKey: streamKey) { result in
                if case .failure(let error) = result {
                    print("⚠️ Failed to clear overlay metadata: \(error.localizedDescription)")
                }
            }
            publishStreamWithKey(streamKey)
        }
    }
    
    private func publishStreamWithKey(_ streamKey: String) {
        // Publish stream with key
        // Full URL: rtmp://100.24.103.57:1935/live/sk_xxxxx
        // RTMP protocol: connect to base, then publish with key
        print("🟢 [STREAM] Publishing stream with key: \(streamKey)")
        print("🟢 [STREAM] Full stream URL: \(fullStreamURL)")
        print("🔍 [STREAM] About to call rtmpStream.publish(\(streamKey))")
        
        rtmpStream.publish(streamKey)
        
        print("🟢 [STREAM] Publish command sent to RTMP server")
        
        // Start duration timer
        startDurationTimer()
    }
    
    func stopStreaming() {
        connectionTimeoutTimer?.invalidate()
        connectionTimeoutTimer = nil
        pendingPublish = false
        
        print("🛑 Stopping stream...")
        
        // Clear overlay metadata on backend when streaming stops
        if let (_, streamKey) = parseRTMPURL() {
            OverlayMetadataService.shared.clearOverlayMetadata(streamKey: streamKey) { result in
                if case .failure(let error) = result {
                    print("⚠️ Failed to clear overlay metadata: \(error.localizedDescription)")
                }
            }
        }
        
        // Unpublish the stream first
        if isStreaming {
            rtmpStream.close()
        }
        
        // Close the RTMP connection
        rtmpConnection.close()
        
        stopDurationTimer()
        
        DispatchQueue.main.async {
            self.isStreaming = false
            self.status = .stopped
            self.duration = 0
            
            // Re-enable idle timer so phone can sleep normally
            UIApplication.shared.isIdleTimerDisabled = false
        }
        
        // Note: Camera remains attached for preview
        // Overlay remains attached for next stream
        // The stream will be recreated when starting again
    }
    
    // MARK: - RTMP Status Callback
    
    @objc private func on(status: Notification) {
        print("📡 RTMP Status Notification received")
        
        // HaishinKit wraps the status data in an "event" object
        // Use a simpler approach: extract directly from the event's data property
        var statusData: [String: Any]?
        var code: String?
        
        // Try to extract using NSStringFromClass to understand the structure
        if let userInfo = status.userInfo as? [String: Any],
           let event = userInfo["event"] as? NSObject {
            
            // Use value(forKeyPath:) to access nested properties
            if let dataValue = event.value(forKeyPath: "data") {
                // Try to unwrap the double-optional using a recursive unwrap function
                func unwrapDoubleOptional(_ value: Any) -> [String: Any]? {
                    let mirror = Mirror(reflecting: value)
                    // Check if it's an Optional type (has "some" or "none" as first child label)
                    if let firstChild = mirror.children.first {
                        if firstChild.label == "some" {
                            // Unwrap and recurse
                            return unwrapDoubleOptional(firstChild.value)
                        }
                    }
                    // If not an optional, try to cast to dictionary
                    if let dict = value as? [String: Any] {
                        return dict
                    }
                    return nil
                }
                
                if let unwrapped = unwrapDoubleOptional(dataValue) {
                    statusData = unwrapped
                    code = unwrapped["code"] as? String
                    print("📡 Successfully extracted status code: \(code ?? "nil")")
                    print("📡 Full status data: \(unwrapped)")
                } else {
                    print("⚠️ Could not unwrap dataValue: \(dataValue)")
                }
            }
        }
        
        // If we couldn't extract, try parsing from the notification description
        if code == nil {
            let notificationString = String(describing: status)
            print("📡 Attempting to parse from notification string")
            
            // Look for "NetConnection.Connect.Success" or similar patterns
            if notificationString.contains("NetConnection.Connect.Success") {
                code = "NetConnection.Connect.Success"
                print("📡 Parsed code from string: \(code!)")
            } else if notificationString.contains("NetConnection.Connect.Failed") {
                code = "NetConnection.Connect.Failed"
            } else if notificationString.contains("NetStream.Publish.Start") {
                code = "NetStream.Publish.Start"
            } else if notificationString.contains("NetStream.Publish.BadName") {
                code = "NetStream.Publish.BadName"
            }
        }
        
        guard let statusCode = code else {
            print("⚠️ RTMP Status: Could not extract status code")
            print("⚠️ Full notification: \(status)")
            print("⚠️ Full userInfo: \(status.userInfo ?? [:])")
            return
        }
        
        DispatchQueue.main.async {
            let code = statusCode
            print("📡 RTMP Status Code: \(code)")
            
            if let data = statusData {
                if let description = data["description"] as? String {
                    print("📡 RTMP Status Description: \(description)")
                }
                if let level = data["level"] as? String {
                    print("📡 RTMP Status Level: \(level)")
                }
                if let application = data["application"] as? String {
                    print("📡 RTMP Application: \(application)")
                }
                print("📡 All status data: \(data)")
            }
            
            // Handle both enum raw values and string status codes
            let connectSuccessCodes = [
                RTMPConnection.Code.connectSuccess.rawValue,
                "NetConnection.Connect.Success",
                "NetConnection.Connect.Success"
            ]
            
            let connectFailedCodes = [
                RTMPConnection.Code.connectFailed.rawValue,
                "NetConnection.Connect.Failed",
                "NetConnection.Connect.Rejected"
            ]
            
            let connectClosedCodes = [
                RTMPConnection.Code.connectClosed.rawValue,
                "NetConnection.Connect.Closed"
            ]
            
            let publishStartCodes = [
                RTMPStream.Code.publishStart.rawValue,
                "NetStream.Publish.Start"
            ]
            
            let publishBadNameCodes = [
                RTMPStream.Code.publishBadName.rawValue,
                "NetStream.Publish.BadName"
            ]
            
            let unpublishSuccessCodes = [
                RTMPStream.Code.unpublishSuccess.rawValue,
                "NetStream.Unpublish.Success"
            ]
            
            let publishIdleCodes = [
                RTMPStream.Code.publishIdle.rawValue,
                "NetStream.Publish.Idle"
            ]
            
            if connectSuccessCodes.contains(code) {
                // Connection successful, now publish the stream
                print("✅ RTMP Connection successful")
                // Cancel timeout timer since connection succeeded
                self.connectionTimeoutTimer?.invalidate()
                self.connectionTimeoutTimer = nil
                // Now publish the stream
                self.publishStream()
                
            } else if connectFailedCodes.contains(code) {
                print("❌ RTMP Connection failed")
                self.connectionTimeoutTimer?.invalidate()
                self.connectionTimeoutTimer = nil
                self.pendingPublish = false
                self.status = .error("Connection failed - please check your network and server")
                self.isStreaming = false
                self.stopDurationTimer()
                // Re-enable idle timer on error
                UIApplication.shared.isIdleTimerDisabled = false
                
            } else if connectClosedCodes.contains(code) {
                print("RTMP Connection closed")
                self.status = .stopped
                self.isStreaming = false
                self.stopDurationTimer()
                // Re-enable idle timer when connection closes
                UIApplication.shared.isIdleTimerDisabled = false
                
            } else if publishBadNameCodes.contains(code) {
                print("❌ RTMP Publish bad name - Invalid stream key")
                self.pendingPublish = false
                self.status = .error("Invalid stream key - please check your stream key")
                self.isStreaming = false
                self.stopDurationTimer()
                self.rtmpConnection.close()
                // Re-enable idle timer on error
                UIApplication.shared.isIdleTimerDisabled = false
                
            } else if publishStartCodes.contains(code) {
                print("✅ RTMP Publish started - Streaming!")
                self.status = .streaming
                self.isStreaming = true
                // Cancel any remaining timeout
                self.connectionTimeoutTimer?.invalidate()
                // Ensure idle timer is disabled to keep phone awake
                UIApplication.shared.isIdleTimerDisabled = true
                self.connectionTimeoutTimer = nil
                
                // Re-add overlay now that streaming has started (ensure it's active)
                print("🔍 Checking overlay state: overlayImage=\(self.overlayImage != nil ? "EXISTS" : "NIL"), overlayScreenObject=\(self.overlayScreenObject != nil ? "EXISTS" : "NIL")")
                if let overlayImage = self.overlayImage {
                    print("🔄 Re-adding overlay now that streaming has started")
                    self.removeOverlay()
                    self.addOverlay(image: overlayImage, overlayName: "Streaming Overlay")
                    print("✅ Overlay re-added after streaming started")
                } else {
                    print("⚠️ No overlay image to re-add when streaming started")
                }
                
            } else if unpublishSuccessCodes.contains(code) {
                print("RTMP Unpublish success")
                self.status = .stopped
                self.isStreaming = false
                self.stopDurationTimer()
                // Re-enable idle timer when stream stops
                UIApplication.shared.isIdleTimerDisabled = false
                
            } else if publishIdleCodes.contains(code) {
                print("RTMP Publish idle")
                // This might happen during connection, don't change status
                
            } else {
                // Handle other status codes as needed
                print("ℹ️ RTMP Status (unhandled): \(code)")
                if let data = statusData,
                   let description = data["description"] as? String {
                    print("ℹ️ RTMP Status Description: \(description)")
                }
                
                // Check for known RTMP status codes
                let knownCodes = [
                    "NetConnection.Connect.Success",
                    "NetConnection.Connect.Failed",
                    "NetConnection.Connect.Rejected",
                    "NetConnection.Connect.Closed",
                    "NetStream.Publish.Start",
                    "NetStream.Publish.BadName",
                    "NetStream.Publish.Idle",
                    "NetStream.Unpublish.Success"
                ]
                
                if knownCodes.contains(code) {
                    print("⚠️ Known status code but not handled: \(code)")
                }
                
                // Check for other error codes
                if code.contains("error") || code.contains("failed") || code.contains("rejected") || code.contains("Error") || code.contains("Failed") {
                    self.pendingPublish = false
                    self.status = .error("Stream error: \(code)")
                    self.isStreaming = false
                    self.stopDurationTimer()
                    // Re-enable idle timer on error
                    UIApplication.shared.isIdleTimerDisabled = false
                }
            }
        }
    }
    
    // MARK: - Permissions
    
    private func requestPermissions(completion: @escaping (Bool) -> Void) {
        let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
        let microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        
        switch (cameraStatus, microphoneStatus) {
        case (.authorized, .authorized):
            completion(true)
            
        case (.notDetermined, _), (_, .notDetermined):
            let group = DispatchGroup()
            var cameraGranted = false
            var microphoneGranted = false
            
            if cameraStatus == .notDetermined {
                group.enter()
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    cameraGranted = granted
                    group.leave()
                }
            } else {
                cameraGranted = (cameraStatus == .authorized)
            }
            
            if microphoneStatus == .notDetermined {
                group.enter()
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    microphoneGranted = granted
                    group.leave()
                }
            } else {
                microphoneGranted = (microphoneStatus == .authorized)
            }
            
            group.notify(queue: .main) {
                completion(cameraGranted && microphoneGranted)
            }
            
        default:
            completion(false)
        }
    }
    
    // MARK: - Duration Timer
    
    private func startDurationTimer() {
        streamStartTime = Date()
        durationTimer?.invalidate()
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self,
                  let startTime = self.streamStartTime else { return }
            
            DispatchQueue.main.async {
                self.duration = Date().timeIntervalSince(startTime)
            }
        }
    }
    
    private func stopDurationTimer() {
        durationTimer?.invalidate()
        durationTimer = nil
        streamStartTime = nil
    }
    
    // MARK: - Cleanup
    
    deinit {
        print("🧹 [StreamManager] deinit called - cleaning up all resources")
        
        // Stop camera preview
        stopCameraPreview()
        
        // Stop streaming
        stopStreaming()
        
        // Stop local recording
        stopLocalRecording()
        
        // Invalidate all timers
        durationTimer?.invalidate()
        connectionTimeoutTimer?.invalidate()
        recordingTimer?.invalidate()
        
        // Clean up camera
        currentCamera = nil
        
        print("✅ [StreamManager] Cleanup complete")
    }
    
    // MARK: - AVCaptureFileOutputRecordingDelegate
    
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        print("✅ Recording started: \(fileURL.path)")
        recordingDidActuallyStart = true
        recordedVideoURL = fileURL
    }
    
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        if let error = error {
            print("❌ Recording error: \(error.localizedDescription)")
            cleanup()
            return
        }
        
        print("✅ Recording finished: \(outputFileURL.path)")
        
        // Check file exists and get size
        if FileManager.default.fileExists(atPath: outputFileURL.path) {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: outputFileURL.path),
               let size = attributes[.size] as? Int64 {
                print("📊 File size: \(Double(size) / 1024 / 1024) MB")
            }
            recordedVideoURL = outputFileURL
            cleanup()
            NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
        } else {
            print("❌ File does not exist")
            cleanup()
        }
    }
    
    // OLD COMPLEX CODE BELOW - REMOVED
    private func old_didFinishRecordingTo_removed(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        if let error = error {
            print("❌ Recording error: \(error.localizedDescription)")
            cleanup()
            return
        }
        
        print("✅ Recording finished: \(outputFileURL.path)")
        
        // Check file exists and get size
        if FileManager.default.fileExists(atPath: outputFileURL.path) {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: outputFileURL.path),
               let size = attributes[.size] as? Int64 {
                print("📊 File size: \(Double(size) / 1024 / 1024) MB")
            }
            recordedVideoURL = outputFileURL
            cleanup()
            NotificationCenter.default.post(name: NSNotification.Name("RecordingFinished"), object: nil)
        } else {
            print("❌ File does not exist")
            cleanup()
        }
    }
    
    // Stream local file to RTMP server (same as live streaming, but from file)
    func streamLocalFileToRTMP(fileURL: URL, streamKey: String, channelName: String) {
        // Set stream key
        setStreamKey("rtmp://100.24.103.57:1935/live/\(streamKey)", channelName: channelName)
        
        // Use AVPlayer to play the file and capture frames to RTMP stream
        // This is the same RTMP endpoint as live streaming - server processes it identically
        streamFileToRTMP(fileURL: fileURL, streamKey: streamKey)
    }
    
    private var fileStreamingPlayer: AVPlayer?
    private var fileStreamingTimer: Timer?
    private var fileStreamingAsset: AVAsset?
    
    private func streamFileToRTMP(fileURL: URL, streamKey: String) {
        print("🎬 Starting to stream local file to RTMP: \(fileURL.path)")
        print("   Stream Key: \(streamKey)")
        
        // Create asset from file
        let asset = AVAsset(url: fileURL)
        fileStreamingAsset = asset
        
        // Get video and audio tracks
        Task {
            do {
                let videoTracks = try await asset.loadTracks(withMediaType: .video)
                let _ = try await asset.loadTracks(withMediaType: .audio) // Audio tracks available if needed
                
                guard let videoTrack = videoTracks.first else {
                    print("❌ No video track found in file")
                    return
                }
                
                // Get video properties
                let naturalSize = try await videoTrack.load(.naturalSize)
                let _ = try await videoTrack.load(.preferredTransform) // Transform available if needed
                
                print("📹 Video properties: \(naturalSize.width)x\(naturalSize.height)")
                
                // Create player item (synchronous - asset is already loaded)
                // Note: AVPlayerItem initializer is synchronous, but we're in async context
                await MainActor.run {
                    let playerItem = AVPlayerItem(asset: asset)
                    let player = AVPlayer(playerItem: playerItem)
                    self.fileStreamingPlayer = player
                }
                
                // Connect to RTMP
                guard !fullStreamURL.isEmpty else {
                    print("❌ Stream URL not set")
                    return
                }
                
                // Connect RTMP connection
                rtmpConnection.connect(fullStreamURL)
                status = .connecting
                
                // Wait for connection, then publish
                // Note: This is a simplified approach - in production, you'd want to
                // use a proper frame-by-frame capture from AVPlayer to RTMP stream
                // For now, we'll use the upload approach which is more reliable
                
                print("⚠️ Direct file-to-RTMP streaming requires frame capture implementation")
                print("   Using upload approach instead (same end result)")
                
            } catch {
                print("❌ Error loading file tracks: \(error)")
            }
        }
    }
    
    // Delete recorded file to free up space
    func deleteRecordedFile() {
        print("🔍 StreamManager: deleteRecordedFile() called")
        
        // Store file URL before clearing state
        let fileURLToDelete = recordedVideoURL
        
        // CRITICAL: Clear all recording state immediately (non-blocking)
        // Clear state right away to prevent freeze
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            print("🔍 StreamManager: Clearing recording state on main thread")
            
            // Clear state immediately
            self.recordedVideoURL = nil
            self.isRecording = false
            self.isRecordingSessionReady = false
            self.recordingPreviewLayer = nil
            
            // Clear attachment flag to allow fresh attachment
            self.isAttachingCamera = false
            
            // Wait a moment before reattaching to ensure cleanup is complete
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                // Reattach camera for preview
                if let camera = self.currentCamera {
                    self.attachCamera(camera)
                } else {
                    let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: self.currentCameraPosition) ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)!
                    self.currentCamera = camera
                    self.attachCamera(camera)
                }
                
                // Post notification for preview refresh
                NotificationCenter.default.post(name: NSNotification.Name("ForceRefreshPreview"), object: nil)
            }
        }
        
        // Delete file on background thread (non-blocking)
        if let fileURL = fileURLToDelete {
            DispatchQueue.global(qos: .utility).async {
                try? FileManager.default.removeItem(at: fileURL)
                print("🗑️ Deleted recorded file: \(fileURL.path)")
            }
        }
    }
}