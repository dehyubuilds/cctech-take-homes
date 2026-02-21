//
//  ProcessingMessageView.swift
//  TwillyBroadcaster
//
//  View shown when stream stops - indicates video is being processed
//

import SwiftUI

struct ProcessingMessageView: View {
    let channelName: String
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            // Processing icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [Color.orange, Color(red: 1.0, green: 0.6, blue: 0.0)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)
            }
            
            Text("Video Processing")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Your video for \(channelName) is being processed. You'll be notified when it's ready.")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            
            // View Inbox button
            Button(action: {
                onDismiss()
            }) {
                HStack {
                    Image(systemName: "tray")
                    Text("View Inbox")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(12)
            }
            .padding(.horizontal, 32)
            
            // Close button
            Button(action: onDismiss) {
                Text("Close")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}
