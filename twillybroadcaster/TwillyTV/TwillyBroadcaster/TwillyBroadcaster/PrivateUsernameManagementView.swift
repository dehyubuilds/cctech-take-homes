import SwiftUI

struct PrivateUsernameManagementView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var authService = AuthService.shared
    @State private var searchQuery = ""
    @State private var searchResults: [UsernameSearchResult] = []
    @State private var isLoading = false
    @State private var addedPrivateUsernames: [AddedUsername] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>? = nil
    @State private var addingUsernames: Set<String> = []
    @State private var removingUsernames: Set<String> = []
    @State private var removedPrivateUsernames: Set<String> = [] // Track removed usernames
    
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
                                // Cancel previous search task
                                searchTask?.cancel()
                                
                                if !newValue.isEmpty {
                                    // Debounce search by 300ms
                                    searchTask = Task {
                                        try? await Task.sleep(nanoseconds: 300_000_000)
                                        if !Task.isCancelled {
                                            await searchUsernames(query: newValue)
                                        }
                                    }
                                } else {
                                    searchResults = []
                                    isSearching = false
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
                                        
                                        Text("Add users to allow them to see your private streams")
                                            .font(.title3)
                                            .fontWeight(.medium)
                                            .foregroundColor(.white)
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
                        // Show search results AND all added users (those with "Remove" button)
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                // First, show ALL added users (those with "Remove" button) - these are the added users
                                if !addedPrivateUsernames.isEmpty {
                                    ForEach(addedPrivateUsernames) { username in
                                        // Show as search result row with "Remove" button
                                        let result = UsernameSearchResult(
                                            username: username.streamerUsername,
                                            email: username.streamerEmail,
                                            userId: nil,
                                            displayUsername: username.streamerUsername,
                                            visibility: "private",
                                            isPrivate: false,
                                            isPremium: false,
                                            subscriptionPrice: nil
                                        )
                                        
                                        let cleanResultUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                                        let currentUsername = authService.username?.lowercased() ?? ""
                                        let isCurrentUser = !currentUsername.isEmpty && cleanResultUsername == currentUsername
                                        
                                        SearchResultRow(
                                            result: result,
                                            isPrivateAdded: true, // Always show "Remove" for added users
                                            isAdding: false,
                                            isRemoving: removingUsernames.contains(cleanResultUsername),
                                            isDisabled: isCurrentUser,
                                            onAdd: {
                                                addPrivateViewer(result: result)
                                            },
                                            onRemove: {
                                                removePrivateViewerByUsername(username: result.username)
                                            }
                                        )
                                    }
                                }
                                
                                // Then show search results (excluding already added ones)
                                ForEach(searchResults) { result in
                                    let cleanResultUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
                                    let currentUsername = authService.username?.lowercased() ?? ""
                                    let isCurrentUser = !currentUsername.isEmpty && cleanResultUsername == currentUsername
                                    
                                    // Skip if already shown in added users section
                                    let isAlreadyAdded = addedPrivateUsernames.contains(where: {
                                        $0.streamerUsername.lowercased() == cleanResultUsername &&
                                        ($0.streamerVisibility?.lowercased() ?? "private") == "private"
                                    })
                                    
                                    if !isAlreadyAdded {
                                        SearchResultRow(
                                            result: result,
                                            isPrivateAdded: isPrivateViewer(username: result.username),
                                            isAdding: addingUsernames.contains(cleanResultUsername),
                                            isRemoving: removingUsernames.contains(cleanResultUsername),
                                            isDisabled: isCurrentUser,
                                            onAdd: {
                                                addPrivateViewer(result: result)
                                            },
                                            onRemove: {
                                                removePrivateViewerByUsername(username: result.username)
                                            }
                                        )
                                    }
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
            loadRemovedPrivateUsernames()
            // Load from cache first, then merge with server (same as public usernames)
            loadAddedPrivateUsernames(mergeWithExisting: true)
        }
    }
    
    private func loadRemovedPrivateUsernames() {
        guard let userEmail = authService.userEmail else { return }
        let key = "removedPrivateUsernames_\(userEmail)"
        if let array = UserDefaults.standard.array(forKey: key) as? [String] {
            removedPrivateUsernames = Set(array)
            print("📂 [PrivateUsernameManagementView] Loaded \(removedPrivateUsernames.count) removed private usernames")
        }
    }
    
    private func saveRemovedPrivateUsernames() {
        guard let userEmail = authService.userEmail else { return }
        let key = "removedPrivateUsernames_\(userEmail)"
        UserDefaults.standard.set(Array(removedPrivateUsernames), forKey: key)
        print("💾 [PrivateUsernameManagementView] Saved \(removedPrivateUsernames.count) removed private usernames")
    }
    
    private func addedPrivateUsernamesKey(for userEmail: String) -> String {
        return "addedPrivateUsernames_\(userEmail)"
    }
    
    private func saveAddedPrivateUsernamesToUserDefaults() {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [PrivateUsernameManagementView] Cannot save to UserDefaults - userEmail is nil")
            return
        }
        
        let key = addedPrivateUsernamesKey(for: userEmail)
        print("🔑 [PrivateUsernameManagementView] Saving to UserDefaults with key: \(key)")
        
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(addedPrivateUsernames)
            UserDefaults.standard.set(data, forKey: key)
            print("💾 [PrivateUsernameManagementView] Saved \(addedPrivateUsernames.count) added private usernames to UserDefaults (key: \(key))")
            print("   📋 Usernames: \(addedPrivateUsernames.map { "\($0.streamerUsername) (visibility: \($0.streamerVisibility ?? "private"))" }.joined(separator: ", "))")
        } catch {
            print("❌ [PrivateUsernameManagementView] Error saving added private usernames to UserDefaults: \(error)")
            print("   Key used: \(key)")
        }
    }
    
    private func loadAddedPrivateUsernamesFromUserDefaults() -> [AddedUsername] {
        guard let userEmail = authService.userEmail else {
            print("⚠️ [PrivateUsernameManagementView] Cannot load from UserDefaults - userEmail is nil")
            return []
        }
        
        let key = addedPrivateUsernamesKey(for: userEmail)
        print("🔑 [PrivateUsernameManagementView] Attempting to load from UserDefaults with key: \(key)")
        
        guard let data = UserDefaults.standard.data(forKey: key) else {
            print("📭 [PrivateUsernameManagementView] No cached added private usernames in UserDefaults for key: \(key)")
            return []
        }
        
        do {
            let decoder = JSONDecoder()
            let cached = try decoder.decode([AddedUsername].self, from: data)
            print("📂 [PrivateUsernameManagementView] Loaded \(cached.count) added private usernames from UserDefaults (key: \(key))")
            print("   📋 Usernames: \(cached.map { "\($0.streamerUsername) (visibility: \($0.streamerVisibility ?? "private"))" }.joined(separator: ", "))")
            return cached
        } catch {
            print("❌ [PrivateUsernameManagementView] Error decoding added private usernames from UserDefaults: \(error)")
            return []
        }
    }
    
    private func loadAddedPrivateUsernames(mergeWithExisting: Bool = false) {
        guard let userEmail = authService.userEmail else { return }
        
        // CRITICAL: Load from UserDefaults FIRST (same as public usernames)
        let cached = loadAddedPrivateUsernamesFromUserDefaults()
        
        // Always use cached data immediately if available (for instant UI update)
        // Filter cached to only include private usernames
        let cachedPrivate = cached.filter { 
            ($0.streamerVisibility?.lowercased() ?? "public") == "private" &&
            !removedPrivateUsernames.contains($0.streamerUsername.lowercased())
        }
        
        if !cachedPrivate.isEmpty {
            if mergeWithExisting {
                // Merge cached with existing, avoiding duplicates
                var merged = addedPrivateUsernames
                for cachedUsername in cachedPrivate {
                    let exists = merged.contains(where: {
                        $0.streamerUsername.lowercased() == cachedUsername.streamerUsername.lowercased() &&
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    })
                    if !exists {
                        merged.append(cachedUsername)
                    }
                }
                addedPrivateUsernames = merged
            } else {
                // Use cached data immediately
                addedPrivateUsernames = cachedPrivate
            }
            print("✅ [PrivateUsernameManagementView] Loaded \(addedPrivateUsernames.count) private usernames from cache")
        } else {
            print("⚠️ [PrivateUsernameManagementView] No cached private usernames found")
        }
        
        Task {
            do {
                let response = try await ChannelService.shared.getAddedUsernames(userEmail: userEmail)
                await MainActor.run {
                    // Filter to only private usernames
                    let allPrivate = (response.addedUsernames ?? []).filter { 
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    }
                    
                    if mergeWithExisting {
                        // Merge server data with cached (preserve optimistic updates)
                        var merged: [AddedUsername] = []
                        var seenEntries = Set<String>()
                        
                        // First, add all server usernames (server is source of truth)
                        for serverUsername in allPrivate {
                            let usernameLower = serverUsername.streamerUsername.lowercased()
                            let key = "\(usernameLower):private"
                            if !seenEntries.contains(key) && !removedPrivateUsernames.contains(usernameLower) {
                                merged.append(serverUsername)
                                seenEntries.insert(key)
                            }
                        }
                        
                        // Then, add cached private usernames that aren't in server (optimistic updates)
                        // Use cachedPrivate (already filtered) instead of cached
                        for cachedUsername in cachedPrivate {
                            let usernameLower = cachedUsername.streamerUsername.lowercased()
                            let key = "\(usernameLower):private"
                            if !seenEntries.contains(key) && !removedPrivateUsernames.contains(usernameLower) {
                                merged.append(cachedUsername)
                                seenEntries.insert(key)
                            }
                        }
                        
                        addedPrivateUsernames = merged
                        print("✅ [PrivateUsernameManagementView] Merged \(addedPrivateUsernames.count) private usernames (server + cache)")
                    } else {
                        // Filter out removed usernames
                        addedPrivateUsernames = allPrivate.filter { username in
                            let usernameLower = username.streamerUsername.lowercased()
                            return !removedPrivateUsernames.contains(usernameLower)
                        }
                    }
                    
                    // Save to UserDefaults (same as public usernames)
                    saveAddedPrivateUsernamesToUserDefaults()
                }
            } catch {
                print("Error loading private usernames: \(error)")
            }
        }
    }
    
    private func searchUsernames(query: String) async {
        guard !query.isEmpty else { return }
        
        await MainActor.run {
            isSearching = true
            isLoading = true
        }
        
        do {
            let results = try await ChannelService.shared.searchUsernames(query: query, limit: 50)
            await MainActor.run {
                // Show all users (including current user - they'll just be disabled)
                searchResults = results
                isLoading = false
                isSearching = false
            }
        } catch {
            print("❌ [PrivateUsernameManagementView] Error searching usernames: \(error)")
            await MainActor.run {
                isLoading = false
                isSearching = false
            }
        }
    }
    
    private func isPrivateViewer(username: String) -> Bool {
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces).lowercased()
        
        // Check if it's in the added list (and not removed)
        let isAdded = addedPrivateUsernames.contains(where: {
            $0.streamerUsername.lowercased() == cleanUsername &&
            ($0.streamerVisibility?.lowercased() ?? "public") == "private"
        })
        
        // If it was removed, it's not added anymore
        if removedPrivateUsernames.contains(cleanUsername) {
            return false
        }
        
        return isAdded
    }
    
    private func addPrivateViewer(result: UsernameSearchResult) {
        guard let ownerEmail = authService.userEmail,
              let ownerUsername = authService.username else {
            print("❌ [PrivateUsernameManagementView] Cannot add private viewer - missing owner email or username")
            return
        }
        
        let cleanUsername = result.username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        let addingKey = cleanUsername.lowercased()
        
        // Prevent duplicate adds
        if addingUsernames.contains(addingKey) {
            return
        }
        
        print("🟢 [PrivateUsernameManagementView] Adding private viewer: \(cleanUsername)")
        addingUsernames.insert(addingKey)
        
        // OPTIMISTIC UPDATE: Add immediately to the list
        let newAdded = AddedUsername(
            streamerEmail: result.email ?? "",
            streamerUsername: cleanUsername,
            addedAt: ISO8601DateFormatter().string(from: Date()),
            streamerVisibility: "private"
        )
        
        await MainActor.run {
            // Remove from removed list if it was there
            removedPrivateUsernames.remove(addingKey)
            saveRemovedPrivateUsernames()
            
            // Check if already exists
            if let existingIndex = addedPrivateUsernames.firstIndex(where: {
                $0.streamerUsername.lowercased() == addingKey &&
                ($0.streamerVisibility?.lowercased() ?? "public") == "private"
            }) {
                // Update existing
                addedPrivateUsernames[existingIndex] = newAdded
            } else {
                // Add new
                addedPrivateUsernames.append(newAdded)
            }
            
            // Save immediately to UserDefaults (same as public usernames)
            saveAddedPrivateUsernamesToUserDefaults()
        }
        
        Task {
            do {
                // Only pass username - backend will do email lookup via GSI
                let response = try await ChannelService.shared.addPrivateViewer(
                    ownerUsername: ownerUsername,
                    viewerUsername: cleanUsername,
                    viewerEmail: nil
                )
                
                print("✅ [PrivateUsernameManagementView] Successfully added private viewer: \(cleanUsername)")
                
                await MainActor.run {
                    addingUsernames.remove(addingKey)
                    isLoading = false
                    
                    // Wait for backend to process, then reload (same as public usernames)
                    Task {
                        do {
                            // Wait 1 second for backend to process
                            try await Task.sleep(nanoseconds: 1_000_000_000)
                            await MainActor.run {
                                loadAddedPrivateUsernames(mergeWithExisting: true)
                            }
                        } catch {
                            print("⚠️ [PrivateUsernameManagementView] Could not refresh from server: \(error.localizedDescription)")
                        }
                    }
                }
            } catch {
                print("❌ [PrivateUsernameManagementView] Error adding private viewer: \(error)")
                await MainActor.run {
                    addingUsernames.remove(addingKey)
                    // Remove optimistic update on error
                    addedPrivateUsernames.removeAll { 
                        $0.streamerUsername.lowercased() == addingKey &&
                        ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                    }
                    // Save to UserDefaults after removing
                    saveAddedPrivateUsernamesToUserDefaults()
                    isLoading = false
                }
            }
        }
    }
    
    private func removePrivateViewer(username: AddedUsername) {
        guard let ownerEmail = authService.userEmail,
              let ownerUsername = authService.username else {
            print("❌ [PrivateUsernameManagementView] Cannot remove private viewer - missing owner email or username")
            return
        }
        
        let viewerUsername = username.streamerUsername
        let removingKey = viewerUsername.lowercased()
        
        // Prevent duplicate removes
        if removingUsernames.contains(removingKey) {
            return
        }
        
        print("🔴 [PrivateUsernameManagementView] Removing private viewer: \(viewerUsername)")
        removingUsernames.insert(removingKey)
        
        Task {
            do {
                // Try to use email first, fallback to username lookup
                var viewerEmail = username.streamerEmail
                
                // If email is missing, try to look it up
                if viewerEmail.isEmpty {
                    print("   🔍 Looking up email for username: \(viewerUsername)")
                    let searchResults = try await ChannelService.shared.searchUsernames(query: viewerUsername, limit: 1)
                    if let foundUser = searchResults.first, let foundEmail = foundUser.email {
                        viewerEmail = foundEmail
                        print("   ✅ Found email: \(viewerEmail)")
                    } else {
                        print("   ⚠️ Could not find email for username: \(viewerUsername)")
                    }
                }
                
                guard !viewerEmail.isEmpty else {
                    throw ChannelServiceError.serverError("Could not find email for username: \(viewerUsername)")
                }
                
                // Use the updated removePrivateViewer that accepts usernames
                _ = try await ChannelService.shared.removePrivateViewer(
                    ownerEmail: ownerEmail,
                    viewerEmail: viewerEmail,
                    ownerUsername: ownerUsername,
                    viewerUsername: viewerUsername
                )
                
                print("✅ [PrivateUsernameManagementView] Successfully removed private viewer: \(viewerUsername)")
                
                await MainActor.run {
                    removingUsernames.remove(removingKey)
                    // Add to removed list to track it
                    removedPrivateUsernames.insert(removingKey)
                    saveRemovedPrivateUsernames()
                    // Remove from added list
                    addedPrivateUsernames.removeAll { $0.id == username.id }
                    // Save to UserDefaults
                    saveAddedPrivateUsernamesToUserDefaults()
                    // Reload to ensure consistency
                    loadAddedPrivateUsernames(mergeWithExisting: true)
                }
            } catch {
                print("❌ [PrivateUsernameManagementView] Error removing private viewer: \(error)")
                await MainActor.run {
                    removingUsernames.remove(removingKey)
                }
            }
        }
    }
    
    private func removePrivateViewerByUsername(username: String) {
        let cleanUsername = username.replacingOccurrences(of: "🔒", with: "").trimmingCharacters(in: .whitespaces)
        if let usernameEntry = addedPrivateUsernames.first(where: {
            $0.streamerUsername.lowercased() == cleanUsername.lowercased() &&
            ($0.streamerVisibility?.lowercased() ?? "public") == "private"
        }) {
            removePrivateViewer(username: usernameEntry)
        } else {
            // If not in addedPrivateUsernames, try to remove directly by username
            guard let ownerEmail = authService.userEmail,
                  let ownerUsername = authService.username else {
                print("❌ [PrivateUsernameManagementView] Cannot remove - missing owner email or username")
                return
            }
            
            print("🔴 [PrivateUsernameManagementView] Removing private viewer by username: \(cleanUsername)")
            isLoading = true
            
            Task {
                do {
                    // Look up email for the username
                    let searchResults = try await ChannelService.shared.searchUsernames(query: cleanUsername, limit: 1)
                    guard let foundUser = searchResults.first, let foundEmail = foundUser.email else {
                        throw ChannelServiceError.serverError("Could not find email for username: \(cleanUsername)")
                    }
                    
                    _ = try await ChannelService.shared.removePrivateViewer(
                        ownerEmail: ownerEmail,
                        viewerEmail: foundEmail,
                        ownerUsername: ownerUsername,
                        viewerUsername: cleanUsername
                    )
                    
                    print("✅ [PrivateUsernameManagementView] Successfully removed private viewer: \(cleanUsername)")
                    
                    await MainActor.run {
                        // Add to removed list
                        removedPrivateUsernames.insert(cleanUsername.lowercased())
                        saveRemovedPrivateUsernames()
                        // Remove from added list
                        addedPrivateUsernames.removeAll { 
                            $0.streamerUsername.lowercased() == cleanUsername.lowercased() &&
                            ($0.streamerVisibility?.lowercased() ?? "public") == "private"
                        }
                        // Save to UserDefaults
                        saveAddedPrivateUsernamesToUserDefaults()
                        // Reload the list to reflect the removal
                        loadAddedPrivateUsernames(mergeWithExisting: true)
                        isLoading = false
                    }
                } catch {
                    print("❌ [PrivateUsernameManagementView] Error removing private viewer: \(error)")
                    await MainActor.run {
                        isLoading = false
                    }
                }
            }
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
    let isAdding: Bool
    let isRemoving: Bool
    let isDisabled: Bool
    let onAdd: () -> Void
    let onRemove: () -> Void
    
    private var isPrivateAccount: Bool {
        result.isPrivate == true || result.username.contains("🔒")
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isPrivateAccount ? "lock.fill" : "person.circle.fill")
                .font(.title3)
                .foregroundColor(isPrivateAccount ? .twillyCyan : .white.opacity(0.7))
                .frame(width: 40, height: 40)
                .background((isPrivateAccount ? Color.twillyCyan : Color.white).opacity(0.2))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(result.username.replacingOccurrences(of: "🔒", with: ""))
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(isDisabled ? .white.opacity(0.5) : .white)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                
                Text(isPrivateAccount ? "Private Account" : "Public Account")
                    .font(.caption)
                    .foregroundColor(isDisabled ? .white.opacity(0.4) : .white.opacity(0.6))
            }
            
            Spacer()
            
            if isAdding || isRemoving {
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
            } else if isPrivateAdded {
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
                .disabled(isDisabled)
                .opacity(isDisabled ? 0.5 : 1.0)
            } else {
                Button(action: onAdd) {
                    Text("Add to Private")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(isDisabled ? .white.opacity(0.5) : .twillyCyan)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(isDisabled ? Color.white.opacity(0.1) : Color.twillyCyan.opacity(0.2))
                        .cornerRadius(8)
                }
                .disabled(isDisabled)
                .opacity(isDisabled ? 0.5 : 1.0)
            }
        }
        .padding(16)
        .background(Color.white.opacity(isDisabled ? 0.02 : 0.05))
        .cornerRadius(12)
        .opacity(isDisabled ? 0.6 : 1.0)
    }
}
