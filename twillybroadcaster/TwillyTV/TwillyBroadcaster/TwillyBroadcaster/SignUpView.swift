//
//  SignUpView.swift
//  TwillyBroadcaster
//
//  Sign up screen - Instagram/Snapchat style
//

import SwiftUI

struct SignUpView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var showingConfirmSignUp = false
    @State private var errorMessage: String?
    @State private var isSigningUp = false
    @State private var showPassword = false
    @State private var showConfirmPassword = false
    
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
                    
                    Text("Sign Up")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    // Balance the back button
                    Color.clear
                        .frame(width: 44, height: 44)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                ScrollView {
                    VStack(spacing: 32) {
                        // Title
                        VStack(spacing: 8) {
                            Text("Create Account")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(.white)
                            
                            Text("Sign up to start streaming")
                                .font(.system(size: 16))
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 40)
                        
                        // Form
                        VStack(spacing: 20) {
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
                            
                            // Password Field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Password")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.gray)
                                
                                HStack {
                                    if showPassword {
                                        TextField("", text: $password)
                                            .textContentType(.newPassword)
                                            .foregroundColor(.white)
                                    } else {
                                        SecureField("", text: $password)
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
                        
                        // Sign Up Button
                        Button(action: {
                            handleSignUp()
                        }) {
                            HStack {
                                if isSigningUp {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                } else {
                                    Text("Sign Up")
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
                        .disabled(isSigningUp || !isFormValid)
                        .opacity(isFormValid ? 1.0 : 0.6)
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                        
                        Spacer(minLength: 40)
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showingConfirmSignUp) {
            ConfirmSignUpView(email: email, password: password)
        }
    }
    
    private var isFormValid: Bool {
        !email.isEmpty &&
        !password.isEmpty &&
        !confirmPassword.isEmpty &&
        password == confirmPassword &&
        password.count >= 8 &&
        email.contains("@")
    }
    
    private func handleSignUp() {
        guard isFormValid else {
            errorMessage = "Please fill in all fields correctly"
            return
        }
        
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match"
            return
        }
        
        guard password.count >= 8 else {
            errorMessage = "Password must be at least 8 characters"
            return
        }
        
        isSigningUp = true
        errorMessage = nil
        
        Task {
            do {
                let result = try await authService.signUp(email: email, password: password)
                await MainActor.run {
                    isSigningUp = false
                    if result.isSignupComplete {
                        // User is already confirmed, proceed to username setup
                        showingConfirmSignUp = false
                    } else {
                        // Need to confirm email
                        showingConfirmSignUp = true
                    }
                }
            } catch {
                // Extract friendly error message directly from the thrown error
                // This ensures we get the correct message even if there's a timing issue
                let friendlyMessage = authService.getFriendlyErrorMessage(
                    from: error,
                    defaultMessage: "Sign up failed. Please try again."
                )
                
                // Log detailed error information for debugging
                print("❌ [SignUpView] Sign up error caught:")
                print("   - Error: \(error)")
                print("   - Error type: \(type(of: error))")
                if let authError = error as? AuthError {
                    print("   - AuthError errorDescription: \(authError.errorDescription ?? "nil")")
                    print("   - AuthError recoverySuggestion: \(authError.recoverySuggestion ?? "nil")")
                }
                if let nsError = error as NSError? {
                    print("   - NSError domain: \(nsError.domain), code: \(nsError.code)")
                    print("   - NSError description: \(nsError.localizedDescription)")
                    print("   - NSError userInfo: \(nsError.userInfo)")
                    if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                        print("   - Underlying error: \(underlyingError.localizedDescription)")
                        print("   - Underlying error domain: \(underlyingError.domain), code: \(underlyingError.code)")
                    }
                }
                print("   - Extracted friendly message: \(friendlyMessage)")
                
                // Small delay to ensure UI has time to update before showing error
                // This helps with any race conditions in SwiftUI updates
                try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
                
                await MainActor.run {
                    isSigningUp = false
                    // Use the friendly error message extracted directly from the error
                    errorMessage = friendlyMessage
                    
                    // Also set it in authService for consistency
                    authService.errorMessage = friendlyMessage
                    
                    print("✅ [SignUpView] Error message set in UI: \(friendlyMessage)")
                }
            }
        }
    }
}

#Preview {
    SignUpView()
}

