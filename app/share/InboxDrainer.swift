//
//  InboxDrainer.swift
//  share
//
//  Drains shared URL inbox to Supabase content table
//  Uses Supabase Swift SDK for database operations
//

import Foundation
import BackgroundTasks

class InboxDrainer {
    static let shared = InboxDrainer()
    private let appGroupId = "group.com.breadchris.share"
    private let backgroundTaskId = "com.breadchris.list.drain"

    private init() {}

    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: backgroundTaskId, using: nil) { [weak self] task in
            Task {
                let success = await self?.drainInboxAsync() ?? false
                task.setTaskCompleted(success: success)
                self?.scheduleNextDrain()
            }
        }
        print("📋 InboxDrainer: Background task registered")
    }

    func scheduleNextDrain() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)

        do {
            try BGTaskScheduler.shared.submit(request)
            print("⏰ InboxDrainer: Next drain scheduled")
        } catch {
            print("❌ InboxDrainer: Failed to schedule drain: \(error)")
        }
    }

    /// Legacy completion-based drain for backwards compatibility
    func drainInbox(completion: @escaping (Bool) -> Void) {
        Task {
            let success = await drainInboxAsync()
            completion(success)
        }
    }

    /// Modern async/await drain using Supabase SDK
    func drainInboxAsync() async -> Bool {
        print("🚀 InboxDrainer: Starting inbox drain (async)...")

        do {
            let inbox = try SharedInbox(appGroupId: appGroupId)
            print("✅ InboxDrainer: Successfully opened inbox at App Group: \(appGroupId)")

            let files = try inbox.drain()
            print("📊 InboxDrainer: Found \(files.count) files in inbox")

            guard !files.isEmpty else {
                print("📭 InboxDrainer: Inbox is empty, nothing to process")
                return true
            }

            print("📥 InboxDrainer: Processing \(files.count) items...")

            // Check if user is authenticated via Supabase SDK
            guard await SupabaseManager.shared.isAuthenticated else {
                print("⚠️ InboxDrainer: User not authenticated via Supabase SDK")
                print("💡 InboxDrainer: User needs to authenticate in the app first")
                return false
            }
            print("✅ InboxDrainer: User is authenticated via Supabase SDK")

            // Get user's default group
            guard let groupId = try await getDefaultGroupIdAsync() else {
                print("⚠️ InboxDrainer: No default group available")
                print("💡 InboxDrainer: User may need to create or join a group first")
                return false
            }
            print("✅ InboxDrainer: Default group ID found: \(groupId)")

            var allSucceeded = true
            var processedCount = 0
            var failedCount = 0

            for fileURL in files {
                do {
                    let item = try inbox.read(fileURL)
                    print("📤 InboxDrainer: Sending item \(item.id) to Supabase (URL: \(item.url))")

                    try await sendToSupabaseAsync(item: item, groupId: groupId)

                    inbox.remove(fileURL)
                    processedCount += 1
                    print("✅ InboxDrainer: Successfully processed and removed item \(item.id)")
                } catch {
                    print("❌ InboxDrainer: Error processing file \(fileURL.lastPathComponent): \(error)")
                    allSucceeded = false
                    failedCount += 1
                }
            }

            print("📊 InboxDrainer: Drain complete - Processed: \(processedCount), Failed: \(failedCount)")
            return allSucceeded
        } catch {
            print("❌ InboxDrainer: Failed to drain inbox: \(error)")
            return false
        }
    }

    // MARK: - Supabase SDK Methods

    private func getDefaultGroupIdAsync() async throws -> String? {
        // Check cache first
        if let sharedContainer = UserDefaults(suiteName: appGroupId),
           let cachedGroupId = sharedContainer.string(forKey: "default_group_id") {
            print("✅ InboxDrainer: Using cached group ID: \(cachedGroupId)")
            return cachedGroupId
        }

        // Fetch from Supabase
        let groupId = try await SupabaseManager.shared.getDefaultGroupId()

        // Cache the result
        if let groupId = groupId,
           let sharedContainer = UserDefaults(suiteName: appGroupId) {
            sharedContainer.set(groupId, forKey: "default_group_id")
            sharedContainer.synchronize()
        }

        return groupId
    }

    private func sendToSupabaseAsync(item: ShareItem, groupId: String) async throws {
        try await SupabaseManager.shared.sendChatMessage(
            text: item.url,
            groupId: groupId,
            sharedFrom: "ios_share_extension"
        )
        print("✅ InboxDrainer: Chat message sent via Supabase SDK")
    }
}
