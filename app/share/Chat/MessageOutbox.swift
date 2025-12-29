//
//  MessageOutbox.swift
//  share
//
//  File-based outbox for queuing offline chat messages
//  Persists messages and images to App Group container for sync when online
//

import Foundation

final class MessageOutbox {
    static let shared: MessageOutbox = {
        do {
            return try MessageOutbox(appGroupId: "group.com.breadchris.share")
        } catch {
            fatalError("Failed to initialize MessageOutbox: \(error)")
        }
    }()

    private let outboxDirectory: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(appGroupId: String) throws {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            throw MessageOutboxError.appGroupNotFound
        }

        outboxDirectory = container.appendingPathComponent("message_outbox", isDirectory: true)
        try FileManager.default.createDirectory(at: outboxDirectory, withIntermediateDirectories: true)

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        print("📤 MessageOutbox: Initialized at \(outboxDirectory.path)")
    }

    // MARK: - Directory for a Message

    /// Get the directory for a specific message's files
    private func messageDirectory(for id: UUID) -> URL {
        outboxDirectory.appendingPathComponent(id.uuidString, isDirectory: true)
    }

    /// Get the JSON file path for a message
    private func messageFile(for id: UUID) -> URL {
        messageDirectory(for: id).appendingPathComponent("message.json")
    }

    /// Get the image file path for a message
    private func imageFile(for id: UUID, index: Int) -> URL {
        messageDirectory(for: id).appendingPathComponent("\(index).jpg")
    }

    // MARK: - Enqueue

    /// Enqueue a message with optional image data
    func enqueue(_ message: PendingChatMessage, images: [Data] = []) throws {
        let dir = messageDirectory(for: message.id)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        // Save images first
        var imageFilenames: [String] = []
        for (index, imageData) in images.enumerated() {
            let filename = "\(index).jpg"
            let imageURL = imageFile(for: message.id, index: index)
            try imageData.write(to: imageURL, options: .atomic)
            imageFilenames.append(filename)
        }

        // Update message with image filenames and save
        var messageWithImages = message
        if !imageFilenames.isEmpty {
            messageWithImages = PendingChatMessage(
                id: message.id,
                text: message.text,
                groupId: message.groupId,
                userId: message.userId,
                senderName: message.senderName,
                createdAt: message.createdAt,
                imageFilenames: imageFilenames,
                retryCount: message.retryCount
            )
        }

        let data = try encoder.encode(messageWithImages)
        try data.write(to: messageFile(for: message.id), options: .atomic)

        print("📤 MessageOutbox: Enqueued message \(message.id) with \(images.count) images")
    }

    // MARK: - Read

    /// Get all pending message IDs
    func allMessageIds() throws -> [UUID] {
        let contents = try FileManager.default.contentsOfDirectory(
            at: outboxDirectory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )

        return contents.compactMap { url in
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                return nil
            }
            return UUID(uuidString: url.lastPathComponent)
        }
    }

    /// Read a pending message
    func read(id: UUID) throws -> PendingChatMessage {
        let data = try Data(contentsOf: messageFile(for: id))
        return try decoder.decode(PendingChatMessage.self, from: data)
    }

    /// Read all pending messages sorted by creation date
    func readAll() throws -> [PendingChatMessage] {
        let ids = try allMessageIds()
        var messages: [PendingChatMessage] = []

        for id in ids {
            do {
                let message = try read(id: id)
                messages.append(message)
            } catch {
                print("⚠️ MessageOutbox: Failed to read message \(id): \(error)")
            }
        }

        return messages.sorted { $0.createdAt < $1.createdAt }
    }

    /// Get image data for a message
    func readImages(for id: UUID) throws -> [Data] {
        let message = try read(id: id)
        var images: [Data] = []

        for (index, _) in message.imageFilenames.enumerated() {
            let imageURL = imageFile(for: id, index: index)
            if FileManager.default.fileExists(atPath: imageURL.path) {
                let data = try Data(contentsOf: imageURL)
                images.append(data)
            }
        }

        return images
    }

    // MARK: - Update

    /// Update a message (e.g., to increment retry count)
    func update(_ message: PendingChatMessage) throws {
        let data = try encoder.encode(message)
        try data.write(to: messageFile(for: message.id), options: .atomic)
        print("📤 MessageOutbox: Updated message \(message.id)")
    }

    // MARK: - Remove

    /// Remove a message and its images after successful sync
    func remove(id: UUID) {
        let dir = messageDirectory(for: id)
        do {
            try FileManager.default.removeItem(at: dir)
            print("✅ MessageOutbox: Removed message \(id)")
        } catch {
            print("⚠️ MessageOutbox: Failed to remove message \(id): \(error)")
        }
    }

    // MARK: - Count

    /// Get the number of pending messages
    func count() -> Int {
        do {
            return try allMessageIds().count
        } catch {
            return 0
        }
    }

    /// Check if there are any pending messages
    var hasPendingMessages: Bool {
        count() > 0
    }

    /// Check if a specific message is pending
    func isPending(id: UUID) -> Bool {
        FileManager.default.fileExists(atPath: messageFile(for: id).path)
    }
}

// MARK: - Errors

enum MessageOutboxError: LocalizedError {
    case appGroupNotFound
    case messageNotFound(UUID)
    case encodingFailed
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .appGroupNotFound:
            return "App Group container not found"
        case .messageNotFound(let id):
            return "Message not found: \(id)"
        case .encodingFailed:
            return "Failed to encode message"
        case .decodingFailed:
            return "Failed to decode message"
        }
    }
}
