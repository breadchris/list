//
//  ChatWithReaderView.swift
//  share
//
//  Split view container for EPUB reader and chat
//

import SwiftUI
import ExyteChat

// MARK: - Message Menu Actions

enum ChatMenuAction: MessageMenuAction {
    case delete
    case openThread

    func title() -> String {
        switch self {
        case .delete: return "Delete"
        case .openThread: return "View Thread"
        }
    }

    func icon() -> Image {
        switch self {
        case .delete: return Image(systemName: "trash")
        case .openThread: return Image(systemName: "text.bubble")
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
                // Normal chat view with EPUB section
                ChatContentView(viewModel: viewModel, showEPUBSection: true)
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

            // Chat messages
            ChatView(
                messages: viewModel.messages,
                chatType: .conversation,
                didSendMessage: { draft in viewModel.send(draft: draft) },
                messageMenuAction: { (action: ChatMenuAction, defaultAction, message) in
                    switch action {
                    case .delete:
                        viewModel.deleteMessage(id: message.id)
                    case .openThread:
                        viewModel.openThread(for: message)
                    }
                }
            )
            .setAvailableInputs([.text, .media])
            .messageUseMarkdown(true)
            .showDateHeaders(true)
            .showNetworkConnectionProblem(false)
            .keyboardDismissMode(.interactive)
            .environment(\.openURL, OpenURLAction { url in
                // Intercept URL taps and open in webview panel instead of Safari
                viewModel.openWebview(url: url, title: url.host ?? "Link")
                return .handled
            })
        }
    }
}

#Preview {
    ChatWithReaderView(viewModel: ChatViewModel())
}
