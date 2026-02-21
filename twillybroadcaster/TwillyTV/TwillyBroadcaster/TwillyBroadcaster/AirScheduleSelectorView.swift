//
//  AirScheduleSelectorView.swift
//  TwillyBroadcaster
//
//  View for selecting recurring air day and time (one-time, locked selection)
//

import SwiftUI

struct AirScheduleSelectorView: View {
    @ObservedObject var authService = AuthService.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var selectedDay: String? = nil
    @State private var selectedTime: String? = nil
    @State private var occupiedSlots: Set<String> = []
    @State private var isLoadingOccupied = false
    @State private var isSaving = false
    @State private var errorMessage: String? = nil
    @State private var showingConfirmation = false
    
    let onScheduleSaved: () -> Void
    
    private let daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    private let timeSlots = [
        "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
        "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
        "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
    ]
    
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
                        // Header
                        VStack(spacing: 12) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 48))
                                .foregroundColor(.twillyTeal)
                            
                            Text("Select Your Air Schedule")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            
                            Text("Choose a recurring day and time for your content to air. This selection cannot be changed once confirmed.")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        .padding(.top, 20)
                        
                        // Day Selection
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Select Day")
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                                ForEach(daysOfWeek, id: \.self) { day in
                                    let slotKey = "\(day)-\(selectedTime ?? "")"
                                    let isOccupied = !selectedTime.isNilOrEmpty && occupiedSlots.contains(slotKey)
                                    let isSelected = selectedDay == day
                                    
                                    Button(action: {
                                        if !isOccupied {
                                            selectedDay = day
                                        }
                                    }) {
                                        Text(day)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                            .foregroundColor(isOccupied ? .gray : (isSelected ? .white : .gray))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 12)
                                            .background(
                                                isOccupied
                                                    ? Color.gray.opacity(0.2)
                                                    : (isSelected ? Color.twillyTeal : Color.white.opacity(0.1))
                                            )
                                            .cornerRadius(8)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 8)
                                                    .stroke(
                                                        isOccupied
                                                            ? Color.gray.opacity(0.5)
                                                            : (isSelected ? Color.twillyTeal : Color.white.opacity(0.2)),
                                                        lineWidth: isSelected ? 2 : 1
                                                    )
                                            )
                                    }
                                    .disabled(isOccupied)
                                }
                            }
                            .padding(.horizontal)
                        }
                        
                        // Time Selection
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Select Time")
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                                ForEach(timeSlots, id: \.self) { time in
                                    let slotKey = "\(selectedDay ?? "")-\(time)"
                                    let isOccupied = !selectedDay.isNilOrEmpty && occupiedSlots.contains(slotKey)
                                    let isSelected = selectedTime == time
                                    
                                    Button(action: {
                                        if !isOccupied {
                                            selectedTime = time
                                            // Reload occupied slots when time changes
                                            Task {
                                                await loadOccupiedSlots()
                                            }
                                        }
                                    }) {
                                        Text(formatTime(time))
                                            .font(.caption)
                                            .fontWeight(.medium)
                                            .foregroundColor(isOccupied ? .gray : (isSelected ? .white : .gray))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 10)
                                            .background(
                                                isOccupied
                                                    ? Color.gray.opacity(0.2)
                                                    : (isSelected ? Color.twillyTeal : Color.white.opacity(0.1))
                                            )
                                            .cornerRadius(8)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 8)
                                                    .stroke(
                                                        isOccupied
                                                            ? Color.gray.opacity(0.5)
                                                            : (isSelected ? Color.twillyTeal : Color.white.opacity(0.2)),
                                                        lineWidth: isSelected ? 2 : 1
                                                    )
                                            )
                                    }
                                    .disabled(isOccupied)
                                }
                            }
                            .padding(.horizontal)
                        }
                        
                        // Error message
                        if let error = errorMessage {
                            Text(error)
                                .font(.subheadline)
                                .foregroundColor(.red)
                                .padding(.horizontal)
                        }
                        
                        // Confirm Button
                        Button(action: {
                            showingConfirmation = true
                        }) {
                            HStack {
                                if isSaving {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Confirm Schedule")
                                        .font(.system(size: 18, weight: .semibold))
                                }
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(
                                canConfirm
                                    ? LinearGradient(
                                        gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                    : LinearGradient(
                                        gradient: Gradient(colors: [Color.gray, Color.gray]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                            )
                            .cornerRadius(16)
                            .shadow(color: canConfirm ? Color.twillyCyan.opacity(0.3) : Color.clear, radius: 10, x: 0, y: 5)
                        }
                        .disabled(!canConfirm || isSaving)
                        .opacity(canConfirm ? 1.0 : 0.6)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 40)
                    }
                }
            }
            .navigationTitle("Air Schedule")
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
                Task {
                    await loadOccupiedSlots()
                }
            }
            .alert("Confirm Air Schedule", isPresented: $showingConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Confirm") {
                    saveSchedule()
                }
            } message: {
                if let day = selectedDay, let time = selectedTime {
                    Text("Your content will air every \(day) at \(formatTime(time)). This selection cannot be changed. Are you sure?")
                }
            }
        }
    }
    
    private var canConfirm: Bool {
        selectedDay != nil && selectedTime != nil && !isSaving
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
        return String(format: "%d:%02d %@", hour12, minute, amPm)
    }
    
    private func loadOccupiedSlots() async {
        print("🔄 [AirScheduleSelector] Starting to load occupied slots...")
        
        await MainActor.run {
            isLoadingOccupied = true
            errorMessage = nil // Clear any previous errors
        }
        
        do {
            let urlString = "https://twilly.app/api/air-schedule/occupied-slots"
            print("📡 [AirScheduleSelector] Requesting URL: \(urlString)")
            
            guard let url = URL(string: urlString) else {
                print("❌ [AirScheduleSelector] Invalid URL: \(urlString)")
                throw NSError(domain: "AirScheduleSelector", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            print("📤 [AirScheduleSelector] Sending POST request...")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [AirScheduleSelector] Invalid response type")
                throw NSError(domain: "AirScheduleSelector", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
            }
            
            print("📥 [AirScheduleSelector] Response status code: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode == 200 {
                if let responseString = String(data: data, encoding: .utf8) {
                    print("📄 [AirScheduleSelector] Response body: \(responseString)")
                }
                
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [AirScheduleSelector] Parsed JSON: \(json)")
                    
                    let success = json["success"] as? Bool ?? false
                    let occupied = json["occupiedSlots"] as? [String] ?? []
                    
                    print("📊 [AirScheduleSelector] Success: \(success), Occupied slots count: \(occupied.count)")
                    
                    if success {
                        await MainActor.run {
                            occupiedSlots = Set(occupied)
                            isLoadingOccupied = false
                            // Don't set error message if no slots are occupied - that's normal
                            if occupied.isEmpty {
                                print("ℹ️ [AirScheduleSelector] No occupied slots found - this is normal for a new system")
                            }
                        }
                    } else {
                        let message = json["message"] as? String ?? "Unknown error"
                        print("⚠️ [AirScheduleSelector] API returned success=false: \(message)")
                        // Don't show error if it's just that no slots are occupied
                        await MainActor.run {
                            occupiedSlots = Set<String>()
                            isLoadingOccupied = false
                        }
                    }
                } else {
                    print("❌ [AirScheduleSelector] Failed to parse JSON")
                    throw NSError(domain: "AirScheduleSelector", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to parse response"])
                }
            } else if httpResponse.statusCode == 404 {
                // 404 means endpoint doesn't exist yet (backend not deployed) or no slots exist
                // Treat this as "no slots occupied" - don't show error
                let responseString = String(data: data, encoding: .utf8) ?? "No response body"
                print("ℹ️ [AirScheduleSelector] Endpoint returned 404 (endpoint may not exist yet): \(responseString)")
                print("   Treating as 'no slots occupied' - this is normal if backend isn't deployed yet")
                await MainActor.run {
                    occupiedSlots = Set<String>()
                    isLoadingOccupied = false
                    // Don't set errorMessage - 404 is expected if backend isn't ready
                }
            } else {
                // Other HTTP errors (500, etc.) - show error
                let responseString = String(data: data, encoding: .utf8) ?? "No response body"
                print("❌ [AirScheduleSelector] HTTP error \(httpResponse.statusCode): \(responseString)")
                throw NSError(domain: "AirScheduleSelector", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server error: \(httpResponse.statusCode)"])
            }
        } catch {
            print("❌ [AirScheduleSelector] Error loading occupied slots: \(error)")
            print("   Error domain: \((error as NSError).domain)")
            print("   Error code: \((error as NSError).code)")
            print("   Error description: \(error.localizedDescription)")
            
            // Check if it's a 404 error that wasn't caught above
            let nsError = error as NSError
            let is404Error = nsError.code == 404
            let isNetworkError = nsError.domain == NSURLErrorDomain && nsError.code != -1003 // -1003 is hostname not found, which is also OK if backend isn't ready
            
            await MainActor.run {
                // Only show error for real server errors (500+), not 404 or hostname not found
                // 404 and hostname errors mean backend isn't ready yet - treat as "no slots occupied"
                if is404Error || nsError.code == -1003 {
                    print("ℹ️ [AirScheduleSelector] Backend endpoint not available (404 or hostname not found)")
                    print("   Treating as 'no slots occupied' - backend may not be deployed yet")
                    occupiedSlots = Set<String>()
                    isLoadingOccupied = false
                    // Don't set errorMessage
                } else if nsError.code >= 500 {
                    // Real server errors (500+) - show error
                    errorMessage = "Failed to load occupied slots: \(error.localizedDescription)"
                    occupiedSlots = Set<String>()
                    isLoadingOccupied = false
                } else {
                    // Other errors (parsing, etc.) - silently use empty set
                    print("ℹ️ [AirScheduleSelector] Using empty occupied slots set due to non-critical error")
                    occupiedSlots = Set<String>()
                    isLoadingOccupied = false
                }
            }
        }
    }
    
    private func saveSchedule() {
        guard let day = selectedDay,
              let time = selectedTime,
              let userEmail = authService.userEmail,
              let userId = authService.userId else {
            errorMessage = "Please select both day and time"
            return
        }
        
        isSaving = true
        errorMessage = nil
        
        Task {
            do {
                guard let url = URL(string: "https://twilly.app/api/air-schedule/save") else {
                    throw NSError(domain: "AirScheduleSelector", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "userEmail": userEmail,
                    "userId": userId,
                    "airDay": day,
                    "airTime": time
                ]
                
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw NSError(domain: "AirScheduleSelector", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
                }
                
                if httpResponse.statusCode == 200 {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = json["success"] as? Bool {
                        if success {
                            await MainActor.run {
                                isSaving = false
                                onScheduleSaved()
                                dismiss()
                            }
                        } else {
                            let message = json["message"] as? String ?? "Failed to save schedule"
                            throw NSError(domain: "AirScheduleSelector", code: 4, userInfo: [NSLocalizedDescriptionKey: message])
                        }
                    } else {
                        throw NSError(domain: "AirScheduleSelector", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to parse response"])
                    }
                } else {
                    let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                    let message = errorData?["message"] as? String ?? "Server error: \(httpResponse.statusCode)"
                    throw NSError(domain: "AirScheduleSelector", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSaving = false
                }
            }
        }
    }
}

// Helper extension for optional string
extension Optional where Wrapped == String {
    var isNilOrEmpty: Bool {
        return self == nil || self!.isEmpty
    }
}
