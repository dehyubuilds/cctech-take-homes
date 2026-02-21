//
//  UsernameSetupView.swift
//  TwillyBroadcaster
//
//  Username selection screen - Instagram/Snapchat style with real-time availability checking
//

import SwiftUI

struct UsernameSetupView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var username = ""
    @State private var isCheckingAvailability = false
    @State private var isAvailable: Bool? = nil
    @State private var errorMessage: String?
    @State private var isUpdating = false
    @State private var canSkip = false // Username is REQUIRED - cannot skip
    
    private let usernameCheckDelay: TimeInterval = 0.5 // Debounce delay
    
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
                
                // Icon
                Image(systemName: "at")
                    .font(.system(size: 64))
                    .foregroundColor(.twillyTeal)
                    .padding(.bottom, 16)
                
                // Title
                VStack(spacing: 12) {
                    Text("Choose Your Username")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Your unique identifier on Twilly")
                        .font(.system(size: 16))
                        .foregroundColor(.gray)
                }
                
                // Username Input
                VStack(spacing: 16) {
                    HStack(spacing: 12) {
                        // Username field with availability indicator
                        HStack(spacing: 12) {
                            Text("@")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(.gray)
                            
                            TextField("username", text: $username)
                                .textContentType(.username)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .foregroundColor(.white)
                                .font(.system(size: 18, weight: .medium))
                                .onChange(of: username) { newValue in
                                    // Remove @ if user types it
                                    let cleaned = newValue.replacingOccurrences(of: "@", with: "")
                                    if cleaned != newValue {
                                        username = cleaned
                                    }
                                    
                                    // Validate and check availability
                                    validateAndCheckUsername(cleaned)
                                }
                            
                            // Availability indicator
                            if !username.isEmpty {
                                if isCheckingAvailability {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .yellow))
                                        .scaleEffect(0.8)
                                } else if let available = isAvailable {
                                    Image(systemName: available ? "checkmark.circle.fill" : "xmark.circle.fill")
                                        .foregroundColor(available ? .green : .red)
                                        .font(.system(size: 20))
                                }
                            }
                        }
                        .padding(16)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(
                                    borderColor,
                                    lineWidth: 2
                                )
                        )
                    }
                    .padding(.horizontal, 32)
                    
                    // Status messages
                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 14))
                            .foregroundColor(.red)
                            .padding(.horizontal, 32)
                    } else if let available = isAvailable, !username.isEmpty {
                        if available {
                            Text("✓ This username is available!")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.green)
                                .padding(.horizontal, 32)
                        } else {
                            Text("✗ This username is already taken")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.red)
                                .padding(.horizontal, 32)
                        }
                    } else if !username.isEmpty && !isValidFormat {
                        Text("Username can only contain letters, numbers, spaces, hyphens, and underscores")
                            .font(.system(size: 12))
                            .foregroundColor(.orange)
                            .padding(.horizontal, 32)
                            .multilineTextAlignment(.center)
                    }
                    
                    // Continue Button
                    Button(action: {
                        handleContinue()
                    }) {
                        HStack {
                            if isUpdating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .black))
                            } else {
                                Text("Continue")
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
                    .disabled(isUpdating || !canContinue)
                    .opacity(canContinue ? 1.0 : 0.6)
                    .padding(.horizontal, 32)
                    .padding(.top, 8)
                    
                    // Skip button (optional)
                    if canSkip {
                        Button(action: {
                            dismiss()
                        }) {
                            Text("Skip for now")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 8)
                    }
                }
                
                Spacer()
            }
        }
    }
    
    private var isValidFormat: Bool {
        if username.isEmpty { return true }
        if username.count < 3 { return false }
        // Only letters, numbers, spaces, hyphens, underscores
        let pattern = "^[a-zA-Z0-9_\\s-]+$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(location: 0, length: username.utf16.count)
        return regex?.firstMatch(in: username, options: [], range: range) != nil
    }
    
    private var canContinue: Bool {
        !username.isEmpty &&
        username.count >= 3 &&
        isValidFormat &&
        isAvailable == true &&
        !isCheckingAvailability
    }
    
    private var borderColor: Color {
        if isCheckingAvailability {
            return .yellow
        } else if let available = isAvailable {
            return available ? .green : .red
        } else if !username.isEmpty && !isValidFormat {
            return .orange
        } else {
            return Color.white.opacity(0.2)
        }
    }
    
    private func validateAndCheckUsername(_ username: String) {
        // Reset state
        isAvailable = nil
        errorMessage = nil
        
        // Basic validation
        if username.isEmpty {
            return
        }
        
        if username.count < 3 {
            errorMessage = "Username must be at least 3 characters"
            return
        }
        
        if !isValidFormat {
            errorMessage = "Username can only contain letters, numbers, spaces, hyphens, and underscores"
            return
        }
        
        // Debounce the API call
        Task {
            try? await Task.sleep(nanoseconds: UInt64(usernameCheckDelay * 1_000_000_000))
            
            // Check if username hasn't changed
            guard username == self.username else { return }
            
            await MainActor.run {
                isCheckingAvailability = true
            }
            
            do {
                let available = try await authService.checkUsernameAvailability(username: username)
                await MainActor.run {
                    isCheckingAvailability = false
                    isAvailable = available
                    if !available {
                        errorMessage = "This username is already taken"
                    } else {
                        errorMessage = nil // Clear any previous errors
                    }
                }
            } catch {
                await MainActor.run {
                    isCheckingAvailability = false
                    isAvailable = nil
                    
                    // Provide user-friendly error messages
                    if let urlError = error as? URLError {
                        // Network errors
                        switch urlError.code {
                        case .notConnectedToInternet:
                            self.errorMessage = "No internet connection. Please check your network."
                        case .timedOut:
                            self.errorMessage = "Request timed out. Please try again."
                        case .cannotFindHost, .cannotConnectToHost:
                            self.errorMessage = "Cannot connect to server. Please try again later."
                        default:
                            self.errorMessage = "Network error. Please check your connection and try again."
                        }
                    } else if let nsError = error as NSError? {
                        if let errorMessage = nsError.userInfo[NSLocalizedDescriptionKey] as? String {
                            self.errorMessage = errorMessage
                        } else {
                            self.errorMessage = "Error checking availability: \(error.localizedDescription)"
                        }
                    } else {
                        // Other errors
                        self.errorMessage = "Error checking availability: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
    
    private func handleContinue() {
        guard canContinue else { return }
        
        // Double-check availability before submitting
        guard isAvailable == true else {
            errorMessage = "Please wait for availability check to complete"
            return
        }
        
        isUpdating = true
        errorMessage = nil
        
        Task {
            do {
                try await authService.updateUsername(username)
                await MainActor.run {
                    isUpdating = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isUpdating = false
                    
                    // Provide user-friendly error messages
                    if let urlError = error as? URLError {
                        // Network errors
                        switch urlError.code {
                        case .notConnectedToInternet:
                            self.errorMessage = "No internet connection. Please check your network."
                        case .timedOut:
                            self.errorMessage = "Request timed out. Please try again."
                        case .cannotFindHost, .cannotConnectToHost:
                            self.errorMessage = "Cannot connect to server. Please try again later."
                        default:
                            self.errorMessage = "Network error. Please check your connection and try again."
                        }
                    } else if let nsError = error as NSError? {
                        if let errorMessage = nsError.userInfo[NSLocalizedDescriptionKey] as? String {
                            self.errorMessage = errorMessage
                        } else {
                            self.errorMessage = error.localizedDescription
                        }
                    } else {
                        // Other errors (including validation errors from server)
                        self.errorMessage = error.localizedDescription
                    }
                }
            }
        }
    }
}

#Preview {
    UsernameSetupView()
}

