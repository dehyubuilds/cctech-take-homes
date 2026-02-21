//
//  AddCollaboratorView.swift
//  TwillyBroadcaster
//
//  Admin view for adding collaborators to channels
//

import SwiftUI

struct AddCollaboratorView: View {
    let channelName: String
    let userEmail: String
    let onCollaboratorAdded: () -> Void
    
    @Environment(\.dismiss) var dismiss
    @ObservedObject var channelService = ChannelService.shared
    
    @State private var searchQuery = ""
    @State private var searchResults: [UsernameSearchResult] = []
    @State private var isSearching = false
    @State private var selectedUsername: UsernameSearchResult?
    @State private var isAdding = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var existingCollaborators: [CollaboratorInfo] = []
    @State private var isLoadingCollaborators = false
    @State private var isRemoving = false
    @State private var collaboratorToRemove: String?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with Cancel button
            HStack {
                Text("Collaborators: \(channelName)")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                
                Spacer()
                
                Button(action: {
                    dismiss()
                }) {
                    Text("Done")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.twillyTeal)
                }
            }
            .padding()
            .background(Color.black.opacity(0.3))
            
            ScrollView {
                VStack(spacing: 20) {
                        // Existing Collaborators Section
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Existing Collaborators")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(.white)
                                
                                Spacer()
                                
                                if isLoadingCollaborators {
                                    ProgressView()
                                        .tint(.twillyTeal)
                                        .scaleEffect(0.8)
                                } else {
                                    Text("(\(existingCollaborators.count))")
                                        .font(.system(size: 16, weight: .regular))
                                        .foregroundColor(.gray)
                                }
                            }
                            .padding(.horizontal, 20)
                            
                            if isLoadingCollaborators {
                                HStack {
                                    Spacer()
                                    Text("Loading...")
                                        .font(.system(size: 14))
                                        .foregroundColor(.gray)
                                    Spacer()
                                }
                                .padding(.vertical, 20)
                            } else if !existingCollaborators.isEmpty {
                                ForEach(existingCollaborators) { collaborator in
                                    HStack(spacing: 12) {
                                        // Avatar
                                        ZStack {
                                            Circle()
                                                .fill(
                                                    LinearGradient(
                                                        gradient: Gradient(colors: [
                                                            Color(red: 0.0, green: 0.8, blue: 0.7),
                                                            Color(red: 0.0, green: 0.7, blue: 0.9)
                                                        ]),
                                                        startPoint: .topLeading,
                                                        endPoint: .bottomTrailing
                                                    )
                                                )
                                                .frame(width: 40, height: 40)
                                            
                                            Text(String(collaborator.username.prefix(1)).uppercased())
                                                .font(.system(size: 16, weight: .bold))
                                                .foregroundColor(.white)
                                        }
                                        
                                        // User Info
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(collaborator.username)
                                                .font(.system(size: 14, weight: .semibold))
                                                .foregroundColor(.white)
                                            Text(collaborator.userEmail)
                                                .font(.system(size: 12))
                                                .foregroundColor(.gray)
                                        }
                                        
                                        Spacer()
                                        
                                        // Remove Button
                                        Button(action: {
                                            removeCollaborator(collaborator)
                                        }) {
                                            Image(systemName: "trash")
                                                .font(.system(size: 16))
                                                .foregroundColor(.red)
                                                .padding(8)
                                                .background(Color.red.opacity(0.1))
                                                .cornerRadius(8)
                                        }
                                        .disabled(isRemoving && collaboratorToRemove == collaborator.userId)
                                    }
                                    .padding()
                                    .background(Color.white.opacity(0.05))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                                    )
                                    .padding(.horizontal, 20)
                                }
                            } else {
                                VStack(spacing: 8) {
                                    Image(systemName: "person.2.slash")
                                        .font(.system(size: 40))
                                        .foregroundColor(.gray.opacity(0.5))
                                    Text("No Collaborators")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(.white.opacity(0.7))
                                    Text("Add collaborators to allow them to stream to this channel")
                                        .font(.system(size: 14))
                                        .foregroundColor(.gray)
                                        .multilineTextAlignment(.center)
                                }
                                .padding(.vertical, 30)
                                .padding(.horizontal, 20)
                            }
                        }
                        .padding(.vertical, 10)
                        
                        // Divider
                        Divider()
                            .background(Color.white.opacity(0.2))
                            .padding(.vertical, 10)
                        
                        // Add New Collaborator Section
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Add New Collaborator")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                            
                            // Search Bar
                            HStack {
                                Image(systemName: "magnifyingglass")
                                    .foregroundColor(.gray)
                                TextField("Search username...", text: $searchQuery)
                                    .foregroundColor(.white)
                                    .onChange(of: searchQuery) { newValue in
                                        if newValue.count >= 2 {
                                            searchUsernames()
                                        } else {
                                            searchResults = []
                                            selectedUsername = nil
                                        }
                                    }
                            }
                            .padding()
                            .background(Color.white.opacity(0.05))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
                            )
                            .padding(.horizontal, 20)
                    
                            // Search Results
                            if isSearching {
                                HStack {
                                    Spacer()
                                    ProgressView()
                                        .tint(.twillyTeal)
                                    Spacer()
                                }
                                .padding(.vertical, 40)
                            } else if searchQuery.count >= 2 && searchResults.isEmpty {
                                VStack(spacing: 12) {
                                    Image(systemName: "person.crop.circle.badge.questionmark")
                                        .font(.system(size: 40))
                                        .foregroundColor(.gray.opacity(0.5))
                                    Text("No users found")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(.white.opacity(0.7))
                                    Text("Try a different search term")
                                        .font(.system(size: 14))
                                        .foregroundColor(.gray)
                                }
                                .padding(.vertical, 30)
                            } else if !searchResults.isEmpty {
                                let availableResults = searchResults.filter { result in
                                    !existingCollaborators.contains(where: { $0.username.lowercased() == result.username.lowercased() })
                                }
                                
                                if availableResults.isEmpty {
                                    VStack(spacing: 12) {
                                        Image(systemName: "checkmark.circle")
                                            .font(.system(size: 40))
                                            .foregroundColor(.twillyTeal.opacity(0.5))
                                        Text("All search results are already collaborators")
                                            .font(.system(size: 14))
                                            .foregroundColor(.gray)
                                            .multilineTextAlignment(.center)
                                    }
                                    .padding(.vertical, 30)
                                    .padding(.horizontal, 20)
                                } else {
                                    LazyVStack(spacing: 12) {
                                        ForEach(availableResults) { result in
                                            UsernameRow(
                                                username: result.username,
                                                email: result.email,
                                                isSelected: selectedUsername?.id == result.id
                                            ) {
                                                selectedUsername = result
                                            }
                                        }
                                    }
                                    .padding(.horizontal, 20)
                                }
                            } else {
                                VStack(spacing: 12) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 40))
                                        .foregroundColor(.gray.opacity(0.5))
                                    Text("Search for a username")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(.white.opacity(0.7))
                                    Text("Type at least 2 characters to search")
                                        .font(.system(size: 14))
                                        .foregroundColor(.gray)
                                }
                                .padding(.vertical, 30)
                            }
                        }
                    
                        // Messages
                        if let error = errorMessage {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text(error)
                                    .font(.system(size: 14))
                                    .foregroundColor(.red)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.horizontal, 20)
                        }
                        
                        if let success = successMessage {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text(success)
                                    .font(.system(size: 14))
                                    .foregroundColor(.green)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.horizontal, 20)
                        }
                        
                        // Add Button
                        if let selected = selectedUsername {
                            Button(action: addCollaborator) {
                                HStack {
                                    if isAdding {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "plus.circle.fill")
                                        Text("Add \(selected.username)")
                                            .font(.system(size: 16, weight: .semibold))
                                    }
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color(red: 0.0, green: 0.8, blue: 0.7),
                                            Color(red: 0.0, green: 0.7, blue: 0.9)
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(12)
                            }
                            .disabled(isAdding)
                            .opacity(isAdding ? 0.6 : 1.0)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 20)
                        }
                }
                .padding(.top, 10)
            }
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 0.06, green: 0.09, blue: 0.16),
                        Color(red: 0.12, green: 0.16, blue: 0.23)
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .onAppear {
            loadCollaborators()
        }
    }
    
    private func loadCollaborators() {
        isLoadingCollaborators = true
        errorMessage = nil
        
        Task {
            do {
                print("🔍 [AddCollaboratorView] Loading collaborators for channel: \(channelName)")
                let collaborators = try await channelService.listCollaborators(
                    channelName: channelName,
                    userEmail: userEmail
                )
                print("✅ [AddCollaboratorView] Loaded \(collaborators.count) collaborators")
                for collab in collaborators {
                    print("   - \(collab.username) (\(collab.userEmail))")
                }
                
                await MainActor.run {
                    existingCollaborators = collaborators
                    isLoadingCollaborators = false
                }
            } catch {
                print("❌ [AddCollaboratorView] Error loading collaborators: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = "Error loading collaborators: \(error.localizedDescription)"
                    isLoadingCollaborators = false
                }
            }
        }
    }
    
    private func removeCollaborator(_ collaborator: CollaboratorInfo) {
        collaboratorToRemove = collaborator.userId
        isRemoving = true
        errorMessage = nil
        successMessage = nil
        
        Task {
            do {
                let success = try await channelService.removeCollaborator(
                    channelName: channelName,
                    collaboratorUsername: collaborator.username,
                    userEmail: userEmail
                )
                
                await MainActor.run {
                    if success {
                        successMessage = "Successfully removed \(collaborator.username)"
                        // Reload collaborators
                        loadCollaborators()
                    } else {
                        errorMessage = "Failed to remove collaborator"
                    }
                    isRemoving = false
                    collaboratorToRemove = nil
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                    isRemoving = false
                    collaboratorToRemove = nil
                }
            }
        }
    }
    
    private func searchUsernames() {
        guard searchQuery.count >= 2 else {
            searchResults = []
            return
        }
        
        print("🔍 [AddCollaboratorView] Searching for username: '\(searchQuery)'")
        isSearching = true
        errorMessage = nil
        
        Task {
            do {
                let results = try await channelService.searchUsernames(query: searchQuery)
                print("✅ [AddCollaboratorView] Search returned \(results.count) results")
                for result in results {
                    print("   - Found: \(result.username) (email: \(result.email ?? "nil"), userId: \(result.userId ?? "nil"))")
                }
                await MainActor.run {
                    searchResults = results
                    isSearching = false
                }
            } catch {
                print("❌ [AddCollaboratorView] Search error: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = "Error searching: \(error.localizedDescription)"
                    isSearching = false
                }
            }
        }
    }
    
    private func addCollaborator() {
        guard let selected = selectedUsername else { return }
        
        // Check if already a collaborator
        if existingCollaborators.contains(where: { $0.username.lowercased() == selected.username.lowercased() }) {
            errorMessage = "\(selected.username) is already a collaborator"
            return
        }
        
        isAdding = true
        errorMessage = nil
        successMessage = nil
        
        Task {
            do {
                print("🔍 [AddCollaboratorView] Adding collaborator: \(selected.username) to channel: \(channelName)")
                let success = try await channelService.addCollaborator(
                    channelName: channelName,
                    collaboratorUsername: selected.username,
                    userEmail: userEmail
                )
                
                await MainActor.run {
                    if success {
                        print("✅ [AddCollaboratorView] Successfully added \(selected.username)")
                        successMessage = "Successfully added \(selected.username)"
                        selectedUsername = nil
                        searchQuery = ""
                        searchResults = []
                        
                        // Reload collaborators list immediately
                        loadCollaborators()
                        
                        // Clear success message after a delay
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                            successMessage = nil
                        }
                        
                        // Call the callback
                        onCollaboratorAdded()
                    } else {
                        print("❌ [AddCollaboratorView] Failed to add collaborator (API returned success: false)")
                        errorMessage = "Failed to add collaborator"
                    }
                    isAdding = false
                }
            } catch {
                print("❌ [AddCollaboratorView] Error adding collaborator: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                    isAdding = false
                }
            }
        }
    }
}

struct UsernameRow: View {
    let username: String
    let email: String?
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Avatar
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 0.0, green: 0.8, blue: 0.7),
                                    Color(red: 0.0, green: 0.7, blue: 0.9)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 50, height: 50)
                    
                    Text(String(username.prefix(1)).uppercased())
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                }
                
                // User Info
                VStack(alignment: .leading, spacing: 4) {
                    Text(username)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                    if let email = email {
                        Text(email)
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.twillyTeal)
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.twillyTeal.opacity(0.2) : Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isSelected ? Color.twillyTeal : Color.white.opacity(0.1), lineWidth: isSelected ? 2 : 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}
