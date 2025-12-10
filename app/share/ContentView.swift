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
    @StateObject private var sharedURLManager = SharedURLManager.shared
    @State private var showingAPIKeyAlert = false
    @State private var apiKeyMessage = ""
    @State private var isAuthenticating = false
    #if DEBUG
    @State private var showingDebugView = false
    #endif
    private let presentationContextProvider = ASWebAuthenticationPresentationContextProvider()

    var body: some View {
        WebView(webView: webViewStore.webView, onRefresh: {
            webViewStore.webView.reload()
        })
        #if DEBUG
        .sheet(isPresented: $showingDebugView) {
            NavigationView {
                DebugView()
                    .navigationTitle("Debug")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button("Done") {
                                showingDebugView = false
                            }
                        }
                    }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
            showingDebugView = true
        }
        #endif
        .onAppear {
            loadListApp()
            setupNotificationObserver()

            // Wait for WebView to load, then sync pending items via WebView's Supabase client
            print("🔄 ContentView: App appeared, will sync inbox after WebView loads...")
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                syncPendingItems()
            }
        }
        .alert("API Key", isPresented: $showingAPIKeyAlert) {
            Button("OK") { }
        } message: {
            Text(apiKeyMessage)
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

        // Handle shared URL processing
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ProcessSharedURL"),
            object: nil,
            queue: .main
        ) { notification in
            if let payload = notification.userInfo?["payload"] as? [String: Any],
               let apiKey = notification.userInfo?["apiKey"] as? String {
                processSharedURLInWebView(payload: payload, apiKey: apiKey)
            }
        }

        // Handle shared URL errors
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("SharedURLError"),
            object: nil,
            queue: .main
        ) { notification in
            if let message = notification.userInfo?["message"] as? String {
                apiKeyMessage = message
                showingAPIKeyAlert = true
            }
        }

        // Handle test shared URL notifications
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("TestSharedURL"),
            object: nil,
            queue: .main
        ) { notification in
            print("🧪 Test: Received test shared URL notification")
            if let shareKey = notification.userInfo?["shareKey"] as? String {
                print("🧪 Test: Processing test share key: \(shareKey)")
            }
            // Trigger the normal shared URL check
            sharedURLManager.checkForSharedURLs()
        }

        // Handle inbox item sync results from WebView
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("InboxItemSynced"),
            object: nil,
            queue: .main
        ) { [self] notification in
            guard let itemId = notification.userInfo?["itemId"] as? String,
                  let success = notification.userInfo?["success"] as? Bool,
                  success else {
                return
            }

            // Remove synced item from inbox
            do {
                let inbox = try SharedInbox(appGroupId: "group.com.breadchris.share")
                let files = try inbox.drain()
                for fileURL in files {
                    if fileURL.lastPathComponent.hasPrefix(itemId) ||
                       fileURL.lastPathComponent.contains(itemId) {
                        inbox.remove(fileURL)
                        print("✅ ContentView: Removed synced item from inbox: \(itemId)")
                    }
                }
            } catch {
                print("❌ ContentView: Failed to remove synced item: \(error)")
            }
        }

        // Handle inbox sync trigger from AppDelegate/shareApp
        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("TriggerInboxSync"),
            object: nil,
            queue: .main
        ) { [self] _ in
            print("🔄 ContentView: Received TriggerInboxSync notification")
            syncPendingItems()
        }
    }

    private func syncPendingItems() {
        print("🔄 ContentView: Syncing pending inbox items via WebView...")

        do {
            let inbox = try SharedInbox(appGroupId: "group.com.breadchris.share")
            let files = try inbox.drain()

            guard !files.isEmpty else {
                print("📭 ContentView: No pending items to sync")
                return
            }

            print("📊 ContentView: Found \(files.count) pending items to sync")

            for fileURL in files {
                do {
                    let item = try inbox.read(fileURL)
                    let itemId = item.id.uuidString
                    let escapedUrl = item.url
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "'", with: "\\'")
                    let escapedNote = (item.note ?? "")
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "'", with: "\\'")

                    let script = "window.syncSharedURL('\(itemId)', '\(escapedUrl)', '\(escapedNote)');"

                    print("📤 ContentView: Calling syncSharedURL for item \(itemId)")
                    webViewStore.webView.evaluateJavaScript(script) { result, error in
                        if let error = error {
                            print("❌ ContentView: JavaScript error for \(itemId): \(error.localizedDescription)")
                        }
                    }
                } catch {
                    print("❌ ContentView: Error reading inbox item \(fileURL.lastPathComponent): \(error)")
                }
            }
        } catch {
            print("❌ ContentView: Failed to access inbox: \(error)")
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

    /// Process shared URL by injecting it into the WebView
    private func processSharedURLInWebView(payload: [String: Any], apiKey: String) {
        guard let payloadData = try? JSONSerialization.data(withJSONObject: payload),
              let payloadJSON = String(data: payloadData, encoding: .utf8) else {
            print("❌ ContentView: Failed to serialize shared URL payload")
            return
        }

        let script = """
            (function() {
                const payload = \(payloadJSON);
                const apiKey = '\(apiKey)';

                console.log('📤 Processing shared URL:', payload);

                // Wait for the app to be ready
                let attemptCount = 0;
                const maxAttempts = 20;

                function attemptToShareURL() {
                    attemptCount++;
                    console.log('🔍 Shared URL: Attempt', attemptCount + '/' + maxAttempts, '- Checking for app readiness...');

                    // Check if we have Supabase client and are authenticated
                    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
                        console.log('✅ Shared URL: Supabase client found, checking auth...');

                        window.supabase.auth.getSession().then(({ data: { session }, error }) => {
                            if (error) {
                                console.error('❌ Shared URL: Auth check failed:', error);
                                return;
                            }

                            if (session) {
                                console.log('✅ Shared URL: User authenticated, sending to Supabase...');
                                
                                // Insert the shared URL into Supabase
                                window.supabase
                                    .from('shared_urls') // Adjust table name as needed
                                    .insert([{
                                        url: payload.url,
                                        title: payload.title || '',
                                        shared_at: payload.shared_at,
                                        source: payload.source,
                                        user_id: session.user.id
                                    }])
                                    .then(({ data, error }) => {
                                        if (error) {
                                            console.error('❌ Shared URL: Supabase insert failed:', error);
                                        } else {
                                            console.log('✅ Shared URL: Successfully saved to Supabase:', data);
                                            
                                            // Optionally refresh the page to show the new content
                                            // window.location.reload();
                                        }
                                    });
                            } else {
                                console.log('⚠️ Shared URL: User not authenticated');
                                // Optionally handle non-authenticated case
                            }
                        });
                    } else {
                        if (attemptCount < maxAttempts) {
                            console.log('⏳ Shared URL: App not ready yet, retrying in 500ms...');
                            setTimeout(attemptToShareURL, 500);
                        } else {
                            console.error('❌ Shared URL: Timeout waiting for app after', (maxAttempts * 0.5), 'seconds');
                        }
                    }
                }

                attemptToShareURL();
            })();
        """

        webViewStore.webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("❌ ContentView: Failed to execute shared URL script: \(error.localizedDescription)")
            } else {
                print("✅ ContentView: Shared URL script executed successfully")
            }
        }
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
        contentController.add(messageHandler, name: "sessionHandler")
        contentController.add(messageHandler, name: "syncResultHandler")
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

                // Monitor Supabase auth state changes and capture session tokens
                function captureSession() {
                    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
                        window.supabase.auth.onAuthStateChange((event, session) => {
                            console.log('🔐 Auth state changed:', event, session);
                            if (session && session.access_token && session.user) {
                                window.webkit.messageHandlers.sessionHandler.postMessage({
                                    type: 'session',
                                    access_token: session.access_token,
                                    user_id: session.user.id
                                });
                            }
                        });
                    }
                }

                // Try to capture session when Supabase loads
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', captureSession);
                } else {
                    captureSession();
                }

                // Also try when content changes
                const sessionObserver = new MutationObserver(function() {
                    captureSession();
                });
                sessionObserver.observe(document.body, { childList: true, subtree: true });

                // Function called from Swift to sync a shared URL via WebView's Supabase client
                window.syncSharedURL = async function(itemId, url, note) {
                    try {
                        console.log('📤 syncSharedURL: Starting sync for item', itemId, url);

                        if (!window.supabase?.auth) {
                            throw new Error('Supabase not ready');
                        }

                        const { data: { session } } = await window.supabase.auth.getSession();
                        if (!session) {
                            throw new Error('Not authenticated');
                        }

                        console.log('✅ syncSharedURL: Authenticated as', session.user.id);

                        // Get user's default group
                        const { data: membership, error: membershipError } = await window.supabase
                            .from('group_memberships')
                            .select('group_id')
                            .eq('user_id', session.user.id)
                            .limit(1)
                            .single();

                        if (membershipError || !membership) {
                            throw new Error('No group membership found');
                        }

                        console.log('✅ syncSharedURL: Using group', membership.group_id);

                        // Insert content
                        const { error: insertError } = await window.supabase
                            .from('content')
                            .insert({
                                type: 'text',
                                data: url,
                                metadata: { url: url, shared_from: 'ios_share_extension', note: note || null },
                                user_id: session.user.id,
                                group_id: membership.group_id
                            });

                        if (insertError) throw insertError;

                        console.log('✅ syncSharedURL: Successfully inserted content for', itemId);

                        // Notify Swift of success
                        window.webkit.messageHandlers.syncResultHandler.postMessage({
                            type: 'syncResult',
                            itemId: itemId,
                            success: true
                        });
                    } catch (e) {
                        console.error('❌ syncSharedURL: Failed for', itemId, e.message);
                        window.webkit.messageHandlers.syncResultHandler.postMessage({
                            type: 'syncResult',
                            itemId: itemId,
                            success: false,
                            error: e.message
                        });
                    }
                };
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
        case "session":
            handleSession(body: body)
        case "syncResult":
            handleSyncResult(body: body)
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

    private func handleSyncResult(body: [String: Any]) {
        guard let itemId = body["itemId"] as? String,
              let success = body["success"] as? Bool else {
            print("❌ handleSyncResult: Invalid sync result data")
            return
        }

        let errorMessage = body["error"] as? String ?? ""
        print(success ? "✅ Sync succeeded for item: \(itemId)" : "❌ Sync failed for item: \(itemId) - \(errorMessage)")

        NotificationCenter.default.post(
            name: NSNotification.Name("InboxItemSynced"),
            object: nil,
            userInfo: [
                "itemId": itemId,
                "success": success,
                "error": errorMessage
            ]
        )
    }

    private func handleSession(body: [String: Any]) {
        guard let accessToken = body["access_token"] as? String,
              let userId = body["user_id"] as? String else {
            print("❌ Session: Invalid session data")
            return
        }

        print("🔑 Session: Received session token for user \(userId)")

        let tokenStore = KeychainTokenStore(
            service: "com.breadchris.list",
            account: "supabase_access_token",
            accessGroup: "group.com.breadchris.share"
        )

        do {
            try tokenStore.write(accessToken)
            print("✅ Session: Access token saved to shared Keychain")

            if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
                sharedContainer.set(userId, forKey: "user_id")
                sharedContainer.synchronize()
                print("✅ Session: User ID saved to shared container")

                // Fetch and cache the default group_id for share extension use
                fetchAndCacheGroupId(userId: userId, accessToken: accessToken)
            }

            // Sync inbox after session is established via WebView
            print("🔄 Session: Session established, triggering inbox sync...")
            NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
        } catch {
            print("❌ Session: Failed to save token: \(error)")
        }
    }

    private func fetchAndCacheGroupId(userId: String, accessToken: String) {
        let supabaseUrl = "https://zazsrepfnamdmibcyenx.supabase.co"
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/group_memberships?user_id=eq.\(userId)&select=group_id&limit=1") else {
            print("❌ Session: Failed to construct group membership URL")
            return
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("public", forHTTPHeaderField: "apikey")

        print("🔍 Session: Fetching default group for user \(userId)...")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ Session: Failed to fetch group: \(error.localizedDescription)")
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let firstGroup = json.first,
                  let groupId = firstGroup["group_id"] as? String else {
                print("⚠️ Session: No group found for user, user may need to create/join a group")
                return
            }

            if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
                sharedContainer.set(groupId, forKey: "default_group_id")
                sharedContainer.synchronize()
                print("✅ Session: Cached default group_id: \(groupId)")
            }
        }.resume()
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
    var onRefresh: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(onRefresh: onRefresh)
    }

    func makeUIView(context: Context) -> WKWebView {
        // Set up pull-to-refresh
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Updates handled by WebViewStore
    }

    class Coordinator: NSObject {
        var onRefresh: (() -> Void)?

        init(onRefresh: (() -> Void)?) {
            self.onRefresh = onRefresh
        }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            onRefresh?()
            // End refreshing after a short delay to show the animation
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                sender.endRefreshing()
            }
        }
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

// MARK: - Shake Gesture Detection
#if DEBUG
extension NSNotification.Name {
    static let deviceDidShake = NSNotification.Name("deviceDidShake")
}

extension UIWindow {
    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: .deviceDidShake, object: nil)
        }
        super.motionEnded(motion, with: event)
    }
}
#endif

#Preview {
    ContentView()
}