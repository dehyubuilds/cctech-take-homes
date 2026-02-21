//
//  OverlayManager.swift
//  TwillyBroadcaster
//
//  Manages stream overlays/watermarks
//

import Foundation
import UIKit
import SwiftUI

struct StreamOverlay: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var imageName: String? // For default overlays
    var imageData: Data? // For custom overlays
    var isDefault: Bool
    
    init(id: UUID = UUID(), name: String, imageName: String? = nil, imageData: Data? = nil, isDefault: Bool = false) {
        self.id = id
        self.name = name
        self.imageName = imageName
        self.imageData = imageData
        self.isDefault = isDefault
    }
    
    func getImage() -> UIImage? {
        if let imageName = imageName {
            // Try loading from asset catalog first (most reliable for images in Assets.xcassets)
            if let image = UIImage(named: imageName) {
                return image
            }
            // Try loading from bundle as fallback
            if let path = Bundle.main.path(forResource: imageName, ofType: "png"),
               let image = UIImage(contentsOfFile: path) {
                return image
            }
            // Try loading without extension from bundle
            if let path = Bundle.main.path(forResource: imageName, ofType: nil),
               let image = UIImage(contentsOfFile: path) {
                return image
            }
        } else if let imageData = imageData {
            return UIImage(data: imageData)
        }
        return nil
    }
}

class OverlayManager: ObservableObject {
    static let shared = OverlayManager()
    
    @Published var overlays: [StreamOverlay] = []
    @Published var selectedOverlayId: UUID?
    
    private let userDefaultsKey = "SavedOverlays"
    private let selectedOverlayIdKey = "SelectedOverlayId"
    
    private init() {
        loadDefaultOverlays()
        loadSavedOverlays()
        loadSelectedOverlay()
    }
    
    var selectedOverlay: StreamOverlay? {
        guard let selectedOverlayId = selectedOverlayId else { return nil }
        return overlays.first { $0.id == selectedOverlayId }
    }
    
    private func loadDefaultOverlays() {
        // Create default Twilly watermark overlay
        let defaultOverlay = StreamOverlay(
            name: "Twilly Watermark",
            imageName: "TwillyWatermark",
            isDefault: true
        )
        overlays.append(defaultOverlay)
    }
    
    private func loadSavedOverlays() {
        if let data = UserDefaults.standard.data(forKey: userDefaultsKey),
           let decoded = try? JSONDecoder().decode([StreamOverlay].self, from: data) {
            // Merge saved overlays with defaults
            let savedIds = overlays.map { $0.id }
            for overlay in decoded {
                if !savedIds.contains(overlay.id) && !overlay.isDefault {
                    overlays.append(overlay)
                }
            }
        }
    }
    
    private func loadSelectedOverlay() {
        if let selectedIdString = UserDefaults.standard.string(forKey: selectedOverlayIdKey),
           let selectedId = UUID(uuidString: selectedIdString),
           overlays.contains(where: { $0.id == selectedId }) {
            selectedOverlayId = selectedId
        }
    }
    
    func selectOverlay(_ overlay: StreamOverlay) {
        selectedOverlayId = overlay.id
        UserDefaults.standard.set(overlay.id.uuidString, forKey: selectedOverlayIdKey)
    }
    
    func deselectOverlay() {
        selectedOverlayId = nil
        UserDefaults.standard.removeObject(forKey: selectedOverlayIdKey)
    }
    
    func addCustomOverlay(name: String, image: UIImage) {
        guard let imageData = image.pngData() else { return }
        let newOverlay = StreamOverlay(
            name: name,
            imageData: imageData,
            isDefault: false
        )
        overlays.append(newOverlay)
        saveOverlays()
    }
    
    func deleteOverlay(_ overlay: StreamOverlay) {
        guard !overlay.isDefault else { return }
        
        if selectedOverlayId == overlay.id {
            selectedOverlayId = nil
            UserDefaults.standard.removeObject(forKey: selectedOverlayIdKey)
        }
        
        overlays.removeAll { $0.id == overlay.id }
        saveOverlays()
    }
    
    private func saveOverlays() {
        // Only save custom overlays (not defaults)
        let customOverlays = overlays.filter { !$0.isDefault }
        if let encoded = try? JSONEncoder().encode(customOverlays) {
            UserDefaults.standard.set(encoded, forKey: userDefaultsKey)
        }
    }
}

