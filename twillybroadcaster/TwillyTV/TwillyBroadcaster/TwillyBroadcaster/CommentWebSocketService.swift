//
//  CommentWebSocketService.swift
//  TwillyBroadcaster
//
//  WebSocket service for real-time comment notifications
//

import Foundation
import Combine

class CommentWebSocketService: ObservableObject {
    static let shared = CommentWebSocketService()
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var reconnectTimer: Timer?
    private var isConnected = false
    private var userEmail: String?
    
    // Published properties for notifications
    @Published var newCommentNotification: CommentNotification?
    
    struct CommentNotification: Codable {
        let type: String
        let videoId: String
        let commentId: String
        let isPrivate: Bool
        let parentCommentId: String?
        let timestamp: String
    }
    
    private init() {}
    
    // Connect to WebSocket
    func connect(userEmail: String, websocketEndpoint: String) {
        guard !isConnected else {
            print("⚠️ [CommentWebSocket] Already connected")
            return
        }
        
        self.userEmail = userEmail
        
        // Construct WebSocket URL with userEmail query parameter
        guard var urlComponents = URLComponents(string: websocketEndpoint) else {
            print("❌ [CommentWebSocket] Invalid WebSocket endpoint: \(websocketEndpoint)")
            return
        }
        
        urlComponents.queryItems = [
            URLQueryItem(name: "userEmail", value: userEmail)
        ]
        
        guard let url = urlComponents.url else {
            print("❌ [CommentWebSocket] Failed to construct WebSocket URL")
            return
        }
        
        print("🔌 [CommentWebSocket] Connecting to: \(url.absoluteString)")
        
        urlSession = URLSession(configuration: .default)
        webSocketTask = urlSession?.webSocketTask(with: url)
        webSocketTask?.resume()
        
        isConnected = true
        receiveMessage()
        
        print("✅ [CommentWebSocket] Connected")
    }
    
    // Disconnect from WebSocket
    func disconnect() {
        print("🔌 [CommentWebSocket] Disconnecting...")
        
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession = nil
        
        isConnected = false
        print("✅ [CommentWebSocket] Disconnected")
    }
    
    // Receive messages from WebSocket
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                
                // Continue receiving messages
                if self.isConnected {
                    self.receiveMessage()
                }
                
            case .failure(let error):
                print("❌ [CommentWebSocket] Receive error: \(error.localizedDescription)")
                
                // Attempt to reconnect after a delay
                if self.isConnected {
                    self.scheduleReconnect()
                }
            }
        }
    }
    
    // Handle incoming message
    private func handleMessage(_ text: String) {
        print("📨 [CommentWebSocket] Received message: \(text)")
        
        guard let data = text.data(using: .utf8) else {
            print("❌ [CommentWebSocket] Failed to convert message to data")
            return
        }
        
        do {
            let notification = try JSONDecoder().decode(CommentNotification.self, from: data)
            
            if notification.type == "new_comment" {
                print("✅ [CommentWebSocket] New comment notification: videoId=\(notification.videoId), commentId=\(notification.commentId)")
                
                // Publish notification on main thread
                DispatchQueue.main.async {
                    self.newCommentNotification = notification
                }
            }
        } catch {
            print("❌ [CommentWebSocket] Failed to decode message: \(error.localizedDescription)")
        }
    }
    
    // Schedule reconnection
    private func scheduleReconnect() {
        guard let userEmail = userEmail else { return }
        
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
            guard let self = self, self.isConnected else { return }
            
            print("🔄 [CommentWebSocket] Attempting to reconnect...")
            self.disconnect()
            
            // Reconnect after a short delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                // Get WebSocket endpoint from ChannelService
                let websocketEndpoint = ChannelService.shared.websocketEndpoint
                self.connect(userEmail: userEmail, websocketEndpoint: websocketEndpoint)
            }
        }
    }
}
