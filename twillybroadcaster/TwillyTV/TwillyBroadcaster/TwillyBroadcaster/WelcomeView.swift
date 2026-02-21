//
//  WelcomeView.swift
//  TwillyBroadcaster
//
//  First launch screen - Instagram/Snapchat style
//

import SwiftUI

struct WelcomeView: View {
    @ObservedObject var authService = AuthService.shared
    @State private var showingSignUp = false
    @State private var showingSignIn = false
    
    var body: some View {
        ZStack {
            // Background gradient - Twilly standard
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 40) {
                Spacer()
                
                // Twilly Logo
                VStack(spacing: 16) {
                    Text("Twilly TV")
                        .font(.system(size: 56, weight: .black, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.twillyTeal, .twillyCyan, .twillyTeal],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .shadow(color: .twillyCyan.opacity(0.5), radius: 20)
                    
                    Text("A Premium streaming network")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.gray)
                        .tracking(1)
                }
                
                Spacer()
                
                // Action Buttons
                VStack(spacing: 16) {
                    // Get Started Button
                    Button(action: {
                        showingSignUp = true
                    }) {
                        Text("Get Started")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(
                                LinearGradient(
                                    colors: [.twillyTeal, .twillyCyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .cornerRadius(16)
                            .shadow(color: .twillyCyan.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                    
                    // Sign In Button
                    Button(action: {
                        showingSignIn = true
                    }) {
                        Text("Already have an account? Sign In")
                            .font(.system(size: 16, weight: .medium))
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
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 60)
            }
        }
        .fullScreenCover(isPresented: $showingSignUp) {
            SignUpView()
        }
        .fullScreenCover(isPresented: $showingSignIn) {
            SignInView()
        }
    }
}

#Preview {
    WelcomeView()
}

