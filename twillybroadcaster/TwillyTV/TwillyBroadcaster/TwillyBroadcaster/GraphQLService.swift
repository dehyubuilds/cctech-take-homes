//
//  GraphQLService.swift
//  TwillyBroadcaster
//
//  GraphQL service for fast, cached reads from AWS AppSync
//  Uploads still use REST API
//

import Foundation

// GraphQL Query Strings
struct GraphQLQueries {
    static let discoverableChannels = """
    query DiscoverableChannels($limit: Int, $nextToken: String) {
      discoverableChannels(limit: $limit, nextToken: $nextToken) {
        channels {
          channelId
          channelName
          creatorEmail
          creatorUsername
          description
          posterUrl
          visibility
          isPublic
          subscriptionPrice
          contentType
        }
        nextToken
      }
    }
    """
    
    static let myChannels = """
    query MyChannels($creatorEmail: String!) {
      myChannels(creatorEmail: $creatorEmail) {
        channelId
        channelName
        visibility
        subscriptionPrice
        description
        category
        posterUrl
        createdAt
        updatedAt
        creatorUsername
      }
    }
    """
    
    static let channelContent = """
    query ChannelContent($channelName: String!, $creatorEmail: String!, $limit: Int, $nextToken: String) {
      channelContent(channelName: $channelName, creatorEmail: $creatorEmail, limit: $limit, nextToken: $nextToken) {
        content {
          SK
          fileName
          title
          description
          hlsUrl
          thumbnailUrl
          createdAt
          isVisible
          price
          category
        }
        count
        nextToken
      }
    }
    """
}

class GraphQLService {
    static let shared = GraphQLService()
    
    // TODO: Replace with your AppSync endpoint and API key
    private let graphQLEndpoint: String = "YOUR_APPSYNC_ENDPOINT_HERE"
    private let apiKey: String = "YOUR_API_KEY_HERE"
    
    private init() {}
    
    // MARK: - GraphQL Request Helper
    
    private func executeQuery<T: Decodable>(query: String, variables: [String: Any]? = nil) async throws -> T {
        guard let url = URL(string: graphQLEndpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        
        var body: [String: Any] = ["query": query]
        if let variables = variables {
            body["variables"] = variables
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [GraphQLService] Request failed - status: \(statusCode), error: \(errorMessage)")
            throw URLError(.badServerResponse)
        }
        
        // Parse GraphQL response
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let errors = json["errors"] as? [[String: Any]], !errors.isEmpty {
            let errorMessage = errors.first?["message"] as? String ?? "GraphQL error"
            print("❌ [GraphQLService] GraphQL error: \(errorMessage)")
            throw NSError(domain: "GraphQLService", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }
    
    // MARK: - Public Methods
    
    func fetchDiscoverableChannels(limit: Int = 50, nextToken: String? = nil) async throws -> [DiscoverableChannel] {
        struct Response: Decodable {
            let data: DataWrapper
        }
        
        struct DataWrapper: Decodable {
            let discoverableChannels: DiscoverableChannelsResult
        }
        
        struct DiscoverableChannelsResult: Decodable {
            let channels: [DiscoverableChannel]
            let nextToken: String?
        }
        
        let variables: [String: Any] = [
            "limit": limit,
            "nextToken": nextToken as Any
        ].compactMapValues { $0 }
        
        let response: Response = try await executeQuery(
            query: GraphQLQueries.discoverableChannels,
            variables: variables
        )
        
        return response.data.discoverableChannels.channels
    }
    
    func fetchMyChannels(creatorEmail: String) async throws -> [MyChannel] {
        struct Response: Decodable {
            let data: DataWrapper
        }
        
        struct DataWrapper: Decodable {
            let myChannels: [MyChannel]
        }
        
        let variables: [String: Any] = [
            "creatorEmail": creatorEmail
        ]
        
        let response: Response = try await executeQuery(
            query: GraphQLQueries.myChannels,
            variables: variables
        )
        
        return response.data.myChannels
    }
    
    func fetchChannelContent(
        channelName: String,
        creatorEmail: String,
        limit: Int = 50,
        nextToken: String? = nil
    ) async throws -> [ChannelContent] {
        struct Response: Decodable {
            let data: DataWrapper
        }
        
        struct DataWrapper: Decodable {
            let channelContent: ChannelContentResult
        }
        
        struct ChannelContentResult: Decodable {
            let content: [ChannelContent]
            let count: Int
            let nextToken: String?
        }
        
        let variables: [String: Any] = [
            "channelName": channelName,
            "creatorEmail": creatorEmail,
            "limit": limit,
            "nextToken": nextToken as Any
        ].compactMapValues { $0 }
        
        let response: Response = try await executeQuery(
            query: GraphQLQueries.channelContent,
            variables: variables
        )
        
        return response.data.channelContent.content
    }
}


