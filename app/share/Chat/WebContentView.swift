//
//  WebContentView.swift
//  share
//
//  View for displaying web URLs in a WKWebView within the chat split view
//

import SwiftUI
import WebKit

struct WebContentView: View {
    let url: URL
    let title: String
    @EnvironmentObject var viewModel: ChatViewModel
    @State private var highlights: [String] = []

    private let repository = ChatRepository()

    var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack {
                Button(action: { viewModel.closeWebview() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.primary)
                }
                .padding(.leading, 16)

                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.horizontal, 12)

                Spacer()

                // Open in Safari button
                Link(destination: url) {
                    Image(systemName: "safari")
                        .font(.system(size: 16))
                        .foregroundColor(.blue)
                }
                .padding(.trailing, 16)
            }
            .frame(height: 44)
            .background(Color(.systemBackground))

            Divider()

            // WebView with highlights and context menu action
            WebContentWebView(url: url, highlights: highlights) { selectedText in
                // Add to local highlights immediately for instant visual feedback
                highlights.append(selectedText)
                // Send to chat and save as highlight
                viewModel.sendSelectedText(selectedText, fromURL: url)
            }
        }
        .task {
            await loadHighlights()
        }
    }

    private func loadHighlights() async {
        guard let groupId = viewModel.currentGroupId else { return }
        do {
            highlights = try await repository.fetchHighlightsForURL(
                url: url.absoluteString,
                groupId: groupId
            )
        } catch {
            print("❌ WebContentView: Failed to load highlights: \(error)")
        }
    }
}

// MARK: - Custom WKWebView with Send to Chat menu item

class ChatWebView: WKWebView {
    var onSendToChat: ((String) -> Void)?
    var highlights: [String] = []

    override func buildMenu(with builder: any UIMenuBuilder) {
        super.buildMenu(with: builder)

        // Add "Send to Chat" action to the edit menu
        let sendToChatAction = UIAction(
            title: "Send to Chat",
            image: UIImage(systemName: "bubble.left")
        ) { [weak self] _ in
            self?.sendSelectionToChat()
        }

        let customMenu = UIMenu(
            title: "",
            options: .displayInline,
            children: [sendToChatAction]
        )

        // Insert at the beginning of the menu
        builder.insertChild(customMenu, atStartOfMenu: .root)
    }

    private func sendSelectionToChat() {
        evaluateJavaScript("window.getSelection().toString()") { [weak self] result, _ in
            if let text = result as? String,
               !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                DispatchQueue.main.async {
                    self?.onSendToChat?(text.trimmingCharacters(in: .whitespacesAndNewlines))
                }
            }
        }
    }

    /// Inject JavaScript to highlight quotes on the page
    func applyHighlights() {
        guard !highlights.isEmpty else { return }

        // Convert highlights to JSON array
        let quotesJSON = highlights.map { quote -> String in
            let escaped = quote
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "\\r")
            return "\"\(escaped)\""
        }.joined(separator: ",")

        let script = """
        (function() {
            // Add highlight styles
            if (!document.getElementById('app-highlight-styles')) {
                const style = document.createElement('style');
                style.id = 'app-highlight-styles';
                style.textContent = '.app-highlight { background-color: rgba(255, 230, 0, 0.3); border-radius: 2px; }';
                document.head.appendChild(style);
            }

            const quotes = [\(quotesJSON)];

            quotes.forEach(quote => {
                // Escape regex special characters
                const escaped = quote.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                const regex = new RegExp(escaped, 'i');

                // Walk all text nodes
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent;
                    const match = text.match(regex);
                    if (match) {
                        const index = match.index;
                        const matchedText = match[0];

                        // Split the text node and wrap the match
                        const before = text.substring(0, index);
                        const after = text.substring(index + matchedText.length);

                        const mark = document.createElement('mark');
                        mark.className = 'app-highlight';
                        mark.textContent = matchedText;

                        const parent = node.parentNode;
                        if (before) {
                            parent.insertBefore(document.createTextNode(before), node);
                        }
                        parent.insertBefore(mark, node);
                        if (after) {
                            parent.insertBefore(document.createTextNode(after), node);
                        }
                        parent.removeChild(node);

                        break; // Only highlight first instance
                    }
                }
            });
        })();
        """

        evaluateJavaScript(script) { _, error in
            if let error = error {
                print("❌ ChatWebView: Failed to apply highlights: \(error)")
            } else {
                print("✅ ChatWebView: Applied \(self.highlights.count) highlights")
            }
        }
    }
}

// MARK: - WKWebView Wrapper

struct WebContentWebView: UIViewRepresentable {
    let url: URL
    let highlights: [String]
    var onSendToChat: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> ChatWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let webView = ChatWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = context.coordinator
        webView.onSendToChat = onSendToChat
        webView.highlights = highlights
        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))

        return webView
    }

    func updateUIView(_ uiView: ChatWebView, context: Context) {
        // Update highlights if they changed
        if uiView.highlights != highlights {
            uiView.highlights = highlights
            // Re-apply if page already loaded
            uiView.applyHighlights()
        }

        // Only reload if URL changed
        if uiView.url != url {
            uiView.load(URLRequest(url: url))
        }
    }

    // MARK: - Coordinator for navigation delegate

    class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: ChatWebView?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Apply highlights after page loads
            (webView as? ChatWebView)?.applyHighlights()
        }
    }
}

#Preview {
    WebContentView(
        url: URL(string: "https://apple.com")!,
        title: "Apple"
    )
    .environmentObject(ChatViewModel())
}
