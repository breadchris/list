//
//  EPUBReaderView.swift
//  share
//
//  WebView component that loads the EPUB reader
//

import SwiftUI
import WebKit

struct EPUBReaderView: View {
    let epub: EPUBItem
    let onClose: () -> Void

    @StateObject private var webViewStore = EPUBReaderWebViewStore()

    var body: some View {
        VStack(spacing: 0) {
            // Header with close button
            HStack {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.body)
                        .foregroundColor(.primary)
                        .frame(width: 44, height: 44)
                }

                Spacer()

                Text(epub.displayTitle)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Spacer()

                // Placeholder for symmetry
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, 8)
            .background(Color(.systemBackground))

            Divider()

            // WebView
            EPUBWebView(webView: webViewStore.webView)
                .onAppear {
                    loadReader()
                }
        }
    }

    private func loadReader() {
        let baseURL = getAppURL()
        let readerURL = "\(baseURL)/reader?contentId=\(epub.id)"

        guard let url = URL(string: readerURL) else {
            print("❌ EPUBReaderView: Invalid URL: \(readerURL)")
            return
        }

        print("📖 EPUBReaderView: Loading reader at: \(readerURL)")
        webViewStore.webView.load(URLRequest(url: url))
    }

    private func getAppURL() -> String {
        #if targetEnvironment(simulator)
        return "http://localhost:3000"
        #else
        return "https://justshare.io"
        #endif
    }
}

// MARK: - WebView Store

class EPUBReaderWebViewStore: ObservableObject {
    let webView: WKWebView
    let messageHandler: EPUBReaderMessageHandler

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        // Add message handlers for iOS bridge
        let contentController = WKUserContentController()
        let handler = EPUBReaderMessageHandler()
        contentController.add(handler, name: "statusBarHandler")
        contentController.add(handler, name: "safeAreaHandler")
        contentController.add(handler, name: "epubHighlightHandler")
        configuration.userContentController = contentController

        // Inject JavaScript bridge for iOS communication
        let script = WKUserScript(
            source: """
                window.setStatusBarHidden = function(hidden) {
                    window.webkit.messageHandlers.statusBarHandler.postMessage({
                        type: 'statusBar',
                        hidden: hidden
                    });
                };
                window.setSafeAreaColor = function(color) {
                    window.webkit.messageHandlers.safeAreaHandler.postMessage({
                        type: 'safeArea',
                        color: color
                    });
                };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(script)

        self.webView = WKWebView(frame: .zero, configuration: configuration)
        self.webView.scrollView.bounces = false
        self.messageHandler = handler
        handler.webView = self.webView
    }
}

// MARK: - Message Handler

class EPUBReaderMessageHandler: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "statusBar":
            if let hidden = body["hidden"] as? Bool {
                NotificationCenter.default.post(
                    name: NSNotification.Name("StatusBarVisibilityChanged"),
                    object: nil,
                    userInfo: ["hidden": hidden]
                )
            }
        case "safeArea":
            let color = body["color"] as? String ?? "#000000"
            NotificationCenter.default.post(
                name: NSNotification.Name("SafeAreaColorChanged"),
                object: nil,
                userInfo: ["topColor": color, "bottomColor": color]
            )
        case "textSelected":
            if let text = body["text"] as? String,
               let cfiRange = body["cfiRange"] as? String {
                showHighlightActionSheet(text: text, cfiRange: cfiRange)
            }
        default:
            break
        }
    }

    private func showHighlightActionSheet(text: String, cfiRange: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.webView,
                  let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let rootViewController = windowScene.windows.first?.rootViewController else {
                return
            }

            // Find the topmost presented view controller
            var topController = rootViewController
            while let presented = topController.presentedViewController {
                topController = presented
            }

            // Truncate text for display
            let displayText = text.count > 100 ? String(text.prefix(100)) + "..." : text

            let alert = UIAlertController(
                title: nil,
                message: "\"\(displayText)\"",
                preferredStyle: .actionSheet
            )

            alert.addAction(UIAlertAction(title: "Send to Chat", style: .default) { _ in
                // Both Send to Chat and Highlight create a highlight (as child of book content)
                webView.evaluateJavaScript("window.createHighlight()") { _, error in
                    if let error = error {
                        print("❌ EPUBReader: Failed to create highlight: \(error)")
                    }
                }
            })

            alert.addAction(UIAlertAction(title: "Highlight", style: .default) { _ in
                webView.evaluateJavaScript("window.createHighlight()") { _, error in
                    if let error = error {
                        print("❌ EPUBReader: Failed to create highlight: \(error)")
                    }
                }
            })

            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                webView.evaluateJavaScript("window.dismissSelection()") { _, _ in }
            })

            // For iPad, set popover source
            if let popover = alert.popoverPresentationController {
                popover.sourceView = webView
                popover.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }

            topController.present(alert, animated: true)
        }
    }
}

// MARK: - UIViewRepresentable

struct EPUBWebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView {
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

#Preview {
    EPUBReaderView(
        epub: EPUBItem(
            id: "test-id",
            created_at: "2024-01-01",
            data: "Sample Book",
            group_id: "g1",
            user_id: "u1",
            metadata: nil
        ),
        onClose: {}
    )
}
