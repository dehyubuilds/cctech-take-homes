//
//  UsernameSearchView.swift
//  TwillyBroadcaster
//
//  View for searching and adding usernames to Twilly TV timeline
//

import SwiftUI

struct UsernameSearchView: View {
    @ObservedObject var channelService = ChannelService.shared
    @ObservedObject private var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    let channelName: String
    let onUsernameAdded: () -> Void
    
    @State private var searchText = ""
    @State private var searchResults: [UsernameSearchResult] = []
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var addedUsernames: [AddedUsername] = []
    @State private var isLoadingAdded = false
    
    // Computed property: Only public usernames (no private, no locks)
    private var publicAddedUsernames: [AddedUsername] {
        addedUsernames.filter { added in
            let visibility = added.streamerVisibility?.lowercased() ?? "public"
            return visibility == "public" && !added.streamerUsername.contains("🔒")
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.black, Color(red: 0.1, green: 0.1, blue: 0.15)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Search bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        
                        TextField("Search username...", text: $searchText)
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .onSubmit {
                                searchUsernames()
                            }
                        
                        if !searchText.isEmpty {
                            Button(action: {
                                searchText = ""
                                searchResults = []
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(12)
                    .padding(.horizontal)
                    .padding(.top)
                    
                    // Search results
                    if isSearching {
                        Spacer()
                        ProgressView()
                            .tint(.white)
                        Spacer()
                    } else if !searchResults.isEmpty {
                        List {
                            ForEach(searchResults) { result in
                                let cleanResultUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                                let currentUsername = authService.username?.lowercased() ?? ""
                                let isCurrentUser = !currentUsername.isEmpty && cleanResultUsername == currentUsername
                                
                                UsernameResultRow(
                                    username: result.username,
                                    isAdded: isUsernameAdded(result.username),
                                    isDisabled: isCurrentUser,
                                    onAdd: {
                                        addUsername(result.username)
                                    },
                                    onRemove: {
                                        removeUsername(result.username)
                                    }
                                )
                            }
                        }
                        .listStyle(PlainListStyle())
                        .background(Color.clear)
                    } else if !searchText.isEmpty && !isSearching {
                        Spacer()
                        Text("No users found")
                            .foregroundColor(.gray)
                        Spacer()
                    }
                    
                    // Added usernames section - ONLY show public usernames (no private, no locks)
                    if !publicAddedUsernames.isEmpty {
                        Divider()
                            .background(Color.white.opacity(0.1))
                            .padding(.vertical)
                        
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Added Usernames")
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal)
                            
                            ForEach(publicAddedUsernames) { added in
                                HStack {
                                    Image(systemName: "person.circle.fill")
                                        .foregroundColor(.twillyTeal)
                                    Text(added.streamerUsername)
                                        .foregroundColor(.white)
                                    Spacer()
                                    Button(action: {
                                        removeUsername(added.streamerUsername)
                                    }) {
                                        Text("Remove")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.red)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(Color.red.opacity(0.2))
                                            .cornerRadius(8)
                                    }
                                }
                                .padding(.horizontal)
                                .padding(.vertical, 8)
                                .background(Color.white.opacity(0.05))
                            }
                        }
                    }
                    
                    if let error = errorMessage {
                        Text(error)
                            .foregroundColor(.red)
                            .padding()
                    }
                }
            }
            .navigationTitle("Add Usernames")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
        }
        .onAppear {
            loadAddedUsernames()
        }
    }
    
    private func searchUsernames() {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else {
            searchResults = []
            return
        }
        
        isSearching = true
        errorMessage = nil
        
        Task {
            do {
                // CRITICAL: Only search for public usernames (no private accounts, no locks)
                let results = try await channelService.searchUsernames(query: searchText, limit: 50, visibilityFilter: "public")
                await MainActor.run {
                    // Filter out any private usernames or usernames with locks (double-check)
                    searchResults = results.filter { result in
                        !(result.isPrivate ?? false) && !result.username.contains("🔒")
                    }
                    isSearching = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error searching: \(error.localizedDescription)"
                    isSearching = false
                }
            }
        }
    }
    
    private func addUsername(_ username: String) {
        guard let userEmail = authService.userEmail else {
            errorMessage = "Not authenticated"
            return
        }
        
        Task {
            do {
                let response = try await channelService.requestFollow(
                    requesterEmail: userEmail,
                    requestedUsername: username
                )
                
                await MainActor.run {
                    if response.success {
                        if response.autoAccepted == true {
                            errorMessage = "\(username) added to timeline"
                        } else {
                            errorMessage = "Follow request sent to \(username)"
                        }
                        loadAddedUsernames()
                        onUsernameAdded()
                    } else {
                        errorMessage = response.message ?? "Failed to add username"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func loadAddedUsernames() {
        guard let userEmail = authService.userEmail else { return }
        
        isLoadingAdded = true
        Task {
            do {
                let response = try await channelService.getAddedUsernames(userEmail: userEmail)
                await MainActor.run {
                    // Filter to only public usernames (no private, no locks)
                    let allAdded = response.addedUsernames ?? []
                    addedUsernames = allAdded.filter { added in
                        let visibility = added.streamerVisibility?.lowercased() ?? "public"
                        return visibility == "public" && !added.streamerUsername.contains("🔒")
                    }
                    isLoadingAdded = false
                }
            } catch {
                await MainActor.run {
                    isLoadingAdded = false
                }
            }
        }
    }
    
    private func isUsernameAdded(_ username: String) -> Bool {
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        return addedUsernames.contains { added in
            let addedUsername = added.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
            let visibility = added.streamerVisibility?.lowercased() ?? "public"
            return addedUsername.lowercased() == cleanUsername.lowercased() && visibility == "public"
        }
    }
    
    private func removeUsername(_ username: String) {
        guard let userEmail = authService.userEmail else {
            errorMessage = "Not authenticated"
            return
        }
        
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        // Find the email for this username from addedUsernames
        var usernameEmail: String? = nil
        if let added = addedUsernames.first(where: { 
            $0.streamerUsername.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased() == cleanUsername.lowercased()
        }) {
            usernameEmail = added.streamerEmail
        }
        
        Task {
            do {
                let response = try await channelService.removeFollow(
                    requesterEmail: userEmail,
                    requestedUsername: cleanUsername,
                    requestedUserEmail: usernameEmail
                )
                
                await MainActor.run {
                    if response.success {
                        errorMessage = "\(cleanUsername) removed from timeline"
                        loadAddedUsernames()
                        onUsernameAdded()
                    } else {
                        errorMessage = response.message ?? "Failed to remove username"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
}

struct UsernameResultRow: View {
    let username: String
    let isAdded: Bool
    let isDisabled: Bool
    let onAdd: () -> Void
    let onRemove: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: "person.circle.fill")
                .foregroundColor(.twillyTeal)
                .font(.title2)
            
            Text(username)
                .foregroundColor(isDisabled ? .white.opacity(0.5) : .white)
                .font(.body)
            
            Spacer()
            
            if isAdded {
                Button(action: onRemove) {
                    Text("Remove")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.red.opacity(0.2))
                        .cornerRadius(8)
                }
                .disabled(isDisabled)
                .opacity(isDisabled ? 0.5 : 1.0)
            } else {
                Button(action: onAdd) {
                    Text("Add")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(isDisabled ? .white.opacity(0.5) : .white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            Group {
                                if isDisabled {
                                    Color.white.opacity(0.1)
                                } else {
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                }
                            }
                        )
                        .cornerRadius(8)
                }
                .disabled(isDisabled)
                .opacity(isDisabled ? 0.5 : 1.0)
            }
        }
        .padding(.vertical, 8)
        .background(Color.clear)
        .opacity(isDisabled ? 0.6 : 1.0)
    }
}
