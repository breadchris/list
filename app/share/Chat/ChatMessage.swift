//
//  ChatMessage.swift
//  share
//
//  Data models for Supabase content table mapping
//

import Foundation

/// Represents a chat message stored in Supabase content table
struct ChatContent: Codable, Identifiable {
    let id: String
    let created_at: String
    let updated_at: String?
    let type: String  // "chat_message"
    let data: String  // Message text
    let group_id: String
    let user_id: String
    let parent_content_id: String?
    let metadata: ChatMessageMetadata?
}

/// Metadata for chat messages
struct ChatMessageMetadata: Codable {
    let images: [ChatImageReference]?
    let sender_name: String?
    let sender_avatar_url: String?

    enum CodingKeys: String, CodingKey {
        case images
        case sender_name
        case sender_avatar_url
    }
}

/// Reference to an uploaded image in Supabase Storage
struct ChatImageReference: Codable {
    let storage_path: String
    let width: Int?
    let height: Int?
}

/// Payload for inserting new chat messages
struct ChatMessagePayload: Encodable {
    let type: String = "chat_message"
    let data: String
    let group_id: String
    let user_id: String
    let metadata: ChatMessageMetadata?
}

/// Payload for inserting highlights
struct HighlightPayload: Encodable {
    let type: String = "highlight"
    let data: String  // The highlighted quote text
    let group_id: String
    let user_id: String
    let parent_content_id: String  // ID of the URL content this highlight belongs to
}

/// Payload for inserting notes/comments as child content in threads
struct NotePayload: Encodable {
    let type: String = "note"
    let data: String  // The note text
    let group_id: String
    let user_id: String
    let parent_content_id: String  // ID of the parent content (URL, etc.)
    let metadata: ChatMessageMetadata?
}

/// Group info for the group selector
struct GroupInfo: Codable, Identifiable {
    let id: String
    let name: String?
    let created_at: String?
}
