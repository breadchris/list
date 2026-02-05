//
//  SupabaseManager.swift
//  share
//
//  Singleton wrapper for Supabase Swift SDK client
//  Provides authenticated access to Supabase with shared Keychain storage
//

import Foundation
import Supabase

final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: "https://zazsrepfnamdmibcyenx.supabase.co")!,
            supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM",
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: KeychainAuthStorage(),
                    redirectToURL: URL(string: "list://auth/success"),
                    flowType: .pkce
                )
            )
        )

        print("✅ SupabaseManager: Client initialized with PKCE flow and Keychain storage")
    }

    // MARK: - Convenience Methods

    /// Get the current session if authenticated
    var currentSession: Session? {
        get async {
            do {
                return try await client.auth.session
            } catch {
                print("❌ SupabaseManager: Failed to get session: \(error)")
                return nil
            }
        }
    }

    /// Get the current user if authenticated
    var currentUser: User? {
        get async {
            await currentSession?.user
        }
    }

    /// Check if user is authenticated
    var isAuthenticated: Bool {
        get async {
            await currentSession != nil
        }
    }

    /// Get user ID if authenticated
    var userId: String? {
        get async {
            await currentUser?.id.uuidString.lowercased()
        }
    }

    // MARK: - Database Operations

    /// Fetch the user's default group ID
    func getDefaultGroupId() async throws -> String? {
        guard let userId = await userId else {
            print("⚠️ SupabaseManager: No user ID available")
            return nil
        }

        struct GroupMembership: Decodable {
            let group_id: String
        }

        let response: GroupMembership = try await client
            .from("group_memberships")
            .select("group_id")
            .eq("user_id", value: userId)
            .limit(1)
            .single()
            .execute()
            .value

        print("✅ SupabaseManager: Found group ID: \(response.group_id)")
        return response.group_id
    }

    /// Fetch all groups the user is a member of
    func getUserGroups() async throws -> [GroupInfo] {
        guard let userId = await userId else {
            print("⚠️ SupabaseManager: No user ID available")
            return []
        }

        struct MembershipWithGroup: Decodable {
            let group_id: String
            let groups: GroupInfo
        }

        let response: [MembershipWithGroup] = try await client
            .from("group_memberships")
            .select("group_id, groups(id, name, created_at)")
            .eq("user_id", value: userId)
            .execute()
            .value

        let groups = response.map { $0.groups }
        print("✅ SupabaseManager: Found \(groups.count) groups")
        return groups
    }

    /// Get current user's display name (email prefix or "User")
    func getCurrentUserDisplayName() async -> String? {
        guard let user = await currentUser else { return nil }
        return user.email?.components(separatedBy: "@").first ?? "User"
    }

    /// Insert content to the database
    func insertContent(url: String, groupId: String, note: String? = nil) async throws {
        guard let userId = await userId else {
            throw SupabaseManagerError.notAuthenticated
        }

        struct ContentPayload: Encodable {
            let type: String
            let data: String
            let metadata: ContentMetadata
            let user_id: String
            let group_id: String
        }

        struct ContentMetadata: Encodable {
            let url: String
            let shared_from: String
            let note: String?
        }

        let payload = ContentPayload(
            type: "text",
            data: url,
            metadata: ContentMetadata(
                url: url,
                shared_from: "ios_share_extension",
                note: note
            ),
            user_id: userId,
            group_id: groupId
        )

        try await client
            .from("content")
            .insert(payload)
            .execute()

        print("✅ SupabaseManager: Content inserted successfully")
    }

    /// Send a chat message to the database (for background/share extension use)
    func sendChatMessage(text: String, groupId: String, sharedFrom: String? = nil) async throws {
        guard let userId = await userId else {
            throw SupabaseManagerError.notAuthenticated
        }

        struct ChatMessagePayload: Encodable {
            let type: String
            let data: String
            let group_id: String
            let user_id: String
            let metadata: ChatMessageMetadata
        }

        struct ChatMessageMetadata: Encodable {
            let sender_name: String?
            let shared_from: String?
        }

        let displayName = await getCurrentUserDisplayName()

        let payload = ChatMessagePayload(
            type: "chat_message",
            data: text,
            group_id: groupId,
            user_id: userId,
            metadata: ChatMessageMetadata(
                sender_name: displayName,
                shared_from: sharedFrom
            )
        )

        try await client
            .from("content")
            .insert(payload)
            .execute()

        print("✅ SupabaseManager: Chat message sent successfully")
    }
}

// MARK: - Errors

enum SupabaseManagerError: LocalizedError {
    case notAuthenticated
    case noGroupFound

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "User is not authenticated"
        case .noGroupFound:
            return "No group membership found for user"
        }
    }
}
