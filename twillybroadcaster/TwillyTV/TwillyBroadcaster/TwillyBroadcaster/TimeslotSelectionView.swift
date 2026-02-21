//
//  TimeslotSelectionView.swift
//  TwillyBroadcaster
//
//  View for non-admin users to select timeslots and get RTMP keys
//

import SwiftUI

struct TimeslotSelectionView: View {
    @ObservedObject var authService = AuthService.shared
    @State private var availableTimeslots: [Timeslot] = []
    @State private var selectedTimeslot: Timeslot? = nil
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingRTMPKey = false
    @State private var rtmpKey: String? = nil
    @State private var rtmpURL: String? = nil
    
    private var userEmail: String {
        authService.userEmail ?? ""
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
                        // Header
                        VStack(spacing: 8) {
                            Image(systemName: "tv.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.twillyTeal)
                            Text("Twilly TV")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text("Select your timeslot to get your RTMP key")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 40)
                        .padding(.bottom, 20)
                        
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .twillyTeal))
                                .scaleEffect(1.5)
                                .padding(.vertical, 40)
                        } else if let error = errorMessage {
                            VStack(spacing: 12) {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.title)
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
                            .padding()
                        } else if availableTimeslots.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "calendar.badge.exclamationmark")
                                    .font(.title)
                                    .foregroundColor(.gray)
                                Text("No available timeslots")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("Check back later for available streaming times")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                            }
                            .padding()
                        } else {
                            // Timeslot selection
                            VStack(alignment: .leading, spacing: 16) {
                                Text("Available Timeslots")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .padding(.horizontal)
                                
                                ForEach(availableTimeslots) { timeslot in
                                    TimeslotRow(
                                        timeslot: timeslot,
                                        isSelected: selectedTimeslot?.id == timeslot.id
                                    ) {
                                        selectTimeslot(timeslot)
                                    }
                                }
                            }
                            .padding(.horizontal)
                            
                            // RTMP Key Display
                            if showingRTMPKey, let key = rtmpKey, let url = rtmpURL {
                                VStack(spacing: 16) {
                                    Divider()
                                        .background(Color.gray.opacity(0.3))
                                        .padding(.vertical)
                                    
                                    VStack(alignment: .leading, spacing: 12) {
                                        Text("Your RTMP Configuration")
                                            .font(.headline)
                                            .foregroundColor(.white)
                                        
                                        VStack(alignment: .leading, spacing: 8) {
                                            Text("RTMP URL:")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                            Text(url)
                                                .font(.system(.body, design: .monospaced))
                                                .foregroundColor(.twillyTeal)
                                                .padding()
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .background(Color.black.opacity(0.6))
                                                .cornerRadius(8)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 8) {
                                            Text("Stream Key:")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                            Text(key)
                                                .font(.system(.body, design: .monospaced))
                                                .foregroundColor(.twillyTeal)
                                                .padding()
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .background(Color.black.opacity(0.6))
                                                .cornerRadius(8)
                                        }
                                        
                                        Button(action: {
                                            UIPasteboard.general.string = "\(url)/\(key)"
                                            // Show success message
                                        }) {
                                            HStack {
                                                Image(systemName: "doc.on.doc")
                                                Text("Copy Full RTMP URL")
                                            }
                                            .font(.subheadline)
                                            .foregroundColor(.white)
                                            .frame(maxWidth: .infinity)
                                            .padding()
                                            .background(Color.twillyTeal)
                                            .cornerRadius(8)
                                        }
                                    }
                                    .padding()
                                    .background(Color.black.opacity(0.4))
                                    .cornerRadius(12)
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Select Timeslot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        // Dismiss
                    }
                    .foregroundColor(.twillyTeal)
                }
            }
        }
        .onAppear {
            loadTimeslots()
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
                // TODO: Call API to reserve timeslot and get RTMP key
                // For now, show mock RTMP key
                await MainActor.run {
                    rtmpKey = "sk_test_\(UUID().uuidString.prefix(16))"
                    rtmpURL = "rtmp://100.24.103.57:1935/live"
                    showingRTMPKey = true
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to reserve timeslot: \(error.localizedDescription)"
                }
            }
        }
    }
}

struct Timeslot: Identifiable {
    let id: String
    let date: String
    let time: String
    let status: String // "available", "reserved", "live", "completed"
}

struct TimeslotRow: View {
    let timeslot: Timeslot
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(formatDate(timeslot.date))
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                    Text(timeslot.time)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.twillyTeal)
                        .font(.system(size: 20))
                } else {
                    Image(systemName: "circle")
                        .foregroundColor(.gray.opacity(0.5))
                        .font(.system(size: 20))
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .background(isSelected ? Color.twillyTeal.opacity(0.15) : Color.clear)
            .overlay(
                Rectangle()
                    .frame(height: 0.5)
                    .foregroundColor(Color.white.opacity(0.1)),
                alignment: .bottom
            )
        }
        .buttonStyle(.plain)
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: dateString) {
            formatter.dateFormat = "EEEE, MMM d"
            return formatter.string(from: date)
        }
        return dateString
    }
}
