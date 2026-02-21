//
//  StreamPreset.swift
//  TwillyBroadcaster
//
//  Default stream URL presets for producers
//

import Foundation

struct StreamPreset: Identifiable, Codable {
    let id: UUID
    var name: String
    var streamURL: String
    
    init(id: UUID = UUID(), name: String, streamURL: String) {
        self.id = id
        self.name = name
        self.streamURL = streamURL
    }
}

class StreamPresetManager: ObservableObject {
    @Published var presets: [StreamPreset] = []
    @Published var selectedPreset: StreamPreset?
    
    init() {
        loadDefaultPresets()
    }
    
    private func loadDefaultPresets() {
        presets = [
            StreamPreset(
                name: "Production Stream 1",
                streamURL: "rtmp://100.24.103.57:1935/live/sk_vnzweq4hpnksev4m"
            ),
            StreamPreset(
                name: "Production Stream 2",
                streamURL: "rtmp://100.24.103.57:1935/live/sk_prod2_default"
            ),
            StreamPreset(
                name: "Production Stream 3",
                streamURL: "rtmp://100.24.103.57:1935/live/sk_prod3_default"
            ),
            StreamPreset(
                name: "Test Stream",
                streamURL: "rtmp://100.24.103.57:1935/live/sk_test_default"
            )
        ]
    }
    
    func selectPreset(_ preset: StreamPreset) {
        selectedPreset = preset
    }
    
    func addCustomPreset(name: String, streamURL: String) {
        let newPreset = StreamPreset(name: name, streamURL: streamURL)
        presets.append(newPreset)
        selectedPreset = newPreset
    }
}

