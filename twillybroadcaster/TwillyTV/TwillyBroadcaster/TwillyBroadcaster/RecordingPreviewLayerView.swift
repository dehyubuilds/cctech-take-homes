//
//  RecordingPreviewLayerView.swift
//  TwillyBroadcaster
//
//  Direct AVCaptureVideoPreviewLayer view for live recording preview
//

import SwiftUI
import AVFoundation
import UIKit

struct RecordingPreviewLayerView: UIViewRepresentable {
    let previewLayer: AVCaptureVideoPreviewLayer?
    let streamManager: StreamManager
    
    func makeUIView(context: Context) -> PreviewContainerView {
        let view = PreviewContainerView()
        view.backgroundColor = .black
        
        print("🔍 RecordingPreviewLayerView.makeUIView - previewLayer: \(previewLayer != nil ? "exists" : "nil")")
        
        // Store preview layer in the container view
        view.previewLayer = previewLayer
        
        // Store streamManager in coordinator for zoom control
        context.coordinator.streamManager = streamManager
        
        // Add preview layer if available
        if let layer = previewLayer {
            print("🔍 Adding preview layer to view, bounds: \(view.bounds)")
            layer.videoGravity = .resizeAspectFill
            
            // CRITICAL: Ensure orientation is set and preserved
            // The orientation should already be set by StreamManager, but verify it's correct
            if let connection = layer.connection, connection.isVideoOrientationSupported {
                let currentOrientation = connection.videoOrientation
                print("🔍 RecordingPreviewLayerView.makeUIView - Preview layer connection orientation: \(currentOrientation.rawValue)")
                print("🔍 RecordingPreviewLayerView.makeUIView - Preview layer connection isVideoMirrored: \(connection.isVideoMirrored)")
                print("🔍 RecordingPreviewLayerView.makeUIView - View bounds: \(view.bounds.width)x\(view.bounds.height)")
                
                // Ensure the connection orientation is preserved (sometimes it can be reset)
                // Don't change it, just verify it's correct
                if currentOrientation == .portrait || currentOrientation == .portraitUpsideDown {
                    let isLandscapeBounds = view.bounds.width > view.bounds.height
                    if isLandscapeBounds {
                        print("⚠️ WARNING: Preview layer orientation is portrait but view bounds are landscape!")
                    }
                } else {
                    let isPortraitBounds = view.bounds.height > view.bounds.width
                    if isPortraitBounds {
                        print("⚠️ WARNING: Preview layer orientation is landscape but view bounds are portrait!")
                    }
                }
            }
            
            view.layer.addSublayer(layer)
            print("🔍 Preview layer added, session running: \(layer.session?.isRunning ?? false)")
            
            // Update frame when view is laid out
            view.setNeedsLayout()
        } else {
            print("⚠️ RecordingPreviewLayerView: No preview layer provided!")
        }
        
        // Add pinch gesture recognizer for zoom
        let pinchGesture = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        pinchGesture.delegate = context.coordinator
        view.addGestureRecognizer(pinchGesture)
        
        // Add pan gesture recognizer for vertical slide zoom
        let panGesture = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        panGesture.delegate = context.coordinator
        panGesture.maximumNumberOfTouches = 1 // Single finger only
        view.addGestureRecognizer(panGesture)
        
        return view
    }
    
    func updateUIView(_ uiView: PreviewContainerView, context: Context) {
        print("🔍 RecordingPreviewLayerView.updateUIView - previewLayer: \(previewLayer != nil ? "exists" : "nil"), bounds: \(uiView.bounds)")
        
        // Update preview layer reference
        if uiView.previewLayer !== previewLayer {
            // Remove old preview layer
            if let oldLayer = uiView.previewLayer {
                print("🔍 Removing old preview layer")
                oldLayer.removeFromSuperlayer()
            }
            
            // Add new preview layer
            uiView.previewLayer = previewLayer
            if let layer = previewLayer {
                print("🔍 Adding new preview layer, bounds: \(uiView.bounds), session running: \(layer.session?.isRunning ?? false)")
                layer.videoGravity = .resizeAspectFill
                uiView.layer.insertSublayer(layer, at: 0)
                uiView.setNeedsLayout()
            }
        } else {
            // Same layer, just update frame
            if let layer = previewLayer {
                layer.frame = uiView.bounds
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, UIGestureRecognizerDelegate {
        weak var streamManager: StreamManager?
        private var initialZoomFactor: CGFloat = 1.0
        private var initialPanY: CGFloat = 0.0
        
        // Allow simultaneous gesture recognition
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            return true
        }
        
        // Pinch to zoom
        @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            guard let streamManager = streamManager else { return }
            
            switch gesture.state {
            case .began:
                initialZoomFactor = streamManager.currentZoomFactor
                streamManager.stopZoomAnimation()
                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                impactFeedback.impactOccurred()
                
            case .changed:
                let scale = gesture.scale
                let logScale = log10(max(0.1, scale)) + 1.0
                let adjustedScale = pow(10, logScale - 1.0)
                let newZoomFactor = initialZoomFactor * adjustedScale
                streamManager.setZoomFactor(newZoomFactor, animated: false)
                
            case .ended:
                let velocity = gesture.velocity
                let scale = gesture.scale
                let logScale = log10(max(0.1, scale)) + 1.0
                let adjustedScale = pow(10, logScale - 1.0)
                let finalZoomFactor = initialZoomFactor * adjustedScale
                streamManager.setZoomFactorWithVelocity(finalZoomFactor, velocity: velocity)
                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                impactFeedback.impactOccurred()
                
            case .cancelled:
                streamManager.setZoomFactor(streamManager.currentZoomFactor, animated: true)
                
            default:
                break
            }
        }
        
        // Vertical slide to zoom (single finger)
        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let streamManager = streamManager else { return }
            guard gesture.numberOfTouches == 1 else { return } // Only single finger
            
            let translation = gesture.translation(in: gesture.view)
            let velocity = gesture.velocity(in: gesture.view)
            
            // Only respond to primarily vertical movement (ignore horizontal swipes)
            let absX = abs(translation.x)
            let absY = abs(translation.y)
            guard absY > absX || absY > 20 else { return } // Must be more vertical than horizontal, or at least 20pt vertical
            
            switch gesture.state {
            case .began:
                initialZoomFactor = streamManager.currentZoomFactor
                initialPanY = 0.0 // translation.y is 0 at .began
                streamManager.stopZoomAnimation()
                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                impactFeedback.impactOccurred()
                
            case .changed:
                // Calculate zoom based on vertical movement
                // Slide up = zoom in, slide down = zoom out
                let deltaY = translation.y - initialPanY
                
                // Normalize the movement (use view height as reference)
                let viewHeight = gesture.view?.bounds.height ?? 1000.0
                let normalizedDelta = -deltaY / viewHeight // Negative because up should zoom in
                
                // Calculate zoom factor (1.0 to maxZoom)
                let maxZoom = streamManager.getMaxZoomFactor()
                let zoomRange = maxZoom - 1.0
                let zoomDelta = normalizedDelta * zoomRange * 2.0 // Multiply by 2 for more sensitivity
                
                let newZoomFactor = max(1.0, min(maxZoom, initialZoomFactor + zoomDelta))
                streamManager.setZoomFactor(newZoomFactor, animated: false)
                
            case .ended:
                // Apply momentum based on velocity
                let deltaY = translation.y - initialPanY
                let viewHeight = gesture.view?.bounds.height ?? 1000.0
                let normalizedDelta = -deltaY / viewHeight
                let maxZoom = streamManager.getMaxZoomFactor()
                let zoomRange = maxZoom - 1.0
                let zoomDelta = normalizedDelta * zoomRange * 2.0
                let finalZoomFactor = max(1.0, min(maxZoom, initialZoomFactor + zoomDelta))
                
                // Use vertical velocity for momentum
                let velocityY = -velocity.y / viewHeight // Negative because up should zoom in
                let velocityZoom = velocityY * zoomRange * 0.5
                streamManager.setZoomFactorWithVelocity(finalZoomFactor, velocity: velocityZoom)
                
                let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                impactFeedback.impactOccurred()
                
            case .cancelled:
                streamManager.setZoomFactor(streamManager.currentZoomFactor, animated: true)
                
            default:
                break
            }
        }
    }
}

// Custom UIView that properly handles layout for preview layer
class PreviewContainerView: UIView {
    var previewLayer: AVCaptureVideoPreviewLayer? {
        didSet {
            if oldValue !== previewLayer {
                oldValue?.removeFromSuperlayer()
                if let layer = previewLayer {
                    layer.videoGravity = .resizeAspectFill
                    self.layer.insertSublayer(layer, at: 0)
                    setNeedsLayout()
                }
            }
        }
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Update preview layer frame when view is laid out
        if let layer = previewLayer {
            print("🔍 PreviewContainerView.layoutSubviews - updating frame to: \(bounds)")
            layer.frame = bounds
            
            // CRITICAL: Ensure orientation is preserved after layout
            // Sometimes the connection orientation can be reset, so re-verify it
            if let connection = layer.connection, connection.isVideoOrientationSupported {
                let currentOrientation = connection.videoOrientation
                print("🔍 PreviewContainerView.layoutSubviews - Current orientation: \(currentOrientation.rawValue), bounds: \(bounds.width)x\(bounds.height)")
                
                // If bounds suggest landscape but orientation is portrait (or vice versa), log a warning
                let isLandscapeBounds = bounds.width > bounds.height
                let isLandscapeOrientation = currentOrientation == .landscapeLeft || currentOrientation == .landscapeRight
                if isLandscapeBounds != isLandscapeOrientation {
                    print("⚠️ PreviewContainerView - Orientation mismatch! Bounds landscape: \(isLandscapeBounds), Orientation landscape: \(isLandscapeOrientation)")
                }
            }
        }
    }
}

