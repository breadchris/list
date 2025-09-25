//
//  ContentView.swift
//  share
//
//  Simple WebView wrapper for List app
//

import SwiftUI
import WebKit
import AuthenticationServices
import UIKit

struct ContentView: View {
    @StateObject private var webViewStore = WebViewStore()
    @State private var showingAPIKeyAlert = false
    @State private var apiKeyMessage = ""
    @State private var isAuthenticating = false
    private let presentationContextProvider = ASWebAuthenticationPresentationContextProvider()

    var body: some View {
        NavigationView {
            WebView(webView: webViewStore.webView)
                .navigationTitle("List")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Refresh") {
                            webViewStore.webView.reload()
                        }
                    }
                }
                .onAppear {
                    loadListApp()
                    setupNotificationObserver()
                }
                .alert("API Key", isPresented: $showingAPIKeyAlert) {
                    Button("OK") { }
                } message: {
                    Text(apiKeyMessage)
                }
        }
    }

    private func loadListApp() {
        let appURL = getAppURL()
        print("🔍 ContentView: Loading app from: \(appURL)")
        print("🏗️ ContentView: Environment: \(isRunningInSimulator() ? "Simulator" : "Physical Device")")

        // Test server connectivity first
        testServerConnectivity(appURL: appURL) { isReachable in
            DispatchQueue.main.async {
                if isReachable {
                    print("✅ ContentView: Server is reachable, loading in WKWebView")
                    guard let url = URL(string: appURL) else {
                        print("❌ ContentView: Failed to create URL from: \(appURL)")
                        return
                    }

                    print("🔧 ContentView: Creating URLRequest for: \(url)")
                    let request = URLRequest(url: url)

                    print("🔧 ContentView: WKWebView delegate assigned: \(self.webViewStore.webView.navigationDelegate != nil)")
                    print("🔧 ContentView: Starting WKWebView.load() call...")

                    self.webViewStore.webView.load(request)

                    print("🔧 ContentView: WKWebView.load() call completed")

                    // Add a timeout check to see if navigation starts
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        let currentURL = self.webViewStore.webView.url?.absoluteString ?? "nil"
                        let isLoading = self.webViewStore.webView.isLoading
                        print("🕐 ContentView: After 2s - URL: \(currentURL), isLoading: \(isLoading)")
                    }
                } else {
                    print("❌ ContentView: Server is not reachable")
                    self.apiKeyMessage = "Cannot connect to server at \(appURL). Make sure the Go server is running."
                    self.showingAPIKeyAlert = true
                }
            }
        }
    }

    private func testServerConnectivity(appURL: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: appURL) else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 15.0  // Increased timeout for production HTTPS connections
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")

        print("🌐 ContentView: Testing connectivity to: \(url)")
        print("⏱️ ContentView: Timeout set to: \(request.timeoutInterval)s")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                let nsError = error as NSError
                print("❌ ContentView: Server connectivity test failed: \(error.localizedDescription)")
                print("📊 ContentView: Error domain: \(nsError.domain), code: \(nsError.code)")
                let userInfo = nsError.userInfo
                if !userInfo.isEmpty {
                    print("📋 ContentView: Error details: \(userInfo)")
                }
                completion(false)
            } else if let httpResponse = response as? HTTPURLResponse {
                print("📡 ContentView: Server responded with status: \(httpResponse.statusCode)")
                print("📋 ContentView: Response headers: \(httpResponse.allHeaderFields)")
                completion(httpResponse.statusCode < 400)
            } else {
                print("❓ ContentView: Unexpected response type")
                completion(false)
            }
        }.resume()
    }

    private func isRunningInSimulator() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    private func getAppURL() -> String {
        if isRunningInSimulator() {
            return "http://localhost:3002"  // Local development
        } else {
            return "https://justshare.io"   // Production
        }
    }

    private func setupNotificationObserver() {
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("APIKeyStored"),
            object: nil,
            queue: .main
        ) { notification in
            if let message = notification.userInfo?["message"] as? String {
                apiKeyMessage = message
                showingAPIKeyAlert = true
            }
        }

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("GoogleAuthRequired"),
            object: nil,
            queue: .main
        ) { notification in
            if let authURL = notification.userInfo?["authURL"] as? String {
                performGoogleAuthentication(authURL: authURL)
            }
        }
    }

    private func performGoogleAuthentication(authURL: String) {
        guard !isAuthenticating else { return }

        print("🔧 OAuth: Original auth URL: \(authURL)")

        // Replace redirect_to parameter with our custom scheme
        var urlComponents = URLComponents(string: authURL)
        var queryItems = urlComponents?.queryItems ?? []

        // Remove existing redirect_to parameter and replace with our custom scheme
        queryItems.removeAll { $0.name == "redirect_to" }
        queryItems.append(URLQueryItem(name: "redirect_to", value: "list://auth/success"))

        urlComponents?.queryItems = queryItems

        guard let url = urlComponents?.url else {
            print("❌ OAuth: Failed to construct URL with custom redirect")
            return
        }

        print("🔧 OAuth: Modified auth URL: \(url)")

        isAuthenticating = true

        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: "list"
        ) { callbackURL, error in
            DispatchQueue.main.async {
                isAuthenticating = false

                if let error = error {
                    print("❌ ASWebAuthenticationSession error: \(error.localizedDescription)")

                    if let authError = error as? ASWebAuthenticationSessionError {
                        switch authError.code {
                        case .canceledLogin:
                            print("👤 ASWebAuthenticationSession: User canceled login")
                        case .presentationContextNotProvided:
                            print("🖼️ ASWebAuthenticationSession: No presentation context provided")
                            apiKeyMessage = "Authentication setup error. Please try again."
                            showingAPIKeyAlert = true
                        case .presentationContextInvalid:
                            print("❌ ASWebAuthenticationSession: Invalid presentation context")
                            apiKeyMessage = "Authentication setup error. Please try again."
                            showingAPIKeyAlert = true
                        @unknown default:
                            print("❓ ASWebAuthenticationSession: Unknown error code: \(authError.code.rawValue)")
                            apiKeyMessage = "Authentication failed: \(error.localizedDescription)"
                            showingAPIKeyAlert = true
                        }
                    } else {
                        print("❌ ASWebAuthenticationSession: Non-auth error: \(error)")
                        apiKeyMessage = "Authentication failed: \(error.localizedDescription)"
                        showingAPIKeyAlert = true
                    }
                    return
                }

                if let callbackURL = callbackURL {
                    print("✅ Google authentication callback: \(callbackURL)")

                    // Extract OAuth code from the callback URL
                    if let urlComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                       let queryItems = urlComponents.queryItems,
                       let authCode = queryItems.first(where: { $0.name == "code" })?.value {
                        print("🔑 OAuth: Received authorization code: \(authCode)")

                        // Inject JavaScript to exchange the code for a session
                        let script = """
                            (function() {
                                const authCode = '\(authCode)';
                                let attemptCount = 0;
                                const maxAttempts = 20; // 10 seconds with 500ms intervals

                                console.log('🔄 OAuth: Starting code exchange for:', authCode);

                                function attemptCodeExchange() {
                                    attemptCount++;
                                    console.log('🔍 OAuth: Attempt', attemptCount + '/' + maxAttempts, '- Checking for Supabase...');

                                    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
                                        console.log('✅ OAuth: Supabase client found, exchanging code...');

                                        window.supabase.auth.exchangeCodeForSession(authCode)
                                            .then(({ data, error }) => {
                                                if (error) {
                                                    console.error('❌ OAuth: Code exchange failed:', error);
                                                } else {
                                                    console.log('✅ OAuth: Session established successfully:', data);
                                                    window.location.reload();
                                                }
                                            })
                                            .catch(e => {
                                                console.error('❌ OAuth: Code exchange error:', e);
                                            });
                                    } else {
                                        if (attemptCount < maxAttempts) {
                                            console.log('⏳ OAuth: Supabase not ready yet, retrying in 500ms...');
                                            setTimeout(attemptCodeExchange, 500);
                                        } else {
                                            console.error('❌ OAuth: Timeout waiting for Supabase client after', (maxAttempts * 0.5), 'seconds');
                                        }
                                    }
                                }

                                attemptCodeExchange();
                            })();
                        """

                        webViewStore.webView.evaluateJavaScript(script) { result, error in
                            if let error = error {
                                print("❌ OAuth: JavaScript execution error: \(error.localizedDescription)")
                            } else {
                                print("✅ OAuth: JavaScript executed successfully")
                            }
                        }
                    } else {
                        print("⚠️ OAuth: No authorization code found in callback URL")
                        // Still reload in case there's another auth mechanism
                        webViewStore.webView.reload()
                    }
                }
            }
        }

        session.presentationContextProvider = presentationContextProvider

        print("🚀 ASWebAuthenticationSession: Starting session with URL: \(url)")
        print("🔗 ASWebAuthenticationSession: Callback scheme: list")
        print("🖼️ ASWebAuthenticationSession: Presentation context provider set: \(session.presentationContextProvider != nil)")

        session.start()
    }
}

class WebViewStore: ObservableObject {
    let webView: WKWebView
    private let navigationDelegate: NavigationDelegate

    init() {
        let configuration = WKWebViewConfiguration()

        // Add JavaScript handlers
        let contentController = WKUserContentController()
        let messageHandler = MessageHandler()
        contentController.add(messageHandler, name: "apiKeyHandler")
        contentController.add(messageHandler, name: "authHandler")
        contentController.add(messageHandler, name: "consoleHandler")
        configuration.userContentController = contentController

        // Inject JavaScript to detect API key creation, Google auth attempts, and console messages
        let script = WKUserScript(
            source: """
                // Capture console messages for debugging
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;

                console.log = function(...args) {
                    window.webkit.messageHandlers.consoleHandler.postMessage({
                        type: 'log',
                        level: 'log',
                        message: args.join(' ')
                    });
                    return originalLog.apply(console, args);
                };

                console.error = function(...args) {
                    window.webkit.messageHandlers.consoleHandler.postMessage({
                        type: 'log',
                        level: 'error',
                        message: args.join(' ')
                    });
                    return originalError.apply(console, args);
                };

                console.warn = function(...args) {
                    window.webkit.messageHandlers.consoleHandler.postMessage({
                        type: 'log',
                        level: 'warn',
                        message: args.join(' ')
                    });
                    return originalWarn.apply(console, args);
                };

                // Log page load events
                console.log('🔍 WKWebView: JavaScript injected successfully');

                window.addEventListener('load', function() {
                    console.log('✅ WKWebView: Page loaded successfully');
                });

                window.addEventListener('error', function(e) {
                    console.error('❌ WKWebView: JavaScript error:', e.message, 'at', e.filename + ':' + e.lineno);
                });

                window.addEventListener('DOMContentLoaded', function() {
                    console.log('📄 WKWebView: DOM content loaded');
                });

                // Monitor for API key creation responses
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    return originalFetch.apply(this, args).then(response => {
                        if (response.url.includes('/api/auth/keys') && response.status === 200) {
                            response.clone().json().then(data => {
                                if (data.token && data.token.startsWith('ak_')) {
                                    window.webkit.messageHandlers.apiKeyHandler.postMessage({
                                        type: 'apiKey',
                                        token: data.token,
                                        name: data.name || 'Mobile App Key'
                                    });
                                }
                            }).catch(e => console.log('Error parsing API key response:', e));
                        }
                        return response;
                    });
                };

                // Intercept Google authentication attempts
                function interceptGoogleAuth() {
                    const links = document.querySelectorAll('a[href*="/auth/google"], button[onclick*="/auth/google"]');
                    links.forEach(link => {
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            const authURL = this.href || '/auth/google';
                            window.webkit.messageHandlers.authHandler.postMessage({
                                type: 'googleAuth',
                                authURL: authURL
                            });
                        });
                    });

                    // Also watch for programmatic redirects to Google auth and Supabase OAuth
                    const originalAssign = window.location.assign;
                    window.location.assign = function(url) {
                        if (url.includes('/auth/google') ||
                            url.includes('supabase.co/auth') ||
                            url.includes('accounts.google.com')) {
                            window.webkit.messageHandlers.authHandler.postMessage({
                                type: 'googleAuth',
                                authURL: url
                            });
                            return;
                        }
                        return originalAssign.call(this, url);
                    };
                }

                // Run interceptor when DOM is ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', interceptGoogleAuth);
                } else {
                    interceptGoogleAuth();
                }

                // Re-run interceptor when content changes (for SPAs)
                const observer = new MutationObserver(function(mutations) {
                    interceptGoogleAuth();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(script)

        self.navigationDelegate = NavigationDelegate()
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        self.webView.navigationDelegate = self.navigationDelegate

        print("🔧 WebViewStore: WKWebView created with delegate: \(self.webView.navigationDelegate != nil)")
        print("🔧 WebViewStore: WKWebView configuration set: \(self.webView.configuration.userContentController.userScripts.count) scripts")
    }
}

class MessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }

        switch type {
        case "apiKey":
            handleAPIKey(body: body)
        case "googleAuth":
            handleGoogleAuth(body: body)
        case "log":
            handleConsoleMessage(body: body)
        default:
            print("Unknown message type: \(type)")
        }
    }

    private func handleAPIKey(body: [String: Any]) {
        guard let token = body["token"] as? String else {
            return
        }

        let name = body["name"] as? String ?? "Mobile App Key"

        // Store API key in Keychain and shared container
        if storeAPIKeyInKeychain(token: token, name: name) {
            print("API key stored successfully in Keychain")

            // Also store in shared container for share extension
            if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
                sharedContainer.set(token, forKey: "api_key")
                sharedContainer.synchronize()
                print("✅ API key also stored in shared container")
            }

            // Show success alert
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("APIKeyStored"),
                    object: nil,
                    userInfo: ["message": "API key saved! You can now share content from other apps."]
                )
            }
        } else {
            print("Failed to store API key in Keychain")
        }
    }

    private func handleGoogleAuth(body: [String: Any]) {
        if let authURL = body["authURL"] as? String {
            print("Google authentication intercepted: \(authURL)")

            // Trigger native Google authentication
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("GoogleAuthRequired"),
                    object: nil,
                    userInfo: ["authURL": authURL]
                )
            }
        }
    }

    private func handleConsoleMessage(body: [String: Any]) {
        guard let level = body["level"] as? String,
              let message = body["message"] as? String else {
            return
        }

        let emoji = level == "error" ? "❌" : level == "warn" ? "⚠️" : "📝"
        print("\(emoji) WebView Console [\(level.uppercased())]: \(message)")
    }

    private func storeAPIKeyInKeychain(token: String, name: String) -> Bool {
        let service = "list.app"
        let account = "api_key"

        // Create query
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: token.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        // Delete any existing key first
        SecItemDelete(query as CFDictionary)

        // Add new key
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
}

class NavigationDelegate: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ NavigationDelegate: Page finished loading: \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("🔄 NavigationDelegate: Started loading: \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("❌ NavigationDelegate: Failed to load page: \(error.localizedDescription)")
        print("📍 NavigationDelegate: Failed URL: \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("❌ NavigationDelegate: Navigation failed: \(error.localizedDescription)")
        print("📍 NavigationDelegate: Failed URL: \(webView.url?.absoluteString ?? "unknown")")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Intercept Google OAuth URLs to prevent them from loading in WKWebView
        if url.host?.contains("accounts.google.com") == true ||
           url.absoluteString.contains("supabase.co/auth") ||
           url.absoluteString.contains("/auth/google") {
            print("🚫 NavigationDelegate: Blocking OAuth URL from WKWebView: \(url)")

            // Trigger the JavaScript interception instead
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("GoogleAuthRequired"),
                    object: nil,
                    userInfo: ["authURL": url.absoluteString]
                )
            }

            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }
}

struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView {
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Updates handled by WebViewStore
    }
}

// ASWebAuthenticationSession presentation context provider
class ASWebAuthenticationPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        print("🔍 PresentationContextProvider: Finding presentation anchor...")

        // Get the key window for iOS 13+
        if #available(iOS 13.0, *) {
            let window = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }

            if let window = window {
                print("✅ PresentationContextProvider: Found key window: \(window)")
                return window
            } else {
                print("⚠️ PresentationContextProvider: No key window found, using fallback")
                return ASPresentationAnchor()
            }
        } else {
            if let window = UIApplication.shared.keyWindow {
                print("✅ PresentationContextProvider: Found legacy key window: \(window)")
                return window
            } else {
                print("⚠️ PresentationContextProvider: No legacy key window found, using fallback")
                return ASPresentationAnchor()
            }
        }
    }
}

#Preview {
    ContentView()
}