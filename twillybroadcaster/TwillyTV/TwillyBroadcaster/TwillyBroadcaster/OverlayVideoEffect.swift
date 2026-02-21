//
//  OverlayVideoEffect.swift
//  TwillyBroadcaster
//
//  Video effect to add overlay/watermark to streamed video
//

import Foundation
import UIKit
import AVFoundation
import HaishinKit

final class OverlayVideoEffect: VideoEffect {
    var overlayImage: UIImage?
    
    // Debug counter to track if effect is being called
    private static var callCount = 0
    private static var lastLogTime: Date = Date()
    
    override func execute(_ image: CIImage, info: CMSampleBuffer?) -> CIImage {
        // Always log first few calls to verify it's being invoked
        Self.callCount += 1
        let now = Date()
        if Self.callCount <= 5 || now.timeIntervalSince(Self.lastLogTime) >= 1.0 {
            print("🎬 OverlayVideoEffect.execute called (call #\(Self.callCount)) - Image size: \(image.extent.width)x\(image.extent.height), overlayImage: \(overlayImage != nil ? "YES" : "NO")")
            Self.lastLogTime = now
        }
        
        guard let overlayImage = overlayImage else {
            if Self.callCount <= 10 {
                print("⚠️ OverlayVideoEffect: overlayImage is nil")
            }
            return image
        }
        
        // Get image width for positioning
        let imageWidth = image.extent.width
        
        // Calculate overlay size and position (bottom-right corner)
        // CIImage coordinate system: origin is at bottom-left, Y increases upward
        let overlayWidth: CGFloat = 200
        let overlayHeight: CGFloat = 60
        let padding: CGFloat = 20
        
        // X position: from right edge
        let overlayX = imageWidth - overlayWidth - padding
        // Y position: from bottom (CIImage origin is at bottom-left)
        let overlayY = padding
        
        // Create overlay CIImage
        guard let overlayCGImage = overlayImage.cgImage else {
            print("❌ OverlayVideoEffect: Failed to get CGImage from UIImage")
            return image
        }
        let overlayCIImage = CIImage(cgImage: overlayCGImage)
        
        // Scale overlay to desired size
        let scaleX = overlayWidth / overlayImage.size.width
        let scaleY = overlayHeight / overlayImage.size.height
        let scaleTransform = CGAffineTransform(scaleX: scaleX, y: scaleY)
        let scaledOverlay = overlayCIImage.transformed(by: scaleTransform)
        
        // Position overlay (translate to bottom-right)
        let translateTransform = CGAffineTransform(
            translationX: overlayX,
            y: overlayY
        )
        let positionedOverlay = scaledOverlay.transformed(by: translateTransform)
        
        // Composite overlay onto base image
        // Use CIFilter for source-over compositing to ensure proper alpha blending
        guard let filter = CIFilter(name: "CISourceOverCompositing") else {
            print("❌ OverlayVideoEffect: Failed to create CISourceOverCompositing filter")
            return image
        }
        filter.setValue(positionedOverlay, forKey: kCIInputImageKey)
        filter.setValue(image, forKey: kCIInputBackgroundImageKey)
        
        guard let compositedImage = filter.outputImage else {
            print("❌ OverlayVideoEffect: Filter output is nil, returning original image")
            return image
        }
        
        return compositedImage
    }
}
