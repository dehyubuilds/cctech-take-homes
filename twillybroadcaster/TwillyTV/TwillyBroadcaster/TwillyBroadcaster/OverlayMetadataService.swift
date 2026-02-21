//
//  OverlayMetadataService.swift
//  TwillyBroadcaster
//
//  Service to send overlay metadata to backend for server-side encoding
//

import Foundation

struct OverlayMetadata: Codable {
    let overlayId: String
    let overlayName: String
    let imageName: String? // For default overlays (backend will map to stored image)
    let imageBase64: String? // For custom overlays (base64 encoded PNG)
    let position: OverlayPosition
    let size: OverlaySize
    
    struct OverlayPosition: Codable {
        let horizontal: String // "left", "center", "right"
        let vertical: String   // "top", "center", "bottom"
        let paddingX: Int      // Pixels from edge
        let paddingY: Int      // Pixels from edge
    }
    
    struct OverlaySize: Codable {
        let width: Int
        let height: Int
        let scale: Double? // Optional scale factor (1.0 = 100%)
    }
}

class OverlayMetadataService {
    static let shared = OverlayMetadataService()
    
    // Configure your backend API base URL
    // Note: Overlay is applied during post-processing of recorded FLV file, NOT during live stream
    private let apiBaseURL = "https://twilly.app/api"
    
    private init() {}
    
    /// Send overlay metadata to backend BEFORE streaming starts
    /// Note: Overlay will be applied during post-processing of the recorded FLV file, not during live stream
    /// - Parameters:
    ///   - overlay: The overlay to send metadata for
    ///   - streamKey: The RTMP stream key (same as streamName on backend)
    ///   - completion: Callback with success/error
    func sendOverlayMetadata(
        overlay: StreamOverlay,
        streamKey: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        print("🔍 [OVERLAY API] sendOverlayMetadata() called")
        print("🔍 [OVERLAY API] Overlay: name=\(overlay.name), id=\(overlay.id.uuidString)")
        print("🔍 [OVERLAY API] StreamKey: \(streamKey)")
        
        // Convert overlay to metadata
        guard let metadata = createMetadata(from: overlay) else {
            print("❌ [OVERLAY API] Failed to create overlay metadata from overlay object")
            completion(.failure(NSError(domain: "OverlayMetadataService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to create overlay metadata"])))
            return
        }
        
        print("✅ [OVERLAY API] Metadata created successfully")
        print("🔍 [OVERLAY API] Metadata details: overlayId=\(metadata.overlayId), imageName=\(metadata.imageName ?? "nil"), imageBase64 length=\(metadata.imageBase64?.count ?? 0)")
        
        // Create request payload
        // Note: streamKey must match the streamKey used in RTMP URL path
        // Backend will use this streamKey (same as streamName) to lookup metadata during post-processing
        let payload: [String: Any] = [
            "streamKey": streamKey,  // This is the same as streamName on backend
            "overlay": [
                "overlayId": metadata.overlayId,
                "overlayName": metadata.overlayName,
                "imageName": metadata.imageName as Any,
                "imageBase64": metadata.imageBase64 as Any,
                "position": [
                    "horizontal": metadata.position.horizontal,
                    "vertical": metadata.position.vertical,
                    "paddingX": metadata.position.paddingX,
                    "paddingY": metadata.position.paddingY
                ],
                "size": [
                    "width": metadata.size.width,
                    "height": metadata.size.height,
                    "scale": metadata.size.scale as Any
                ]
            ]
        ]
        
        print("🔍 [OVERLAY API] Request payload created")
        if let payloadData = try? JSONSerialization.data(withJSONObject: payload),
           let payloadString = String(data: payloadData, encoding: .utf8) {
            print("🔍 [OVERLAY API] Payload preview: \(String(payloadString.prefix(500)))...")
        }
        
        // Send to backend API
        print("🔍 [OVERLAY API] Sending HTTP POST request to backend...")
        sendToBackend(payload: payload, completion: completion)
    }
    
    /// Clear overlay metadata (optional - backend can also use TTL for cleanup)
    func clearOverlayMetadata(streamKey: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let payload: [String: Any] = [
            "streamKey": streamKey,
            "action": "clear"
        ]
        
        sendToBackend(payload: payload, endpoint: "/streams/overlay/clear", completion: completion)
    }
    
    // MARK: - Private Helpers
    
    private func createMetadata(from overlay: StreamOverlay) -> OverlayMetadata? {
        print("🔍 [OVERLAY API] createMetadata() called for overlay: \(overlay.name)")
        
        guard let image = overlay.getImage() else {
            print("❌ [OVERLAY API] Failed to get image from overlay")
            return nil
        }
        
        let imageSize = image.size
        print("✅ [OVERLAY API] Image loaded: \(imageSize.width)x\(imageSize.height)")
        
        // Encode custom overlay image as base64 (if not a default)
        var imageBase64: String? = nil
        if overlay.imageData != nil, let pngData = image.pngData() {
            imageBase64 = pngData.base64EncodedString()
            print("🔍 [OVERLAY API] Custom overlay detected - encoded to base64: \(imageBase64?.count ?? 0) chars")
        } else {
            print("🔍 [OVERLAY API] Default overlay detected - using imageName: \(overlay.imageName ?? "nil")")
        }
        
        // Position: bottom-right with padding
        let position = OverlayMetadata.OverlayPosition(
            horizontal: "right",
            vertical: "bottom",
            paddingX: 16,
            paddingY: 16
        )
        
        // Size: maintain aspect ratio, max width 200px
        let maxWidth: CGFloat = 200
        let aspectRatio = imageSize.height / imageSize.width
        let width = min(imageSize.width, maxWidth)
        let height = width * aspectRatio
        
        let size = OverlayMetadata.OverlaySize(
            width: Int(width),
            height: Int(height),
            scale: nil
        )
        
        print("🔍 [OVERLAY API] Position: \(position.horizontal)-\(position.vertical), padding: \(position.paddingX)x\(position.paddingY)")
        print("🔍 [OVERLAY API] Size: \(size.width)x\(size.height)")
        
        let metadata = OverlayMetadata(
            overlayId: overlay.id.uuidString,
            overlayName: overlay.name,
            imageName: overlay.imageName, // Backend maps "TwillyWatermark" to stored image
            imageBase64: imageBase64,
            position: position,
            size: size
        )
        
        print("✅ [OVERLAY API] Metadata object created successfully")
        return metadata
    }
    
    private func sendToBackend(
        payload: [String: Any],
        endpoint: String = "/streams/overlay",
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        let fullURL = "\(apiBaseURL)\(endpoint)"
        print("🔍 [OVERLAY API] Full URL: \(fullURL)")
        
        guard let url = URL(string: fullURL) else {
            print("❌ [OVERLAY API] Invalid API URL: \(fullURL)")
            completion(.failure(NSError(domain: "OverlayMetadataService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid API URL: \(fullURL)"])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            print("✅ [OVERLAY API] Request body created: \(request.httpBody?.count ?? 0) bytes")
        } catch {
            print("❌ [OVERLAY API] Failed to serialize payload: \(error)")
            completion(.failure(error))
            return
        }
        
        print("🔍 [OVERLAY API] Starting URLSession data task...")
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ [OVERLAY API] Network error: \(error.localizedDescription)")
                print("🔍 [OVERLAY API] Error details: \(error)")
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [OVERLAY API] Invalid response type (not HTTPURLResponse)")
                DispatchQueue.main.async {
                    completion(.failure(NSError(domain: "OverlayMetadataService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])))
                }
                return
            }
            
            print("🔍 [OVERLAY API] HTTP Response: Status Code = \(httpResponse.statusCode)")
            if let responseData = data, let responseString = String(data: responseData, encoding: .utf8) {
                print("🔍 [OVERLAY API] Response body: \(responseString)")
            }
            
            if (200...299).contains(httpResponse.statusCode) {
                print("✅ [OVERLAY API] Request successful (status: \(httpResponse.statusCode))")
                DispatchQueue.main.async {
                    completion(.success(()))
                }
            } else {
                print("❌ [OVERLAY API] Request failed with status code: \(httpResponse.statusCode)")
                DispatchQueue.main.async {
                    let error = NSError(domain: "OverlayMetadataService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server error: \(httpResponse.statusCode)"])
                    completion(.failure(error))
                }
            }
        }.resume()
        
        print("✅ [OVERLAY API] URLSession data task started (request sent to server)")
    }
}

