//
//  ForgotPasswordView.swift
//  TwillyBroadcaster
//
//  Forgot password screen - enter email to receive reset code
//

import SwiftUI

struct ForgotPasswordView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var email = ""
    @State private var errorMessage: String?
    @State private var isRequesting = false
    @State private var codeSent = false
    
    var body: some View {
        ZStack {
            // Background gradient - Twilly standard
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header
                HStack {
                    Button(action: {
                        dismiss()
                    }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(12)
                    }
                    
                    Spacer()
                    
                    Text("Forgot Password")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    Color.clear
                        .frame(width: 44, height: 44)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                ScrollView {
                    VStack(spacing: 32) {
                        // Title
                        VStack(spacing: 8) {
                            Text("Reset Password")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(.white)
                            
                            if codeSent {
                                Text("Check your email")
                                    .font(.system(size: 16))
                                    .foregroundColor(.gray)
                                
                                Text("We sent a password reset code to \(email)")
                                    .font(.system(size: 14))
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 32)
                            } else {
                                Text("Enter your email to receive a reset code")
                                    .font(.system(size: 16))
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.top, 40)
                        
                        if !codeSent {
                            // Email Field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Email")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.gray)
                                
                                TextField("", text: $email)
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                                    .foregroundColor(.white)
                                    .padding(16)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                                    )
                            }
                            .padding(.horizontal, 32)
                            
                            // Error Message
                            if let error = errorMessage ?? authService.errorMessage {
                                Text(error)
                                    .font(.system(size: 14))
                                    .foregroundColor(.red)
                                    .padding(.horizontal, 32)
                                    .multilineTextAlignment(.center)
                            }
                            
                            // Send Code Button
                            Button(action: {
                                handleRequestReset()
                            }) {
                                HStack {
                                    if isRequesting {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                    } else {
                                        Text("Send Reset Code")
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
                            .disabled(isRequesting || email.isEmpty || !email.contains("@"))
                            .opacity((email.isEmpty || !email.contains("@")) ? 0.6 : 1.0)
                            .padding(.horizontal, 32)
                            .padding(.top, 8)
                        } else {
                            // Show ResetPasswordView after code is sent
                            ResetPasswordView(email: email)
                        }
                        
                        Spacer(minLength: 40)
                    }
                }
            }
        }
        .onAppear {
            // Clear error messages when view appears
            errorMessage = nil
            authService.errorMessage = nil
        }
    }
    
    private func handleRequestReset() {
        guard !email.isEmpty && email.contains("@") else {
            errorMessage = "Please enter a valid email address"
            return
        }
        
        isRequesting = true
        errorMessage = nil
        
        Task {
            do {
                try await authService.forgotPassword(email: email)
                await MainActor.run {
                    isRequesting = false
                    codeSent = true
                }
            } catch {
                await MainActor.run {
                    isRequesting = false
                    errorMessage = authService.errorMessage ?? "Failed to send reset code. Please try again."
                }
            }
        }
    }
}

#Preview {
    ForgotPasswordView()
}
