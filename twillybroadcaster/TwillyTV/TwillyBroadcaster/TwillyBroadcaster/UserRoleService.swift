//
//  UserRoleService.swift
//  TwillyBroadcaster
//
//  Service to check user roles (admin/producer, collaborator)
//

import Foundation

// Admin email - only this user can be producer/admin
private let ADMIN_EMAIL = "dehyu.sinyan@gmail.com"

struct CollaboratorRole: Codable {
    let channelId: String
    let channelName: String
    let streamKey: String?
    let joinedAt: String?
    let status: String?
    let role: String?
}

struct UserRoles: Codable {
    let isAdmin: Bool
    let isCollaborator: Bool
    let collaboratorChannels: [CollaboratorRole]
}

class UserRoleService: ObservableObject {
    static let shared = UserRoleService()
    private init() {}
    
    // Check if user is admin/producer
    func isAdmin(userEmail: String) -> Bool {
        return userEmail.lowercased() == ADMIN_EMAIL.lowercased()
    }
    
    // Fetch user's collaborator roles from API
    func fetchCollaboratorRoles(userId: String, userEmail: String, username: String? = nil) async throws -> [CollaboratorRole] {
        guard let url = URL(string: "https://twilly.app/api/collaborations/get-user-roles") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "userId": userId,
            "userEmail": userEmail
        ]
        
        if let username = username {
            body["username"] = username
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool, success,
           let roles = json["roles"] as? [[String: Any]] {
            
            print("📋 [UserRoleService] API returned \(roles.count) roles")
            let parsedRoles = roles.compactMap { roleDict -> CollaboratorRole? in
                guard let channelId = roleDict["channelId"] as? String,
                      let channelName = roleDict["channelName"] as? String else {
                    print("⚠️ [UserRoleService] Skipping invalid role: \(roleDict)")
                    return nil
                }
                
                print("   ✅ Role: \(channelName) (ID: \(channelId), PK: \(roleDict["pk"] as? String ?? "N/A"), SK: \(roleDict["sk"] as? String ?? "N/A"))")
                
                return CollaboratorRole(
                    channelId: channelId,
                    channelName: channelName,
                    streamKey: roleDict["streamKey"] as? String,
                    joinedAt: roleDict["joinedAt"] as? String,
                    status: roleDict["status"] as? String,
                    role: roleDict["role"] as? String
                )
            }
            
            print("📋 [UserRoleService] Parsed \(parsedRoles.count) valid collaborator roles")
            parsedRoles.forEach { role in
                print("   📺 Channel: \(role.channelName)")
            }
            
            return parsedRoles
        }
        
        print("⚠️ [UserRoleService] API response was not successful or missing roles")
        return []
    }
    
    // Check if user has any collaborator access
    func hasCollaboratorAccess(userId: String, userEmail: String) async -> Bool {
        do {
            let roles = try await fetchCollaboratorRoles(userId: userId, userEmail: userEmail)
            return !roles.isEmpty || isAdmin(userEmail: userEmail)
        } catch {
            print("⚠️ [UserRoleService] Error checking collaborator access: \(error.localizedDescription)")
            // If admin, always return true
            return isAdmin(userEmail: userEmail)
        }
    }
    
    // Get all user roles
    func getUserRoles(userId: String, userEmail: String) async -> UserRoles {
        let isAdminUser = isAdmin(userEmail: userEmail)
        
        do {
            let collaboratorChannels = try await fetchCollaboratorRoles(userId: userId, userEmail: userEmail)
            return UserRoles(
                isAdmin: isAdminUser,
                isCollaborator: !collaboratorChannels.isEmpty || isAdminUser,
                collaboratorChannels: collaboratorChannels
            )
        } catch {
            print("⚠️ [UserRoleService] Error fetching roles: \(error.localizedDescription)")
            return UserRoles(
                isAdmin: isAdminUser,
                isCollaborator: isAdminUser,
                collaboratorChannels: []
            )
        }
    }
}
