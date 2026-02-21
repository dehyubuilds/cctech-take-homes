//
//  ResetPasswordView.swift
//  TwillyBroadcaster
//
//  Reset password screen - enter code and new password
//

import SwiftUI

struct ResetPasswordView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    let email: String
    
    @State private var confirmationCode = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var errorMessage: String?
    @State private var isResetting = false
    @State private var showPassword = false
    @State private var showConfirmPassword = false
    @State private var passwordReset = false
    
    var body: some View {
        ZStack {
            // Background gradient - Twilly standard
            LinearGradient(
                gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            if passwordReset {
                // Success state
                VStack(spacing: 32) {
                    Spacer()
                    
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.twillyTeal)
                    
                    Text("Password Reset")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Your password has been successfully reset")
                        .font(.system(size: 16))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    
                    Button(action: {
                        dismiss()
                    }) {
                        Text("Sign In")
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
                    .padding(.horizontal, 32)
                    
                    Spacer()
                }
            } else {
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
                        
                        Text("Reset Password")
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
                                Text("Enter Reset Code")
                                    .font(.system(size: 32, weight: .bold))
                                    .foregroundColor(.white)
                                
                                Text("Enter the code sent to \(email) and your new password")
                                    .font(.system(size: 16))
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 32)
                            }
                            .padding(.top, 40)
                            
                            // Form
                            VStack(spacing: 20) {
                                // Code Field
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Reset Code")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.gray)
                                    
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
                                }
                                
                                // New Password Field
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("New Password")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.gray)
                                    
                                    HStack {
                                        if showPassword {
                                            TextField("", text: $newPassword)
                                                .textContentType(.newPassword)
                                                .foregroundColor(.white)
                                        } else {
                                            SecureField("", text: $newPassword)
                                                .textContentType(.newPassword)
                                                .foregroundColor(.white)
                                        }
                                        
                                        Button(action: {
                                            showPassword.toggle()
                                        }) {
                                            Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                                .foregroundColor(.gray)
                                                .padding(.trailing, 4)
                                        }
                                    }
                                    .padding(16)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                                    )
                                }
                                
                                // Confirm Password Field
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Confirm Password")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.gray)
                                    
                                    HStack {
                                        if showConfirmPassword {
                                            TextField("", text: $confirmPassword)
                                                .textContentType(.newPassword)
                                                .foregroundColor(.white)
                                        } else {
                                            SecureField("", text: $confirmPassword)
                                                .textContentType(.newPassword)
                                                .foregroundColor(.white)
                                        }
                                        
                                        Button(action: {
                                            showConfirmPassword.toggle()
                                        }) {
                                            Image(systemName: showConfirmPassword ? "eye.slash.fill" : "eye.fill")
                                                .foregroundColor(.gray)
                                                .padding(.trailing, 4)
                                        }
                                    }
                                    .padding(16)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                                    )
                                }
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
                            
                            // Reset Password Button
                            Button(action: {
                                handleResetPassword()
                            }) {
                                HStack {
                                    if isResetting {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                    } else {
                                        Text("Reset Password")
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
                            .disabled(isResetting || !isFormValid)
                            .opacity(isFormValid ? 1.0 : 0.6)
                            .padding(.horizontal, 32)
                            .padding(.top, 8)
                            
                            Spacer(minLength: 40)
                        }
                    }
                }
            }
        }
    }
    
    private var isFormValid: Bool {
        !confirmationCode.isEmpty &&
        confirmationCode.count == 6 &&
        !newPassword.isEmpty &&
        !confirmPassword.isEmpty &&
        newPassword == confirmPassword &&
        newPassword.count >= 8
    }
    
    private func handleResetPassword() {
        guard isFormValid else {
            if confirmationCode.count != 6 {
                errorMessage = "Please enter a 6-digit code"
            } else if newPassword != confirmPassword {
                errorMessage = "Passwords do not match"
            } else if newPassword.count < 8 {
                errorMessage = "Password must be at least 8 characters long"
            } else {
                errorMessage = "Please fill in all fields correctly"
            }
            return
        }
        
        isResetting = true
        errorMessage = nil
        
        Task {
            do {
                try await authService.confirmResetPassword(
                    email: email,
                    confirmationCode: confirmationCode,
                    newPassword: newPassword
                )
                await MainActor.run {
                    isResetting = false
                    passwordReset = true
                }
            } catch {
                await MainActor.run {
                    isResetting = false
                    errorMessage = authService.errorMessage ?? "Failed to reset password. Please try again."
                }
            }
        }
    }
}

#Preview {
    ResetPasswordView(email: "test@example.com")
}
