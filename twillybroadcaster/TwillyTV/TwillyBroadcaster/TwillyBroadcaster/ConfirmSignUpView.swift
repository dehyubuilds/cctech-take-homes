//
//  ConfirmSignUpView.swift
//  TwillyBroadcaster
//
//  Email verification code screen
//

import SwiftUI

struct ConfirmSignUpView: View {
    @ObservedObject var authService = AuthService.shared
    let email: String
    let password: String
    
    @State private var confirmationCode = ""
    @State private var errorMessage: String?
    @State private var isConfirming = false
    @State private var showingUsernameSetup = false
    
    var body: some View {
        ZStack {
            // Background gradient - Twilly standard
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 32) {
                Spacer()
                
                // Icon
                Image(systemName: "envelope.fill")
                    .font(.system(size: 64))
                    .foregroundColor(.twillyTeal)
                    .padding(.bottom, 16)
                
                // Title
                VStack(spacing: 8) {
                    Text("Verify Your Email")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("We sent a verification code to")
                        .font(.system(size: 16))
                        .foregroundColor(.gray)
                    
                    Text(email)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.twillyTeal)
                }
                
                // Code Input
                VStack(spacing: 16) {
                    TextField("Enter 6-digit code", text: $confirmationCode)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 24, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(20)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                        .onChange(of: confirmationCode) { newValue in
                            // Limit to 6 digits
                            if newValue.count > 6 {
                                confirmationCode = String(newValue.prefix(6))
                            }
                        }
                    
                    // Error Message
                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 14))
                            .foregroundColor(.red)
                    }
                    
                    // Confirm Button
                    Button(action: {
                        handleConfirm()
                    }) {
                        HStack {
                            if isConfirming {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .black))
                            } else {
                                Text("Verify")
                                    .font(.system(size: 18, weight: .semibold))
                            }
                        }
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
                    .disabled(isConfirming || confirmationCode.count != 6)
                    .opacity(confirmationCode.count == 6 ? 1.0 : 0.6)
                }
                .padding(.horizontal, 32)
                
                Spacer()
            }
        }
        .onAppear {
            // Clear error messages when view appears
            errorMessage = nil
            authService.errorMessage = nil
        }
        .fullScreenCover(isPresented: $showingUsernameSetup) {
            UsernameSetupView()
        }
    }
    
    private func handleConfirm() {
        guard confirmationCode.count == 6 else {
            errorMessage = "Please enter a 6-digit code"
            return
        }
        
        isConfirming = true
        errorMessage = nil
        
        Task {
            do {
                try await authService.confirmSignUp(email: email, confirmationCode: confirmationCode)
                
                // After confirmation, sign in automatically
                try await authService.signIn(email: email, password: password)
                
                await MainActor.run {
                    isConfirming = false
                    showingUsernameSetup = true
                }
            } catch {
                await MainActor.run {
                    isConfirming = false
                    // Use the friendly error message from AuthService (already set)
                    errorMessage = authService.errorMessage ?? "Verification failed. Please check your code and try again."
                }
            }
        }
    }
}

#Preview {
    ConfirmSignUpView(email: "test@example.com", password: "password123")
}

