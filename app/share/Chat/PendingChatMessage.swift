//
//  PendingChatMessage.swift
//  share
//
//  Model for offline-queued chat messages awaiting sync
//

import Foundation

struct PendingChatMessage: Codable, Identifiable, Equatable {
    let id: UUID
    let text: String
    let groupId: String
    let userId: String
    let senderName: String?
    let createdAt: Date
    let imageFilenames: [String]  // Local filenames for attached images (e.g., "0.jpg", "1.jpg")
    var retryCount: Int

    init(
        id: UUID = UUID(),
        text: String,
        groupId: String,
        userId: String,
        senderName: String? = nil,
        createdAt: Date = Date(),
        imageFilenames: [String] = [],
        retryCount: Int = 0
    ) {
        self.id = id
        self.text = text
        self.groupId = groupId
        self.userId = userId
        self.senderName = senderName
        self.createdAt = createdAt
        self.imageFilenames = imageFilenames
        self.retryCount = retryCount
    }

    /// Maximum number of retry attempts before marking as failed
    static let maxRetries = 5

    /// Check if message has exceeded retry limit
    var hasExceededRetryLimit: Bool {
        retryCount >= Self.maxRetries
    }

    /// Create a copy with incremented retry count
    func incrementingRetryCount() -> PendingChatMessage {
        var copy = self
        copy.retryCount = retryCount + 1
        return copy
    }
}

/// Status of a pending message in the UI
enum PendingMessageStatus: Equatable {
    case pending      // Queued, waiting to send
    case sending      // Currently being transmitted
    case sent         // Successfully sent to server
    case failed       // Exceeded retry limit
}
