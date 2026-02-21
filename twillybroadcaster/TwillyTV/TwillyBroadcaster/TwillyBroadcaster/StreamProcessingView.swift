//
//  StreamProcessingView.swift
//  TwillyBroadcaster
//
//  View that shows "Stream Processing..." and polls for stream file existence
//

import SwiftUI
import Foundation

struct StreamProcessingView: View {
    let streamKey: String
    let channelName: String?
    let channelId: String?
    let onStreamReady: (String?) -> Void // Pass fileId when ready
    let onTimeout: () -> Void
    
    @State private var isPolling: Bool = true
    @State private var pollCount: Int = 0
    @State private var errorMessage: String?
    @ObservedObject private var authService = AuthService.shared
    @ObservedObject private var channelService = ChannelService.shared
    
    private let maxPollAttempts = 30 // Poll for up to 30 attempts (30 seconds)
    private let pollInterval: TimeInterval = 1.0 // Poll every 1 second
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    // Processing indicator
                    VStack(spacing: 16) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                            .scaleEffect(1.5)
                        
                        Text("Stream Processing...")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        if let channelName = channelName {
                            Text("Processing your stream for \(channelName)")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        } else {
                            Text("Processing your stream")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        
                        Text("This may take a few moments")
                            .font(.caption)
                            .foregroundColor(.gray.opacity(0.7))
                    }
                    .padding(.top, 40)
                    
                    // Error message
                    if let errorMessage = errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.orange)
                            .font(.subheadline)
                            .padding(.horizontal, 24)
                    }
                    
                    Spacer()
                }
            }
            .navigationTitle("Processing Stream")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                startPolling()
            }
        }
    }
    
    private func startPolling() {
        guard let userEmail = authService.userEmail else {
            errorMessage = "Please sign in"
            return
        }
        
        Task {
            while isPolling && pollCount < maxPollAttempts {
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
                pollCount += 1
                
                do {
                    // Check if file exists for this streamKey
                    let (fileExists, fileId) = try await checkStreamFileExists(userEmail: userEmail, streamKey: streamKey)
                    
                    if fileExists {
                        await MainActor.run {
                            isPolling = false
                            onStreamReady(fileId) // Pass fileId to callback
                        }
                        return
                    }
                } catch {
                    print("⚠️ Error checking stream file: \(error.localizedDescription)")
                    // Continue polling on error
                }
            }
            
            // Timeout - stream not found after max attempts
            await MainActor.run {
                isPolling = false
                if pollCount >= maxPollAttempts {
                    errorMessage = "Stream processing is taking longer than expected. You can still add metadata."
                    // Show metadata form anyway after timeout (no fileId available)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        onStreamReady(nil)
                    }
                } else {
                    onTimeout()
                }
            }
        }
    }
    
    private func checkStreamFileExists(userEmail: String, streamKey: String) async throws -> (Bool, String?) {
        // Use dedicated endpoint to check if stream file exists
        let baseURL = "https://twilly.app/api"
        guard let url = URL(string: "\(baseURL)/files/check-stream-file") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        print("🔍 [StreamProcessingView] Checking for stream file:")
        print("   📝 userEmail: \(userEmail)")
        print("   📝 streamKey: \(streamKey)")
        
        let body: [String: Any] = [
            "userEmail": userEmail,
            "streamKey": streamKey
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("⚠️ [StreamProcessingView] Invalid HTTP response")
            return (false, nil)
        }
        
        print("🔍 [StreamProcessingView] HTTP Status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            print("⚠️ [StreamProcessingView] Non-200 status: \(httpResponse.statusCode)")
            if let responseString = String(data: data, encoding: .utf8) {
                print("   📝 Response: \(responseString)")
            }
            return (false, nil)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let exists = json["exists"] as? Bool ?? false
            let hasHlsUrl = json["hasHlsUrl"] as? Bool ?? false
            let hasThumbnail = json["hasThumbnail"] as? Bool ?? false
            let isVisible = json["isVisible"] as? Bool ?? false
            let fileId = json["fileId"] as? String
            
            print("🔍 [StreamProcessingView] Response: exists=\(exists), hasHlsUrl=\(hasHlsUrl), hasThumbnail=\(hasThumbnail), isVisible=\(isVisible), fileId=\(fileId ?? "nil")")
            
            // Video is ready when it exists, has HLS URL, has thumbnail, and is visible (with default details)
            if exists && hasHlsUrl && hasThumbnail && isVisible {
                print("✅ [StreamProcessingView] Stream file found, processing complete, thumbnail ready, and visible (ready for metadata)")
                if let fileName = json["fileName"] as? String {
                    print("   📝 File name: \(fileName)")
                }
                if let fileId = fileId {
                    print("   📝 File ID: \(fileId)")
                }
                return (true, fileId)
            } else if exists && hasHlsUrl && hasThumbnail {
                print("⏳ [StreamProcessingView] Stream file exists, has HLS URL and thumbnail but isVisible=\(isVisible) (still processing)")
            } else if exists && hasHlsUrl {
                print("⏳ [StreamProcessingView] Stream file exists and has HLS URL but hasThumbnail=\(hasThumbnail) (thumbnail still processing)")
            } else if exists {
                print("⏳ [StreamProcessingView] Stream file exists but HLS URL not ready yet (still processing)")
            } else {
                print("⏳ [StreamProcessingView] Stream file not found yet (still processing)")
            }
        }
        
        return (false, nil)
    }
}
