//
//  StreamKeyManager.swift
//  TwillyBroadcaster
//
//  Manages multiple saved stream keys with names
//

import Foundation

struct StreamKey: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var url: String
    var createdAt: Date
    var isDefault: Bool // Marks the default connection that cannot be deleted
    
    init(id: UUID = UUID(), name: String, url: String, createdAt: Date = Date(), isDefault: Bool = false) {
        self.id = id
        self.name = name
        self.url = url
        self.createdAt = createdAt
        self.isDefault = isDefault
    }
}

class StreamKeyManager: ObservableObject {
    static let shared = StreamKeyManager()
    
    @Published var streamKeys: [StreamKey] = []
    @Published var selectedKeyId: UUID?
    
    private let userDefaultsKey = "SavedStreamKeys"
    private let selectedKeyIdKey = "SelectedStreamKeyId"
    
    private init() {
        loadStreamKeys()
        // Ensure default connection exists
        ensureDefaultConnection()
    }
    
    private func ensureDefaultConnection() {
        // Check if default connection exists
        if !streamKeys.contains(where: { $0.isDefault }) {
            // Create default connection with current hardcoded URL
            let defaultKey = StreamKey(
                name: "Default Stream",
                url: "rtmp://100.24.103.57:1935/live/sk_vnzweq4hpnksev4m",
                isDefault: true
            )
            streamKeys.insert(defaultKey, at: 0) // Insert at beginning
            saveStreamKeys()
            
            // DO NOT auto-select - user must explicitly select a channel
        }
        // DO NOT auto-select default - user must explicitly select a channel
    }
    
    var selectedStreamKey: StreamKey? {
        guard let selectedKeyId = selectedKeyId else { return nil }
        return streamKeys.first { $0.id == selectedKeyId }
    }
    
    func addStreamKey(name: String, url: String) {
        let trimmedURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Validate URL
        guard !trimmedURL.isEmpty else { return }
        guard !trimmedName.isEmpty else { return }
        
        let newKey = StreamKey(name: trimmedName, url: trimmedURL, isDefault: false)
        streamKeys.append(newKey)
        saveStreamKeys()
        
        // Auto-select the new key
        selectedKeyId = newKey.id
        saveSelectedKey()
    }
    
    func updateStreamKey(_ key: StreamKey) {
        // Prevent editing default connection
        guard !key.isDefault else { return }
        
        if let index = streamKeys.firstIndex(where: { $0.id == key.id }) {
            var updatedKey = key
            updatedKey.isDefault = false // Ensure isDefault stays false
            streamKeys[index] = updatedKey
            saveStreamKeys()
        }
    }
    
    func deleteStreamKey(_ key: StreamKey) {
        // Prevent deleting the default connection
        guard !key.isDefault else { return }
        
        streamKeys.removeAll { $0.id == key.id }
        saveStreamKeys()
        
        // If deleted key was selected, clear selection - user must explicitly select
        if selectedKeyId == key.id {
            selectedKeyId = nil
            saveSelectedKey()
        }
    }
    
    func updateStreamKeyName(_ key: StreamKey, newName: String) {
        // Prevent editing default connection name
        guard !key.isDefault else { return }
        
        let trimmedName = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        if let index = streamKeys.firstIndex(where: { $0.id == key.id }) {
            streamKeys[index].name = trimmedName
            saveStreamKeys()
        }
    }
    
    func updateStreamKeyURL(_ key: StreamKey, newURL: String) {
        // Prevent editing default connection URL
        guard !key.isDefault else { return }
        
        let trimmedURL = newURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedURL.isEmpty else { return }
        
        if let index = streamKeys.firstIndex(where: { $0.id == key.id }) {
            streamKeys[index].url = trimmedURL
            saveStreamKeys()
        }
    }
    
    func selectStreamKey(_ key: StreamKey) {
        selectedKeyId = key.id
        saveSelectedKey()
    }
    
    private func saveStreamKeys() {
        if let encoded = try? JSONEncoder().encode(streamKeys) {
            UserDefaults.standard.set(encoded, forKey: userDefaultsKey)
        }
    }
    
    private func loadStreamKeys() {
        if let data = UserDefaults.standard.data(forKey: userDefaultsKey),
           let decoded = try? JSONDecoder().decode([StreamKey].self, from: data) {
            streamKeys = decoded
        }
        
        // Ensure default connection exists after loading
        // This is called before ensureDefaultConnection(), so we handle migration here
        // If we loaded keys but none are default, mark the first one as default for migration
        // (This will be overridden by ensureDefaultConnection if needed)
        
        // Load selected key ID ONLY if it exists and is valid
        // DO NOT auto-select first key - user must explicitly select
        if let selectedIdString = UserDefaults.standard.string(forKey: selectedKeyIdKey),
           let selectedId = UUID(uuidString: selectedIdString),
           streamKeys.contains(where: { $0.id == selectedId }) {
            // Only restore selection if it's a valid, existing key
            selectedKeyId = selectedId
        } else {
            // Clear invalid selection - user must explicitly select a channel
            selectedKeyId = nil
            saveSelectedKey()
        }
    }
    
    private func saveSelectedKey() {
        if let selectedKeyId = selectedKeyId {
            UserDefaults.standard.set(selectedKeyId.uuidString, forKey: selectedKeyIdKey)
        } else {
            UserDefaults.standard.removeObject(forKey: selectedKeyIdKey)
        }
    }
}


