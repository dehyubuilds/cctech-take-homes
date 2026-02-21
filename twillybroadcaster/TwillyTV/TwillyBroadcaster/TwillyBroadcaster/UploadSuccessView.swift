//
//  UploadSuccessView.swift
//  TwillyBroadcaster
//
//  Success screen shown after video upload completes
//

import SwiftUI

struct UploadSuccessView: View {
    let channelName: String
    let onViewChannel: () -> Void
    let onDone: () -> Void
    @Environment(\.dismiss) var dismiss
    @State private var isNavigating = false
    @State private var dragOffset: CGFloat = 0
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 30) {
                Spacer()
                
                // Success icon
                ZStack {
                    Circle()
                        .fill(Color.green.opacity(0.2))
                        .frame(width: 120, height: 120)
                    
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.green)
                }
                
                VStack(spacing: 12) {
                    Text("Upload Complete!")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    Text("Your video has been uploaded to")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                    
                    Text(channelName)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.twillyTeal)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.twillyTeal.opacity(0.2))
                        )
                }
                
                Spacer()
                
                // Action buttons
                VStack(spacing: 16) {
                    // View Channel button
                    Button(action: {
                        isNavigating = true
                        onViewChannel()
                    }) {
                        HStack {
                            if isNavigating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Image(systemName: "play.circle.fill")
                            }
                            Text(isNavigating ? "Opening..." : "View Channel")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.twillyTeal, Color(red: 0.1, green: 0.5, blue: 0.8)]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(16)
                    }
                    .disabled(isNavigating)
                    
                    // Done button
                    Button(action: onDone) {
                        Text("Done")
                            .font(.headline)
                            .foregroundColor(.white.opacity(0.8))
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(Color.white.opacity(0.1))
                            )
                    }
                }
                .padding(.horizontal, 30)
                .padding(.bottom, 40)
            }
            .offset(y: dragOffset)
        }
        .gesture(
            DragGesture()
                .onChanged { value in
                    // Only allow swipe down
                    if value.translation.height > 0 {
                        dragOffset = value.translation.height
                    }
                }
                .onEnded { value in
                    // If swiped down enough, dismiss
                    if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                        withAnimation {
                            onDone()
                        }
                    } else {
                        // Spring back
                        withAnimation(.spring()) {
                            dragOffset = 0
                        }
                    }
                }
        )
    }
}

