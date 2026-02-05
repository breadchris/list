//
//  ChatViewModel.swift
//  share
//
//  ViewModel for managing chat state with Supabase integration
//  Supports offline-first messaging with local caching
//

import Foundation
import ExyteChat
import Realtime
import Combine

// Use type aliases from ChatRepository to disambiguate from Realtime types

/// Data for navigating to a thread view
struct ThreadNavigationData: Identifiable {
    let id: String  // content ID
    let url: URL?
    let title: String
    let groupId: String
}

@MainActor
final class ChatViewModel: ObservableObject {

    // MARK: - Published State

    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var isRefreshing = false  // Background refresh indicator
    @Published var error: Error?
    @Published var showGroupSelector = false
    @Published var currentGroupId: String?
    @Published var currentGroupName: String?
    @Published var isOffline = false

    // EPUB state
    @Published var epubs: [EPUBItem] = []
    @Published var isLoadingEPUBs = false
    @Published var isEPUBSectionExpanded = true
    @Published var selectedEPUB: EPUBItem? = nil

    // Webview state (for opening URLs from messages)
    @Published var selectedURL: URL? = nil
    @Published var selectedURLTitle: String? = nil

    // Thread navigation state
    @Published var selectedThreadContent: ThreadNavigationData? = nil

    // Photo notes state
    @Published var noteCounts: [String: Int] = [:]
    @Published var showAddNotesPrompt: Bool = false
    @Published var lastSentPhotoId: String? = nil

    // MARK: - Private Properties

    private let repository = ChatRepository()
    private let messageCache = MessageCache.shared
    private let syncService = MessageSyncService.shared
    private var realtimeChannel: RealtimeChannelV2?
    private var currentUserId: String?
    private var pendingServerIds: Set<String> = []
    private var pendingLocalIds: Set<String> = []  // Track pending message IDs
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        setupNetworkObserver()
        setupSyncObservers()

        // Check for persisted group selection
        if let savedGroupId = ChatGroupManager.shared.selectedGroupId {
            currentGroupId = savedGroupId
            currentGroupName = ChatGroupManager.shared.selectedGroupName

            // Load cached messages immediately for instant display
            loadCachedMessages(groupId: savedGroupId)

            // Then fetch fresh data in background
            Task {
                await initialize()
            }
        } else {
            // No group selected, will show selector
            showGroupSelector = true
        }
    }

    deinit {
        // Note: Can't call async from deinit, but channel will be cleaned up
        // when the view model is deallocated
    }

    // MARK: - Network & Sync Observers

    private func setupNetworkObserver() {
        NetworkMonitor.shared.$isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isConnected in
                self?.isOffline = !isConnected
            }
            .store(in: &cancellables)
    }

    private func setupSyncObservers() {
        // Listen for successful message sync
        NotificationCenter.default.publisher(for: MessageSyncService.didSyncMessageNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self = self,
                      let localId = notification.userInfo?["localId"] as? String,
                      let serverId = notification.userInfo?["serverId"] as? String,
                      let groupId = notification.userInfo?["groupId"] as? String,
                      groupId == self.currentGroupId else { return }

                self.handleMessageSynced(localId: localId, serverId: serverId)

                // Check if the synced message has images - prompt for notes
                if let message = self.messages.first(where: { $0.id == serverId || $0.id == localId }),
                   !message.attachments.isEmpty {
                    self.promptForPhotoNotes(photoId: serverId)
                }
            }
            .store(in: &cancellables)

        // Listen for failed message sync
        NotificationCenter.default.publisher(for: MessageSyncService.didFailMessageNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self = self,
                      let messageId = notification.userInfo?["messageId"] as? String else { return }

                self.handleMessageFailed(localId: messageId)
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Initialize the chat (called after group selection or on launch)
    func initialize() async {
        currentUserId = await SupabaseManager.shared.userId

        if let groupId = currentGroupId {
            // Fetch fresh messages from network (updates cache)
            await loadMessages()
            await loadEPUBs()
            subscribeToRealtime()

            // Merge any pending messages
            mergePendingMessages(groupId: groupId)
        }
    }

    /// Select a group and load its messages
    func selectGroup(_ group: GroupInfo) {
        // Clear messages immediately to prevent UITableView batch update crashes
        messages = []

        currentGroupId = group.id
        currentGroupName = group.name
        ChatGroupManager.shared.selectGroup(id: group.id, name: group.name)

        // Load cached messages immediately
        loadCachedMessages(groupId: group.id)

        Task {
            await initialize()
        }
    }

    /// Load cached messages for instant display
    private func loadCachedMessages(groupId: String) {
        let cachedContents = messageCache.loadSafe(groupId: groupId)

        if !cachedContents.isEmpty {
            Task {
                var loadedMessages: [ChatMessage] = []
                for content in cachedContents {
                    let message = await repository.mapToExyteChatMessage(content, currentUserId: currentUserId)
                    loadedMessages.append(message)
                }
                messages = loadedMessages
                print("✅ ChatViewModel: Loaded \(messages.count) cached messages instantly")
            }
        }
    }

    /// Merge pending (offline) messages into the messages array
    private func mergePendingMessages(groupId: String) {
        let pending = syncService.pendingMessages(for: groupId)

        for pendingMessage in pending {
            // Skip if already in messages
            guard !messages.contains(where: { $0.id == pendingMessage.id.uuidString }) else {
                continue
            }

            let user = ChatUser(
                id: pendingMessage.userId,
                name: pendingMessage.senderName ?? "Me",
                avatarURL: nil,
                isCurrentUser: true
            )

            let message = ChatMessage(
                id: pendingMessage.id.uuidString,
                user: user,
                status: .sending,  // Show as pending
                createdAt: pendingMessage.createdAt,
                text: pendingMessage.text,
                attachments: []  // TODO: Load cached images
            )

            messages.append(message)
            pendingLocalIds.insert(pendingMessage.id.uuidString)
        }

        // Sort by date
        messages.sort { $0.createdAt < $1.createdAt }
    }

    /// Load messages from Supabase
    func loadMessages() async {
        guard let groupId = currentGroupId else {
            print("⚠️ ChatViewModel: No group selected")
            return
        }

        // Only show loading if we have no cached messages
        let hasCachedMessages = !messages.isEmpty
        if !hasCachedMessages {
            isLoading = true
        } else {
            isRefreshing = true
        }
        error = nil

        do {
            let contents = try await repository.fetchMessages(groupId: groupId)

            // Cache the fetched messages
            try? messageCache.save(contents, groupId: groupId)

            var loadedMessages: [ChatMessage] = []
            for content in contents {
                let message = await repository.mapToExyteChatMessage(content, currentUserId: currentUserId)
                loadedMessages.append(message)
            }

            // Preserve pending messages that haven't synced yet
            let pendingMessages = messages.filter { pendingLocalIds.contains($0.id) }
            messages = loadedMessages + pendingMessages
            messages.sort { $0.createdAt < $1.createdAt }

            print("✅ ChatViewModel: Loaded \(loadedMessages.count) messages from server")
        } catch {
            print("❌ ChatViewModel: Failed to load messages: \(error)")
            // Don't overwrite cached messages on network error
            if messages.isEmpty {
                self.error = error
            }
        }

        isLoading = false
        isRefreshing = false
    }

    /// Load EPUBs for the current group
    func loadEPUBs() async {
        guard let groupId = currentGroupId else { return }

        isLoadingEPUBs = true
        do {
            epubs = try await repository.fetchEPUBs(groupId: groupId)
            print("✅ ChatViewModel: Loaded \(epubs.count) EPUBs")
        } catch {
            print("❌ ChatViewModel: Failed to load EPUBs: \(error)")
        }
        isLoadingEPUBs = false
    }

    /// Select an EPUB for viewing
    func selectEPUB(_ epub: EPUBItem) {
        selectedEPUB = epub
    }

    /// Close the EPUB reader
    func closeEPUBReader() {
        selectedEPUB = nil
    }

    /// Open a URL in the webview panel
    func openWebview(url: URL, title: String) {
        selectedURL = url
        selectedURLTitle = title
        selectedEPUB = nil  // Clear EPUB selection when opening URL
    }

    /// Close the webview
    func closeWebview() {
        selectedURL = nil
        selectedURLTitle = nil
    }

    /// Open thread view for a message
    func openThread(for message: ChatMessage) {
        guard let groupId = currentGroupId else { return }

        // Try to extract URL from message text
        let url = extractURL(from: message.text)

        // Use message text as title (truncated), or URL host if available
        let title: String
        if let url = url {
            title = url.host ?? message.text.prefix(50).description
        } else {
            title = String(message.text.prefix(50))
        }

        selectedThreadContent = ThreadNavigationData(
            id: message.id,
            url: url,
            title: title,
            groupId: groupId
        )
    }

    /// Close the thread view
    func closeThread() {
        selectedThreadContent = nil
    }

    // MARK: - Photo Notes

    /// Prompt user to add notes after sending a photo
    private func promptForPhotoNotes(photoId: String) {
        lastSentPhotoId = photoId
        showAddNotesPrompt = true
    }

    /// Dismiss the notes prompt
    func dismissNotesPrompt() {
        showAddNotesPrompt = false
        lastSentPhotoId = nil
    }

    /// Open thread view for a photo to add notes
    func openPhotoThread(photoId: String) {
        guard let groupId = currentGroupId else { return }

        selectedThreadContent = ThreadNavigationData(
            id: photoId,
            url: nil,
            title: "Photo Notes",
            groupId: groupId
        )
    }

    /// Fetch note counts for a list of message IDs
    func fetchNoteCounts(for messageIds: [String]) async {
        for id in messageIds {
            // Skip if already cached
            if noteCounts[id] != nil { continue }

            do {
                let count = try await repository.fetchNoteCount(parentId: id)
                noteCounts[id] = count
            } catch {
                print("⚠️ ChatViewModel: Failed to fetch note count for \(id)")
            }
        }
    }

    /// Increment note count when a new note is added
    func incrementNoteCount(for parentId: String) {
        noteCounts[parentId] = (noteCounts[parentId] ?? 0) + 1
    }

    /// Extract first URL from text
    private func extractURL(from text: String) -> URL? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }
        let matches = detector.matches(in: text, options: [], range: NSRange(text.startIndex..., in: text))
        return matches.first?.url
    }

    /// Send selected text from webview as a chat message and save as highlight
    func sendSelectedText(_ text: String, fromURL url: URL? = nil) {
        guard !text.isEmpty, let groupId = currentGroupId else { return }

        // Quote the selected text
        let quotedText = "> \(text)"

        Task {
            do {
                _ = try await repository.sendMessage(text: quotedText, groupId: groupId)
                print("✅ ChatViewModel: Sent selected text to chat")

                // Also save as highlight if URL provided
                if let url = url {
                    try await repository.createHighlight(
                        quote: text,
                        forURL: url.absoluteString,
                        groupId: groupId
                    )
                    print("✅ ChatViewModel: Created highlight for URL")
                }
            } catch {
                print("❌ ChatViewModel: Failed to send selected text: \(error)")
            }
        }

        // NOTE: Do NOT close webview - user keeps reading
    }

    /// Send a new message (offline-first)
    func send(draft: DraftMessage) {
        guard let groupId = currentGroupId else {
            print("⚠️ ChatViewModel: Cannot send - no group selected")
            return
        }

        Task {
            // Get user info
            var userId = currentUserId ?? "unknown"
            if userId == "unknown" {
                userId = await SupabaseManager.shared.userId ?? "unknown"
            }
            let senderName = await SupabaseManager.shared.getCurrentUserDisplayName() ?? "Me"

            // Extract image data from draft media
            var imageData: [Data] = []
            let imageMedias = draft.medias.filter { $0.type == .image }
            for media in imageMedias {
                if let data = try? await Data(contentsOf: media.getURL()!.downloadURL) {
                    imageData.append(data)
                }
            }

            // Enqueue to outbox (persists to disk)
            do {
                let pendingMessage = try syncService.enqueue(
                    text: draft.text,
                    groupId: groupId,
                    userId: userId,
                    senderName: senderName,
                    images: imageData
                )

                // Create optimistic local message
                let currentUser = ChatUser(
                    id: userId,
                    name: senderName,
                    avatarURL: nil,
                    isCurrentUser: true
                )

                let optimisticMessage = await ChatMessage.makeMessage(
                    id: pendingMessage.id.uuidString,
                    user: currentUser,
                    status: .sending,
                    draft: draft
                )

                messages.append(optimisticMessage)
                pendingLocalIds.insert(pendingMessage.id.uuidString)

                // Sort by date
                messages.sort { $0.createdAt < $1.createdAt }

                print("✅ ChatViewModel: Message queued for sending: \(pendingMessage.id)")

            } catch {
                print("❌ ChatViewModel: Failed to queue message: \(error)")
                self.error = error
            }
        }
    }

    /// Handle when a message is successfully synced
    private func handleMessageSynced(localId: String, serverId: String) {
        // CRITICAL: Add to pendingServerIds FIRST
        pendingServerIds.insert(serverId)
        pendingLocalIds.remove(localId)

        // Check if realtime already added a message with the server ID
        // If so, just remove the local pending message (race condition handled)
        if messages.contains(where: { $0.id == serverId }) {
            messages.removeAll { $0.id == localId }
            print("✅ ChatViewModel: Message synced (realtime already delivered): \(localId) → \(serverId)")
            return
        }

        guard let index = messages.firstIndex(where: { $0.id == localId }) else {
            // Local message not found - realtime might have handled it
            print("⚠️ ChatViewModel: Local message not found for sync: \(localId)")
            return
        }

        // Update message with sent status and server ID
        let oldMessage = messages[index]
        messages[index] = ChatMessage(
            id: serverId,
            user: oldMessage.user,
            status: .sent,
            createdAt: oldMessage.createdAt,
            text: oldMessage.text,
            attachments: oldMessage.attachments
        )

        print("✅ ChatViewModel: Message synced: \(localId) → \(serverId)")
    }

    /// Handle when a message fails to sync after max retries
    private func handleMessageFailed(localId: String) {
        guard let index = messages.firstIndex(where: { $0.id == localId }) else {
            return
        }

        pendingLocalIds.remove(localId)

        // Mark as error with retry option
        let oldMessage = messages[index]
        let draft = DraftMessage(
            text: oldMessage.text,
            medias: [],
            giphyMedia: nil,
            recording: nil,
            replyMessage: nil,
            createdAt: oldMessage.createdAt
        )

        messages[index] = ChatMessage(
            id: localId,
            user: oldMessage.user,
            status: .error(draft),
            createdAt: oldMessage.createdAt,
            text: oldMessage.text,
            attachments: oldMessage.attachments
        )

        print("❌ ChatViewModel: Message failed after retries: \(localId)")
    }

    /// Delete a message
    func deleteMessage(id: String) {
        Task {
            do {
                try await repository.deleteMessage(id: id)
                // Remove from local state (realtime will also trigger this)
                messages.removeAll { $0.id == id }
                print("✅ ChatViewModel: Deleted message: \(id)")
            } catch {
                print("❌ ChatViewModel: Failed to delete message: \(error)")
            }
        }
    }

    /// Retry uploading a pending message
    func retryMessage(id: String) {
        guard let uuid = UUID(uuidString: id) else {
            print("⚠️ ChatViewModel: Invalid UUID for retry: \(id)")
            return
        }

        // Update UI to show sending state
        if let index = messages.firstIndex(where: { $0.id == id }) {
            let oldMessage = messages[index]
            messages[index] = ChatMessage(
                id: id,
                user: oldMessage.user,
                status: .sending,
                createdAt: oldMessage.createdAt,
                text: oldMessage.text,
                attachments: oldMessage.attachments
            )
            pendingLocalIds.insert(id)
        }

        Task {
            await syncService.retryMessage(id: uuid)
        }
    }

    /// Show the group selector modal
    func showGroupPicker() {
        showGroupSelector = true
    }

    // MARK: - Realtime Subscription

    /// Subscribe to realtime updates for the current group
    private func subscribeToRealtime() {
        guard let groupId = currentGroupId else { return }

        // Unsubscribe from any existing channel
        unsubscribe()

        // Capture groupId at subscription time to guard against group switches
        let subscribedGroupId = groupId

        realtimeChannel = repository.subscribeToMessages(
            groupId: groupId,
            onInsert: { [weak self] content in
                Task { @MainActor in
                    guard let self = self else { return }

                    // Ignore events from old group subscriptions
                    guard self.currentGroupId == subscribedGroupId else { return }

                    // Skip if this is a message we just sent (already handled)
                    if self.pendingServerIds.remove(content.id) != nil {
                        print("✅ ChatViewModel: Ignoring realtime for our own message: \(content.id)")
                        return
                    }

                    // Skip if we already have this message
                    guard !self.messages.contains(where: { $0.id == content.id }) else {
                        print("⚠️ ChatViewModel: Skipping duplicate message: \(content.id)")
                        return
                    }

                    let message = await self.repository.mapToExyteChatMessage(content, currentUserId: self.currentUserId)
                    self.messages.append(message)
                    print("✅ ChatViewModel: Received realtime message: \(content.id)")
                }
            },
            onDelete: { [weak self] id in
                // Ignore events from old group subscriptions
                guard self?.currentGroupId == subscribedGroupId else { return }
                self?.messages.removeAll { $0.id == id }
                print("✅ ChatViewModel: Removed message: \(id)")
            }
        )
    }

    /// Unsubscribe from realtime updates
    private func unsubscribe() {
        if let channel = realtimeChannel {
            Task {
                await channel.unsubscribe()
            }
            realtimeChannel = nil
            print("✅ ChatViewModel: Unsubscribed from realtime")
        }
    }
}
