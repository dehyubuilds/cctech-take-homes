//
//  InviteCodeEntryView.swift
//  TwillyBroadcaster
//
//  View for entering invite code to unlock streaming access to Twilly TV
//

import SwiftUI

struct InviteCodeEntryView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    let channelName: String?
    @State private var inviteCode: String = ""
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    
    var onSuccess: () -> Void
    
    init(channelName: String? = nil, onSuccess: @escaping () -> Void) {
        self.channelName = channelName
        self.onSuccess = onSuccess
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.black,
                        Color(red: 0.1, green: 0.15, blue: 0.2)
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "ticket.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.twillyTeal)
                            .padding(.bottom, 8)
                        
                        Text("Unlock Streaming")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        if let channelName = channelName {
                            Text("Enter your invite code to stream to \(channelName)")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                        } else {
                            Text("Enter your invite code to unlock streaming access")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                        }
                    }
                    .padding(.top, 60)
                    
                    Spacer()
                    
                    // Invite Code Input
                    VStack(spacing: 16) {
                        TextField("Enter invite code", text: $inviteCode)
                            .textFieldStyle(.plain)
                            .font(.system(size: 18, weight: .medium, design: .monospaced))
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                            )
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .disabled(isSubmitting)
                        
                        if let error = errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                                .padding(.horizontal)
                        }
                        
                        if let success = successMessage {
                            Text(success)
                                .font(.caption)
                                .foregroundColor(.twillyTeal)
                                .padding(.horizontal)
                        }
                        
                        // Submit Button
                        Button(action: submitInviteCode) {
                            HStack {
                                if isSubmitting {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Activate Invite Code")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                Group {
                                    if isSubmitting || inviteCode.isEmpty {
                                        Color.gray.opacity(0.3)
                                    } else {
                                        LinearGradient(
                                            gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    }
                                }
                            )
                            .foregroundColor(.white)
                            .cornerRadius(25)
                            .shadow(color: Color.twillyTeal.opacity(0.3), radius: 8, x: 0, y: 4)
                        }
                        .disabled(isSubmitting || inviteCode.isEmpty)
                    }
                    .padding(.horizontal, 40)
                    
                    Spacer()
                    
                    // Info text
                    VStack(spacing: 8) {
                        Text("Don't have an invite code?")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                        Text("Contact the channel admin to get one")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding(.bottom, 40)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
        }
    }
    
    private func submitInviteCode() {
        guard !inviteCode.isEmpty,
              let userId = authService.userId,
              let userEmail = authService.userEmail else {
            errorMessage = "Please sign in to use an invite code"
            return
        }
        
        isSubmitting = true
        errorMessage = nil
        successMessage = nil
        
        Task {
            do {
                // Use the accept-invite API to validate and activate the invite code
                let response = try await ChannelService.shared.acceptInviteCode(
                    inviteCode: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines),
                    userId: userId,
                    userEmail: userEmail,
                    channelName: channelName
                )
                
                await MainActor.run {
                    if response.success {
                        let channel = channelName ?? (response.collaborator?.channelName ?? "the channel")
                        successMessage = response.message ?? "Invite code activated! You can now stream to \(channel)."
                        // Wait a moment then dismiss and call onSuccess
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            dismiss()
                            onSuccess()
                        }
                    } else {
                        errorMessage = response.message ?? "Invalid invite code"
                        isSubmitting = false
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to activate invite code: \(error.localizedDescription)"
                    isSubmitting = false
                }
            }
        }
    }
}
