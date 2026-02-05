//
//  WebContentView.swift
//  share
//
//  View for displaying web URLs in a WKWebView within the chat split view
//

import SwiftUI
import WebKit

// MARK: - WebContentView

struct WebContentView: View {
    let url: URL
    let title: String
    @EnvironmentObject var viewModel: ChatViewModel
    @StateObject private var store = WebContentStore()
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

            // WebView with highlights and floating popup for selection
            WebContentWebView(url: url, highlights: highlights, store: store) { selectedText in
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

// MARK: - Selection Message Handler

class WebContentSelectionHandler: NSObject, WKScriptMessageHandler {
    weak var webView: ChatWebView?
    private var highlightPopup: HighlightPopupView?
    private var tapOverlay: UIView?
    private var currentSelectedText: String?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "textSelected":
            if let text = body["text"] as? String,
               let rectX = body["rect_x"] as? CGFloat,
               let rectY = body["rect_y"] as? CGFloat,
               let rectWidth = body["rect_width"] as? CGFloat,
               let rectHeight = body["rect_height"] as? CGFloat {
                let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedText.isEmpty else {
                    dismissPopup()
                    return
                }
                let selectionRect = CGRect(x: rectX, y: rectY, width: rectWidth, height: rectHeight)
                showFloatingHighlightButton(at: selectionRect, text: trimmedText)
            }
        case "selectionCleared":
            dismissPopup()
        default:
            break
        }
    }

    private func showFloatingHighlightButton(at rect: CGRect, text: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let webView = self.webView else { return }

            // Remove existing popup if any
            self.dismissPopupImmediate()

            // Store the selected text
            self.currentSelectedText = text

            // Create new popup
            let popup = HighlightPopupView()
            popup.onHighlight = { [weak self, weak popup] in
                // Trigger the highlight callback
                if let selectedText = self?.currentSelectedText {
                    self?.webView?.onSendToChat?(selectedText)
                }
                // Clear selection
                self?.webView?.evaluateJavaScript("window.getSelection().removeAllRanges()") { _, _ in }
                popup?.animateOut {
                    self?.highlightPopup = nil
                    self?.removeTapOverlay()
                    self?.currentSelectedText = nil
                }
            }

            // Add to webView
            webView.addSubview(popup)
            popup.position(above: rect, in: webView)
            popup.animateIn()
            self.highlightPopup = popup

            // Add tap overlay to detect taps outside popup
            self.addTapOverlay(in: webView)
        }
    }

    private func addTapOverlay(in containerView: UIView) {
        let overlay = UIView(frame: containerView.bounds)
        overlay.backgroundColor = .clear
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleOverlayTap))
        overlay.addGestureRecognizer(tapGesture)

        // Insert below the popup
        if let popup = highlightPopup {
            containerView.insertSubview(overlay, belowSubview: popup)
        } else {
            containerView.addSubview(overlay)
        }
        tapOverlay = overlay
    }

    private func removeTapOverlay() {
        tapOverlay?.removeFromSuperview()
        tapOverlay = nil
    }

    @objc private func handleOverlayTap() {
        dismissPopup()
        // Clear selection in webview
        webView?.evaluateJavaScript("window.getSelection().removeAllRanges()") { _, _ in }
    }

    func dismissPopup() {
        DispatchQueue.main.async { [weak self] in
            self?.highlightPopup?.animateOut {
                self?.highlightPopup = nil
            }
            self?.removeTapOverlay()
            self?.currentSelectedText = nil
        }
    }

    private func dismissPopupImmediate() {
        highlightPopup?.removeFromSuperview()
        highlightPopup = nil
        removeTapOverlay()
        currentSelectedText = nil
    }
}

// MARK: - Custom WKWebView with selection handling

class ChatWebView: WKWebView {
    var onSendToChat: ((String) -> Void)?
    var highlights: [String] = []
    var selectionHandler: WebContentSelectionHandler?

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

    /// Inject JavaScript to detect text selection and send coordinates
    func injectSelectionScript() {
        let script = """
        (function() {
            if (window._selectionHandlerInstalled) return;
            window._selectionHandlerInstalled = true;

            let debounceTimer = null;

            document.addEventListener('selectionchange', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim().length > 0 && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        window.webkit.messageHandlers.selectionHandler.postMessage({
                            type: 'textSelected',
                            text: selection.toString(),
                            rect_x: rect.left,
                            rect_y: rect.top,
                            rect_width: rect.width,
                            rect_height: rect.height
                        });
                    } else {
                        window.webkit.messageHandlers.selectionHandler.postMessage({
                            type: 'selectionCleared'
                        });
                    }
                }, 300);
            });

            // Dismiss on scroll
            window.addEventListener('scroll', () => {
                window.webkit.messageHandlers.selectionHandler.postMessage({
                    type: 'selectionCleared'
                });
            }, true);
        })();
        """

        evaluateJavaScript(script) { _, error in
            if let error = error {
                print("❌ ChatWebView: Failed to inject selection script: \(error)")
            }
        }
    }
}

// MARK: - WKWebView Wrapper

struct WebContentWebView: UIViewRepresentable {
    let url: URL
    let highlights: [String]
    let store: WebContentStore
    var onSendToChat: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> ChatWebView {
        // Use store to get or create webview (persists across view updates)
        return store.getOrCreateWebView(
            for: url,
            highlights: highlights,
            onSendToChat: onSendToChat,
            coordinator: context.coordinator
        )
    }

    func updateUIView(_ uiView: ChatWebView, context: Context) {
        // Update callback
        uiView.onSendToChat = onSendToChat

        // Update highlights if they changed
        if uiView.highlights != highlights {
            uiView.highlights = highlights
            // Re-apply if page already loaded
            uiView.applyHighlights()
        }

        // Only reload if URL changed (handled by store)
        store.loadURL(url)
    }

    // MARK: - Coordinator for navigation delegate

    class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: ChatWebView?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard let chatWebView = webView as? ChatWebView else { return }
            // Apply highlights after page loads
            chatWebView.applyHighlights()
            // Inject selection handling script
            chatWebView.injectSelectionScript()
        }
    }
}

// MARK: - WebContent Store (persists webview across view updates)

@MainActor
class WebContentStore: ObservableObject {
    var webView: ChatWebView?
    var selectionHandler: WebContentSelectionHandler?
    private(set) var currentURL: URL?

    func getOrCreateWebView(
        for url: URL,
        highlights: [String],
        onSendToChat: @escaping (String) -> Void,
        coordinator: WebContentWebView.Coordinator
    ) -> ChatWebView {
        // If webview exists and URL is same, return existing
        if let existing = webView, currentURL == url {
            existing.onSendToChat = onSendToChat
            existing.highlights = highlights
            return existing
        }

        // Create new webview
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        // Add selection message handler
        let handler = WebContentSelectionHandler()
        configuration.userContentController.add(handler, name: "selectionHandler")

        let newWebView = ChatWebView(frame: .zero, configuration: configuration)
        newWebView.allowsBackForwardNavigationGestures = true
        newWebView.navigationDelegate = coordinator
        newWebView.onSendToChat = onSendToChat
        newWebView.highlights = highlights
        newWebView.selectionHandler = handler
        handler.webView = newWebView
        coordinator.webView = newWebView

        // Store references
        webView = newWebView
        selectionHandler = handler
        currentURL = url

        // Load URL
        newWebView.load(URLRequest(url: url))

        return newWebView
    }

    /// Load a new URL if different from current
    func loadURL(_ url: URL) {
        guard url != currentURL else { return }
        currentURL = url
        webView?.load(URLRequest(url: url))
    }
}

#Preview {
    WebContentView(
        url: URL(string: "https://apple.com")!,
        title: "Apple"
    )
    .environmentObject(ChatViewModel())
}
