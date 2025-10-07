//
//  SharedInbox.swift
//  share
//
//  App Group file-based inbox for queuing shared URLs
//

import Foundation

final class SharedInbox {
    private let inboxDirectory: URL

    init(appGroupId: String) throws {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            throw NSError(domain: "SharedInbox", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to access App Group container"])
        }

        inboxDirectory = container.appendingPathComponent("inbox", isDirectory: true)
        try FileManager.default.createDirectory(at: inboxDirectory, withIntermediateDirectories: true)
    }

    func enqueue(_ item: ShareItem) throws {
        let fileURL = inboxDirectory.appendingPathComponent("\(item.id.uuidString).json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(item)
        try data.write(to: fileURL, options: .atomic)
        print("📥 SharedInbox: Enqueued item \(item.id) to \(fileURL.path)")
    }

    func drain() throws -> [URL] {
        let files = try FileManager.default.contentsOfDirectory(at: inboxDirectory, includingPropertiesForKeys: nil)
        return files.filter { $0.pathExtension == "json" }
    }

    func read(_ fileURL: URL) throws -> ShareItem {
        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(ShareItem.self, from: data)
    }

    func remove(_ fileURL: URL) {
        do {
            try FileManager.default.removeItem(at: fileURL)
            print("✅ SharedInbox: Removed processed item at \(fileURL.path)")
        } catch {
            print("⚠️ SharedInbox: Failed to remove file at \(fileURL.path): \(error)")
        }
    }

    func count() throws -> Int {
        let files = try drain()
        return files.count
    }
}
