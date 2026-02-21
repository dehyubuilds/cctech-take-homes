//
//  ScheduleAirdateView.swift
//  TwillyBroadcaster
//
//  Admin view for scheduling videos to air
//

import SwiftUI

struct ScheduleAirdateView: View {
    let content: ChannelContent
    let channelName: String
    let userEmail: String
    let onScheduled: () -> Void
    
    @Environment(\.dismiss) var dismiss
    @ObservedObject var channelService = ChannelService.shared
    
    @State private var selectedDate = Date()
    @State private var selectedTime = Date()
    @State private var isScheduling = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    
    private var scheduledDateTime: Date {
        let calendar = Calendar.current
        let dateComponents = calendar.dateComponents([.year, .month, .day], from: selectedDate)
        let timeComponents = calendar.dateComponents([.hour, .minute], from: selectedTime)
        
        var combinedComponents = DateComponents()
        combinedComponents.year = dateComponents.year
        combinedComponents.month = dateComponents.month
        combinedComponents.day = dateComponents.day
        combinedComponents.hour = timeComponents.hour
        combinedComponents.minute = timeComponents.minute
        
        return calendar.date(from: combinedComponents) ?? Date()
    }
    
    private var isValid: Bool {
        scheduledDateTime > Date()
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
                        // Video Info
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Schedule Video")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            
                            if let title = content.title, !title.isEmpty {
                                Text(title)
                                    .font(.headline)
                                    .foregroundColor(.white.opacity(0.9))
                            } else {
                                Text(content.fileName)
                                    .font(.headline)
                                    .foregroundColor(.white.opacity(0.9))
                            }
                            
                            Text("Channel: \(channelName)")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Date Picker
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Select Date")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            DatePicker(
                                "Date",
                                selection: $selectedDate,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.compact)
                            .accentColor(.twillyTeal)
                            .colorScheme(.dark)
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Time Picker
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Select Time")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            DatePicker(
                                "Time",
                                selection: $selectedTime,
                                displayedComponents: .hourAndMinute
                            )
                            .datePickerStyle(.wheel)
                            .accentColor(.twillyTeal)
                            .colorScheme(.dark)
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Scheduled Time Display
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Scheduled For")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Text(scheduledDateTime.formatted(date: .abbreviated, time: .shortened))
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.twillyTeal, .twillyCyan],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                            
                            if !isValid {
                                Text("⚠️ Date must be in the future")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Error/Success Messages
                        if let error = errorMessage {
                            Text(error)
                                .font(.subheadline)
                                .foregroundColor(.red)
                                .padding()
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        if let success = successMessage {
                            Text(success)
                                .font(.subheadline)
                                .foregroundColor(.green)
                                .padding()
                                .background(Color.green.opacity(0.1))
                                .cornerRadius(8)
                        }
                        
                        // Schedule Button
                        Button(action: scheduleAirdate) {
                            HStack {
                                if isScheduling {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    Text("Scheduling...")
                                } else {
                                    Text("Schedule Video")
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
                        .disabled(isScheduling || !isValid)
                        .opacity((isScheduling || !isValid) ? 0.6 : 1.0)
                        
                        // Make Visible Immediately Button
                        Button(action: makeVisibleImmediately) {
                            Text("Make Visible Immediately")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.white.opacity(0.8))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.white.opacity(0.1))
                                .cornerRadius(12)
                        }
                        .disabled(isScheduling)
                        .opacity(isScheduling ? 0.6 : 1.0)
                    }
                    .padding()
                }
            }
            .navigationTitle("Schedule Video")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
        }
    }
    
    private func scheduleAirdate() {
        guard isValid else {
            errorMessage = "Please select a future date and time"
            return
        }
        
        isScheduling = true
        errorMessage = nil
        successMessage = nil
        
        Task {
            do {
                // First update the airdate in DynamoDB
                let updateResponse = try await channelService.updateFileDetails(
                    fileId: content.SK,
                    userId: userEmail,
                    title: content.title,
                    description: content.description,
                    price: content.price ?? 0,
                    isVisible: false, // Keep hidden until airdate
                    airdate: scheduledDateTime
                )
                
                if !updateResponse.success {
                    throw NSError(domain: "ScheduleAirdateView", code: 1, userInfo: [NSLocalizedDescriptionKey: updateResponse.message ?? "Failed to update airdate"])
                }
                
                // Then trigger the Step Function for future scheduling
                let scheduleResponse = try await channelService.scheduleAirdate(
                    episodeId: content.SK,
                    userId: userEmail,
                    seriesName: channelName,
                    airdate: scheduledDateTime
                )
                
                await MainActor.run {
                    isScheduling = false
                    if scheduleResponse.success {
                        successMessage = "Video scheduled successfully!"
                        // Dismiss after a short delay
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            onScheduled()
                            dismiss()
                        }
                    } else {
                        errorMessage = scheduleResponse.message ?? "Failed to schedule video"
                    }
                }
            } catch {
                await MainActor.run {
                    isScheduling = false
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func makeVisibleImmediately() {
        isScheduling = true
        errorMessage = nil
        successMessage = nil
        
        Task {
            do {
                let response = try await channelService.updateFileDetails(
                    fileId: content.SK,
                    userId: userEmail,
                    title: content.title,
                    description: content.description,
                    price: content.price ?? 0,
                    isVisible: true,
                    airdate: nil // Clear any existing airdate
                )
                
                await MainActor.run {
                    isScheduling = false
                    if response.success {
                        successMessage = "Video made visible immediately!"
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            onScheduled()
                            dismiss()
                        }
                    } else {
                        errorMessage = response.message ?? "Failed to make video visible"
                    }
                }
            } catch {
                await MainActor.run {
                    isScheduling = false
                    errorMessage = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
}
