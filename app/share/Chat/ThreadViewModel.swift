//
//  ThreadViewModel.swift
//  share
//
//  ViewModel for threaded chat view showing parent content with child messages
//

import Foundation
import ExyteChat
import Realtime

@MainActor
final class ThreadViewModel: ObservableObject {
    // MARK: - Published State

    @Published var parentContent: ChatContent?
    @Published var childMessages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: Error?

    // MARK: - Thread Context

    let parentId: String
    let groupId: String
    let parentURL: URL?
    let parentTitle: String

    // MARK: - Private

    private let repository = ChatRepository()
    private var realtimeChannel: RealtimeChannelV2?
    private var processedIds = Set<String>()

    // MARK: - Init

    init(parentId: String, groupId: String, parentURL: URL?, parentTitle: String) {
        self.parentId = parentId
        self.groupId = groupId
        self.parentURL = parentURL
        self.parentTitle = parentTitle
    }

    deinit {
        Task { [realtimeChannel] in
            await realtimeChannel?.unsubscribe()
        }
    }

    // MARK: - Load Thread

    func loadThread() async {
        isLoading = true
        error = nil

        do {
            // Fetch parent content
            parentContent = try await repository.fetchContent(id: parentId)

            // Fetch child content
            let children = try await repository.fetchChildContent(parentId: parentId)

            // Map to ExyteChat messages
            let currentUserId = await SupabaseManager.shared.userId
            var messages: [ChatMessage] = []
            for child in children {
                let message = await repository.mapToExyteChatMessage(child, currentUserId: currentUserId)
                messages.append(message)
                processedIds.insert(child.id)
            }
            childMessages = messages

            // Subscribe to realtime updates
            subscribeToRealtime()

            print("✅ ThreadViewModel: Loaded \(children.count) child items")
        } catch {
            self.error = error
            print("❌ ThreadViewModel: Failed to load thread: \(error)")
        }

        isLoading = false
    }

    // MARK: - Send Note

    func sendNote(text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        do {
            let content = try await repository.createChildContent(
                text: text,
                parentId: parentId,
                groupId: groupId
            )

            // Only add if not already processed by realtime
            if !processedIds.contains(content.id) {
                processedIds.insert(content.id)
                let currentUserId = await SupabaseManager.shared.userId
                let message = await repository.mapToExyteChatMessage(content, currentUserId: currentUserId)
                childMessages.append(message)
            }

            print("✅ ThreadViewModel: Sent note")
        } catch {
            self.error = error
            print("❌ ThreadViewModel: Failed to send note: \(error)")
        }
    }

    // MARK: - Delete Note

    func deleteNote(id: String) async {
        do {
            try await repository.deleteMessage(id: id)
            childMessages.removeAll { $0.id == id }
            processedIds.remove(id)
            print("✅ ThreadViewModel: Deleted note: \(id)")
        } catch {
            self.error = error
            print("❌ ThreadViewModel: Failed to delete note: \(error)")
        }
    }

    // MARK: - Realtime Subscription

    private func subscribeToRealtime() {
        realtimeChannel = repository.subscribeToChildContent(
            parentId: parentId,
            onInsert: { [weak self] content in
                Task { @MainActor in
                    guard let self = self else { return }

                    // Avoid duplicates
                    guard !self.processedIds.contains(content.id) else { return }
                    self.processedIds.insert(content.id)

                    let currentUserId = await SupabaseManager.shared.userId
                    let message = await self.repository.mapToExyteChatMessage(content, currentUserId: currentUserId)
                    self.childMessages.append(message)
                }
            },
            onDelete: { [weak self] id in
                Task { @MainActor in
                    self?.childMessages.removeAll { $0.id == id }
                    self?.processedIds.remove(id)
                }
            }
        )
    }
}
