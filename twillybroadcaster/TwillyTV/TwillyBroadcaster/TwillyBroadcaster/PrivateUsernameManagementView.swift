import SwiftUI

struct PrivateUsernameManagementView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var authService = AuthService.shared
    @State private var searchQuery = ""
    @State private var searchResults: [UsernameSearchResult] = []
    @State private var isLoading = false
    @State private var addedPrivateUsernames: [AddedUsername] = []
    @State private var isSearching = false
    
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
                            .foregroundColor(.white.opacity(0.6))
                        
                        TextField("Search usernames...", text: $searchQuery)
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .onChange(of: searchQuery) { newValue in
                                if !newValue.isEmpty {
                                    searchUsernames(query: newValue)
                                } else {
                                    searchResults = []
                                }
                            }
                        
                        if !searchQuery.isEmpty {
                            Button(action: {
                                searchQuery = ""
                                searchResults = []
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(10)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    
                    if isLoading {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyCyan))
                        Spacer()
                    } else if !searchQuery.isEmpty && searchResults.isEmpty {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "person.crop.circle.badge.questionmark")
                                .font(.system(size: 50))
                                .foregroundColor(.white.opacity(0.3))
                            Text("No results found")
                                .foregroundColor(.white.opacity(0.7))
                        }
                        Spacer()
                    } else if searchQuery.isEmpty {
                        // Show added private usernames
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                if addedPrivateUsernames.isEmpty {
                                    VStack(spacing: 16) {
                                        Image(systemName: "person.circle")
                                            .font(.system(size: 60))
                                            .foregroundColor(.white.opacity(0.3))
                                        
                                        Text("No Private Viewers")
                                            .font(.title2)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.white)
                                        
                                        Text("Search for usernames to add them to your private content")
                                            .font(.body)
                                            .foregroundColor(.white.opacity(0.7))
                                            .multilineTextAlignment(.center)
                                            .padding(.horizontal, 32)
                                    }
                                    .padding(.top, 60)
                                } else {
                                    ForEach(addedPrivateUsernames) { username in
                                        PrivateUsernameRow(
                                            username: username,
                                            onRemove: {
                                                removePrivateViewer(username: username)
                                            }
                                        )
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                        }
                    } else {
                        // Show search results
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(searchResults) { result in
                                    SearchResultRow(
                                        result: result,
                                        isPrivateAdded: isPrivateViewer(username: result.username),
                                        onAdd: {
                                            addPrivateViewer(result: result)
                                        },
                                        onRemove: {
                                            removePrivateViewerByUsername(username: result.username)
                                        }
                                    )
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                        }
                    }
                }
            }
            .navigationTitle("Manage Private Viewers")
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
            loadAddedPrivateUsernames()
        }
    }
    
    private func loadAddedPrivateUsernames() {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.getAddedUsernames(userEmail: userEmail)
                await MainActor.run {
                    // Filter to only private usernames
                    addedPrivateUsernames = (response.addedUsernames ?? []).filter { 
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    }
                }
            } catch {
                print("Error loading private usernames: \(error)")
            }
        }
    }
    
    private func searchUsernames(query: String) {
        guard !query.isEmpty else { return }
        
        isLoading = true
        Task {
            do {
                let results = try await ChannelService.shared.searchUsernames(query: query, limit: 50)
                await MainActor.run {
                    // Filter to only show private accounts
                    searchResults = results.filter { $0.isPrivate == true }
                    isLoading = false
                }
            } catch {
                print("Error searching usernames: \(error)")
                await MainActor.run {
                    isLoading = false
                }
            }
        }
    }
    
    private func isPrivateViewer(username: String) -> Bool {
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        return addedPrivateUsernames.contains(where: {
            $0.streamerUsername.lowercased() == cleanUsername.lowercased() &&
            ($0.streamerVisibility?.lowercased() ?? "public") == "private"
        })
    }
    
    private func addPrivateViewer(result: UsernameSearchResult) {
        guard let ownerEmail = authService.userEmail,
              let ownerUsername = authService.username else { return }
        
        let cleanUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        
        Task {
            do {
                _ = try await ChannelService.shared.addPrivateViewer(
                    ownerUsername: ownerUsername,
                    viewerUsername: cleanUsername,
                    ownerEmail: ownerEmail
                )
                
                await MainActor.run {
                    // Reload list
                    loadAddedPrivateUsernames()
                    // Clear search to show updated list
                    searchQuery = ""
                    searchResults = []
                }
            } catch {
                print("Error adding private viewer: \(error)")
            }
        }
    }
    
    private func removePrivateViewer(username: AddedUsername) {
        guard let ownerEmail = authService.userEmail else { return }
        
        Task {
            do {
                _ = try await ChannelService.shared.removePrivateViewer(
                    ownerEmail: ownerEmail,
                    viewerEmail: username.streamerEmail
                )
                
                await MainActor.run {
                    // Remove from list
                    addedPrivateUsernames.removeAll { $0.id == username.id }
                }
            } catch {
                print("Error removing private viewer: \(error)")
            }
        }
    }
    
    private func removePrivateViewerByUsername(username: String) {
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        if let usernameEntry = addedPrivateUsernames.first(where: {
            $0.streamerUsername.lowercased() == cleanUsername.lowercased()
        }) {
            removePrivateViewer(username: usernameEntry)
        }
    }
}

struct PrivateUsernameRow: View {
    let username: AddedUsername
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.circle.fill")
                .font(.title2)
                .foregroundColor(.twillyCyan)
                .frame(width: 40, height: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(username.streamerUsername)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                
                if let addedAt = username.addedAt {
                    Text("Added \(formatDate(addedAt))")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                }
            }
            
            Spacer()
            
            Button(action: onRemove) {
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
        .padding(16)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let relativeFormatter = RelativeDateTimeFormatter()
            return relativeFormatter.localizedString(for: date, relativeTo: Date())
        }
        return dateString
    }
}

struct SearchResultRow: View {
    let result: UsernameSearchResult
    let isPrivateAdded: Bool
    let onAdd: () -> Void
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill")
                .font(.title3)
                .foregroundColor(.twillyCyan)
                .frame(width: 40, height: 40)
                .background(Color.twillyCyan.opacity(0.2))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(result.username.replacingOccurrences(of: "🔒", with: ""))
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                
                Text("Private Account")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
            }
            
            Spacer()
            
            if isPrivateAdded {
                Button(action: onRemove) {
                    Text("Remove")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.red)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.2))
                        .cornerRadius(8)
                }
            } else {
                Button(action: onAdd) {
                    Text("Add to Private")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.twillyCyan)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.twillyCyan.opacity(0.2))
                        .cornerRadius(8)
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}
