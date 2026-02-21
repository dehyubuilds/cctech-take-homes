//
//  PostRecordingActionsView.swift
//  TwillyBroadcaster
//
//  Action sheet shown after recording finishes - Post/View/Recapture options
//

import SwiftUI

struct PostRecordingActionsView: View {
    let onPost: () -> Void
    let onView: () -> Void
    let onRecapture: () -> Void
    
    var body: some View {
        ZStack {
            // Semi-transparent background
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    // Dismiss by recapturing (same as tapping Recapture)
                    onRecapture()
                }
            
            // Action buttons
            VStack(spacing: 20) {
                Spacer()
                
                // Post button
                Button(action: {
                    onPost()
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                        Text("Post to Channel")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.twillyTeal,
                                Color.twillyCyan
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(16)
                    .shadow(color: Color.twillyCyan.opacity(0.4), radius: 8, x: 0, y: 4)
                }
                
                // View button
                Button(action: {
                    onView()
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: "eye.fill")
                            .font(.title2)
                        Text("View Recording")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.3), lineWidth: 1)
                    )
                }
                
                // Recapture button
                Button(action: {
                    onRecapture()
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: "arrow.counterclockwise.circle.fill")
                            .font(.title2)
                        Text("Recapture")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
                }
                
                Spacer()
                    .frame(height: 40)
            }
            .padding(.horizontal, 32)
        }
        .gesture(
            DragGesture()
                .onEnded { value in
                    // Swipe down to dismiss
                    if value.translation.height > 100 || value.predictedEndTranslation.height > 200 {
                        onRecapture()
                    }
                    // Swipe left to dismiss
                    else if value.translation.width < -100 || value.predictedEndTranslation.width < -200 {
                        onRecapture()
                    }
                }
        )
    }
}

