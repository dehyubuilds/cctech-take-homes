//
//  ChannelService.swift
//  TwillyBroadcaster
//
//  Service to fetch channels and stream keys from twilly.app API
//

import Foundation

struct Channel: Identifiable, Codable {
    let id: String
    let name: String
    let shareUrl: String?
    let streamKey: String?
    let hasStreamKey: Bool
    let visibility: String?
    let isPublic: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shareUrl
        case streamKey
        case hasStreamKey
        case visibility
        case isPublic
    }
}

// Username search result
struct UsernameSearchResult: Identifiable, Codable {
    let username: String
    let email: String?
    let userId: String?
    
    var id: String { username }
}

// Collaborator info
struct CollaboratorInfo: Identifiable, Codable {
    let userId: String
    let userEmail: String
    let username: String
    let streamKey: String?
    let joinedAt: String?
    let status: String?
    let role: String?
    
    var id: String { userId }
}

// Air Schedule Response
struct AirScheduleResponse: Codable {
    let success: Bool
    let message: String?
    let schedule: AirSchedule?
}

struct AirSchedule: Codable {
    let airDay: String?
    let airTime: String?
    let isLocked: Bool?
    let isPaused: Bool?
}

// Occupied Slots Response
struct OccupiedSlotsResponse: Codable {
    let success: Bool
    let occupiedSlots: [String]
}

// Channel for discovery (public/searchable channels)
struct DiscoverableChannel: Identifiable, Codable {
    let channelId: String
    let channelName: String
    let creatorEmail: String
    let creatorUsername: String
    let description: String
    let posterUrl: String
    let visibility: String // "public", "searchable", or "private"
    let isPublic: Bool
    let subscriptionPrice: Double?
    let contentType: String?
    
    var id: String { channelId }
}

// Channel content (videos/episodes)
struct ChannelContent: Identifiable, Codable {
    let SK: String // File ID
    let fileName: String
    let title: String?
    let description: String?
    let hlsUrl: String?
    let thumbnailUrl: String?
    let createdAt: String?
    let isVisible: Bool?
    let price: Double?
    let category: String?
    let uploadId: String?  // Upload ID for matching during polling
    let fileId: String?  // File ID for easier matching
    let airdate: String?  // Scheduled airdate (ISO8601 format)
    let creatorUsername: String?  // Username of the person who posted this video
    let isPrivateUsername: Bool?  // Whether this was streamed as private (username 🔒)
    
    // Local file URL for immediate display (before server processing)
    // Not part of Codable - only used for local display
    var localFileURL: URL? {
        get { _localFileURL }
        set { _localFileURL = newValue }
    }
    private var _localFileURL: URL?
    
    var id: String { SK }
    
    // Custom init to support local files
    init(SK: String, fileName: String, title: String? = nil, description: String? = nil, hlsUrl: String? = nil, thumbnailUrl: String? = nil, createdAt: String? = nil, isVisible: Bool? = nil, price: Double? = nil, category: String? = nil, uploadId: String? = nil, fileId: String? = nil, airdate: String? = nil, creatorUsername: String? = nil, isPrivateUsername: Bool? = nil, localFileURL: URL? = nil) {
        self.SK = SK
        self.fileName = fileName
        self.title = title
        self.description = description
        self.hlsUrl = hlsUrl
        self.thumbnailUrl = thumbnailUrl
        self.createdAt = createdAt
        self.isVisible = isVisible
        self.airdate = airdate
        self.price = price
        self.category = category
        self.uploadId = uploadId
        self.fileId = fileId
        self.creatorUsername = creatorUsername
        self.isPrivateUsername = isPrivateUsername
        self._localFileURL = localFileURL
    }
    
    // Custom Codable implementation to exclude localFileURL
    enum CodingKeys: String, CodingKey {
        case SK, fileName, title, description, hlsUrl, thumbnailUrl, createdAt, isVisible, price, category, uploadId, fileId, airdate, creatorUsername, isPrivateUsername
    }
}

struct StreamKeyResponse: Codable {
    let success: Bool
    let streamKey: String?
    let message: String?
    let existingStreamKey: String?
}

struct ShareUrlResponse: Codable {
    let success: Bool
    let shareUrl: String?
    let message: String?
}

// Persistent cache structure for channels
private struct CachedChannels: Codable {
    let channels: [Channel]
    let timestamp: Date
}

// Persistent cache structure for discoverable channels
private struct CachedDiscoverableChannels: Codable {
    let channels: [DiscoverableChannel]
    let timestamp: Date
    let searchQuery: String?
}

class ChannelService: NSObject, ObservableObject, URLSessionDelegate {
    static let shared = ChannelService()
    
    private let baseURL = "https://twilly.app/api"
    private let rtmpServerURL = "rtmp://100.24.103.57:1935/live"
    
    // GraphQL configuration (set to nil to disable, or configure with AppSync endpoint)
    private var useGraphQL: Bool = false // Disable GraphQL for now (DNS issues) - use REST API directly
    private let graphQLEndpoint: String? = "https://kh56cqqjzfexzdrps2ob4uoyse.appsync-api.us-east-1.amazonaws.com/graphql"
    // Note: API key value is only shown once at creation in AWS Console
    // If this doesn't work, get the actual key value from: AWS Console > AppSync > TwillyGraphQL > API Keys
    private let graphQLApiKey: String? = "da2-zmc3cjkk75gjjpodmxntgayzwy" // Latest API Key ID - may need actual key value from console
    
    // Cache for channels - using persistent storage for better performance
    private var cachedChannels: [String: (channels: [Channel], timestamp: Date)] = [:]
    private var cachedDiscoverableChannels: [String: (channels: [DiscoverableChannel], timestamp: Date)] = [:]
    private let cacheExpirationInterval: TimeInterval = 3600 // 1 hour (longer cache for better performance)
    private let cacheKey = "twilly_cached_channels"
    private let discoverableCacheKey = "twilly_cached_discoverable_channels"
    
    // Custom URLSession for regular API calls (fast timeout for quick responses)
    private lazy var urlSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()
    
    // Separate URLSession for large file uploads (longer timeout)
    private lazy var uploadSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 600 // 10 minutes for request
        configuration.timeoutIntervalForResource = 1800 // 30 minutes for entire upload
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()
    
    override private init() {
        super.init()
    }
    
    // URLSessionDelegate to handle SSL certificate validation
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // For twilly.app, accept the certificate even if validation fails
        if challenge.protectionSpace.host.contains("twilly.app") {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                let credential = URLCredential(trust: serverTrust)
                completionHandler(.useCredential, credential)
                return
            }
        }
        // For other domains, use default handling
        completionHandler(.performDefaultHandling, nil)
    }
    
    // Fetch channels for the authenticated user (with persistent caching)
    // Returns cached data immediately if available, then refreshes in background
    func fetchChannels(userEmail: String, forceRefresh: Bool = false) async throws -> [Channel] {
        // FAST PATH: Check in-memory cache first (instant)
        if !forceRefresh, let cached = cachedChannels[userEmail] {
            let age = Date().timeIntervalSince(cached.timestamp)
            if age < cacheExpirationInterval {
                print("📦 Using in-memory cached channels (age: \(Int(age))s)")
                // Refresh in background if cache is getting old (> 30 min)
                if age > 1800 {
                    Task.detached { [weak self] in
                        _ = try? await self?.fetchChannels(userEmail: userEmail, forceRefresh: true)
                    }
                }
                return cached.channels
            }
        }
        
        // FAST PATH: Check persistent cache (UserDefaults) - very fast
        if !forceRefresh, let cachedData = UserDefaults.standard.data(forKey: "\(cacheKey)_\(userEmail)") {
            if let cached = try? JSONDecoder().decode(CachedChannels.self, from: cachedData) {
                let age = Date().timeIntervalSince(cached.timestamp)
                if age < cacheExpirationInterval {
                    print("📦 Using persistent cached channels (age: \(Int(age))s)")
                    // Update in-memory cache for next time
                    cachedChannels[userEmail] = (channels: cached.channels, timestamp: cached.timestamp)
                    // Refresh in background if cache is getting old (> 30 min)
                    if age > 1800 {
                        Task.detached { [weak self] in
                            _ = try? await self?.fetchChannels(userEmail: userEmail, forceRefresh: true)
                        }
                    }
                    return cached.channels
                }
            }
        }
        
        // Fetch from API
        guard let url = URL(string: "\(baseURL)/channels/list") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Parse response
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success,
           let channels = json["channels"] as? [[String: Any]] {
            let parsedChannels = channels.compactMap { channelDict -> Channel? in
                guard let name = channelDict["name"] as? String else { return nil }
                let id = channelDict["id"] as? String ?? UUID().uuidString
                let shareUrl = channelDict["shareUrl"] as? String
                let streamKey = channelDict["streamKey"] as? String
                let hasStreamKey = channelDict["hasStreamKey"] as? Bool ?? false
                let visibility = channelDict["visibility"] as? String ?? "private"
                let isPublic = channelDict["isPublic"] as? Bool ?? false
                
                return Channel(
                    id: id,
                    name: name,
                    shareUrl: shareUrl,
                    streamKey: streamKey,
                    hasStreamKey: hasStreamKey,
                    visibility: visibility,
                    isPublic: isPublic
                )
            }
            
            // Cache the results (both in-memory and persistent)
            let timestamp = Date()
            cachedChannels[userEmail] = (channels: parsedChannels, timestamp: timestamp)
            
            // Persist to UserDefaults for faster subsequent loads
            let cached = CachedChannels(channels: parsedChannels, timestamp: timestamp)
            if let encoded = try? JSONEncoder().encode(cached) {
                UserDefaults.standard.set(encoded, forKey: "\(cacheKey)_\(userEmail)")
                print("💾 Cached \(parsedChannels.count) channels (in-memory + persistent) for \(userEmail)")
            }
            
            return parsedChannels
        }
        
        return []
    }
    
    // Fetch channels user is a collaborator of (for streaming access)
    func fetchCollaboratorChannels(userId: String, userEmail: String, username: String? = nil, forceRefresh: Bool = false) async throws -> [Channel] {
        print("🔍 [ChannelService] Fetching collaborator channels for userId: \(userId), email: \(userEmail), username: \(username ?? "nil")")
        
        // Fetch collaborator roles from UserRoleService
        let roles = try await UserRoleService.shared.fetchCollaboratorRoles(userId: userId, userEmail: userEmail, username: username)
        
        print("📊 [ChannelService] Found \(roles.count) collaborator roles")
        
        // Log each channel found
        roles.forEach { role in
            print("   📺 Channel: \(role.channelName) (ID: \(role.channelId))")
        }
        
        // Convert collaborator roles to Channel objects
        let channels = roles.map { role -> Channel in
            Channel(
                id: role.channelId,
                name: role.channelName,
                shareUrl: nil,
                streamKey: role.streamKey,
                hasStreamKey: role.streamKey != nil && !role.streamKey!.isEmpty,
                visibility: "public", // Collaborator channels are accessible
                isPublic: true
            )
        }
        
        print("✅ [ChannelService] Returning \(channels.count) collaborator channels")
        return channels
    }
    
    // Clear cache for a specific user (useful when channels are added/removed)
    func clearCache(for userEmail: String) {
        cachedChannels.removeValue(forKey: userEmail)
        UserDefaults.standard.removeObject(forKey: "\(cacheKey)_\(userEmail)")
        print("🗑️ Cleared cache for \(userEmail)")
    }
    
    // Clear discoverable channels cache (useful when new channels are published)
    func clearDiscoverableCache() {
        cachedDiscoverableChannels.removeAll()
        // Clear all UserDefaults entries that match our discoverable cache key pattern
        let defaults = UserDefaults.standard
        let keys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(discoverableCacheKey) }
        keys.forEach { defaults.removeObject(forKey: $0) }
        print("🗑️ Cleared all discoverable channel caches")
    }
    
    // Clear all cache
    func clearAllCache() {
        cachedChannels.removeAll()
        cachedDiscoverableChannels.removeAll()
        // Clear all persistent cache keys
        let defaults = UserDefaults.standard
        let keys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(cacheKey) || $0.hasPrefix(discoverableCacheKey) }
        keys.forEach { defaults.removeObject(forKey: $0) }
        print("🗑️ Cleared all channel caches")
    }
    
    // Generate or fetch stream key for a channel
    // Get or create collaborator stream key for a channel
    func getOrCreateCollaboratorStreamKey(channelId: String, channelName: String, userId: String, userEmail: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/collaborations/get-or-create-stream-key") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelId": channelId,
            "channelName": channelName,
            "userId": userId,
            "userEmail": userEmail
        ]
        
        print("🔍 [ChannelService] Requesting collaborator stream key:")
        print("   📝 channelId: \(channelId)")
        print("   📝 channelName: \(channelName)")
        print("   📝 userId: \(userId)")
        print("   📝 userEmail: \(userEmail)")
        print("   📝 URL: \(url.absoluteString)")
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await urlSession.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [ChannelService] Invalid HTTP response")
                throw URLError(.badServerResponse)
            }
            
            print("🔍 [ChannelService] HTTP Status: \(httpResponse.statusCode)")
            
            // Handle non-200 status codes
            if httpResponse.statusCode != 200 {
                let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
                print("❌ [ChannelService] Server error response (status \(httpResponse.statusCode)): \(responseString)")
                
                // Try to parse error message from response
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let message = json["message"] as? String {
                        print("❌ [ChannelService] API error message: \(message)")
                        throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
                    }
                    if let statusMessage = json["statusMessage"] as? String {
                        print("❌ [ChannelService] API status message: \(statusMessage)")
                        throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: statusMessage])
                    }
                }
                
                // If we can't parse the error, throw a generic error
                throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server error: HTTP \(httpResponse.statusCode)"])
            }
            
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                print("🔍 [ChannelService] Response JSON: \(json)")
                
                // Check for success field
                if let success = json["success"] as? Bool {
                    if success {
                        if let streamKey = json["streamKey"] as? String {
                            print("✅ [ChannelService] Stream key received: \(streamKey)")
                            return streamKey
                        } else {
                            print("❌ [ChannelService] Success=true but streamKey missing in response: \(json)")
                            throw NSError(domain: "ChannelService", code: -2, userInfo: [NSLocalizedDescriptionKey: "Stream key missing in API response"])
                        }
                    } else {
                        // success = false
                        let message = json["message"] as? String ?? "Unknown error"
                        print("❌ [ChannelService] API returned success=false: \(message)")
                        throw NSError(domain: "ChannelService", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
                    }
                } else {
                    // No success field - check for message
                    if let message = json["message"] as? String {
                        print("❌ [ChannelService] API error (no success field): \(message)")
                        throw NSError(domain: "ChannelService", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
                    } else {
                        print("❌ [ChannelService] Invalid response format (no success or message): \(json)")
                        throw URLError(.badServerResponse)
                    }
                }
            }
            
            throw URLError(.badServerResponse)
        } catch let error as URLError {
            print("❌ [ChannelService] URL Error: \(error.localizedDescription), code: \(error.code.rawValue)")
            throw error
        } catch {
            print("❌ [ChannelService] Unexpected error: \(error)")
            throw error
        }
    }
    
    func getOrGenerateStreamKey(userEmail: String, channelName: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/stream-keys/generate") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "channelName": channelName
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard response is HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let keyResponse = try decoder.decode(StreamKeyResponse.self, from: data)
        
        if keyResponse.success, let streamKey = keyResponse.streamKey {
            return streamKey
        } else if let existingKey = keyResponse.existingStreamKey {
            return existingKey
        } else {
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: keyResponse.message ?? "Failed to get stream key"])
        }
    }
    
    // Get share URL for a channel
    func getShareUrl(userEmail: String, channelName: String, username: String?) async throws -> String {
        // Use the get-share-params-by-series endpoint
        guard let url = URL(string: "\(baseURL)/creators/get-share-params-by-series") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Slugify channel name for URL
        let slug = channelName.lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
        
        let body: [String: Any] = [
            "seriesSlug": slug,
            "series": channelName
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // Try to get username and series
            if let username = json["username"] as? String,
               let series = json["series"] as? String {
                // Construct share URL: https://twilly.app/{username}/{series-slug} (clean format)
                let seriesSlug = series.lowercased()
                    .replacingOccurrences(of: " ", with: "-")
                    .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
                // Use clean format: /{username}/{series} (same as managefiles)
                return "https://twilly.app/\(username)/\(seriesSlug)"
            }
            
            // Fallback: use menu/share format if username not available
            let series = json["series"] as? String ?? channelName
            let seriesSlug = series.lowercased()
                .replacingOccurrences(of: " ", with: "-")
                .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
            let encodedEmail = userEmail.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userEmail
            return "https://twilly.app/menu/share/\(encodedEmail)/\(seriesSlug)"
        }
        
        // Final fallback
        let seriesSlug = channelName.lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
        let encodedEmail = userEmail.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userEmail
        return "https://twilly.app/menu/share/\(encodedEmail)/\(seriesSlug)"
    }
    
    // Update video details in DynamoDB (same as web app)
    func updateVideoDetails(PK: String, fileId: String, streamKey: String? = nil, title: String? = nil, description: String? = nil, price: Double? = nil) async throws -> UpdateDetailsResponse {
        guard let url = URL(string: "\(baseURL)/files/update-details") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "PK": PK,
            "fileId": fileId
        ]
        
        // Only include streamKey if provided (for bulk updates)
        // If nil, only the specific file will be updated
        if let streamKey = streamKey {
            body["streamKey"] = streamKey
        }
        
        if let title = title {
            body["title"] = title.isEmpty ? nil : title
        }
        if let description = description {
            body["description"] = description.isEmpty ? nil : description
        }
        if let price = price {
            body["price"] = price
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(UpdateDetailsResponse.self, from: data)
    }
    
    // Update file details with airdate support
    func updateFileDetails(
        fileId: String,
        userId: String,
        title: String? = nil,
        description: String? = nil,
        price: Double? = nil,
        isVisible: Bool? = nil,
        airdate: Date? = nil
    ) async throws -> UpdateDetailsResponse {
        guard let url = URL(string: "\(baseURL)/files/update-details") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "PK": "USER#\(userId)",
            "fileId": fileId
        ]
        
        if let title = title {
            body["title"] = title.isEmpty ? nil : title
        }
        if let description = description {
            body["description"] = description.isEmpty ? nil : description
        }
        if let price = price {
            body["price"] = price
        }
        if let isVisible = isVisible {
            body["isVisible"] = isVisible
        }
        if let airdate = airdate {
            body["airdate"] = airdate.ISO8601Format()
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(UpdateDetailsResponse.self, from: data)
    }
    
    // Schedule airdate for an episode
    func scheduleAirdate(
        episodeId: String,
        userId: String,
        seriesName: String,
        airdate: Date
    ) async throws -> ScheduleAirdateResponse {
        guard let url = URL(string: "\(baseURL)/episodes/schedule-airdate") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "episodeId": episodeId,
            "userId": userId,
            "seriesName": seriesName,
            "airdate": airdate.ISO8601Format()
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(ScheduleAirdateResponse.self, from: data)
    }
    
    // Upload video file to server (server processes it like RTMP stream)
    // uploadId: Unique identifier for this upload to ensure metadata is unique per video
    // title, description, price: Optional metadata to send WITH upload (so Lambda can apply it)
    func uploadVideoFile(fileURL: URL, channelName: String, userEmail: String, streamKey: String, uploadId: String? = nil, title: String? = nil, description: String? = nil, price: Double? = nil, isPrivateUsername: Bool? = nil) async throws -> UploadVideoResponse {
        let uploadStartTime = Date()
        print("📤 [TIMING] Starting video upload: \(fileURL.lastPathComponent)")
        print("📤 Channel: \(channelName), Email: \(userEmail), StreamKey: \(streamKey)")
        print("📤 METADATA RECEIVED - Title: \(title ?? "nil"), Description: \(description ?? "nil"), Price: \(price != nil ? String(price!) : "nil")")
        
        // Check if file exists
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("❌ Video file does not exist at path: \(fileURL.path)")
            throw URLError(.fileDoesNotExist)
        }
        
        // Get file size
        if let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
           let fileSize = attributes[.size] as? Int64 {
            let fileSizeMB = Double(fileSize) / (1024 * 1024)
            print("📤 File size: \(String(format: "%.2f", fileSizeMB)) MB")
        }
        
        // Upload directly to EC2 server (bypassing Nuxt API for now)
        // Note: Metadata (title, description, price) is still sent and will be stored
        let ec2ServerURL = "http://100.24.103.57:3000"
        guard let url = URL(string: "\(ec2ServerURL)/api/channels/upload-video") else {
            print("❌ Invalid upload URL")
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        // Timeout handled by uploadSession configuration (30 minutes)
        
        // Create multipart form data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add form fields
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"channelName\"\r\n\r\n".data(using: .utf8)!)
        body.append(channelName.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"userEmail\"\r\n\r\n".data(using: .utf8)!)
        body.append(userEmail.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"streamKey\"\r\n\r\n".data(using: .utf8)!)
        body.append(streamKey.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add unique uploadId to ensure metadata is unique per upload
        let uniqueUploadId = uploadId ?? UUID().uuidString
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"uploadId\"\r\n\r\n".data(using: .utf8)!)
        body.append(uniqueUploadId.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // CRITICAL: Send metadata WITH upload so EC2 can store it BEFORE Lambda processes
        // This ensures Lambda can find and apply metadata during S3 event processing
        print("📤 ChannelService: Preparing to add metadata to form data")
        print("   Title: \(title ?? "nil") (isEmpty: \(title?.isEmpty ?? true))")
        print("   Description: \(description ?? "nil") (isEmpty: \(description?.isEmpty ?? true))")
        print("   Price: \(price != nil ? String(price!) : "nil")")
        
        if let title = title, !title.isEmpty {
            print("📤 ChannelService: Adding title to form data: '\(title)'")
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"title\"\r\n\r\n".data(using: .utf8)!)
            body.append(title.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        } else {
            print("📤 ChannelService: NOT adding title (nil or empty)")
        }
        
        if let description = description, !description.isEmpty {
            print("📤 ChannelService: Adding description to form data: '\(description.prefix(50))...'")
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"description\"\r\n\r\n".data(using: .utf8)!)
            body.append(description.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        } else {
            print("📤 ChannelService: NOT adding description (nil or empty)")
        }
        
        if let price = price {
            print("📤 ChannelService: Adding price to form data: \(price)")
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"price\"\r\n\r\n".data(using: .utf8)!)
            body.append(String(price).data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        } else {
            print("📤 ChannelService: NOT adding price (nil)")
        }
        
        // CRITICAL PRIVACY FIX: Pass isPrivateUsername directly in upload request
        // This eliminates race condition where createVideoEntryImmediately runs before setStreamUsernameType completes
        if let isPrivate = isPrivateUsername {
            print("📤 ChannelService: Adding isPrivateUsername to form data: \(isPrivate)")
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"isPrivateUsername\"\r\n\r\n".data(using: .utf8)!)
            body.append((isPrivate ? "true" : "false").data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        } else {
            print("📤 ChannelService: NOT adding isPrivateUsername (nil - will default to public)")
        }
        
        // Add video file header
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"video\"; filename=\"\(fileURL.lastPathComponent)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: video/quicktime\r\n\r\n".data(using: .utf8)!)
        
        // Instead of loading entire file into memory, create a temp file with multipart body
        // This allows streaming the upload without memory issues
        let tempFileURL = FileManager.default.temporaryDirectory.appendingPathComponent("upload-\(UUID().uuidString).tmp")
        
        print("📤 Creating temporary multipart file for streaming upload...")
        do {
            // Create file handle for writing
            FileManager.default.createFile(atPath: tempFileURL.path, contents: nil, attributes: nil)
            guard let fileHandle = FileHandle(forWritingAtPath: tempFileURL.path) else {
                throw URLError(.cannotWriteToFile)
            }
            defer { fileHandle.closeFile() }
            
            // Write form fields (already in body)
            fileHandle.write(body)
            
            // Stream video file in chunks (8MB chunks for efficiency)
            let chunkSize = 8 * 1024 * 1024 // 8MB
            guard let videoFileHandle = FileHandle(forReadingAtPath: fileURL.path) else {
                throw URLError(.fileDoesNotExist)
            }
            defer { videoFileHandle.closeFile() }
            
            var totalBytesWritten = 0
            while true {
                let chunk = videoFileHandle.readData(ofLength: chunkSize)
                if chunk.isEmpty {
                    break
                }
                fileHandle.write(chunk)
                totalBytesWritten += chunk.count
            }
            
            print("📤 Video file streamed: \(totalBytesWritten) bytes")
            
            // Write closing boundary
            let closingBoundary = "\r\n--\(boundary)--\r\n"
            fileHandle.write(closingBoundary.data(using: .utf8)!)
            
            // Get final file size
            if let attributes = try? FileManager.default.attributesOfItem(atPath: tempFileURL.path),
               let fileSize = attributes[.size] as? Int64 {
                let fileSizeMB = Double(fileSize) / (1024 * 1024)
                print("📤 Multipart body size: \(String(format: "%.2f", fileSizeMB)) MB")
            }
        } catch {
            // Clean up temp file on error
            try? FileManager.default.removeItem(at: tempFileURL)
            print("❌ Failed to create multipart file: \(error.localizedDescription)")
            throw error
        }
        
        let uploadNetworkStartTime = Date()
        print("📤 [TIMING] Starting streaming upload...")
        // Use uploadTask with file URL for efficient streaming (30 min timeout)
        // Note: uploadTask with file URL streams directly without loading into memory
        let (data, response) = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<(Data, URLResponse), Error>) in
            let task = uploadSession.uploadTask(with: request, fromFile: tempFileURL) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let data = data, let response = response {
                    continuation.resume(returning: (data, response))
                } else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                }
            }
            task.resume()
        }
        
        let uploadNetworkDuration = Date().timeIntervalSince(uploadNetworkStartTime)
        print("📤 [TIMING] Network upload completed in \(String(format: "%.2f", uploadNetworkDuration)) seconds")
        
        // Clean up temp file after upload
        try? FileManager.default.removeItem(at: tempFileURL)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ Invalid HTTP response")
            throw URLError(.badServerResponse)
        }
        
        print("📤 Upload response status: \(httpResponse.statusCode)")
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ Upload failed with status \(httpResponse.statusCode): \(errorMessage)")
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(httpResponse.statusCode) - \(errorMessage)"])
        }
        
        print("📤 Parsing upload response...")
        let decoder = JSONDecoder()
        do {
            let uploadResponse = try decoder.decode(UploadVideoResponse.self, from: data)
            let totalUploadDuration = Date().timeIntervalSince(uploadStartTime)
            print("✅ [TIMING] Upload successful in \(String(format: "%.2f", totalUploadDuration)) seconds (network: \(String(format: "%.2f", uploadNetworkDuration))s)")
            return uploadResponse
        } catch {
            print("❌ Failed to parse upload response: \(error.localizedDescription)")
            print("📤 Response data: \(String(data: data, encoding: .utf8) ?? "Unable to decode")")
            throw error
        }
    }
    
    // Mark streamed content as visible
    func markContentVisible(streamKey: String, userEmail: String) async throws -> MarkVisibleResponse {
        guard let url = URL(string: "\(baseURL)/streams/mark-visible") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "streamKey": streamKey,
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard response is HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(MarkVisibleResponse.self, from: data)
        return result
    }
    
    // Build full RTMP URL from stream key
    func buildRTMPURL(streamKey: String) -> String {
        return "\(rtmpServerURL)/\(streamKey)"
    }
    
    // MARK: - Discovery & Search
    
    // Fetch discoverable channels (public and searchable) with caching
    func fetchDiscoverableChannels(searchQuery: String? = nil, forceRefresh: Bool = false) async throws -> [DiscoverableChannel] {
        let cacheKeyString = "\(discoverableCacheKey)_\(searchQuery ?? "all")"
        
        // FAST PATH: Check in-memory cache first (instant)
        if !forceRefresh, let cached = cachedDiscoverableChannels[cacheKeyString] {
            let age = Date().timeIntervalSince(cached.timestamp)
            if age < cacheExpirationInterval {
                print("📦 Using in-memory cached discoverable channels (age: \(Int(age))s)")
                // Refresh in background if cache is getting old (> 30 min)
                if age > 1800 {
                    Task.detached { [weak self] in
                        _ = try? await self?.fetchDiscoverableChannels(searchQuery: searchQuery, forceRefresh: true)
                    }
                }
                return cached.channels
            }
        }
        
        // FAST PATH: Check persistent cache (UserDefaults) - very fast
        if !forceRefresh, let cachedData = UserDefaults.standard.data(forKey: cacheKeyString) {
            if let cached = try? JSONDecoder().decode(CachedDiscoverableChannels.self, from: cachedData) {
                let age = Date().timeIntervalSince(cached.timestamp)
                if age < cacheExpirationInterval && cached.searchQuery == searchQuery {
                    print("📦 Using persistent cached discoverable channels (age: \(Int(age))s)")
                    // Update in-memory cache for next time
                    cachedDiscoverableChannels[cacheKeyString] = (channels: cached.channels, timestamp: cached.timestamp)
                    // Refresh in background if cache is getting old (> 30 min)
                    if age > 1800 {
                        Task.detached { [weak self] in
                            _ = try? await self?.fetchDiscoverableChannels(searchQuery: searchQuery, forceRefresh: true)
                        }
                    }
                    return cached.channels
                }
            }
        }
        
        // Fetch from API
        guard let url = URL(string: "\(baseURL)/channels/get-public-channels") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "searchQuery": searchQuery ?? ""
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("🌐 [ChannelService] Fetching discoverable channels from API")
        print("   URL: \(url.absoluteString)")
        print("   Search Query: \(searchQuery ?? "nil")")
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] Invalid HTTP response")
            throw URLError(.badServerResponse)
        }
        
        print("📡 [ChannelService] API Response Status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [ChannelService] API returned non-200 status: \(httpResponse.statusCode)")
            print("   Response body: \(responseString)")
            throw URLError(.badServerResponse)
        }
        
        // Log raw response for debugging
        if let responseString = String(data: data, encoding: .utf8) {
            print("📦 [ChannelService] API Response (first 500 chars): \(String(responseString.prefix(500)))")
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success,
           let channels = json["channels"] as? [[String: Any]] {
            
            print("✅ [ChannelService] API returned \(channels.count) channels")
            
            // Log Twilly TV channel specifically
            if let twillyTV = channels.first(where: { ($0["channelName"] as? String ?? "").lowercased().contains("twilly tv") }) {
                print("📺 [ChannelService] Found Twilly TV channel in API response:")
                print("   Channel Name: \(twillyTV["channelName"] ?? "nil")")
                print("   Poster URL: \(twillyTV["posterUrl"] ?? "nil")")
                print("   Creator Email: \(twillyTV["creatorEmail"] ?? "nil")")
            }
            
            let discoverableChannels = channels.compactMap { channelDict -> DiscoverableChannel? in
                guard let channelId = channelDict["channelId"] as? String,
                      let channelName = channelDict["channelName"] as? String else {
                    print("⚠️ [ChannelService] Skipping channel - missing channelId or channelName")
                    return nil
                }
                
                let creatorEmail = channelDict["creatorEmail"] as? String ?? ""
                let creatorUsername = channelDict["creatorUsername"] as? String ?? "Unknown"
                let description = channelDict["description"] as? String ?? "Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you."
                let posterUrl = channelDict["posterUrl"] as? String ?? ""
                let visibility = channelDict["visibility"] as? String ?? "private"
                let isPublic = channelDict["isPublic"] as? Bool ?? false
                let subscriptionPrice = channelDict["subscriptionPrice"] as? Double
                let contentType = channelDict["contentType"] as? String
                
                // Log poster URL parsing
                print("📋 [ChannelService] Parsing channel: \(channelName)")
                print("   Channel ID: \(channelId)")
                print("   Creator Email: \(creatorEmail)")
                print("   Poster URL from API: \(posterUrl.isEmpty ? "EMPTY" : posterUrl)")
                if !posterUrl.isEmpty {
                    print("   Poster URL length: \(posterUrl.count) characters")
                    if let url = URL(string: posterUrl) {
                        print("   ✅ Poster URL is valid")
                        print("   URL scheme: \(url.scheme ?? "nil")")
                        print("   URL host: \(url.host ?? "nil")")
                        print("   URL path: \(url.path)")
                    } else {
                        print("   ❌ Poster URL is INVALID - cannot parse")
                    }
                } else {
                    print("   ⚠️ Poster URL is empty - checking raw API response...")
                    if let rawPosterUrl = channelDict["posterUrl"] {
                        print("   Raw posterUrl type: \(type(of: rawPosterUrl))")
                        print("   Raw posterUrl value: \(rawPosterUrl)")
                    } else {
                        print("   posterUrl key does not exist in API response")
                    }
                }
                
                return DiscoverableChannel(
                    channelId: channelId,
                    channelName: channelName,
                    creatorEmail: creatorEmail,
                    creatorUsername: creatorUsername,
                    description: description,
                    posterUrl: posterUrl,
                    visibility: visibility,
                    isPublic: isPublic,
                    subscriptionPrice: subscriptionPrice,
                    contentType: contentType
                )
            }
            
            // Filter based on search query and visibility
            let filteredChannels: [DiscoverableChannel]
            if let query = searchQuery, !query.isEmpty {
                // When searching: show public and searchable channels that match
                let queryLower = query.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                filteredChannels = discoverableChannels.filter { channel in
                    (channel.visibility == "public" || channel.visibility == "searchable") &&
                    channel.channelName.lowercased().contains(queryLower)
                }
            } else {
                // When browsing: show only public channels
                filteredChannels = discoverableChannels.filter { $0.visibility == "public" }
            }
            
            // Deduplicate channels by channelId
            var seenChannelIds = Set<String>()
            let uniqueChannels = filteredChannels.filter { channel in
                if seenChannelIds.contains(channel.channelId) {
                    print("⚠️ [ChannelService] Removing duplicate channel: \(channel.channelName) (ID: \(channel.channelId))")
                    return false
                }
                seenChannelIds.insert(channel.channelId)
                return true
            }
            
            // Log if duplicates were found
            if uniqueChannels.count < filteredChannels.count {
                print("⚠️ [ChannelService] Removed \(filteredChannels.count - uniqueChannels.count) duplicate channel(s)")
            }
            
            // Cache the results (both in-memory and persistent)
            let timestamp = Date()
            cachedDiscoverableChannels[cacheKeyString] = (channels: uniqueChannels, timestamp: timestamp)
            
            // Persist to UserDefaults for faster subsequent loads
            let cached = CachedDiscoverableChannels(channels: uniqueChannels, timestamp: timestamp, searchQuery: searchQuery)
            if let encoded = try? JSONEncoder().encode(cached) {
                UserDefaults.standard.set(encoded, forKey: cacheKeyString)
                print("💾 Cached \(uniqueChannels.count) unique discoverable channels (in-memory + persistent)")
            }
            
            return uniqueChannels
        }
        
        return []
    }
    
    // Pagination result structure
    struct PaginatedContent {
        let content: [ChannelContent]
        let nextToken: String?
        let hasMore: Bool
    }
    
    // Fetch content for a specific channel with pagination
    // Uses GraphQL if enabled, otherwise falls back to REST API
    func fetchChannelContent(
        channelName: String,
        creatorEmail: String,
        viewerEmail: String? = nil,
        limit: Int = 20,
        nextToken: String? = nil,
        forceRefresh: Bool = false,
        showPrivateContent: Bool = false
    ) async throws -> PaginatedContent {
        // Use GraphQL if enabled and configured, but fall back to REST on error
        if useGraphQL, let endpoint = graphQLEndpoint, let apiKey = graphQLApiKey {
            do {
                print("🚀 [ChannelService] Using GraphQL for channel content (limit: \(limit))")
                let result = try await fetchChannelContentGraphQL(
                    channelName: channelName,
                    creatorEmail: creatorEmail,
                    limit: limit,
                    nextToken: nextToken,
                    endpoint: endpoint,
                    apiKey: apiKey
                )
                return PaginatedContent(
                    content: result.content,
                    nextToken: result.nextToken,
                    hasMore: result.nextToken != nil
                )
            } catch {
                print("⚠️ [ChannelService] GraphQL channel content fetch failed: \(error.localizedDescription)")
                print("   Falling back to REST API...")
                // Continue to REST fallback below
            }
        }
        
        // Fall back to REST API
        print("📡 [ChannelService] Using REST API for channel content (limit: \(limit))")
        guard let url = URL(string: "\(baseURL)/channels/get-content") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add cache control headers if forceRefresh is true
        if forceRefresh {
            request.cachePolicy = .reloadIgnoringLocalCacheData
        }
        
        var body: [String: Any] = [
            "channelName": channelName,
            "creatorEmail": creatorEmail,
            "limit": limit
        ]
        
        if let nextToken = nextToken {
            body["nextToken"] = nextToken
        }
        
        // Add viewerEmail for Twilly TV filtering
        if let viewerEmail = viewerEmail {
            body["viewerEmail"] = viewerEmail
        }
        
        // Add showPrivateContent for server-side filtering (CRITICAL for privacy)
        // When false, server will NEVER return private videos (except viewer's own)
        body["showPrivateContent"] = showPrivateContent
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        // OPTIMIZATION: Use reasonable timeout - don't make it too long
        let session = forceRefresh ? {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 60.0 // 60 seconds for force refresh
            config.timeoutIntervalForResource = 120.0
            return URLSession(configuration: config, delegate: self, delegateQueue: nil)
        }() : urlSession
        
        print("📡 [ChannelService] Fetching content for channel: \(channelName), creatorEmail: \(creatorEmail), forceRefresh: \(forceRefresh)")
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            print("❌ [ChannelService] Failed to fetch content - status: \(statusCode)")
            if let responseString = String(data: data, encoding: .utf8) {
                print("   Response body: \(responseString)")
            }
            throw URLError(.badServerResponse)
        }
        
        // Log raw response for debugging
        if let responseString = String(data: data, encoding: .utf8) {
            print("🔍 [ChannelService] Raw API response: \(responseString.prefix(500))")
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("🔍 [ChannelService] Parsed JSON keys: \(json.keys.sorted())")
            
            // Handle both success format and direct content format
            let contentArray: [[String: Any]]
            if let success = json["success"] as? Bool, success, let content = json["content"] as? [[String: Any]] {
                print("✅ [ChannelService] Found content in success.content format - count: \(content.count)")
                contentArray = content
            } else if let content = json["content"] as? [[String: Any]] {
                print("✅ [ChannelService] Found content in content format - count: \(content.count)")
                contentArray = content
            } else {
                print("⚠️ [ChannelService] No content array found in response")
                print("   JSON structure: \(json)")
                return PaginatedContent(content: [], nextToken: nil, hasMore: false)
            }
            
            let contents = contentArray.compactMap { itemDict -> ChannelContent? in
                guard let sk = itemDict["SK"] as? String else {
                    print("⚠️ [ChannelService] Item missing SK field: \(itemDict.keys)")
                    return nil
                }
                
                let thumbnailUrl = itemDict["thumbnailUrl"] as? String
                
                // Debug: Log all fields for videos
                if let category = itemDict["category"] as? String, category == "Videos" {
                    let fileName = itemDict["fileName"] as? String ?? "unknown"
                    let title = itemDict["title"] as? String
                    let description = itemDict["description"] as? String
                    let price = itemDict["price"]
                    let uploadId = itemDict["uploadId"] as? String
                    let fileId = itemDict["fileId"] as? String
                    let isPrivateUsername = itemDict["isPrivateUsername"]
                    print("📹 Video: fileName=\(fileName)")
                    print("   title=\(title ?? "nil") (type: \(title != nil ? "String" : "nil"))")
                    print("   description=\(description != nil ? "\(description!.prefix(50))..." : "nil")")
                    print("   price=\(price != nil ? String(describing: price!) : "nil") (type: \(price != nil ? String(describing: type(of: price!)) : "nil"))")
                    print("   uploadId=\(uploadId ?? "MISSING")")
                    print("   fileId=\(fileId ?? "MISSING")")
                    print("   thumbnailUrl=\(thumbnailUrl ?? "MISSING")")
                    print("   isPrivateUsername=\(isPrivateUsername != nil ? String(describing: isPrivateUsername!) : "MISSING") (type: \(isPrivateUsername != nil ? String(describing: type(of: isPrivateUsername!)) : "nil"))")
                }
                
                // Parse price - handle string, number (Double, Int, NSNumber) formats from DynamoDB
                var price: Double? = nil
                if let priceValue = itemDict["price"] {
                    if let priceDouble = priceValue as? Double {
                        price = priceDouble
                    } else if let priceInt = priceValue as? Int {
                        price = Double(priceInt)
                    } else if let priceNSNumber = priceValue as? NSNumber {
                        price = priceNSNumber.doubleValue
                    } else if let priceString = priceValue as? String, let priceDouble = Double(priceString) {
                        price = priceDouble
                    }
                }
                
                // Parse title - handle empty strings as nil (to match web app behavior)
                var title: String? = itemDict["title"] as? String
                if let titleStr = title, titleStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    title = nil // Treat empty strings as nil
                }
                
                // Parse description - handle empty strings as nil
                var description: String? = itemDict["description"] as? String
                if let descStr = description, descStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    description = nil // Treat empty strings as nil
                }
                
                // Extract creator username from response if available, or from streamKey lookup
                let creatorUsername = itemDict["creatorUsername"] as? String ?? 
                                     itemDict["username"] as? String
                
                // Parse isPrivateUsername - handle boolean, string, number, or nil
                var isPrivateUsername: Bool? = nil
                if let isPrivateValue = itemDict["isPrivateUsername"] {
                    print("   🔍 [ChannelService] Found isPrivateUsername in itemDict: \(isPrivateValue) (type: \(type(of: isPrivateValue)))")
                    if let isPrivateBool = isPrivateValue as? Bool {
                        isPrivateUsername = isPrivateBool
                        print("   ✅ [ChannelService] Parsed as Bool: \(isPrivateUsername!)")
                    } else if let isPrivateString = isPrivateValue as? String {
                        isPrivateUsername = isPrivateString.lowercased() == "true" || isPrivateString == "1"
                        print("   ✅ [ChannelService] Parsed as String: \(isPrivateUsername!)")
                    } else if let isPrivateNumber = isPrivateValue as? NSNumber {
                        isPrivateUsername = isPrivateNumber.boolValue
                        print("   ✅ [ChannelService] Parsed as NSNumber: \(isPrivateUsername!)")
                    } else if let isPrivateInt = isPrivateValue as? Int {
                        isPrivateUsername = isPrivateInt == 1
                        print("   ✅ [ChannelService] Parsed as Int: \(isPrivateUsername!)")
                    } else {
                        print("   ⚠️ [ChannelService] isPrivateUsername has unexpected type: \(type(of: isPrivateValue))")
                    }
                } else {
                    print("   ❌ [ChannelService] isPrivateUsername NOT FOUND in itemDict. Available keys: \(itemDict.keys.joined(separator: ", "))")
                }
                
                return ChannelContent(
                    SK: sk,
                    fileName: itemDict["fileName"] as? String ?? "",
                    title: title,
                    description: description,
                    hlsUrl: itemDict["hlsUrl"] as? String,
                    thumbnailUrl: thumbnailUrl,
                    createdAt: itemDict["createdAt"] as? String,
                    isVisible: itemDict["isVisible"] as? Bool,
                    price: price,
                    category: itemDict["category"] as? String,
                    uploadId: itemDict["uploadId"] as? String,
                    fileId: itemDict["fileId"] as? String,
                    airdate: itemDict["airdate"] as? String,
                    creatorUsername: creatorUsername,
                    isPrivateUsername: isPrivateUsername
                )
            }
            
            print("📦 Parsed \(contents.count) content items")
            // Debug: Log thumbnail URLs for all videos
            for content in contents.filter({ $0.category == "Videos" }) {
                print("   📹 \(content.fileName): thumbnailUrl = \(content.thumbnailUrl ?? "nil")")
            }
            
            // Get nextToken from response if available
            let nextToken = json["nextToken"] as? String
            
            // If we got exactly the limit, there might be more
            let hasMore = contents.count == limit || nextToken != nil
            
            return PaginatedContent(
                content: contents,
                nextToken: nextToken,
                hasMore: hasMore
            )
        }
        
        return PaginatedContent(content: [], nextToken: nil, hasMore: false)
    }
    
    // Convenience method for backward compatibility (loads first page)
    func fetchChannelContent(channelName: String, creatorEmail: String, forceRefresh: Bool = false) async throws -> [ChannelContent] {
        let result = try await fetchChannelContent(
            channelName: channelName,
            creatorEmail: creatorEmail,
            limit: 50, // Load more for initial load
            nextToken: nil,
            forceRefresh: forceRefresh
        )
        return result.content
    }
    
    // MARK: - GraphQL Methods (Private)
    
    private func fetchChannelContentGraphQL(
        channelName: String,
        creatorEmail: String,
        limit: Int = 20,
        nextToken: String? = nil,
        endpoint: String,
        apiKey: String
    ) async throws -> (content: [ChannelContent], nextToken: String?) {
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        
        let query = """
        query ChannelContent($channelName: String!, $creatorEmail: String!, $limit: Int, $nextToken: String) {
          channelContent(channelName: $channelName, creatorEmail: $creatorEmail, limit: $limit, nextToken: $nextToken) {
            content {
              SK
              fileName
              title
              description
              hlsUrl
              thumbnailUrl
              createdAt
              isVisible
              price
              category
              uploadId
              fileId
              airdate
            }
            count
            nextToken
          }
        }
        """
        
        var variables: [String: Any] = [
            "channelName": channelName,
            "creatorEmail": creatorEmail,
            "limit": limit
        ]
        if let nextToken = nextToken {
            variables["nextToken"] = nextToken
        }
        
        let body: [String: Any] = [
            "query": query,
            "variables": variables
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Parse GraphQL response
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.badServerResponse)
        }
        
        // Check for GraphQL errors
        if let errors = json["errors"] as? [[String: Any]], !errors.isEmpty {
            let errorMessage = errors.first?["message"] as? String ?? "GraphQL error"
            print("❌ [ChannelService] GraphQL error: \(errorMessage)")
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }
        
        // Parse data
        guard let dataDict = json["data"] as? [String: Any],
              let channelContent = dataDict["channelContent"] as? [String: Any],
              let contentArray = channelContent["content"] as? [[String: Any]] else {
            return ([], nil)
        }
        
        // Get nextToken
        let nextToken = channelContent["nextToken"] as? String
        
        // Convert to ChannelContent objects
        let contents = contentArray.compactMap { itemDict -> ChannelContent? in
            guard let sk = itemDict["SK"] as? String else { return nil }
            
            var price: Double? = nil
            if let priceValue = itemDict["price"] {
                if let priceDouble = priceValue as? Double {
                    price = priceDouble
                } else if let priceInt = priceValue as? Int {
                    price = Double(priceInt)
                } else if let priceString = priceValue as? String, let priceDouble = Double(priceString) {
                    price = priceDouble
                }
            }
            
            var title: String? = itemDict["title"] as? String
            if let titleStr = title, titleStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                title = nil
            }
            
            var description: String? = itemDict["description"] as? String
            if let descStr = description, descStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                description = nil
            }
            
            // Extract creator username from response if available
            let creatorUsername = itemDict["creatorUsername"] as? String ?? 
                                 itemDict["username"] as? String
            
            return ChannelContent(
                SK: sk,
                fileName: itemDict["fileName"] as? String ?? "",
                title: title,
                description: description,
                hlsUrl: itemDict["hlsUrl"] as? String,
                thumbnailUrl: itemDict["thumbnailUrl"] as? String,
                createdAt: itemDict["createdAt"] as? String,
                isVisible: itemDict["isVisible"] as? Bool,
                price: price,
                category: itemDict["category"] as? String,
                uploadId: itemDict["uploadId"] as? String,
                fileId: itemDict["fileId"] as? String,
                creatorUsername: creatorUsername
            )
        }
        
        print("📦 [ChannelService] GraphQL fetched \(contents.count) content items, nextToken: \(nextToken ?? "nil")")
        return (contents, nextToken)
    }
    
    // MARK: - Channel Management (Phase 1)
    
    // Channel model for user's own channels (with management info)
    struct MyChannel: Identifiable, Codable {
        let channelId: String
        let channelName: String
        let visibility: String // "private", "searchable", or "public"
        let subscriptionPrice: Double
        let description: String
        let category: String
        let posterUrl: String?
        let createdAt: String
        let updatedAt: String
        let creatorUsername: String
        
        var id: String { channelId }
    }
    
    // Create a new channel
    func createChannel(
        channelName: String,
        creatorEmail: String,
        creatorUsername: String? = nil,
        userId: String? = nil,
        visibility: String = "private",
        subscriptionPrice: Double = 0,
        description: String = "",
        category: String = "Mixed"
    ) async throws -> CreateChannelResponse {
        guard let url = URL(string: "\(baseURL)/channels/create") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelName": channelName,
            "creatorEmail": creatorEmail,
            "creatorUsername": creatorUsername ?? creatorEmail,
            "userId": userId ?? creatorEmail,
            "visibility": visibility,
            "subscriptionPrice": subscriptionPrice,
            "description": description,
            "category": category
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(CreateChannelResponse.self, from: data)
    }
    
    // Fetch user's own channels
    func fetchMyChannels(creatorEmail: String, userId: String? = nil) async throws -> [MyChannel] {
        // Try GraphQL first if enabled
        if useGraphQL, let endpoint = graphQLEndpoint, let apiKey = graphQLApiKey {
            return try await fetchMyChannelsGraphQL(creatorEmail: creatorEmail, endpoint: endpoint, apiKey: apiKey)
        }
        
        // Fallback to REST API
        guard let url = URL(string: "\(baseURL)/channels/my-channels") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "creatorEmail": creatorEmail
        ]
        if let userId = userId {
            body["userId"] = userId
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            print("❌ [ChannelService] fetchMyChannels REST API error: status code \((response as? HTTPURLResponse)?.statusCode ?? -1)")
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success,
           let channels = json["channels"] as? [[String: Any]] {
            
            let myChannels = channels.compactMap { channelDict -> MyChannel? in
                guard let channelId = channelDict["channelId"] as? String,
                      let channelName = channelDict["channelName"] as? String else {
                    return nil
                }
                
                return MyChannel(
                    channelId: channelId,
                    channelName: channelName,
                    visibility: channelDict["visibility"] as? String ?? "private",
                    subscriptionPrice: channelDict["subscriptionPrice"] as? Double ?? 0,
                    description: channelDict["description"] as? String ?? "",
                    category: channelDict["category"] as? String ?? "Mixed",
                    posterUrl: channelDict["posterUrl"] as? String,
                    createdAt: channelDict["createdAt"] as? String ?? "",
                    updatedAt: channelDict["updatedAt"] as? String ?? "",
                    creatorUsername: channelDict["creatorUsername"] as? String ?? creatorEmail
                )
            }
            
            return myChannels
        }
        
        return []
    }
    
    // GraphQL query for myChannels
    private func fetchMyChannelsGraphQL(creatorEmail: String, endpoint: String, apiKey: String) async throws -> [MyChannel] {
        let query = """
        query MyChannels($creatorEmail: String!) {
          myChannels(creatorEmail: $creatorEmail) {
            channelId
            channelName
            visibility
            subscriptionPrice
            description
            category
            posterUrl
            createdAt
            updatedAt
            creatorUsername
          }
        }
        """
        
        let variables: [String: Any] = [
            "creatorEmail": creatorEmail
        ]
        
        let requestBody: [String: Any] = [
            "query": query,
            "variables": variables
        ]
        
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            print("❌ [ChannelService] fetchMyChannels GraphQL error: status code \((response as? HTTPURLResponse)?.statusCode ?? -1)")
            throw URLError(.badServerResponse)
        }
        
        // Parse GraphQL response
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.badServerResponse)
        }
        
        // Check for GraphQL errors
        if let errors = json["errors"] as? [[String: Any]], !errors.isEmpty {
            let errorMessage = errors.first?["message"] as? String ?? "GraphQL error"
            print("❌ [ChannelService] GraphQL error: \(errorMessage)")
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }
        
        // Parse myChannels response
        guard let dataDict = json["data"] as? [String: Any],
              let channelsArray = dataDict["myChannels"] as? [[String: Any]] else {
            print("⚠️ [ChannelService] GraphQL myChannels query returned no channels")
            return []
        }
        
        let myChannels = channelsArray.compactMap { channelDict -> MyChannel? in
            guard let channelId = channelDict["channelId"] as? String,
                  let channelName = channelDict["channelName"] as? String else {
                return nil
            }
            
            return MyChannel(
                channelId: channelId,
                channelName: channelName,
                visibility: channelDict["visibility"] as? String ?? "private",
                subscriptionPrice: channelDict["subscriptionPrice"] as? Double ?? 0,
                description: channelDict["description"] as? String ?? "",
                category: channelDict["category"] as? String ?? "Mixed",
                posterUrl: channelDict["posterUrl"] as? String,
                createdAt: channelDict["createdAt"] as? String ?? "",
                updatedAt: channelDict["updatedAt"] as? String ?? "",
                creatorUsername: channelDict["creatorUsername"] as? String ?? creatorEmail
            )
        }
        
        print("✅ [ChannelService] GraphQL fetched \(myChannels.count) channels")
        return myChannels
    }
    
    // Update channel visibility
    func updateChannelVisibility(
        channelId: String,
        channelName: String,
        creatorUsername: String,
        visibility: String
    ) async throws -> UpdateVisibilityResponse {
        guard let url = URL(string: "\(baseURL)/channels/update-visibility") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelId": channelId,
            "channelName": channelName,
            "creatorUsername": creatorUsername,
            "visibility": visibility
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(UpdateVisibilityResponse.self, from: data)
    }
    
    // Update channel subscription price
    func updateChannelSubscriptionPrice(
        channelId: String,
        channelName: String,
        creatorUsername: String,
        newPrice: Double
    ) async throws -> UpdateSubscriptionPriceResponse {
        guard let url = URL(string: "\(baseURL)/channels/update-subscription-price") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelId": channelId,
            "channelName": channelName,
            "creatorUsername": creatorUsername,
            "newPrice": newPrice
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(UpdateSubscriptionPriceResponse.self, from: data)
    }
    
    // MARK: - Username Management
    
    func checkUsernameAvailability(username: String, userId: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/creators/check-username") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "username": username,
            "userId": userId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await urlSession.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }
            
            // Parse response body for error messages
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Check for success and available fields
                if let success = json["success"] as? Bool, success,
                   let available = json["available"] as? Bool {
                    return available
                }
                
                // Check for error message in response
                if let message = json["message"] as? String {
                    throw NSError(
                        domain: "ChannelService",
                        code: httpResponse.statusCode,
                        userInfo: [NSLocalizedDescriptionKey: message]
                    )
                }
            }
            
            // Handle non-200 status codes with error message
            if httpResponse.statusCode != 200 {
                let errorMessage: String
                if let responseString = String(data: data, encoding: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    errorMessage = message
                } else {
                    errorMessage = "Server error: \(httpResponse.statusCode)"
                }
                
                throw NSError(
                    domain: "ChannelService",
                    code: httpResponse.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: errorMessage]
                )
            }
            
            // Default to false if we can't parse the response
            return false
        } catch let error as URLError {
            // Network errors - re-throw with custom message
            let errorMessage: String
            switch error.code {
            case .notConnectedToInternet:
                errorMessage = "No internet connection. Please check your network."
            case .timedOut:
                errorMessage = "Request timed out. Please try again."
            case .cannotFindHost, .cannotConnectToHost:
                errorMessage = "Cannot connect to server. Please try again later."
            default:
                errorMessage = "Network error: \(error.localizedDescription)"
            }
            // Create new URLError with custom message
            var userInfo = error.userInfo
            userInfo[NSLocalizedDescriptionKey] = errorMessage
            throw URLError(error.code, userInfo: userInfo)
        }
    }
    
    // Update content details (title, description, price, visibility)
    func updateContentDetails(fileId: String, pk: String, title: String?, description: String?, price: Double?, isVisible: Bool?) async throws {
        guard let url = URL(string: "\(baseURL)/files/update-details") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "fileId": fileId,
            "PK": pk
        ]
        
        if let title = title {
            body["title"] = title
        }
        if let description = description {
            body["description"] = description
        }
        if let price = price {
            body["price"] = price
        }
        if let isVisible = isVisible {
            body["isVisible"] = isVisible
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success {
            print("✅ [ChannelService] Content updated successfully")
        } else {
            throw URLError(.badServerResponse)
        }
    }
    
    // Update content visibility (live/draft toggle)
    // MARK: - Air Schedule Functions
    
    func saveAirSchedule(userEmail: String, userId: String, airDay: String, airTime: String) async throws -> AirScheduleResponse {
        guard let url = URL(string: "\(baseURL)/air-schedule/save") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "userId": userId,
            "airDay": airDay,
            "airTime": airTime
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(AirScheduleResponse.self, from: data)
    }
    
    func getAirSchedule(userEmail: String) async throws -> AirScheduleResponse {
        print("🔍 [ChannelService] Fetching air schedule for userEmail: \(userEmail)")
        guard let url = URL(string: "\(baseURL)/air-schedule/get") else {
            print("❌ [ChannelService] Invalid URL for getAirSchedule")
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📤 [ChannelService] Sending POST request to: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] Invalid response type for getAirSchedule")
            throw ChannelServiceError.invalidResponse
        }
        
        print("📥 [ChannelService] getAirSchedule response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode == 404 {
            // 404 means endpoint doesn't exist yet or user has no schedule
            // Return a response indicating no schedule exists
            let responseString = String(data: data, encoding: .utf8) ?? "No response body"
            print("ℹ️ [ChannelService] getAirSchedule returned 404 (endpoint may not exist or no schedule): \(responseString)")
            print("   Returning empty schedule response")
            return AirScheduleResponse(success: false, message: "No schedule found", schedule: nil)
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [ChannelService] getAirSchedule server error \(httpResponse.statusCode): \(errorMessage)")
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📄 [ChannelService] getAirSchedule response body: \(responseString)")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(AirScheduleResponse.self, from: data)
        print("✅ [ChannelService] getAirSchedule parsed successfully: success=\(result.success), hasSchedule=\(result.schedule != nil)")
        return result
    }
    
    func setPostAutomatically(userEmail: String, userId: String?, postAutomatically: Bool) async throws -> AirScheduleResponse {
        print("🔧 [ChannelService] Setting postAutomatically=\(postAutomatically) for userEmail: \(userEmail)")
        guard let url = URL(string: "\(baseURL)/air-schedule/post-automatically") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "userEmail": userEmail,
            "postAutomatically": postAutomatically
        ]
        
        if let userId = userId {
            body["userId"] = userId
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(AirScheduleResponse.self, from: data)
    }
    
    func getPostAutomatically(userEmail: String) async throws -> Bool {
        print("🔍 [ChannelService] Getting postAutomatically setting for userEmail: \(userEmail)")
        guard let url = URL(string: "\(baseURL)/air-schedule/get-post-automatically") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode == 404 {
            // Default to false if not set
            return false
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let postAutomatically = json["postAutomatically"] as? Bool {
            return postAutomatically
        }
        
        return false
    }
    
    func pauseSchedule(userEmail: String, pause: Bool) async throws -> AirScheduleResponse {
        print("🔧 [ChannelService] \(pause ? "Pausing" : "Resuming") schedule for userEmail: \(userEmail)")
        guard let url = URL(string: "\(baseURL)/air-schedule/unset") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "pause": pause
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(AirScheduleResponse.self, from: data)
    }
    
    func getOccupiedSlots() async throws -> [String] {
        print("🔍 [ChannelService] Fetching occupied slots...")
        guard let url = URL(string: "\(baseURL)/air-schedule/occupied-slots") else {
            print("❌ [ChannelService] Invalid URL for getOccupiedSlots")
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        print("📤 [ChannelService] Sending POST request to: \(url.absoluteString)")
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] Invalid response type for getOccupiedSlots")
            throw ChannelServiceError.invalidResponse
        }
        
        print("📥 [ChannelService] getOccupiedSlots response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode == 404 {
            // 404 means endpoint doesn't exist yet or no slots are occupied
            // Return empty array - this is normal if backend isn't deployed yet
            let responseString = String(data: data, encoding: .utf8) ?? "No response body"
            print("ℹ️ [ChannelService] getOccupiedSlots returned 404 (endpoint may not exist): \(responseString)")
            print("   Returning empty array - treating as 'no slots occupied'")
            return []
        }
        
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [ChannelService] getOccupiedSlots server error \(httpResponse.statusCode): \(errorMessage)")
            throw ChannelServiceError.serverError(errorMessage)
        }
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📄 [ChannelService] getOccupiedSlots response body: \(responseString)")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(OccupiedSlotsResponse.self, from: data)
        print("✅ [ChannelService] getOccupiedSlots parsed successfully: \(result.occupiedSlots.count) slots")
        return result.occupiedSlots
    }
    
    func updateContentVisibility(fileId: String, pk: String, isVisible: Bool) async throws {
        try await updateContentDetails(fileId: fileId, pk: pk, title: nil, description: nil, price: nil, isVisible: isVisible)
    }
    
    // Response structure for convertStreamToPost
    struct ConvertToPostResponse: Codable {
        let success: Bool
        let message: String?
        let fileId: String? // File ID (SK without "FILE#" prefix)
    }
    
    // Create collaborator invite
    // Convert recorded RTMP stream to channel post
    // Returns fileId if successful (for moving file to selected channel)
    func convertStreamToPost(channelName: String, streamKey: String, title: String? = nil, description: String? = nil, price: Double? = nil, userEmail: String) async throws -> String? {
        guard let url = URL(string: "\(baseURL)/streams/convert-to-post") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "channelName": channelName,
            "streamKey": streamKey,
            "userEmail": userEmail
        ]
        
        if let title = title {
            body["title"] = title
        }
        if let description = description {
            body["description"] = description
        }
        if let price = price {
            body["price"] = price
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode != 200 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
            }
            throw URLError(.badServerResponse)
        }
        
        // Parse response
        let decoder = JSONDecoder()
        let convertResponse = try decoder.decode(ConvertToPostResponse.self, from: data)
        
        if convertResponse.success {
            print("✅ Stream converted to post successfully")
            return convertResponse.fileId
        } else {
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: convertResponse.message ?? "Failed to convert stream to post"])
        }
    }
    
    // Move file to a different channel/folder (same as managefiles move function)
    func moveFile(userEmail: String, fileId: String, targetChannel: String) async throws {
        guard let url = URL(string: "\(baseURL)/files/move") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // The move API expects fileId to be the full SK (FILE#...), not just the ID
        let fullFileId = fileId.hasPrefix("FILE#") ? fileId : "FILE#\(fileId)"
        
        let body: [String: Any] = [
            "userId": userEmail,
            "fileId": fullFileId,
            "targetFolder": targetChannel
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode != 200 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
            }
            throw URLError(.badServerResponse)
        }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success {
            print("✅ File moved to channel '\(targetChannel)' successfully")
        } else {
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to move file"])
        }
    }
    
    // Check subscription status for a channel (GraphQL optimized)
    func checkSubscriptionStatus(channelId: String, userEmail: String) async throws -> Bool {
        // Use GraphQL for fast subscription check
        guard let endpoint = graphQLEndpoint, let apiKey = graphQLApiKey, useGraphQL else {
            // Fallback to REST API
            return try await checkSubscriptionStatusREST(channelId: channelId, userEmail: userEmail)
        }
        
        let query = """
        query CheckSubscription($channelId: String!, $userEmail: String!) {
          checkSubscription(channelId: $channelId, userEmail: $userEmail) {
            isSubscribed
          }
        }
        """
        
        let variables: [String: Any] = [
            "channelId": channelId,
            "userEmail": userEmail
        ]
        
        // GraphQL implementation would go here
        // For now, fallback to REST
        return try await checkSubscriptionStatusREST(channelId: channelId, userEmail: userEmail)
    }
    
    private func checkSubscriptionStatusREST(channelId: String, userEmail: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/subscriptions/check") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelId": channelId,
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            return false
        }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let isSubscribed = json["isSubscribed"] as? Bool {
            return isSubscribed
        }
        
        return false
    }
    
    func createCollaboratorInvite(channelName: String, channelOwnerEmail: String, channelOwnerId: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/collaborations/store-invite") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Generate invite code (UUID)
        let inviteCode = UUID().uuidString
        
        let body: [String: Any] = [
            "PK": "INVITE",
            "SK": inviteCode,
            "channelName": channelName,
            "channelOwnerEmail": channelOwnerEmail,
            "channelOwnerId": channelOwnerId,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "expiresAt": ISO8601DateFormatter().string(from: Date().addingTimeInterval(7 * 24 * 60 * 60)), // 7 days
            "status": "active"
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success {
            return inviteCode
        } else {
            throw URLError(.badServerResponse)
        }
    }
    
    // Check if user can upload to a channel (must be owner or collaborator)
    func canUploadToChannel(channelName: String, userEmail: String, userId: String? = nil) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/collaborations/check-upload-permission") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "userEmail": userEmail,
            "channelName": channelName
        ]
        
        if let userId = userId {
            body["userId"] = userId
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            print("❌ [ChannelService] canUploadToChannel error: status code \((response as? HTTPURLResponse)?.statusCode ?? -1)")
            // On error, default to false for security
            return false
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool,
           let canUpload = json["canUpload"] as? Bool {
            print("✅ [ChannelService] canUploadToChannel result: \(canUpload) for channel: \(channelName)")
            return success && canUpload
        }
        
        // Default to false if we can't parse the response
        return false
    }
    
    // MARK: - Invite Code Management
    
    // Accept invite code to unlock streaming access
    struct AcceptInviteResponse: Codable {
        let success: Bool
        let message: String?
        let streamKey: String?
        let hasPayoutSetup: Bool?
        let payoutSetupRequired: Bool?
        let collaborator: CollaboratorResponse?
        
        struct CollaboratorResponse: Codable {
            let channelId: String?
            let channelName: String?
            let streamKey: String?
            let joinedAt: String?
            let hasPayoutSetup: Bool?
            let payoutSetupRequired: Bool?
        }
    }
    
    func acceptInviteCode(inviteCode: String, userId: String, userEmail: String, channelName: String? = nil) async throws -> AcceptInviteResponse {
        guard let url = URL(string: "\(baseURL)/collaborations/accept-invite") else {
            throw URLError(.badURL)
        }
        
        print("🎫 [ChannelService] Accepting invite code: \(inviteCode) for channel: \(channelName ?? "unknown")")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "inviteCode": inviteCode,
            "userId": userId,
            "userEmail": userEmail
        ]
        
        // Include channelName if provided (for validation)
        if let channelName = channelName {
            body["channelName"] = channelName
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        print("📡 [ChannelService] Accept invite response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode != 200 {
            if let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = errorData["message"] as? String {
                throw NSError(domain: "ChannelService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
            }
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(AcceptInviteResponse.self, from: data)
        
        print("✅ [ChannelService] Invite code accepted: \(result.success)")
        return result
    }
    
    // MARK: - Collaborator Management (Admin Only)
    
    // Search for usernames on Twilly
    func searchUsernames(query: String, limit: Int = 50) async throws -> [UsernameSearchResult] {
        guard let url = URL(string: "\(baseURL)/users/search-usernames") else {
            throw URLError(.badURL)
        }
        
        print("🔍 [ChannelService] Searching usernames with query: '\(query)'")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "searchQuery": query,
            "limit": limit
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] Invalid response")
            throw URLError(.badServerResponse)
        }
        
        print("📡 [ChannelService] Response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode != 200 {
            if let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                print("❌ [ChannelService] Error response: \(errorData)")
            }
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("📦 [ChannelService] Response JSON: \(json)")
            
            if let success = json["success"] as? Bool, success,
               let usernames = json["usernames"] as? [[String: Any]] {
                
                print("✅ [ChannelService] Found \(usernames.count) usernames")
                
                return usernames.compactMap { userDict -> UsernameSearchResult? in
                    guard let username = userDict["username"] as? String else {
                        print("⚠️ [ChannelService] User dict missing username: \(userDict)")
                        return nil
                    }
                    return UsernameSearchResult(
                        username: username,
                        email: userDict["email"] as? String,
                        userId: userDict["userId"] as? String
                    )
                }
            } else {
                print("⚠️ [ChannelService] Response missing success or usernames array")
                if let message = json["message"] as? String {
                    print("   Message: \(message)")
                }
            }
        }
        
        return []
    }
    
    // List collaborators for a channel (admin only)
    func listCollaborators(channelName: String, userEmail: String) async throws -> [CollaboratorInfo] {
        guard let url = URL(string: "\(baseURL)/collaborations/list") else {
            throw URLError(.badURL)
        }
        
        print("🔍 [ChannelService] Listing collaborators for channel: '\(channelName)', userEmail: '\(userEmail)'")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelName": channelName,
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("🔍 [ChannelService] listCollaborators response: \(json)")
            print("🔍 [ChannelService] Response keys: \(json.keys)")
            
            if let success = json["success"] as? Bool {
                print("🔍 [ChannelService] success: \(success)")
            }
            
            if let message = json["message"] as? String {
                print("🔍 [ChannelService] message: \(message)")
            }
            
            if let collaborators = json["collaborators"] as? [[String: Any]] {
                print("✅ [ChannelService] Found \(collaborators.count) collaborators in response")
                
                for (index, collab) in collaborators.enumerated() {
                    print("   [\(index)] Raw collaborator data: \(collab)")
                }
            } else {
                print("⚠️ [ChannelService] No 'collaborators' array in response, or it's not an array")
            }
            
            if let success = json["success"] as? Bool, success,
               let collaborators = json["collaborators"] as? [[String: Any]] {
                
                print("✅ [ChannelService] Processing \(collaborators.count) collaborators")
                
                let parsed = collaborators.compactMap { collabDict -> CollaboratorInfo? in
                    guard let userId = collabDict["userId"] as? String,
                          let userEmail = collabDict["userEmail"] as? String else {
                        print("⚠️ [ChannelService] Invalid collaborator data - missing userId or userEmail: \(collabDict)")
                        return nil
                    }
                    
                    // Username is optional, default to "Unknown" if missing
                    let username = (collabDict["username"] as? String) ?? "Unknown"
                    
                    print("   - Parsed: \(username) (\(userEmail), userId: \(userId))")
                    
                    return CollaboratorInfo(
                        userId: userId,
                        userEmail: userEmail,
                        username: username,
                        streamKey: collabDict["streamKey"] as? String,
                        joinedAt: collabDict["joinedAt"] as? String,
                        status: collabDict["status"] as? String,
                        role: collabDict["role"] as? String
                    )
                }
                
                print("✅ [ChannelService] Returning \(parsed.count) valid collaborators")
                return parsed
            } else {
                print("❌ [ChannelService] API returned success: false or missing collaborators array")
                if let message = json["message"] as? String {
                    print("   Message: \(message)")
                }
            }
        }
        
        return []
    }
    
    // Remove collaborator from a channel (admin only)
    func removeCollaborator(channelName: String, collaboratorUsername: String, userEmail: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/collaborations/remove") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelName": channelName,
            "collaboratorUsername": collaboratorUsername,
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let success = json["success"] as? Bool {
                return success
            }
            
            // Check for error message
            if let message = json["message"] as? String {
                throw NSError(
                    domain: "ChannelService",
                    code: httpResponse.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: message]
                )
            }
        }
        
        // If status is not 200, throw error
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        return true
    }
    
    // Add collaborator to a channel (admin only)
    func addCollaborator(channelName: String, collaboratorUsername: String, userEmail: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/collaborations/add") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "channelName": channelName,
            "collaboratorUsername": collaboratorUsername,
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let success = json["success"] as? Bool {
                if !success {
                    // If success is false, check for error message and throw it
                    if let message = json["message"] as? String {
                        throw NSError(
                            domain: "ChannelService",
                            code: httpResponse.statusCode,
                            userInfo: [NSLocalizedDescriptionKey: message]
                        )
                    }
                    return false
                }
                return true
            }
            
            // Check for error message
            if let message = json["message"] as? String {
                throw NSError(
                    domain: "ChannelService",
                    code: httpResponse.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: message]
                )
            }
        }
        
        // If status is not 200, throw error
        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
        
        return true
    }
    
    // Get email from username (for admin check - username can change, email shouldn't)
    func getEmailFromUsername(username: String) async throws -> String? {
        guard let url = URL(string: "\(baseURL)/users/get-email-from-username") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "username": username
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success,
           let email = json["email"] as? String {
            return email
        }
        
        return nil
    }
    
    func updateUsername(userId: String, username: String, email: String) async throws {
        guard let url = URL(string: "\(baseURL)/creators/update-username") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userId": userId,
            "username": username,
            "email": email
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error: \(errorMessage)"])
        }
    }
    
    func fetchUsername(userId: String, email: String) async throws -> String? {
        // Try GraphQL first if enabled, but fall back to REST on error
        if useGraphQL, let endpoint = graphQLEndpoint, let apiKey = graphQLApiKey {
            do {
                print("🚀 [ChannelService] Trying GraphQL for username fetch")
                return try await fetchUsernameGraphQL(userId: userId, email: email, endpoint: endpoint, apiKey: apiKey)
            } catch {
                print("⚠️ [ChannelService] GraphQL username fetch failed: \(error.localizedDescription)")
                print("   Falling back to REST API...")
                // Continue to REST fallback below
            }
        }
        
        // Fallback to REST API with shorter timeout for quick username fetch
        guard let url = URL(string: "\(baseURL)/creators/get-username") else {
            throw URLError(.badURL)
        }
        
        // Create a URLSession with shorter timeout for username fetch (10 seconds)
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10.0
        config.timeoutIntervalForResource = 15.0
        let quickSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userId": userId,
            "email": email
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await quickSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] fetchUsername REST API error: invalid response type")
            throw URLError(.badServerResponse)
        }
        
        // Handle 403 specifically (Netlify security challenge)
        if httpResponse.statusCode == 403 {
            print("⚠️ [ChannelService] fetchUsername got 403 - likely Netlify security challenge")
            // Try to parse error message from response
            if let responseString = String(data: data, encoding: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                throw NSError(
                    domain: "ChannelService",
                    code: 403,
                    userInfo: [NSLocalizedDescriptionKey: message]
                )
            } else {
                throw NSError(
                    domain: "ChannelService",
                    code: 403,
                    userInfo: [NSLocalizedDescriptionKey: "Access denied. Please try again in a moment."]
                )
            }
        }
        
        guard httpResponse.statusCode == 200 else {
            print("❌ [ChannelService] fetchUsername REST API error: status code \(httpResponse.statusCode)")
            // Try to parse error message
            if let responseString = String(data: data, encoding: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                throw NSError(
                    domain: "ChannelService",
                    code: httpResponse.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: message]
                )
            } else {
                throw URLError(.badServerResponse)
            }
        }
        
        // Log the raw response for debugging
        if let responseString = String(data: data, encoding: .utf8) {
            print("🔍 [ChannelService] fetchUsername REST API response: \(responseString)")
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("🔍 [ChannelService] fetchUsername JSON: \(json)")
            
            // Handle both "username" and empty string cases
            // Also check for "found" field to see if user record exists
            if let found = json["found"] as? Bool, found {
                if let username = json["username"] as? String {
                    if !username.isEmpty {
                        print("✅ [ChannelService] Found username: \(username)")
                        return username
                    } else {
                        print("⚠️ [ChannelService] User record exists but username is empty string")
                        return nil
                    }
                } else {
                    print("⚠️ [ChannelService] User record found but no username field")
                    return nil
                }
            } else {
                // No user record found or found=false
                if let username = json["username"] as? String, !username.isEmpty {
                    print("✅ [ChannelService] Found username (found=false but username exists): \(username)")
                    return username
                } else {
                    print("⚠️ [ChannelService] No user record found (found=false or missing)")
                    return nil
                }
            }
        }
        
        print("⚠️ [ChannelService] Could not parse JSON response")
        return nil
    }
    
    // GraphQL query for username using userAccount query
    private func fetchUsernameGraphQL(userId: String, email: String, endpoint: String, apiKey: String) async throws -> String? {
        let query = """
        query GetUserAccount($userId: String!) {
          userAccount(userId: $userId) {
            userId
            email
            username
            name
          }
        }
        """
        
        let variables: [String: Any] = [
            "userId": userId
        ]
        
        let requestBody: [String: Any] = [
            "query": query,
            "variables": variables
        ]
        
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Parse GraphQL response
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.badServerResponse)
        }
        
        // Check for GraphQL errors
        if let errors = json["errors"] as? [[String: Any]], !errors.isEmpty {
            let errorMessage = errors.first?["message"] as? String ?? "GraphQL error"
            print("❌ [ChannelService] GraphQL error: \(errorMessage)")
            throw NSError(domain: "ChannelService", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }
        
        // Parse userAccount response
        if let dataDict = json["data"] as? [String: Any],
           let userAccount = dataDict["userAccount"] as? [String: Any],
           let username = userAccount["username"] as? String,
           !username.isEmpty {
            print("✅ [ChannelService] GraphQL found username: \(username)")
            return username
        }
        
        print("⚠️ [ChannelService] GraphQL userAccount query returned no username")
        return nil
    }
    
    // MARK: - Username Visibility
    
    func setUsernameVisibility(userEmail: String, isPublic: Bool) async throws -> UsernameVisibilityResponse {
        guard let url = URL(string: "\(baseURL)/users/set-visibility") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "isPublic": isPublic
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(UsernameVisibilityResponse.self, from: data)
    }
    
    // MARK: - Delete File
    
    func deleteFile(userId: String, fileId: String, fileName: String, folderName: String?) async throws -> DeleteFileResponse {
        guard let url = URL(string: "\(baseURL)/files/delete") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "userId": userId,
            "fileId": fileId,
            "fileName": fileName
        ]
        
        if let folderName = folderName {
            body["folderName"] = folderName
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] deleteFile: Invalid HTTP response")
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode != 200 {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [ChannelService] deleteFile: HTTP \(httpResponse.statusCode) - \(responseString)")
            
            // Try to parse error message from response
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["message"] as? String {
                throw ChannelServiceError.serverError(message)
            }
            
            throw ChannelServiceError.serverError("Server error: HTTP \(httpResponse.statusCode)")
        }
        
        return try JSONDecoder().decode(DeleteFileResponse.self, from: data)
    }
    
    func getUsernameVisibility(userEmail: String) async throws -> UsernameVisibilityResponse {
        guard let url = URL(string: "\(baseURL)/users/get-visibility") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] getUsernameVisibility: Invalid HTTP response")
            throw ChannelServiceError.invalidResponse
        }
        
        if httpResponse.statusCode != 200 {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [ChannelService] getUsernameVisibility: HTTP \(httpResponse.statusCode) - \(responseString)")
            throw ChannelServiceError.invalidResponse
        }
        
        // Log response for debugging
        if let responseString = String(data: data, encoding: .utf8) {
            print("🔍 [ChannelService] getUsernameVisibility response: \(responseString)")
        }
        
        return try JSONDecoder().decode(UsernameVisibilityResponse.self, from: data)
    }
    
    // MARK: - Private Username
    
    func setPrivateUsername(userEmail: String, privateUsername: String?) async throws -> PrivateUsernameResponse {
        guard let url = URL(string: "\(baseURL)/users/set-private-username") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        if let username = privateUsername {
            body["privateUsername"] = username
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(PrivateUsernameResponse.self, from: data)
    }
    
    func getPrivateUsername(userEmail: String) async throws -> PrivateUsernameResponse {
        guard let url = URL(string: "\(baseURL)/users/get-private-username") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(PrivateUsernameResponse.self, from: data)
    }
    
    // MARK: - Stream Username Type
    
    func setStreamUsernameType(streamKey: String, isPrivateUsername: Bool, streamUsername: String) async throws -> StreamUsernameTypeResponse {
        // CRITICAL PRIVACY FIX: Call EC2 immediate endpoint FIRST (BLOCKING) before Netlify API
        // This ensures the global map is set BEFORE the stream starts - NO RACE CONDITION
        // This MUST complete before the stream starts, so we await it
        let ec2ServerURL = "http://100.24.103.57:3000"
        let immediateURL = "\(ec2ServerURL)/api/streams/set-privacy-immediate"
        
        // CRITICAL: This MUST be blocking (await) so it completes BEFORE stream starts
        do {
            if let ec2URL = URL(string: immediateURL) {
                var request = URLRequest(url: ec2URL)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let ec2Body: [String: Any] = [
                    "streamKey": streamKey,
                    "isPrivateUsername": isPrivateUsername
                ]
                request.httpBody = try JSONSerialization.data(withJSONObject: ec2Body)
                request.timeoutInterval = 5.0
                
                print("🔍 [ChannelService] Calling EC2 immediate endpoint (BLOCKING) for streamKey: \(streamKey), isPrivate: \(isPrivateUsername)")
                let (_, response) = try await URLSession.shared.data(for: request)
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    print("✅ [ChannelService] CRITICAL: Successfully stored in EC2 global map (BLOCKING - COMPLETED BEFORE STREAM STARTS)")
                } else {
                    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
                    print("⚠️ [ChannelService] EC2 immediate endpoint returned status: \(statusCode)")
                }
            }
        } catch {
            // Log error but continue - Netlify API will also try to call it
            print("⚠️ [ChannelService] Could not call EC2 immediate endpoint (BLOCKING): \(error.localizedDescription)")
        }
        guard let url = URL(string: "\(baseURL)/streams/set-stream-username-type") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "streamKey": streamKey,
            "isPrivateUsername": isPrivateUsername,
            "streamUsername": streamUsername
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [ChannelService] setStreamUsernameType: Invalid response type")
            throw ChannelServiceError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            let responseBody = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            print("❌ [ChannelService] setStreamUsernameType: HTTP \(httpResponse.statusCode)")
            print("   Response body: \(responseBody)")
            throw ChannelServiceError.serverError("HTTP \(httpResponse.statusCode): \(responseBody)")
        }
        
        return try JSONDecoder().decode(StreamUsernameTypeResponse.self, from: data)
    }
    
    // MARK: - Follow Requests
    
    func requestFollow(requesterEmail: String, requestedUsername: String) async throws -> FollowRequestResponse {
        guard let url = URL(string: "\(baseURL)/users/request-follow") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "requesterEmail": requesterEmail,
            "requestedUsername": requestedUsername
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(FollowRequestResponse.self, from: data)
    }
    
    func acceptFollowRequest(userEmail: String, requesterEmail: String) async throws -> FollowRequestResponse {
        guard let url = URL(string: "\(baseURL)/users/accept-follow") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "requesterEmail": requesterEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(FollowRequestResponse.self, from: data)
    }
    
    func removeFollow(requesterEmail: String, requestedUsername: String) async throws -> FollowRequestResponse {
        // First, get the requested user's email from username
        let searchResults = try await searchUsernames(query: requestedUsername, limit: 1)
        guard let requestedUser = searchResults.first,
              let requestedUserEmail = requestedUser.email else {
            throw ChannelServiceError.invalidResponse
        }
        
        guard let url = URL(string: "\(baseURL)/users/remove-follow") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "requesterEmail": requesterEmail,
            "requestedUserEmail": requestedUserEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(FollowRequestResponse.self, from: data)
    }
    
    func declineFollowRequest(userEmail: String, requesterEmail: String) async throws -> FollowRequestResponse {
        guard let url = URL(string: "\(baseURL)/users/decline-follow") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "requesterEmail": requesterEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(FollowRequestResponse.self, from: data)
    }
    
    func getFollowRequests(userEmail: String, status: String = "pending") async throws -> FollowRequestsResponse {
        guard let url = URL(string: "\(baseURL)/users/follow-requests") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "status": status
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(FollowRequestsResponse.self, from: data)
    }
    
    // MARK: - Added Usernames
    
    func getAddedUsernames(userEmail: String) async throws -> AddedUsernamesResponse {
        guard let url = URL(string: "\(baseURL)/users/added-usernames") else {
            throw ChannelServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "userEmail": userEmail
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChannelServiceError.invalidResponse
        }
        
        return try JSONDecoder().decode(AddedUsernamesResponse.self, from: data)
    }
    
    // MARK: - Updated getContent to include viewerEmail for filtering
    
}

// Error type for ChannelService
enum ChannelServiceError: Error {
    case invalidURL
    case invalidResponse
    case serverError(String)
}

struct MarkVisibleResponse: Codable {
    let success: Bool
    let message: String?
    let filesUpdated: Int?
    let channelName: String?
}

struct UploadVideoResponse: Codable {
    let success: Bool
    let message: String?
    let fileUrl: String?
}

struct UpdateDetailsResponse: Codable {
    let success: Bool
    let message: String?
    let data: [String: AnyCodable]?
}

// Channel Management Response Types
struct CreateChannelResponse: Codable {
    let success: Bool
    let message: String?
    let channel: ChannelInfo?
}

struct ChannelInfo: Codable {
    let channelId: String
    let channelName: String
    let visibility: String
    let subscriptionPrice: Double
    let streamKey: String
    let createdAt: String
}

struct UpdateVisibilityResponse: Codable {
    let success: Bool
    let message: String?
    let visibility: String?
    let isPublic: Bool?
    let channelId: String?
    let channelName: String?
}

struct UpdateSubscriptionPriceResponse: Codable {
    let success: Bool
    let message: String?
    let price: Double?
    let channelId: String?
    let channelName: String?
}

struct ScheduleAirdateResponse: Codable {
    let success: Bool
    let message: String?
    let data: ScheduleAirdateData?
}

struct ScheduleAirdateData: Codable {
    let episodeId: String?
    let airdate: String?
    let immediate: Bool?
    let requestId: String?
}

// MARK: - Username Visibility Response Types

struct DeleteFileResponse: Codable {
    let success: Bool
    let message: String?
}

struct UsernameVisibilityResponse: Codable {
    let success: Bool
    let message: String?
    let usernameVisibility: String?
    let isPublic: Bool?
}

struct PrivateUsernameResponse: Codable {
    let success: Bool
    let message: String?
    let privateUsername: String?
    let hasPrivateUsername: Bool?
}

struct StreamUsernameTypeResponse: Codable {
    let success: Bool
    let message: String?
    let isPrivateUsername: Bool?
}

// MARK: - Follow Request Response Types

struct FollowRequestResponse: Codable {
    let success: Bool
    let message: String?
    let status: String?
    let autoAccepted: Bool?
}

struct FollowRequestsResponse: Codable {
    let success: Bool
    let requests: [FollowRequest]?
    let count: Int?
}

struct FollowRequest: Codable, Identifiable {
    let requesterEmail: String
    let requesterUsername: String
    let requestedAt: String?
    let respondedAt: String?
    let status: String
    
    var id: String { requesterEmail }
}

// MARK: - Added Usernames Response Types

struct AddedUsernamesResponse: Codable {
    let success: Bool
    let addedUsernames: [AddedUsername]?
    let count: Int?
}

struct AddedUsername: Codable, Identifiable {
    let streamerEmail: String
    let streamerUsername: String
    let addedAt: String?
    let streamerVisibility: String?
    
    var id: String { streamerEmail }
}

// Helper to handle AnyCodable for JSON decoding
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Cannot encode AnyCodable"))
        }
    }
}

