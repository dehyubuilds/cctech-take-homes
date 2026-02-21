import Foundation
import AVFoundation

/// Service for prefetching video content to enable instant playback
class VideoPrefetchService {
    static let shared = VideoPrefetchService()
    
    // Cache for prefetched HLS master playlists
    private var prefetchedPlaylists: [String: Data] = [:]
    
    // Cache for prefetched video segments (first few segments of each video)
    private var prefetchedSegments: [String: [Data]] = [:]
    
    // Active prefetch tasks (to allow cancellation)
    private var activeTasks: [String: URLSessionDataTask] = [:]
    
    // Maximum number of items to prefetch
    private let maxPrefetchItems = 5
    
    // Maximum number of segments to prefetch per video
    private let maxSegmentsPerVideo = 3
    
    private let urlSession: URLSession
    
    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30.0
        config.timeoutIntervalForResource = 60.0
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.urlCache = URLCache(memoryCapacity: 50 * 1024 * 1024, // 50MB memory
                                   diskCapacity: 200 * 1024 * 1024,   // 200MB disk
                                   diskPath: "video_prefetch_cache")
        self.urlSession = URLSession(configuration: config)
    }
    
    /// Prefetch HLS master playlists for the first N items
    func prefetchPlaylists(for items: [ChannelContent], maxItems: Int = 5) {
        let itemsToPrefetch = Array(items.prefix(maxItems))
        print("🔄 [VideoPrefetchService] Starting prefetch for \(itemsToPrefetch.count) items")
        
        for (index, item) in itemsToPrefetch.enumerated() {
            guard let hlsUrl = item.hlsUrl, !hlsUrl.isEmpty,
                  let url = URL(string: hlsUrl) else {
                continue
            }
            
            let cacheKey = hlsUrl
            
            // Skip if already prefetched
            if prefetchedPlaylists[cacheKey] != nil {
                print("   ⏭️ [VideoPrefetchService] Already prefetched: \(item.fileName)")
                continue
            }
            
            // Prefetch master playlist
            prefetchMasterPlaylist(url: url, cacheKey: cacheKey, item: item, priority: index == 0)
        }
    }
    
    /// Prefetch HLS master playlist
    private func prefetchMasterPlaylist(url: URL, cacheKey: String, item: ChannelContent, priority: Bool) {
        // Cancel existing task if any
        activeTasks[cacheKey]?.cancel()
        
        print("   📥 [VideoPrefetchService] Prefetching master playlist: \(item.fileName) (priority: \(priority))")
        
        let task = urlSession.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                // Don't log cancellation errors
                if (error as NSError).code != NSURLErrorCancelled {
                    print("   ❌ [VideoPrefetchService] Error prefetching playlist for \(item.fileName): \(error.localizedDescription)")
                }
                self.activeTasks.removeValue(forKey: cacheKey)
                return
            }
            
            guard let data = data, !data.isEmpty else {
                print("   ⚠️ [VideoPrefetchService] Empty playlist data for \(item.fileName)")
                self.activeTasks.removeValue(forKey: cacheKey)
                return
            }
            
            // Cache the playlist
            self.prefetchedPlaylists[cacheKey] = data
            print("   ✅ [VideoPrefetchService] Prefetched master playlist: \(item.fileName) (\(data.count) bytes)")
            
            // For priority item (first item), also prefetch video segments
            if priority {
                self.prefetchVideoSegments(playlistData: data, baseURL: url, item: item)
            }
            
            self.activeTasks.removeValue(forKey: cacheKey)
        }
        
        // Set priority for first item
        if priority {
            task.priority = URLSessionTask.highPriority
        }
        
        activeTasks[cacheKey] = task
        task.resume()
    }
    
    /// Prefetch first few video segments from HLS playlist
    private func prefetchVideoSegments(playlistData: Data, baseURL: URL, item: ChannelContent) {
        guard let playlistString = String(data: playlistData, encoding: .utf8) else {
            return
        }
        
        // Parse HLS playlist to find segment URLs
        let lines = playlistString.components(separatedBy: .newlines)
        var segmentUrls: [URL] = []
        
        for (index, line) in lines.enumerated() {
            // Look for .ts or .m3u8 segment files
            if line.hasSuffix(".ts") || line.hasSuffix(".m3u8") {
                // Handle relative URLs
                if let segmentURL = URL(string: line, relativeTo: baseURL) {
                    segmentUrls.append(segmentURL)
                } else if let absoluteURL = URL(string: line) {
                    segmentUrls.append(absoluteURL)
                }
            }
        }
        
        // Prefetch first N segments
        let segmentsToPrefetch = Array(segmentUrls.prefix(maxSegmentsPerVideo))
        print("   📥 [VideoPrefetchService] Prefetching \(segmentsToPrefetch.count) segments for \(item.fileName)")
        
        for (index, segmentURL) in segmentsToPrefetch.enumerated() {
            let segmentKey = "\(item.hlsUrl ?? "")_segment_\(index)"
            
            // Skip if already prefetched
            if prefetchedSegments[segmentKey] != nil {
                continue
            }
            
            let task = urlSession.dataTask(with: segmentURL) { [weak self] data, response, error in
                guard let self = self else { return }
                
                if let error = error {
                    if (error as NSError).code != NSURLErrorCancelled {
                        print("   ❌ [VideoPrefetchService] Error prefetching segment \(index) for \(item.fileName): \(error.localizedDescription)")
                    }
                    return
                }
                
                guard let data = data, !data.isEmpty else {
                    return
                }
                
                // Cache the segment
                if self.prefetchedSegments[segmentKey] == nil {
                    self.prefetchedSegments[segmentKey] = []
                }
                self.prefetchedSegments[segmentKey]?.append(data)
                print("   ✅ [VideoPrefetchService] Prefetched segment \(index) for \(item.fileName) (\(data.count) bytes)")
            }
            
            task.priority = URLSessionTask.highPriority
            task.resume()
        }
    }
    
    /// Check if playlist is prefetched
    func isPlaylistPrefetched(hlsUrl: String) -> Bool {
        return prefetchedPlaylists[hlsUrl] != nil
    }
    
    /// Get prefetched playlist data (if available)
    func getPrefetchedPlaylist(hlsUrl: String) -> Data? {
        return prefetchedPlaylists[hlsUrl]
    }
    
    /// Cancel all active prefetch tasks
    func cancelAllPrefetches() {
        print("🛑 [VideoPrefetchService] Cancelling all prefetch tasks")
        for (key, task) in activeTasks {
            task.cancel()
        }
        activeTasks.removeAll()
    }
    
    /// Cancel prefetch for specific item
    func cancelPrefetch(for hlsUrl: String) {
        if let task = activeTasks[hlsUrl] {
            task.cancel()
            activeTasks.removeValue(forKey: hlsUrl)
            print("🛑 [VideoPrefetchService] Cancelled prefetch for: \(hlsUrl)")
        }
    }
    
    /// Clear all cached prefetched data
    func clearCache() {
        prefetchedPlaylists.removeAll()
        prefetchedSegments.removeAll()
        print("🧹 [VideoPrefetchService] Cleared all prefetch cache")
    }
    
    /// Get cache statistics
    func getCacheStats() -> (playlists: Int, segments: Int, activeTasks: Int) {
        return (prefetchedPlaylists.count, prefetchedSegments.count, activeTasks.count)
    }
}
