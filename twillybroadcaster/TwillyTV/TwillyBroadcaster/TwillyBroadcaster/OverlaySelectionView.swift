//
//  OverlaySelectionView.swift
//  TwillyBroadcaster
//
//  UI for selecting stream overlays/watermarks
//

import SwiftUI

struct OverlaySelectionView: View {
    @ObservedObject var overlayManager = OverlayManager.shared
    @Environment(\.dismiss) var dismiss
    @ObservedObject var streamManager: StreamManager
    
    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Select Overlay")) {
                    // No overlay option
                    Button(action: {
                        overlayManager.deselectOverlay()
                        streamManager.setOverlay(nil)
                    }) {
                        HStack {
                            Image(systemName: overlayManager.selectedOverlayId == nil ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(overlayManager.selectedOverlayId == nil ? .green : .gray)
                            Text("No Overlay")
                                .foregroundColor(.primary)
                            Spacer()
                        }
                    }
                    
                    // Available overlays
                    ForEach(overlayManager.overlays) { overlay in
                        Button(action: {
                            print("🔍 [UI] User selected overlay: \(overlay.name)")
                            overlayManager.selectOverlay(overlay)
                            streamManager.setOverlay(overlay)
                        }) {
                            HStack {
                                // Overlay preview
                                if let image = overlay.getImage() {
                                    Image(uiImage: image)
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .frame(width: 60, height: 30)
                                        .background(Color.gray.opacity(0.2))
                                        .cornerRadius(4)
                                } else {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.gray.opacity(0.2))
                                        .frame(width: 60, height: 30)
                                }
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(overlay.name)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    if overlay.isDefault {
                                        Text("Default")
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                }
                                
                                Spacer()
                                
                                if overlayManager.selectedOverlayId == overlay.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Select Overlay")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

