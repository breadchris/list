//
//  MessageSyncService.swift
//  share
//
//  Syncs pending offline messages when network is available
//  Observes NetworkMonitor and drains MessageOutbox
//

import Foundation
import Combine

@MainActor
final class MessageSyncService: ObservableObject {
    static let shared = MessageSyncService()

    /// Whether sync is currently in progress
    @Published private(set) var isSyncing: Bool = false

    /// Number of pending messages
    @Published private(set) var pendingCount: Int = 0

    /// Notification posted when a message is successfully synced
    static let didSyncMessageNotification = Notification.Name("MessageSyncServiceDidSyncMessage")

    /// Notification posted when a message fails to sync after max retries
    static let didFailMessageNotification = Notification.Name("MessageSyncServiceDidFailMessage")

    private let outbox = MessageOutbox.shared
    private let repository = ChatRepository()
    private var cancellables = Set<AnyCancellable>()
    private var syncTask: Task<Void, Never>?

    private init() {
        updatePendingCount()
        setupNetworkObserver()
        print("🔄 MessageSyncService: Initialized with \(pendingCount) pending messages")
    }

    private func setupNetworkObserver() {
        // Observe network reconnection
        NotificationCenter.default.publisher(for: NetworkMonitor.didReconnectNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                print("🔄 MessageSyncService: Network reconnected, starting sync...")
                Task { @MainActor in
                    await self?.syncPendingMessages()
                }
            }
            .store(in: &cancellables)
    }

    /// Update the pending message count
    func updatePendingCount() {
        pendingCount = outbox.count()
    }

    /// Enqueue a new message for sending
    func enqueue(
        text: String,
        groupId: String,
        userId: String,
        senderName: String?,
        images: [Data] = []
    ) throws -> PendingChatMessage {
        let message = PendingChatMessage(
            text: text,
            groupId: groupId,
            userId: userId,
            senderName: senderName
        )

        try outbox.enqueue(message, images: images)
        updatePendingCount()

        print("🔄 MessageSyncService: Enqueued message \(message.id)")

        // Try to sync immediately if online
        if NetworkMonitor.shared.isConnected {
            Task {
                await syncPendingMessages()
            }
        }

        return message
    }

    /// Sync all pending messages
    func syncPendingMessages() async {
        guard !isSyncing else {
            print("🔄 MessageSyncService: Sync already in progress")
            return
        }

        guard NetworkMonitor.shared.isConnected else {
            print("🔄 MessageSyncService: Offline, skipping sync")
            return
        }

        guard await SupabaseManager.shared.isAuthenticated else {
            print("🔄 MessageSyncService: Not authenticated, skipping sync")
            return
        }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let messages = try outbox.readAll()
            print("🔄 MessageSyncService: Syncing \(messages.count) pending messages...")

            for message in messages {
                await syncMessage(message)
            }

            updatePendingCount()
            print("🔄 MessageSyncService: Sync complete, \(pendingCount) messages remaining")
        } catch {
            print("❌ MessageSyncService: Failed to read outbox: \(error)")
        }
    }

    /// Sync a single message
    private func syncMessage(_ message: PendingChatMessage) async {
        // Check if exceeded retry limit
        if message.hasExceededRetryLimit {
            print("❌ MessageSyncService: Message \(message.id) exceeded retry limit, marking as failed")
            outbox.remove(id: message.id)
            NotificationCenter.default.post(
                name: Self.didFailMessageNotification,
                object: nil,
                userInfo: ["messageId": message.id.uuidString]
            )
            return
        }

        do {
            // Get images for this message
            let images = try outbox.readImages(for: message.id)

            // Send via repository
            let content = try await repository.sendMessage(
                text: message.text,
                groupId: message.groupId,
                images: images.isEmpty ? nil : images
            )

            // Success - remove from outbox
            outbox.remove(id: message.id)

            print("✅ MessageSyncService: Message \(message.id) synced as \(content.id)")

            // Notify UI
            NotificationCenter.default.post(
                name: Self.didSyncMessageNotification,
                object: nil,
                userInfo: [
                    "localId": message.id.uuidString,
                    "serverId": content.id,
                    "groupId": message.groupId
                ]
            )
        } catch {
            print("❌ MessageSyncService: Failed to sync message \(message.id): \(error)")

            // Increment retry count
            let updatedMessage = message.incrementingRetryCount()
            do {
                try outbox.update(updatedMessage)
            } catch {
                print("⚠️ MessageSyncService: Failed to update retry count: \(error)")
            }
        }
    }

    /// Cancel any ongoing sync
    func cancelSync() {
        syncTask?.cancel()
        syncTask = nil
        isSyncing = false
    }

    /// Check if a specific message is still pending
    func isPending(id: UUID) -> Bool {
        outbox.isPending(id: id)
    }

    /// Get all pending messages for a specific group
    func pendingMessages(for groupId: String) -> [PendingChatMessage] {
        do {
            return try outbox.readAll().filter { $0.groupId == groupId }
        } catch {
            return []
        }
    }

    /// Retry a specific message immediately
    func retryMessage(id: UUID) async {
        guard let message = try? outbox.read(id: id) else {
            print("⚠️ MessageSyncService: Message not found for retry: \(id)")
            return
        }

        // Reset retry count
        var resetMessage = PendingChatMessage(
            id: message.id,
            text: message.text,
            groupId: message.groupId,
            userId: message.userId,
            senderName: message.senderName,
            createdAt: message.createdAt,
            imageFilenames: message.imageFilenames,
            retryCount: 0
        )

        do {
            try outbox.update(resetMessage)
            print("🔄 MessageSyncService: Retrying message \(id)")
            await syncMessage(resetMessage)
            updatePendingCount()
        } catch {
            print("❌ MessageSyncService: Failed to retry message \(id): \(error)")
        }
    }
}
