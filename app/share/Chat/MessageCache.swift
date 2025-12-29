//
//  MessageCache.swift
//  share
//
//  Caches recent chat messages locally for instant loading
//  Messages are persisted per group in the App Group container
//

import Foundation

final class MessageCache {
    static let shared: MessageCache = {
        do {
            return try MessageCache(appGroupId: "group.com.breadchris.share")
        } catch {
            fatalError("Failed to initialize MessageCache: \(error)")
        }
    }()

    private let cacheDirectory: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    /// Maximum number of messages to cache per group
    private let maxMessagesPerGroup = 100

    init(appGroupId: String) throws {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            throw MessageCacheError.appGroupNotFound
        }

        cacheDirectory = container.appendingPathComponent("message_cache", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        print("💾 MessageCache: Initialized at \(cacheDirectory.path)")
    }

    // MARK: - File Paths

    private func cacheFile(for groupId: String) -> URL {
        cacheDirectory.appendingPathComponent("\(groupId).json")
    }

    // MARK: - Save

    /// Save messages for a group (replaces existing cache)
    func save(_ messages: [ChatContent], groupId: String) throws {
        // Keep only the most recent messages
        let recentMessages = Array(messages.suffix(maxMessagesPerGroup))

        let wrapper = CachedMessages(
            groupId: groupId,
            messages: recentMessages,
            cachedAt: Date()
        )

        let data = try encoder.encode(wrapper)
        try data.write(to: cacheFile(for: groupId), options: .atomic)

        print("💾 MessageCache: Saved \(recentMessages.count) messages for group \(groupId)")
    }

    /// Append new messages to existing cache
    func append(_ newMessages: [ChatContent], groupId: String) throws {
        var existing = try? load(groupId: groupId)
        if existing == nil {
            existing = []
        }

        // Merge, avoiding duplicates
        let existingIds = Set(existing!.map { $0.id })
        let uniqueNew = newMessages.filter { !existingIds.contains($0.id) }

        var combined = existing! + uniqueNew
        combined.sort { $0.created_at < $1.created_at }

        try save(combined, groupId: groupId)
    }

    // MARK: - Load

    /// Load cached messages for a group
    func load(groupId: String) throws -> [ChatContent] {
        let file = cacheFile(for: groupId)
        guard FileManager.default.fileExists(atPath: file.path) else {
            return []
        }

        let data = try Data(contentsOf: file)
        let wrapper = try decoder.decode(CachedMessages.self, from: data)

        print("💾 MessageCache: Loaded \(wrapper.messages.count) cached messages for group \(groupId)")
        return wrapper.messages
    }

    /// Load cached messages if available, returns empty array on error
    func loadSafe(groupId: String) -> [ChatContent] {
        do {
            return try load(groupId: groupId)
        } catch {
            print("⚠️ MessageCache: Failed to load cache for group \(groupId): \(error)")
            return []
        }
    }

    // MARK: - Cache Info

    /// Check when cache was last updated for a group
    func cacheDate(for groupId: String) -> Date? {
        let file = cacheFile(for: groupId)
        guard FileManager.default.fileExists(atPath: file.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: file)
            let wrapper = try decoder.decode(CachedMessages.self, from: data)
            return wrapper.cachedAt
        } catch {
            return nil
        }
    }

    /// Check if cache exists for a group
    func hasCache(for groupId: String) -> Bool {
        FileManager.default.fileExists(atPath: cacheFile(for: groupId).path)
    }

    // MARK: - Clear

    /// Clear cache for a specific group
    func clear(groupId: String) {
        let file = cacheFile(for: groupId)
        try? FileManager.default.removeItem(at: file)
        print("💾 MessageCache: Cleared cache for group \(groupId)")
    }

    /// Clear all cached messages
    func clearAll() {
        do {
            let files = try FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for file in files where file.pathExtension == "json" {
                try FileManager.default.removeItem(at: file)
            }
            print("💾 MessageCache: Cleared all caches")
        } catch {
            print("⚠️ MessageCache: Failed to clear all caches: \(error)")
        }
    }
}

// MARK: - Supporting Types

private struct CachedMessages: Codable {
    let groupId: String
    let messages: [ChatContent]
    let cachedAt: Date
}

enum MessageCacheError: LocalizedError {
    case appGroupNotFound
    case loadFailed

    var errorDescription: String? {
        switch self {
        case .appGroupNotFound:
            return "App Group container not found"
        case .loadFailed:
            return "Failed to load cached messages"
        }
    }
}
