//
//  VideoDetailsFormView.swift
//  TwillyBroadcaster
//
//  Form for entering video details (Title, Description, Price) before upload
//

import SwiftUI

struct VideoDetailsFormView: View {
    @Binding var title: String
    @Binding var description: String
    @Binding var price: String
    
    let onSave: () -> Void
    let onCancel: () -> Void
    
    @FocusState private var focusedField: Field?
    
    enum Field {
        case title, description, price
    }
    
    var body: some View {
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
                    // Header - Twilly themed
                    VStack(spacing: 8) {
                        Text("Video Details")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundStyle(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.twillyTeal,
                                        Color.twillyCyan,
                                        Color.twillyTeal
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .shadow(color: Color.twillyCyan.opacity(0.5), radius: 4, x: 0, y: 2)
                        
                        Text("All fields are optional")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .padding(.top, 20)
                    
                    // Form fields
                    VStack(spacing: 20) {
                        // Title field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Title (Optional)")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            TextField("Enter video title", text: $title)
                                .textFieldStyle(CustomTextFieldStyle())
                                .focused($focusedField, equals: .title)
                                .submitLabel(.next)
                                .onSubmit {
                                    // Only move to next field, never auto-submit
                                    focusedField = .description
                                }
                        }
                        
                        // Description field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description (Optional)")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            ZStack(alignment: .topLeading) {
                                // Background layer (covers TextEditor's default background on iOS 15)
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.black.opacity(0.3))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
                                    )
                                
                                // TextEditor with transparent background
                                TextEditor(text: $description)
                                    .frame(minHeight: 120)
                                    .padding(12)
                                    .background(Color.clear)
                                    .foregroundColor(.white)
                                    .focused($focusedField, equals: .description)
                                    // TextEditor doesn't support onSubmit, so no auto-submit
                            }
                            
                            if description.isEmpty {
                                Text("Enter video description")
                                    .foregroundColor(.white.opacity(0.4))
                                    .padding(.leading, 16)
                                    .padding(.top, -100)
                                    .allowsHitTesting(false)
                            }
                        }
                        
                        // Price field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Price ($)")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            HStack {
                                Text("$")
                                    .foregroundColor(.white.opacity(0.7))
                                    .font(.headline)
                                
                                TextField("0.00", text: $price)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(CustomTextFieldStyle())
                                    .focused($focusedField, equals: .price)
                                    .submitLabel(.done)
                                    .onSubmit {
                                        // Don't auto-submit - user must click button
                                        focusedField = nil
                                    }
                            }
                            
                            Text("Optional - leave empty for free content")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                    .padding(.horizontal, 20)
                    
                    // Action buttons
                    VStack(spacing: 12) {
                        Button(action: onSave) {
                            HStack {
                                Text("Post")
                                    .fontWeight(.semibold)
                                Image(systemName: "arrow.up.circle.fill")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.twillyTeal, Color.twillyCyan]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(16)
                            .shadow(color: Color.twillyTeal.opacity(0.3), radius: 8, x: 0, y: 4)
                        }
                            // Always enabled since all fields are optional
                        
                        Button(action: onCancel) {
                            Text("Cancel")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .onTapGesture {
            // Dismiss keyboard when tapping outside
            focusedField = nil
        }
        // Prevent any auto-submit behavior - only submit when button is explicitly clicked
        .interactiveDismissDisabled(false) // Allow swipe down to dismiss
    }
}

struct CustomTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(12)
            .background(Color.black.opacity(0.3))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.twillyTeal.opacity(0.3), lineWidth: 1)
            )
            .foregroundColor(.white)
    }
}

