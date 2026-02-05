//
//  ChatRepository.swift
//  share
//
//  Data access layer for chat messages using Supabase
//

import Foundation
import Supabase
import ExyteChat
import Realtime

// Type aliases to disambiguate from Realtime.Message
typealias ChatMessage = ExyteChat.Message
typealias ChatUser = ExyteChat.User
typealias ChatAttachment = ExyteChat.Attachment

@MainActor
final class ChatRepository {
    private let supabase: SupabaseClient
    private let storageBucket = "content"
    private let baseStorageURL: String

    init(supabase: SupabaseClient = SupabaseManager.shared.client) {
        self.supabase = supabase
        self.baseStorageURL = "https://zazsrepfnamdmibcyenx.supabase.co/storage/v1/object/public/\(storageBucket)/"
    }

    // MARK: - Fetch EPUBs

    /// Fetch EPUB books for a group
    func fetchEPUBs(groupId: String) async throws -> [EPUBItem] {
        let response: [EPUBItem] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("type", value: "epub")
            .order("created_at", ascending: false)
            .execute()
            .value

        print("✅ ChatRepository: Fetched \(response.count) EPUBs")
        return response
    }

    // MARK: - Fetch Highlights for URL

    /// Fetch highlight quotes for a URL in a group
    func fetchHighlightsForURL(url: String, groupId: String) async throws -> [String] {
        // 1. Find the content item for this URL
        let urlContents: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("data", value: url)
            .limit(1)
            .execute()
            .value

        guard let urlContent = urlContents.first else {
            print("ℹ️ ChatRepository: No content found for URL: \(url)")
            return []
        }

        // 2. Fetch highlight children
        let highlights: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("parent_content_id", value: urlContent.id)
            .eq("type", value: "highlight")
            .execute()
            .value

        print("✅ ChatRepository: Fetched \(highlights.count) highlights for URL")
        return highlights.map { $0.data }
    }

    // MARK: - Fetch Child Content (for Thread View)

    /// Fetch all child content for a parent content ID (highlights, notes, etc.)
    func fetchChildContent(parentId: String) async throws -> [ChatContent] {
        let response: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("parent_content_id", value: parentId)
            .order("created_at", ascending: true)
            .execute()
            .value

        print("✅ ChatRepository: Fetched \(response.count) child items for parent: \(parentId)")
        return response
    }

    /// Fetch count of child notes for a content ID
    func fetchNoteCount(parentId: String) async throws -> Int {
        let response: [ChatContent] = try await supabase
            .from("content")
            .select("id")
            .eq("parent_content_id", value: parentId)
            .eq("type", value: "note")
            .execute()
            .value

        return response.count
    }

    /// Fetch a single content item by ID
    func fetchContent(id: String) async throws -> ChatContent? {
        let response: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value

        return response.first
    }

    // MARK: - Create Child Content (Notes in Thread)

    /// Create a note as child of parent content
    func createChildContent(text: String, parentId: String, groupId: String) async throws -> ChatContent {
        guard let userId = await SupabaseManager.shared.userId else {
            throw ChatRepositoryError.notAuthenticated
        }

        let displayName = await SupabaseManager.shared.getCurrentUserDisplayName()

        let payload = NotePayload(
            data: text,
            group_id: groupId,
            user_id: userId,
            parent_content_id: parentId,
            metadata: ChatMessageMetadata(
                images: nil,
                sender_name: displayName,
                sender_avatar_url: nil
            )
        )

        let content: ChatContent = try await supabase
            .from("content")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value

        print("✅ ChatRepository: Created child content for parent: \(parentId)")
        return content
    }

    // MARK: - Subscribe to Child Content (Realtime for Thread)

    /// Subscribe to child content changes for a parent ID
    func subscribeToChildContent(
        parentId: String,
        onInsert: @escaping (ChatContent) -> Void,
        onDelete: @escaping (String) -> Void
    ) -> RealtimeChannelV2 {
        let channel = supabase.realtimeV2.channel("thread:\(parentId)")

        let insertions = channel.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "content",
            filter: "parent_content_id=eq.\(parentId)"
        )

        let deletions = channel.postgresChange(
            DeleteAction.self,
            schema: "public",
            table: "content",
            filter: "parent_content_id=eq.\(parentId)"
        )

        Task {
            for await insertion in insertions {
                do {
                    let content = try insertion.decodeRecord(as: ChatContent.self, decoder: JSONDecoder())
                    await MainActor.run {
                        onInsert(content)
                    }
                } catch {
                    print("❌ ChatRepository: Failed to decode child content: \(error)")
                }
            }
        }

        Task {
            for await deletion in deletions {
                if let id = deletion.oldRecord["id"]?.stringValue {
                    await MainActor.run {
                        onDelete(id)
                    }
                }
            }
        }

        Task {
            await channel.subscribe()
            print("✅ ChatRepository: Subscribed to realtime for thread: \(parentId)")
        }

        return channel
    }

    // MARK: - Create Highlight

    /// Create a highlight for a URL
    func createHighlight(quote: String, forURL url: String, groupId: String) async throws {
        guard let userId = await SupabaseManager.shared.userId else {
            throw ChatRepositoryError.notAuthenticated
        }

        // Find the content item for this URL
        let urlContents: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("data", value: url)
            .limit(1)
            .execute()
            .value

        guard let urlContent = urlContents.first else {
            print("⚠️ ChatRepository: No content found for URL, cannot create highlight")
            return
        }

        // Create highlight as child of the URL content
        let payload = HighlightPayload(
            data: quote,
            group_id: groupId,
            user_id: userId,
            parent_content_id: urlContent.id
        )

        try await supabase
            .from("content")
            .insert(payload)
            .execute()

        print("✅ ChatRepository: Created highlight for URL")
    }

    // MARK: - Fetch Messages

    /// Fetch chat messages for a group
    func fetchMessages(groupId: String, limit: Int = 100) async throws -> [ChatContent] {
        let response: [ChatContent] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("type", value: "chat_message")
            .order("created_at", ascending: true)
            .limit(limit)
            .execute()
            .value

        print("✅ ChatRepository: Fetched \(response.count) messages")
        return response
    }

    // MARK: - Send Message

    /// Send a new chat message
    func sendMessage(text: String, groupId: String, images: [Data]? = nil) async throws -> ChatContent {
        guard let userId = await SupabaseManager.shared.userId else {
            throw ChatRepositoryError.notAuthenticated
        }

        let displayName = await SupabaseManager.shared.getCurrentUserDisplayName()

        // 1. Create content record first (without images) to get a valid content ID
        let initialPayload = ChatMessagePayload(
            data: text,
            group_id: groupId,
            user_id: userId,
            metadata: ChatMessageMetadata(
                images: nil,
                sender_name: displayName,
                sender_avatar_url: nil
            )
        )

        let content: ChatContent = try await supabase
            .from("content")
            .insert(initialPayload)
            .select()
            .single()
            .execute()
            .value

        // 2. Upload images using content ID as path prefix
        var imageRefs: [ChatImageReference] = []
        if let images = images, !images.isEmpty {
            for (index, imageData) in images.enumerated() {
                let path = try await uploadImage(imageData, contentId: content.id, index: index)
                imageRefs.append(ChatImageReference(storage_path: path, width: nil, height: nil))
            }

            // 3. Update content with image references
            let updatedMetadata = ChatMessageMetadata(
                images: imageRefs,
                sender_name: displayName,
                sender_avatar_url: nil
            )

            try await supabase
                .from("content")
                .update(["metadata": updatedMetadata])
                .eq("id", value: content.id)
                .execute()
        }

        print("✅ ChatRepository: Message sent with ID: \(content.id)")
        return content
    }

    // MARK: - Upload Image

    /// Upload an image to Supabase Storage
    func uploadImage(_ imageData: Data, contentId: String, index: Int = 0) async throws -> String {
        // Use content ID for both folder and filename: {contentId}/{contentId}.jpg
        let filename = "\(contentId)/\(contentId).jpg"

        try await supabase.storage
            .from(storageBucket)
            .upload(
                path: filename,
                file: imageData,
                options: FileOptions(contentType: "image/jpeg")
            )

        print("✅ ChatRepository: Image uploaded to: \(filename)")
        return filename
    }

    // MARK: - Delete Message

    /// Delete a chat message
    func deleteMessage(id: String) async throws {
        try await supabase
            .from("content")
            .delete()
            .eq("id", value: id)
            .execute()

        print("✅ ChatRepository: Deleted message: \(id)")
    }

    // MARK: - Realtime Subscription

    /// Subscribe to chat messages for a group
    func subscribeToMessages(
        groupId: String,
        onInsert: @escaping (ChatContent) -> Void,
        onDelete: @escaping (String) -> Void
    ) -> RealtimeChannelV2 {
        let channel = supabase.realtimeV2.channel("chat:\(groupId)")

        let insertions = channel.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "content",
            filter: "group_id=eq.\(groupId)"
        )

        let deletions = channel.postgresChange(
            DeleteAction.self,
            schema: "public",
            table: "content",
            filter: "group_id=eq.\(groupId)"
        )

        Task {
            for await insertion in insertions {
                // Decode the inserted record
                do {
                    let content = try insertion.decodeRecord(as: ChatContent.self, decoder: JSONDecoder())
                    // Only process chat_message type
                    if content.type == "chat_message" {
                        await MainActor.run {
                            onInsert(content)
                        }
                    }
                } catch {
                    print("❌ ChatRepository: Failed to decode inserted message: \(error)")
                }
            }
        }

        Task {
            for await deletion in deletions {
                if let id = deletion.oldRecord["id"]?.stringValue {
                    await MainActor.run {
                        onDelete(id)
                    }
                }
            }
        }

        Task {
            await channel.subscribe()
            print("✅ ChatRepository: Subscribed to realtime for group: \(groupId)")
        }

        return channel
    }

    // MARK: - Message Mapping

    /// Convert ChatContent to ExyteChat Message
    func mapToExyteChatMessage(_ content: ChatContent, currentUserId: String?) async -> ChatMessage {
        // Ensure we have a valid user ID for comparison (fallback if nil)
        let effectiveUserId: String?
        if let currentUserId = currentUserId {
            effectiveUserId = currentUserId
        } else {
            effectiveUserId = await SupabaseManager.shared.userId
        }
        let isCurrentUser = content.user_id == effectiveUserId

        let user = ChatUser(
            id: content.user_id,
            name: content.metadata?.sender_name ?? "User",
            avatarURL: content.metadata?.sender_avatar_url.flatMap { URL(string: $0) },
            isCurrentUser: isCurrentUser
        )

        // Parse ISO8601 date
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var createdAt = formatter.date(from: content.created_at)
        if createdAt == nil {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            createdAt = formatter.date(from: content.created_at)
        }

        // Build attachments from metadata images
        let attachments: [ChatAttachment] = content.metadata?.images?.compactMap { imageRef in
            guard let url = URL(string: baseStorageURL + imageRef.storage_path) else { return nil }
            return ChatAttachment(
                id: UUID().uuidString,
                url: url,
                type: .image
            )
        } ?? []

        return ChatMessage(
            id: content.id,
            user: user,
            status: .sent,
            createdAt: createdAt ?? Date(),
            text: content.data,
            attachments: attachments
        )
    }
}

// MARK: - Errors

enum ChatRepositoryError: LocalizedError {
    case notAuthenticated
    case messageSendFailed(Error)
    case imageUploadFailed(Error)
    case fetchFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to use chat"
        case .messageSendFailed(let error):
            return "Failed to send message: \(error.localizedDescription)"
        case .imageUploadFailed(let error):
            return "Failed to upload image: \(error.localizedDescription)"
        case .fetchFailed(let error):
            return "Failed to load messages: \(error.localizedDescription)"
        }
    }
}
