//
//  ConnectionManagementView.swift
//  TwillyBroadcaster
//
//  UI for managing multiple RTMP connections
//

import SwiftUI

struct ConnectionManagementView: View {
    @ObservedObject var connectionManager = StreamKeyManager.shared
    @Environment(\.dismiss) var dismiss
    
    @State private var showingAddConnection = false
    @State private var newConnectionName = ""
    @State private var newConnectionURL = ""
    @State private var editingConnection: StreamKey?
    @State private var editConnectionName = ""
    @State private var editConnectionURL = ""
    
    var body: some View {
        NavigationView {
            List {
                ForEach(connectionManager.streamKeys) { connection in
                    ConnectionRow(
                        connection: connection,
                        isSelected: connectionManager.selectedKeyId == connection.id,
                        onSelect: {
                            connectionManager.selectStreamKey(connection)
                        },
                        onEdit: {
                            editingConnection = connection
                            editConnectionName = connection.name
                            editConnectionURL = connection.url
                        },
                        onDelete: {
                            connectionManager.deleteStreamKey(connection)
                        }
                    )
                }
            }
            .navigationTitle("Connections")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingAddConnection = true
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddConnection) {
                AddConnectionView(
                    connectionName: $newConnectionName,
                    connectionURL: $newConnectionURL,
                    onSave: {
                        connectionManager.addStreamKey(name: newConnectionName, url: newConnectionURL)
                        newConnectionName = ""
                        newConnectionURL = ""
                        showingAddConnection = false
                    },
                    onCancel: {
                        newConnectionName = ""
                        newConnectionURL = ""
                        showingAddConnection = false
                    }
                )
            }
            .sheet(item: $editingConnection) { connection in
                EditConnectionView(
                    connection: connection,
                    connectionName: $editConnectionName,
                    connectionURL: $editConnectionURL,
                    onSave: {
                        if let editing = editingConnection {
                            connectionManager.updateStreamKeyName(editing, newName: editConnectionName)
                            connectionManager.updateStreamKeyURL(editing, newURL: editConnectionURL)
                        }
                        editingConnection = nil
                    },
                    onCancel: {
                        editingConnection = nil
                    }
                )
            }
        }
    }
}

struct ConnectionRow: View {
    let connection: StreamKey
    let isSelected: Bool
    let onSelect: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(connection.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                    if connection.isDefault {
                        Text("(Default)")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                Text(connection.url)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Edit button (visible for non-default connections)
                if !connection.isDefault {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                            .font(.system(size: 16))
                            .foregroundColor(.blue)
                            .padding(8)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                
                // Selection indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 20))
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if !connection.isDefault {
                Button(role: .destructive, action: onDelete) {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }
}

struct AddConnectionView: View {
    @Binding var connectionName: String
    @Binding var connectionURL: String
    let onSave: () -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Connection Details")) {
                    TextField("Connection Name", text: $connectionName)
                        .textInputAutocapitalization(.words)
                    
                    TextField("Full RTMP URL", text: $connectionURL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }
                
                Section(footer: Text("Enter the full RTMP URL (e.g., rtmp://server.com/live/stream_key)")) {
                    EmptyView()
                }
            }
            .navigationTitle("Add Connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save", action: onSave)
                        .disabled(connectionName.isEmpty || connectionURL.isEmpty)
                }
            }
        }
    }
}

struct EditConnectionView: View {
    let connection: StreamKey
    @Binding var connectionName: String
    @Binding var connectionURL: String
    let onSave: () -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Connection Details")) {
                    TextField("Connection Name", text: $connectionName)
                        .textInputAutocapitalization(.words)
                        .disabled(connection.isDefault)
                    
                    TextField("Full RTMP URL", text: $connectionURL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .disabled(connection.isDefault)
                }
                
                if connection.isDefault {
                    Section(footer: Text("The default connection cannot be edited or deleted.")) {
                        EmptyView()
                    }
                }
            }
            .navigationTitle("Edit Connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save", action: onSave)
                        .disabled(connectionName.isEmpty || connectionURL.isEmpty || connection.isDefault)
                }
            }
        }
    }
}

