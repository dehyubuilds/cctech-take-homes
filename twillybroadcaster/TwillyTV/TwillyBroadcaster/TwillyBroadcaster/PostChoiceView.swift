//
//  PostChoiceView.swift
//  TwillyBroadcaster
//
//  Choice page: Add Details or Continue Posting
//

import SwiftUI

struct PostChoiceView: View {
    @Environment(\.dismiss) var dismiss
    let onAddDetails: () -> Void
    let onContinuePosting: () -> Void
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 24) {
                Spacer()
                
                // Header
                VStack(spacing: 12) {
                    Text("Post to Channel")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundStyle(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.twillyTeal,
                                    Color.twillyCyan,
                                    Color.twillyTeal
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .shadow(color: Color.twillyCyan.opacity(0.5), radius: 4, x: 0, y: 2)
                    
                    Text("Choose how you want to post")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }
                .padding(.bottom, 40)
                
                // Add Details button - Twilly aesthetic
                Button(action: {
                    onAddDetails()
                }) {
                    HStack(spacing: 16) {
                        Image(systemName: "text.alignleft")
                            .font(.system(size: 24))
                            .foregroundStyle(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal,
                                        Color.twillyCyan
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Add Details")
                                .font(.headline)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                            Text("Title, description, price")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.twillyCyan.opacity(0.7))
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.black.opacity(0.3))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal.opacity(0.6),
                                                Color.twillyCyan.opacity(0.4)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.2), radius: 8, x: 0, y: 4)
                }
                
                // Continue Posting button - Twilly aesthetic
                Button(action: {
                    onContinuePosting()
                }) {
                    HStack(spacing: 16) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal,
                                        Color.twillyCyan
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Continue Posting")
                                .font(.headline)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                            Text("Post without details")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.twillyCyan.opacity(0.7))
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.black.opacity(0.3))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color.twillyTeal.opacity(0.4),
                                                Color.twillyCyan.opacity(0.2)
                                            ]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        ),
                                        lineWidth: 1.5
                                    )
                            )
                    )
                    .shadow(color: Color.twillyCyan.opacity(0.15), radius: 6, x: 0, y: 3)
                }
                
                Spacer()
                
                // Cancel button
                Button(action: {
                    dismiss()
                }) {
                    Text("Cancel")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                        .padding(.vertical, 12)
                }
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 40)
        }
    }
}

