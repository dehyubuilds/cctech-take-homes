//
//  VisibilitySelectorView.swift
//  TwillyBroadcaster
//
//  Sleek selector for choosing Public/Private visibility on Twilly TV
//

import SwiftUI

struct VisibilitySelectorView: View {
    @Binding var isPresented: Bool
    @Binding var isPublic: Bool
    let onSelect: (Bool) -> Void
    
    @State private var selectedOption: Bool? = nil
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isPresented = false
                    }
                }
            
            // Selector card
            VStack(spacing: 0) {
                // Header
                HStack {
                    Image(systemName: "tv.fill")
                        .font(.title2)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.twillyTeal, .twillyCyan],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                    Text("Twilly TV")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    Spacer()
                    Button(action: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            isPresented = false
                        }
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 12)
                
                // Instruction text
                HStack {
                    Image(systemName: "info.circle.fill")
                        .font(.caption)
                        .foregroundColor(.twillyCyan.opacity(0.8))
                    Text("Must select one to continue")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
                
                // Options
                VStack(spacing: 16) {
                    // Public option
                    Button(action: {
                        selectedOption = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            onSelect(true)
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                isPresented = false
                            }
                        }
                    }) {
                        HStack(spacing: 16) {
                            // Icon
                            ZStack {
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: selectedOption == true ? [.twillyTeal, .twillyCyan] : [Color.white.opacity(0.1)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 50, height: 50)
                                
                                Image(systemName: "eye.fill")
                                    .font(.title3)
                                    .foregroundColor(selectedOption == true ? .white : .white.opacity(0.7))
                            }
                            
                            // Text content
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    if isPublic {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.caption)
                                            .foregroundColor(.twillyCyan)
                                    }
                                    Text("Public")
                                        .font(.headline)
                                        .fontWeight(.bold)
                                        .foregroundColor(.white)
                                }
                                
                                Text("Stream as your username. Viewers can add you to their channel to see all your public streams.")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            
                            Spacer()
                        }
                        .padding(20)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(selectedOption == true ? Color.twillyTeal.opacity(0.2) : Color.white.opacity(0.05))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(
                                            selectedOption == true ? Color.twillyCyan.opacity(0.6) : Color.white.opacity(0.1),
                                            lineWidth: selectedOption == true ? 2 : 1
                                        )
                                )
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // Private option
                    Button(action: {
                        selectedOption = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            onSelect(false)
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                isPresented = false
                            }
                        }
                    }) {
                        HStack(spacing: 16) {
                            // Icon
                            ZStack {
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: selectedOption == false ? [.orange.opacity(0.8), .orange] : [Color.white.opacity(0.1)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 50, height: 50)
                                
                                Image(systemName: "eye.slash.fill")
                                    .font(.title3)
                                    .foregroundColor(selectedOption == false ? .white : .white.opacity(0.7))
                            }
                            
                            // Text content
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    HStack(spacing: 4) {
                                        Image(systemName: "lock.fill")
                                            .font(.caption)
                                            .foregroundColor(.orange)
                                        Text("Private")
                                            .font(.headline)
                                            .fontWeight(.bold)
                                            .foregroundColor(.white)
                                    }
                                    
                                    if !isPublic {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.caption)
                                            .foregroundColor(.orange)
                                    }
                                }
                                
                                Text("Stream as your username 🔒. Viewers must request access and be accepted to see your private streams.")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            
                            Spacer()
                        }
                        .padding(20)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(selectedOption == false ? Color.orange.opacity(0.15) : Color.white.opacity(0.05))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(
                                            selectedOption == false ? Color.orange.opacity(0.6) : Color.white.opacity(0.1),
                                            lineWidth: selectedOption == false ? 2 : 1
                                        )
                                )
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.1, green: 0.1, blue: 0.15), Color.black],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
            )
            .padding(.horizontal, 20)
            .shadow(color: Color.black.opacity(0.5), radius: 20, x: 0, y: 10)
            .scaleEffect(isPresented ? 1.0 : 0.9)
            .opacity(isPresented ? 1.0 : 0.0)
        }
        .onAppear {
            selectedOption = nil // Reset selection when appearing
        }
    }
}
