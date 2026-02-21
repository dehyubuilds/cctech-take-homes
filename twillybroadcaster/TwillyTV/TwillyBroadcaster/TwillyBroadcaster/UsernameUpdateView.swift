//
//  UsernameUpdateView.swift
//  TwillyBroadcaster
//
//  View for updating username (similar to UsernameSetupView but for existing users)
//

import SwiftUI

struct UsernameUpdateView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var username = ""
    @State private var isCheckingAvailability = false
    @State private var isAvailable: Bool? = nil
    @State private var errorMessage: String?
    @State private var isUpdating = false
    
    private let usernameCheckDelay: TimeInterval = 0.5 // Debounce delay
    
    var body: some View {
        NavigationView {
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
                        Text("Update Username")
                            .font(.system(size: 32, weight: .bold))
                            .foregroundColor(.white)
                        
                        if let currentUsername = authService.username {
                            Text("Current: @\(currentUsername)")
                                .font(.system(size: 16))
                                .foregroundColor(.gray)
                        }
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
                        
                        // Error message
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 14))
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        
                        // Availability message
                        if let available = isAvailable, !username.isEmpty {
                            Text(available ? "Username available" : "Username taken")
                                .font(.system(size: 14))
                                .foregroundColor(available ? .green : .red)
                        }
                    }
                    .padding(.horizontal, 32)
                    
                    Spacer()
                    
                    // Update Button
                    Button(action: handleUpdate) {
                        HStack {
                            if isUpdating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                                Text("Updating...")
                            } else {
                                Text("Update Username")
                            }
                        }
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(16)
                        .shadow(color: Color.twillyTeal.opacity(0.3), radius: 8, x: 0, y: 4)
                    }
                    .disabled(isUpdating || isCheckingAvailability || !(isAvailable == true) || username.isEmpty)
                    .opacity((isUpdating || isCheckingAvailability || !(isAvailable == true) || username.isEmpty) ? 0.6 : 1.0)
                    .padding(.horizontal, 32)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Update Username")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
            .onAppear {
                // Pre-fill current username
                if let currentUsername = authService.username {
                    username = currentUsername
                    // Don't check availability for current username
                    isAvailable = true
                }
            }
        }
    }
    
    private var borderColor: Color {
        if let available = isAvailable {
            return available ? .green : .red
        }
        return .gray.opacity(0.3)
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
            isAvailable = false
            return
        }
        
        if !username.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" || $0 == " " }) {
            errorMessage = "Username can only contain letters, numbers, spaces, hyphens, and underscores"
            isAvailable = false
            return
        }
        
        // Check availability (debounced)
        Task {
            try? await Task.sleep(nanoseconds: UInt64(usernameCheckDelay * 1_000_000_000))
            
            // Only check if username hasn't changed
            guard username == self.username else { return }
            
            await MainActor.run {
                isCheckingAvailability = true
            }
            
            do {
                guard let userId = authService.userId else {
                    await MainActor.run {
                        isCheckingAvailability = false
                        errorMessage = "User ID not available"
                        isAvailable = false
                    }
                    return
                }
                
                let available = try await ChannelService.shared.checkUsernameAvailability(username: username, userId: userId)
                
                await MainActor.run {
                    isCheckingAvailability = false
                    isAvailable = available
                    if !available {
                        errorMessage = "Username is already taken"
                    }
                }
            } catch {
                await MainActor.run {
                    isCheckingAvailability = false
                    isAvailable = false
                    
                    // Handle specific error types
                    if let urlError = error as? URLError {
                        switch urlError.code {
                        case .timedOut:
                            errorMessage = "Request timed out. Please check your connection."
                        case .notConnectedToInternet:
                            errorMessage = "No internet connection. Please check your network."
                        case .cannotFindHost, .cannotConnectToHost:
                            errorMessage = "Cannot connect to server. Please try again later."
                        default:
                            errorMessage = "Network error: \(urlError.localizedDescription)"
                        }
                    } else if let nsError = error as NSError? {
                        if nsError.domain == "ChannelService" {
                            errorMessage = nsError.localizedDescription
                        } else {
                            errorMessage = "Error checking username: \(error.localizedDescription)"
                        }
                    } else {
                        errorMessage = "Error checking username: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
    
    private func handleUpdate() {
        guard let userId = authService.userId,
              let email = authService.userEmail else {
            errorMessage = "User information not available"
            return
        }
        
        guard isAvailable == true else {
            errorMessage = "Please choose an available username"
            return
        }
        
        isUpdating = true
        errorMessage = nil
        
        Task {
            do {
                try await ChannelService.shared.updateUsername(userId: userId, username: username, email: email)
                
                // Update auth service
                await MainActor.run {
                    authService.username = username
                    isUpdating = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isUpdating = false
                    
                    if let urlError = error as? URLError {
                        switch urlError.code {
                        case .timedOut:
                            errorMessage = "Request timed out. Please check your connection."
                        case .notConnectedToInternet:
                            errorMessage = "No internet connection. Please check your network."
                        case .cannotFindHost, .cannotConnectToHost:
                            errorMessage = "Cannot connect to server. Please try again later."
                        default:
                            errorMessage = "Network error: \(urlError.localizedDescription)"
                        }
                    } else {
                        errorMessage = "Failed to update username: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
}
