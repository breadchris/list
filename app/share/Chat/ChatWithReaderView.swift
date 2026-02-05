//
//  ChatWithReaderView.swift
//  share
//
//  Split view container for EPUB reader and chat
//

import SwiftUI
import ExyteChat

// MARK: - Custom Message View with Stable Link Preview

/// Custom message bubble that includes stable link previews without layout jitter
struct CustomMessageBubble: View {
    let message: Message
    let isCurrentUser: Bool
    let noteCount: Int
    let onOpenURL: (URL) -> Void
    let showAttachment: (Attachment) -> Void
    let onOpenNotes: () -> Void
    let onRetryUpload: (() -> Void)?
    let showContextMenu: () -> Void

    /// Check if message is pending upload
    private var isPendingUpload: Bool {
        if case .sending = message.status {
            return true
        }
        return false
    }

    /// Check if message upload failed
    private var isUploadFailed: Bool {
        if case .error = message.status {
            return true
        }
        return false
    }

    /// Get pending status for overlay
    private var pendingStatus: PendingMessageStatus? {
        switch message.status {
        case .sending:
            return .sending
        case .error:
            return .failed
        default:
            return nil
        }
    }

    var body: some View {
        VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 6) {
            // Message content bubble
            VStack(alignment: .leading, spacing: 8) {
                // Show attachments (images) first
                if !message.attachments.isEmpty {
                    ForEach(message.attachments, id: \.id) { attachment in
                        if attachment.type == .image {
                            ZStack(alignment: .bottomTrailing) {
                                AsyncImage(url: attachment.full) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fit)
                                            .frame(maxWidth: 200)
                                            .cornerRadius(8)
                                    case .failure:
                                        Image(systemName: "photo")
                                            .foregroundColor(.secondary)
                                    case .empty:
                                        ProgressView()
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                                .onTapGesture {
                                    if isUploadFailed {
                                        onRetryUpload?()
                                    } else {
                                        showAttachment(attachment)
                                    }
                                }

                                // Upload status overlay (covers entire image)
                                if let status = pendingStatus {
                                    UploadStatusOverlay(status: status)
                                        .frame(maxWidth: 200)
                                        .cornerRadius(8)
                                        .allowsHitTesting(false)
                                }

                                // Notes indicator badge (on top, at corner)
                                if noteCount > 0 && pendingStatus == nil {
                                    NotesIndicatorBadge(count: noteCount)
                                        .onTapGesture {
                                            onOpenNotes()
                                        }
                                }
                            }
                        }
                    }
                }

                // The message text (if not empty)
                if !message.text.isEmpty {
                    Text(message.text)
                        .font(.body)
                        .foregroundColor(isCurrentUser ? .white : .primary)
                }

                // Show stable link preview if URL is detected (only for non-empty text)
                if !message.text.isEmpty, let url = message.text.extractFirstURL() {
                    StableLinkPreview(url: url)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isCurrentUser ? Color.blue : Color(.systemGray5))
            .cornerRadius(16)

            // Timestamp
            Text(formatTime(message.createdAt))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: 280, alignment: isCurrentUser ? .trailing : .leading)
        .onLongPressGesture(minimumDuration: 0.3) {
            showContextMenu()
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Message Menu Actions

enum ChatMenuAction: MessageMenuAction {
    case delete
    case openThread
    case retryUpload

    func title() -> String {
        switch self {
        case .delete: return "Delete"
        case .openThread: return "View Thread"
        case .retryUpload: return "Retry Upload"
        }
    }

    func icon() -> Image {
        switch self {
        case .delete: return Image(systemName: "trash")
        case .openThread: return Image(systemName: "text.bubble")
        case .retryUpload: return Image(systemName: "arrow.clockwise")
        }
    }
}

struct ChatWithReaderView: View {
    @ObservedObject var viewModel: ChatViewModel

    var body: some View {
        GeometryReader { geometry in
            if let selectedEPUB = viewModel.selectedEPUB {
                // Split view: EPUB Reader on top, Chat on bottom
                VStack(spacing: 0) {
                    // EPUB Reader (takes 60% of screen)
                    EPUBReaderView(epub: selectedEPUB) {
                        viewModel.closeEPUBReader()
                    }
                    .frame(height: geometry.size.height * 0.6)

                    Divider()

                    // Chat (takes 40% of screen)
                    ChatContentView(viewModel: viewModel, showEPUBSection: false)
                        .frame(height: geometry.size.height * 0.4)
                }
            } else if let selectedURL = viewModel.selectedURL {
                // Split view: Webview on top, Chat on bottom
                VStack(spacing: 0) {
                    // Webview (takes 60% of screen)
                    WebContentView(
                        url: selectedURL,
                        title: viewModel.selectedURLTitle ?? selectedURL.host ?? "Web"
                    )
                    .environmentObject(viewModel)
                    .frame(height: geometry.size.height * 0.6)

                    Divider()

                    // Chat (takes 40% of screen)
                    ChatContentView(viewModel: viewModel, showEPUBSection: false)
                        .frame(height: geometry.size.height * 0.4)
                }
            } else {
                // Normal chat view (books accessed via Apps menu)
                ChatContentView(viewModel: viewModel, showEPUBSection: false)
            }
        }
    }
}

/// Extracted chat content for reuse
struct ChatContentView: View {
    @ObservedObject var viewModel: ChatViewModel
    let showEPUBSection: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Collapsible EPUB section (only in non-split mode)
            if showEPUBSection && !viewModel.epubs.isEmpty {
                EPUBSectionView(
                    epubs: viewModel.epubs,
                    isExpanded: $viewModel.isEPUBSectionExpanded,
                    isLoading: viewModel.isLoadingEPUBs,
                    onSelectEPUB: { epub in
                        viewModel.selectEPUB(epub)
                    }
                )
            }

            // Chat messages with custom bubble for notes indicator
            ChatView(
                messages: viewModel.messages,
                chatType: .conversation,
                didSendMessage: { draft in viewModel.send(draft: draft) },
                messageBuilder: { message, positionInGroup, positionInMessagesSection, positionInCommentsGroup, showContextMenu, messageActionClosure, showAttachment in
                    let isCurrentUser = message.user.isCurrentUser
                    let noteCount = viewModel.noteCounts[message.id] ?? 0

                    return CustomMessageBubble(
                        message: message,
                        isCurrentUser: isCurrentUser,
                        noteCount: noteCount,
                        onOpenURL: { url in
                            viewModel.openWebview(url: url, title: url.host ?? "Link")
                        },
                        showAttachment: showAttachment,
                        onOpenNotes: {
                            viewModel.openPhotoThread(photoId: message.id)
                        },
                        onRetryUpload: {
                            viewModel.retryMessage(id: message.id)
                        },
                        showContextMenu: showContextMenu
                    )
                },
                messageMenuAction: { (action: ChatMenuAction, defaultAction, message) in
                    switch action {
                    case .delete:
                        viewModel.deleteMessage(id: message.id)
                    case .openThread:
                        viewModel.openThread(for: message)
                    case .retryUpload:
                        viewModel.retryMessage(id: message.id)
                    }
                }
            )
            .setAvailableInputs([.text, .media])
            .messageUseMarkdown(false)  // We handle text rendering in custom bubble
            .showDateHeaders(true)
            .showNetworkConnectionProblem(false)
            .keyboardDismissMode(.interactive)
            .showMessageMenuOnLongPress(false)  // We use custom 300ms long press in CustomMessageBubble
            .environment(\.openURL, OpenURLAction { url in
                // Intercept URL taps and open in webview panel instead of Safari
                viewModel.openWebview(url: url, title: url.host ?? "Link")
                return .handled
            })
        }
        .task {
            // Fetch note counts for image messages
            let imageMessageIds = viewModel.messages
                .filter { !$0.attachments.isEmpty }
                .map { $0.id }
            await viewModel.fetchNoteCounts(for: imageMessageIds)
        }
    }
}

#Preview {
    ChatWithReaderView(viewModel: ChatViewModel())
}
