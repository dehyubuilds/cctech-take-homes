//
//  StreamerSettingsView.swift
//  TwillyBroadcaster
//
//  Settings view for streamers to select timeslots and get RTMP connection strings
//

import SwiftUI
import SafariServices

struct StreamerSettingsView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    @State private var availableTimeslots: [Timeslot] = []
    @State private var selectedTimeslot: Timeslot? = nil
    @State private var isLoading = false
    @State private var errorMessage: String? = nil
    @State private var rtmpConnectionString: String? = nil
    @State private var showingCopySuccess = false
    @State private var airDay: String? = nil
    @State private var airTime: String? = nil
    @State private var isScheduleLocked = false
    @State private var showingAirScheduleSelector = false
    @State private var postAutomatically = false
    @State private var isUpdatingPostAutomatically = false
    @State private var isPausingSchedule = false
    @State private var isSchedulePaused = false
    @State private var isCollaborator = false
    @State private var collaboratorChannels: [CollaboratorRole] = []
    @State private var isLoadingRTMPKey = false
    @State private var rtmpKeyLoadStartTime: Date?
    @State private var followRequests: [FollowRequest] = []
    @State private var isLoadingFollowRequests = false
    @State private var isPrivateAccount = false
    @State private var isLoadingAccountVisibility = false
    @State private var isUpdatingAccountVisibility = false
    @State private var showingFollowRequests = false
    @State private var isPremiumEnabled = false
    @State private var isLoadingPremiumStatus = false
    @State private var premiumStatus: PremiumStatusResponse? = nil
    @State private var showingPremiumSetup = false
    
    private var userEmail: String {
        authService.userEmail ?? ""
    }
    
    private var isAdmin: Bool {
        UserRoleService.shared.isAdmin(userEmail: userEmail)
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
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Account Info Section
                        accountInfoSection
                            .padding(.horizontal, 16)
                        
                        // Premium Section - HIDDEN for v1
                        // premiumSection
                            .padding(.horizontal, 16)
                        
                        // Account Actions Section
                        accountActionsSection
                            .padding(.horizontal, 16)
                            .padding(.bottom, 40)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
        .sheet(isPresented: $showingAirScheduleSelector) {
            AirScheduleSelectorView {
                // Reload schedule after saving
                loadAirSchedule()
            }
        }
        }
        .onAppear {
            // Load follow requests
            loadFollowRequests()
            
            // Load account visibility
            loadAccountVisibility()
            
            // Load premium status
            loadPremiumStatus()
        }
        .sheet(isPresented: $showingPremiumSetup) {
            if let onboardingUrl = premiumStatus?.onboardingUrl, let url = URL(string: onboardingUrl) {
                SafariView(url: url)
            } else if let dashboardUrl = premiumStatus?.dashboardUrl, let url = URL(string: dashboardUrl) {
                SafariView(url: url)
            }
        }
    }
    
    // MARK: - Account Components
    
    
    
    
    
    
    private var accountInfoSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section Header
            HStack {
                Text("Account")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.3))
            
            // Account Details
            VStack(spacing: 0) {
                if let username = authService.username {
                    accountInfoRow(label: "Username", value: username)
                    Divider()
                        .background(Color.white.opacity(0.1))
                }
                
                accountInfoRow(label: "Email", value: userEmail)
                
                if isAdmin {
                    Divider()
                        .background(Color.white.opacity(0.1))
                    accountInfoRow(
                        label: "Role",
                        value: "Admin",
                        valueColor: .twillyTeal,
                        icon: "checkmark.circle.fill"
                    )
                }
                
            }
            .background(Color.black.opacity(0.2))
        }
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }
    
    private func accountInfoRow(label: String, value: String, valueColor: Color = .white, icon: String? = nil) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.gray)
                HStack(spacing: 6) {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.caption)
                            .foregroundColor(valueColor)
                    }
                    Text(value)
                        .font(.body)
                        .foregroundColor(valueColor)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    private var premiumSection: some View {
        VStack(spacing: 0) {
            // Section Header
            HStack {
                Text("Premium")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.3))
            
            VStack(spacing: 0) {
                // Premium Toggle
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Enable Premium")
                            .font(.body)
                            .foregroundColor(.white)
                        Text("Set up Stripe to accept subscriptions")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Spacer()
                    
                    if isLoadingPremiumStatus {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Toggle("", isOn: Binding(
                            get: { isPremiumEnabled },
                            set: { newValue in
                                if newValue {
                                    // Enable premium - redirect to setup
                                    showingPremiumSetup = true
                                } else {
                                    // Disable premium
                                    disablePremium()
                                }
                            }
                        ))
                        .tint(.orange)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.black.opacity(0.2))
                
                // Premium Status Info
                if let status = premiumStatus, status.isPremium == true {
                    Divider()
                        .background(Color.white.opacity(0.1))
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Premium Active")
                                .font(.body)
                                .foregroundColor(.white)
                            if let price = status.subscriptionPrice {
                                Text("$\(String(format: "%.2f", price))/month")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.2))
                    
                    // Manage Premium Button
                    Button(action: {
                        showingPremiumSetup = true
                    }) {
                        HStack {
                            Text("Manage Premium")
                                .font(.body)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .foregroundColor(.orange)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.black.opacity(0.2))
                    }
                } else if isPremiumEnabled && premiumStatus?.hasStripeAccount == true && premiumStatus?.stripeStatus != "connected" {
                    Divider()
                        .background(Color.white.opacity(0.1))
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Setup Required")
                                .font(.body)
                                .foregroundColor(.orange)
                            Text("Complete Stripe account setup")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        Spacer()
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.orange)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.2))
                }
            }
        }
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
        )
    }
    
    private var accountActionsSection: some View {
        VStack(spacing: 0) {
            // Section Header
            HStack {
                Text("Account Actions")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.3))
            
            // Sign Out Button (Instagram/YouTube style)
            Button(action: {
                Task {
                    do {
                        try await AuthService.shared.signOut()
                        dismiss()
                    } catch {
                        print("Error signing out: \(error)")
                    }
                }
            }) {
                HStack {
                    Image(systemName: "arrow.right.square")
                        .font(.system(size: 18))
                    Text("Sign Out")
                        .font(.body)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                }
                .foregroundColor(.red)
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
                .background(Color.black.opacity(0.2))
            }
        }
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
        )
    }
    
    private var adminRTMPSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.twillyTeal)
                Text("Admin Account")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
            }
            
            Text("Stream from mobile app or use RTMP key below")
                .font(.caption)
                .foregroundColor(.gray)
        }
    }
    
    private func loadCollaboratorStatus() {
        Task {
            guard let userEmail = authService.userEmail,
                  let userId = authService.userId else {
                return
            }
            
            do {
                let userRoles = await UserRoleService.shared.getUserRoles(userId: userId, userEmail: userEmail)
                await MainActor.run {
                    isCollaborator = userRoles.isCollaborator
                    collaboratorChannels = userRoles.collaboratorChannels
                    print("✅ [StreamerSettingsView] User is collaborator: \(isCollaborator), channels: \(collaboratorChannels.count)")
                }
            } catch {
                print("⚠️ [StreamerSettingsView] Error loading collaborator status: \(error.localizedDescription)")
            }
        }
    }
    
    private func shouldShowRTMPError() -> Bool {
        // Only show error if we've been loading for more than 2 seconds
        guard let startTime = rtmpKeyLoadStartTime else {
            return false
        }
        let elapsed = Date().timeIntervalSince(startTime)
        return elapsed >= 2.0
    }
    
    private func loadRTMPKey() {
        // Set loading state and start time
        Task { @MainActor in
            isLoadingRTMPKey = true
            rtmpKeyLoadStartTime = Date()
            errorMessage = nil // Clear any previous errors
        }
        
        Task {
            do {
                guard let userEmail = authService.userEmail,
                      let userId = authService.userId else {
                    print("❌ [StreamerSettingsView] Missing user credentials - userEmail: \(authService.userEmail ?? "nil"), userId: \(authService.userId ?? "nil")")
                    // Wait 2 seconds before showing error
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    await MainActor.run {
                        isLoadingRTMPKey = false
                        errorMessage = "Please sign in to get your RTMP connection"
                    }
                    return
                }
                
                print("🔍 [StreamerSettingsView] Loading RTMP key for user: \(userEmail), userId: \(userId)")
                
                // Get Twilly TV channel and stream key
                print("🔍 [StreamerSettingsView] Fetching discoverable channels...")
                let channels = try await ChannelService.shared.fetchDiscoverableChannels(forceRefresh: false)
                print("✅ [StreamerSettingsView] Found \(channels.count) discoverable channels")
                
                guard let twillyTV = channels.first(where: { 
                    $0.channelName.lowercased().contains("twilly tv") 
                }) else {
                    print("❌ [StreamerSettingsView] Twilly TV channel not found in \(channels.count) channels")
                    print("   Available channels: \(channels.map { $0.channelName }.joined(separator: ", "))")
                    // Wait 2 seconds before showing error
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    await MainActor.run {
                        isLoadingRTMPKey = false
                        errorMessage = "Twilly TV channel not found"
                    }
                    return
                }
                
                print("✅ [StreamerSettingsView] Found Twilly TV channel: \(twillyTV.channelName) (ID: \(twillyTV.channelId))")
                
                // Get or create stream key for Twilly TV (same for admin and non-admin)
                print("🔍 [StreamerSettingsView] Getting or creating collaborator stream key...")
                let streamKey = try await ChannelService.shared.getOrCreateCollaboratorStreamKey(
                    channelId: twillyTV.channelId,
                    channelName: twillyTV.channelName,
                    userId: userId,
                    userEmail: userEmail
                )
                
                print("✅ [StreamerSettingsView] Successfully got stream key: \(streamKey)")
                
                await MainActor.run {
                    // Format: rtmp://SERVER_IP:PORT/live/STREAM_KEY
                    let serverIP = "100.24.103.57"
                    let serverPort = "1935"
                    rtmpConnectionString = "rtmp://\(serverIP):\(serverPort)/live/\(streamKey)"
                    print("✅ [StreamerSettingsView] RTMP connection string set: \(rtmpConnectionString ?? "nil")")
                    isLoadingRTMPKey = false
                    errorMessage = nil // Clear any previous errors
                    rtmpKeyLoadStartTime = nil
                }
            } catch {
                print("❌ [StreamerSettingsView] Error loading RTMP key: \(error)")
                print("   Error type: \(type(of: error))")
                print("   Error description: \(error.localizedDescription)")
                if let urlError = error as? URLError {
                    print("   URL Error code: \(urlError.code.rawValue)")
                    print("   URL Error description: \(urlError.localizedDescription)")
                }
                if let nsError = error as NSError? {
                    print("   NSError domain: \(nsError.domain)")
                    print("   NSError code: \(nsError.code)")
                    print("   NSError userInfo: \(nsError.userInfo)")
                }
                // Wait 2 seconds before showing error
                do {
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                } catch {
                    // Ignore sleep error
                }
                await MainActor.run {
                    isLoadingRTMPKey = false
                    errorMessage = "Failed to load RTMP key: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private var timeslotSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isLoading {
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                    Text("Loading timeslots...")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.title2)
                        .foregroundColor(.red)
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        loadTimeslots()
                    }
                    .foregroundColor(.twillyTeal)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else if availableTimeslots.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.title3)
                        .foregroundColor(.gray)
                    Text("No available timeslots")
                        .font(.subheadline)
                        .foregroundColor(.white)
                    Text("Check back later")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                ForEach(availableTimeslots) { timeslot in
                    TimeslotRow(
                        timeslot: timeslot,
                        isSelected: selectedTimeslot?.id == timeslot.id
                    ) {
                        selectTimeslot(timeslot)
                    }
                }
            }
        }
    }
    
    private func rtmpConnectionSection(connectionString: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RTMP Connection String")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.white)
            
            Text(connectionString)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.twillyTeal)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.5))
                .cornerRadius(8)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            
            Button(action: {
                UIPasteboard.general.string = connectionString
                withAnimation {
                    showingCopySuccess = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    withAnimation {
                        showingCopySuccess = false
                    }
                }
            }) {
                HStack {
                    Image(systemName: showingCopySuccess ? "checkmark.circle.fill" : "doc.on.doc")
                    Text(showingCopySuccess ? "Copied!" : "Copy")
                }
                .font(.subheadline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.twillyTeal)
                .cornerRadius(8)
            }
        }
    }
    
    private func loadTimeslots() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                // TODO: Call API to get available timeslots
                // For now, show mock data
                await MainActor.run {
                    // Mock timeslots for testing
                    availableTimeslots = [
                        Timeslot(id: "1", date: "2026-02-08", time: "08:00", status: "available"),
                        Timeslot(id: "2", date: "2026-02-08", time: "10:00", status: "available"),
                        Timeslot(id: "3", date: "2026-02-08", time: "14:00", status: "available"),
                        Timeslot(id: "4", date: "2026-02-08", time: "18:00", status: "available"),
                        Timeslot(id: "5", date: "2026-02-08", time: "20:00", status: "available")
                    ]
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    private func selectTimeslot(_ timeslot: Timeslot) {
        selectedTimeslot = timeslot
        
        Task {
            do {
                // TODO: Call API to reserve timeslot
                // Note: RTMP key is already loaded and doesn't change with timeslot selection
                // The key is the same regardless of which timeslot is selected
                print("✅ [StreamerSettingsView] Timeslot selected: \(timeslot.date) at \(timeslot.time)")
                print("   RTMP key remains the same (already loaded)")
                
                // Show success message
                await MainActor.run {
                    // Timeslot selected - RTMP key is already available
                    // No need to reload the key as it doesn't change
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to reserve timeslot: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // MARK: - Air Schedule Section
    private var airScheduleSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Air Schedule")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            
            if isScheduleLocked, let day = airDay, let time = airTime {
                // Show locked schedule with pause/resume button
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: isSchedulePaused ? "pause.circle.fill" : "lock.fill")
                            .foregroundColor(isSchedulePaused ? .orange : .twillyTeal)
                        Text("\(day)s at \(formatTime(time))")
                            .font(.subheadline)
                            .foregroundColor(.white)
                        if isSchedulePaused {
                            Text("(Paused)")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                    Text("Your recurring air schedule (cannot be changed)")
                        .font(.caption)
                        .foregroundColor(.gray)
                    
                    // Pause/Resume button
                    Button(action: {
                        pauseOrResumeSchedule(pause: !isSchedulePaused)
                    }) {
                        HStack {
                            Image(systemName: isSchedulePaused ? "play.circle.fill" : "pause.circle.fill")
                            Text(isSchedulePaused ? "Resume Schedule" : "Pause Schedule")
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(isSchedulePaused ? Color.twillyTeal : Color.orange)
                        .cornerRadius(8)
                    }
                    .disabled(isPausingSchedule)
                }
                .padding(12)
                .background(Color.black.opacity(0.3))
                .cornerRadius(8)
            } else {
                // Show selector button
                Button(action: {
                    showingAirScheduleSelector = true
                }) {
                    HStack {
                        Image(systemName: "calendar")
                        Text("Select Air Schedule")
                    }
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.twillyTeal)
                    .cornerRadius(8)
                }
            }
            
            // Post Automatically Toggle (shown for all users)
            Divider()
                .background(Color.white.opacity(0.1))
                .padding(.vertical, 8)
            
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Post Automatically")
                        .font(.subheadline)
                        .foregroundColor(.white)
                    Spacer()
                    if isUpdatingPostAutomatically {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                            .scaleEffect(0.8)
                    } else {
                        Toggle("", isOn: Binding(
                            get: { postAutomatically },
                            set: { newValue in
                                updatePostAutomatically(newValue)
                            }
                        ))
                        .toggleStyle(SwitchToggleStyle(tint: .twillyTeal))
                    }
                }
                
                Text("When enabled, all streamed content becomes visible immediately when ready. This will pause your recurring schedule.")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
        }
    }
    
    // MARK: - RTMP Key Section
    private var rtmpKeySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RTMP Connection String")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            
            if isLoadingRTMPKey {
                // Show spinner while loading (don't show error immediately)
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                    Text("Loading RTMP key...")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else if let rtmpString = rtmpConnectionString {
                VStack(alignment: .leading, spacing: 8) {
                    Text(rtmpString)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(8)
                    
                    Button(action: {
                        UIPasteboard.general.string = rtmpString
                        showingCopySuccess = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            withAnimation {
                                showingCopySuccess = false
                            }
                        }
                    }) {
                        HStack {
                            Image(systemName: showingCopySuccess ? "checkmark.circle.fill" : "doc.on.doc")
                            Text(showingCopySuccess ? "Copied!" : "Copy")
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.twillyTeal)
                        .cornerRadius(8)
                    }
                }
            } else if isLoadingRTMPKey {
                // Show spinner while loading (don't show error immediately)
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                    Text("Loading RTMP key...")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else if let error = errorMessage, shouldShowRTMPError() {
                // Only show error if we've been loading for more than 2 seconds
                Text("Failed to load RTMP key")
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .padding(.vertical, 12)
            }
        }
    }
    
    private func formatTime(_ time: String) -> String {
        // Convert "16:00" to "4:00 PM"
        let components = time.split(separator: ":")
        guard components.count == 2,
              let hour = Int(components[0]),
              let minute = Int(components[1]) else {
            return time
        }
        
        let hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        let amPm = hour < 12 ? "AM" : "PM"
        return "\(hour12):\(String(format: "%02d", minute)) \(amPm)"
    }
    
    private func loadAirSchedule() {
        Task {
            do {
                guard let userEmail = authService.userEmail else {
                    return
                }
                
                let response = try await ChannelService.shared.getAirSchedule(userEmail: userEmail)
                
                await MainActor.run {
                    if let schedule = response.schedule {
                        airDay = schedule.airDay
                        airTime = schedule.airTime
                        isScheduleLocked = schedule.isLocked ?? false
                        isSchedulePaused = schedule.isPaused ?? false
                    } else {
                        airDay = nil
                        airTime = nil
                        isScheduleLocked = false
                        isSchedulePaused = false
                    }
                }
            } catch {
                print("Error loading air schedule: \(error)")
                await MainActor.run {
                    airDay = nil
                    airTime = nil
                    isScheduleLocked = false
                    isSchedulePaused = false
                }
            }
        }
    }
    
    private func loadPostAutomatically() {
        Task {
            do {
                guard let userEmail = authService.userEmail else {
                    return
                }
                
                let postAuto = try await ChannelService.shared.getPostAutomatically(userEmail: userEmail)
                
                await MainActor.run {
                    postAutomatically = postAuto
                }
            } catch {
                print("Error loading post automatically setting: \(error)")
            }
        }
    }
    
    private func updatePostAutomatically(_ value: Bool) {
        isUpdatingPostAutomatically = true
        
        Task {
            do {
                guard let userEmail = authService.userEmail,
                      let userId = authService.userId else {
                    await MainActor.run {
                        isUpdatingPostAutomatically = false
                        errorMessage = "Please sign in"
                    }
                    return
                }
                
                let response = try await ChannelService.shared.setPostAutomatically(
                    userEmail: userEmail,
                    userId: userId,
                    postAutomatically: value
                )
                
                await MainActor.run {
                    isUpdatingPostAutomatically = false
                    if response.success {
                        postAutomatically = value
                        // Reload schedule to get updated isPaused status
                        loadAirSchedule()
                    } else {
                        errorMessage = response.message ?? "Failed to update setting"
                    }
                }
            } catch {
                await MainActor.run {
                    isUpdatingPostAutomatically = false
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func pauseOrResumeSchedule(pause: Bool) {
        isPausingSchedule = true
        
        Task {
            do {
                guard let userEmail = authService.userEmail else {
                    await MainActor.run {
                        isPausingSchedule = false
                        errorMessage = "Please sign in"
                    }
                    return
                }
                
                let response = try await ChannelService.shared.pauseSchedule(
                    userEmail: userEmail,
                    pause: pause
                )
                
                await MainActor.run {
                    isPausingSchedule = false
                    if response.success {
                        isSchedulePaused = pause
                    } else {
                        errorMessage = response.message ?? "Failed to \(pause ? "pause" : "resume") schedule"
                    }
                }
            } catch {
                await MainActor.run {
                    isPausingSchedule = false
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // MARK: - Username Visibility
    // Visibility is now controlled via Twilly TV badge on stream screen (ContentView)
    // Removed loadUsernameVisibility() and updateUsernameVisibility() - no longer needed
    
    // MARK: - Follow Requests
    
    private var followRequestsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section Header
            HStack {
                Text("Follow Requests")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                if !followRequests.isEmpty {
                    Text("\(followRequests.count)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.black.opacity(0.3))
            
            if isLoadingFollowRequests {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(.white)
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if followRequests.isEmpty {
                Text("No pending requests")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
            } else {
                ForEach(followRequests) { request in
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.twillyTeal)
                            .font(.title3)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(request.requesterUsername)
                                .font(.body)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                            Text(request.requesterEmail)
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 8) {
                            Button(action: {
                                acceptFollowRequest(request.requesterEmail)
                            }) {
                                Text("Accept")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.twillyTeal)
                                    .cornerRadius(8)
                            }
                            
                            Button(action: {
                                declineFollowRequest(request.requesterEmail)
                            }) {
                                Text("Decline")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.red.opacity(0.7))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.2))
                    
                    if request.id != followRequests.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.1))
                    }
                }
            }
        }
        .background(Color.black.opacity(0.2))
        .cornerRadius(12)
    }
    
    private func loadFollowRequests() {
        guard let userEmail = authService.userEmail else { return }
        
        isLoadingFollowRequests = true
        Task {
            do {
                let response = try await ChannelService.shared.getFollowRequests(userEmail: userEmail, status: "pending")
                await MainActor.run {
                    followRequests = response.requests ?? []
                    isLoadingFollowRequests = false
                    print("✅ [StreamerSettingsView] Loaded \(followRequests.count) pending follow requests")
                }
            } catch {
                print("❌ [StreamerSettingsView] Error loading follow requests: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingFollowRequests = false
                }
            }
        }
    }
    
    private func acceptFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.acceptFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        followRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [StreamerSettingsView] Accepted follow request from \(requesterEmail)")
                    } else {
                        errorMessage = response.message ?? "Failed to accept request"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func declineFollowRequest(_ requesterEmail: String) {
        guard let userEmail = authService.userEmail else { return }
        
        Task {
            do {
                let response = try await ChannelService.shared.declineFollowRequest(userEmail: userEmail, requesterEmail: requesterEmail)
                await MainActor.run {
                    if response.success {
                        // Remove from list
                        followRequests.removeAll { $0.requesterEmail == requesterEmail }
                        print("✅ [StreamerSettingsView] Declined follow request from \(requesterEmail)")
                    } else {
                        errorMessage = response.message ?? "Failed to decline request"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // MARK: - Account Visibility
    
    private func loadAccountVisibility() {
        guard let userEmail = authService.userEmail, !isLoadingAccountVisibility else {
            return
        }
        
        isLoadingAccountVisibility = true
        
        Task {
            do {
                let response = try await ChannelService.shared.getUsernameVisibility(userEmail: userEmail)
                await MainActor.run {
                    isLoadingAccountVisibility = false
                    // Default to public if not set
                    isPrivateAccount = !(response.isPublic ?? true)
                    print("✅ [StreamerSettingsView] Loaded account visibility: \(isPrivateAccount ? "private" : "public")")
                }
            } catch {
                await MainActor.run {
                    isLoadingAccountVisibility = false
                    print("❌ [StreamerSettingsView] Error loading account visibility: \(error)")
                    // Default to public on error
                    isPrivateAccount = false
                }
            }
        }
    }
    
    private func loadPremiumStatus() {
        guard let userEmail = authService.userEmail else {
            return
        }
        
        isLoadingPremiumStatus = true
        
        Task {
            do {
                let response = try await ChannelService.shared.getPremiumStatus(userEmail: userEmail)
                await MainActor.run {
                    isLoadingPremiumStatus = false
                    premiumStatus = response
                    isPremiumEnabled = response.isPremiumEnabled ?? false
                    print("✅ [StreamerSettingsView] Loaded Premium status: enabled=\(isPremiumEnabled), active=\(response.isPremium ?? false)")
                }
            } catch {
                await MainActor.run {
                    isLoadingPremiumStatus = false
                    print("❌ [StreamerSettingsView] Error loading Premium status: \(error)")
                }
            }
        }
    }
    
    private func disablePremium() {
        guard let userEmail = authService.userEmail else {
            return
        }
        
        Task {
            do {
                let response = try await ChannelService.shared.enablePremium(userEmail: userEmail, enable: false)
                await MainActor.run {
                    if response.success {
                        isPremiumEnabled = false
                        loadPremiumStatus() // Reload to get updated status
                    } else {
                        errorMessage = response.message ?? "Failed to disable Premium"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func updateAccountVisibility(_ isPrivate: Bool) {
        guard let userEmail = authService.userEmail, !isUpdatingAccountVisibility else {
            return
        }
        
        isUpdatingAccountVisibility = true
        let previousValue = isPrivateAccount
        
        // Update state immediately for responsive UI
        isPrivateAccount = isPrivate
        
        Task {
            do {
                // isPublic is the inverse of isPrivate
                let response = try await ChannelService.shared.setUsernameVisibility(userEmail: userEmail, isPublic: !isPrivate)
                await MainActor.run {
                    isUpdatingAccountVisibility = false
                    
                    if response.success {
                        print("✅ [StreamerSettingsView] Account visibility updated to: \(isPrivate ? "private" : "public")")
                    } else {
                        // Revert on failure
                        isPrivateAccount = previousValue
                        errorMessage = response.message ?? "Failed to update account visibility"
                    }
                }
            } catch {
                await MainActor.run {
                    isUpdatingAccountVisibility = false
                    // Revert on error
                    isPrivateAccount = previousValue
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
}

// Safari View Wrapper for SwiftUI
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }
    
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
    }
}
