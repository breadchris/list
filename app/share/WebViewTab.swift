//
//  WebViewTab.swift
//  share
//
//  WebView tab for List app (extracted from ContentView)
//

import SwiftUI
import WebKit
import AuthenticationServices

struct WebViewTab: View {
    @StateObject private var webViewStore = WebViewStore()
    @State private var showingAPIKeyAlert = false
    @State private var apiKeyMessage = ""
    @State private var isAuthenticating = false
    @State private var topSafeAreaColor: Color = Color(hex: "#000000")
    @State private var bottomSafeAreaColor: Color = Color(hex: "#000000")
    #if DEBUG
    @State private var showingDebugView = false
    #endif
    private let presentationContextProvider = ASWebAuthenticationPresentationContextProvider()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Colored safe area backgrounds
                VStack(spacing: 0) {
                    topSafeAreaColor
                        .frame(height: geometry.safeAreaInsets.top)
                    Spacer()
                    bottomSafeAreaColor
                        .frame(height: geometry.safeAreaInsets.bottom)
                }
                .ignoresSafeArea()

                // WebView fills the entire screen
                WebView(webView: webViewStore.webView, onRefresh: {
                    webViewStore.webView.reload()
                })
                .ignoresSafeArea()
            }
        }
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
            print("🔄 WebViewTab: App appeared, will sync inbox after WebView loads...")
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
        print("🔍 WebViewTab: Loading app from: \(appURL)")
        print("🏗️ WebViewTab: Environment: \(isRunningInSimulator() ? "Simulator" : "Physical Device")")

        // Test server connectivity first
        testServerConnectivity(appURL: appURL) { isReachable in
            DispatchQueue.main.async {
                if isReachable {
                    print("✅ WebViewTab: Server is reachable, loading in WKWebView")
                    guard let url = URL(string: appURL) else {
                        print("❌ WebViewTab: Failed to create URL from: \(appURL)")
                        return
                    }

                    print("🔧 WebViewTab: Creating URLRequest for: \(url)")
                    var request = URLRequest(url: url)
                    request.cachePolicy = .returnCacheDataElseLoad

                    print("🔧 WebViewTab: WKWebView delegate assigned: \(self.webViewStore.webView.navigationDelegate != nil)")
                    print("🔧 WebViewTab: Starting WKWebView.load() call...")

                    self.webViewStore.webView.load(request)

                    print("🔧 WebViewTab: WKWebView.load() call completed")

                    // Add a timeout check to see if navigation starts
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        let currentURL = self.webViewStore.webView.url?.absoluteString ?? "nil"
                        let isLoading = self.webViewStore.webView.isLoading
                        print("🕐 WebViewTab: After 2s - URL: \(currentURL), isLoading: \(isLoading)")
                    }
                } else {
                    print("❌ WebViewTab: Server is not reachable")
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
        request.timeoutInterval = 15.0
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")

        print("🌐 WebViewTab: Testing connectivity to: \(url)")
        print("⏱️ WebViewTab: Timeout set to: \(request.timeoutInterval)s")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                let nsError = error as NSError
                print("❌ WebViewTab: Server connectivity test failed: \(error.localizedDescription)")
                print("📊 WebViewTab: Error domain: \(nsError.domain), code: \(nsError.code)")
                let userInfo = nsError.userInfo
                if !userInfo.isEmpty {
                    print("📋 WebViewTab: Error details: \(userInfo)")
                }
                completion(false)
            } else if let httpResponse = response as? HTTPURLResponse {
                print("📡 WebViewTab: Server responded with status: \(httpResponse.statusCode)")
                print("📋 WebViewTab: Response headers: \(httpResponse.allHeaderFields)")
                completion(httpResponse.statusCode < 400)
            } else {
                print("❓ WebViewTab: Unexpected response type")
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
            return "http://localhost:3000"
        } else {
            return "https://justshare.io"
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

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("TestSharedURL"),
            object: nil,
            queue: .main
        ) { notification in
            print("🧪 Test: Received test shared URL notification")
            if let shareKey = notification.userInfo?["shareKey"] as? String {
                print("🧪 Test: Processing test share key: \(shareKey)")
            }
            Task {
                await InboxDrainer.shared.drainInboxAsync()
            }
        }

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

            do {
                let inbox = try SharedInbox(appGroupId: "group.com.breadchris.share")
                let files = try inbox.drain()
                for fileURL in files {
                    if fileURL.lastPathComponent.hasPrefix(itemId) ||
                       fileURL.lastPathComponent.contains(itemId) {
                        inbox.remove(fileURL)
                        print("✅ WebViewTab: Removed synced item from inbox: \(itemId)")
                    }
                }
            } catch {
                print("❌ WebViewTab: Failed to remove synced item: \(error)")
            }
        }

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("TriggerInboxSync"),
            object: nil,
            queue: .main
        ) { [self] _ in
            print("🔄 WebViewTab: Received TriggerInboxSync notification")
            syncPendingItems()
        }

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name("SafeAreaColorChanged"),
            object: nil,
            queue: .main
        ) { [self] notification in
            if let topColorHex = notification.userInfo?["topColor"] as? String {
                topSafeAreaColor = Color(hex: topColorHex)
            }
            if let bottomColorHex = notification.userInfo?["bottomColor"] as? String {
                bottomSafeAreaColor = Color(hex: bottomColorHex)
            }
        }
    }

    private func syncPendingItems() {
        print("🔄 WebViewTab: Syncing pending inbox items via WebView...")

        do {
            let inbox = try SharedInbox(appGroupId: "group.com.breadchris.share")
            let files = try inbox.drain()

            guard !files.isEmpty else {
                print("📭 WebViewTab: No pending items to sync")
                return
            }

            print("📊 WebViewTab: Found \(files.count) pending items to sync")

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

                    print("📤 WebViewTab: Calling syncSharedURL for item \(itemId)")
                    webViewStore.webView.evaluateJavaScript(script) { result, error in
                        if let error = error {
                            print("❌ WebViewTab: JavaScript error for \(itemId): \(error.localizedDescription)")
                        }
                    }
                } catch {
                    print("❌ WebViewTab: Error reading inbox item \(fileURL.lastPathComponent): \(error)")
                }
            }
        } catch {
            print("❌ WebViewTab: Failed to access inbox: \(error)")
        }
    }

    private func performGoogleAuthentication(authURL: String) {
        guard !isAuthenticating else { return }

        print("🔧 OAuth: Starting native Supabase authentication")
        isAuthenticating = true

        Task {
            do {
                // Use Supabase SDK's built-in OAuth with ASWebAuthenticationSession
                try await SupabaseManager.shared.client.auth.signInWithOAuth(
                    provider: .google
                ) { (session: ASWebAuthenticationSession) in
                    session.presentationContextProvider = self.presentationContextProvider
                    session.prefersEphemeralWebBrowserSession = false
                }

                print("✅ OAuth: Session established via Supabase SDK")

                await MainActor.run {
                    isAuthenticating = false
                    // Reload WebView to reflect authenticated state
                    webViewStore.webView.reload()
                    // Trigger inbox sync
                    NotificationCenter.default.post(
                        name: NSNotification.Name("TriggerInboxSync"),
                        object: nil
                    )
                }
            } catch {
                print("❌ OAuth error: \(error)")

                await MainActor.run {
                    isAuthenticating = false

                    // Check if user just cancelled
                    if let authError = error as? ASWebAuthenticationSessionError,
                       authError.code == .canceledLogin {
                        print("👤 OAuth: User canceled login")
                        return
                    }

                    apiKeyMessage = "Authentication failed: \(error.localizedDescription)"
                    showingAPIKeyAlert = true
                }
            }
        }
    }

    private func processSharedURLInWebView(payload: [String: Any], apiKey: String) {
        guard let payloadData = try? JSONSerialization.data(withJSONObject: payload),
              let payloadJSON = String(data: payloadData, encoding: .utf8) else {
            print("❌ WebViewTab: Failed to serialize shared URL payload")
            return
        }

        let script = """
            (function() {
                const payload = \(payloadJSON);
                const apiKey = '\(apiKey)';

                console.log('📤 Processing shared URL:', payload);

                let attemptCount = 0;
                const maxAttempts = 20;

                function attemptToShareURL() {
                    attemptCount++;
                    console.log('🔍 Shared URL: Attempt', attemptCount + '/' + maxAttempts, '- Checking for app readiness...');

                    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
                        console.log('✅ Shared URL: Supabase client found, checking auth...');

                        window.supabase.auth.getSession().then(({ data: { session }, error }) => {
                            if (error) {
                                console.error('❌ Shared URL: Auth check failed:', error);
                                return;
                            }

                            if (session) {
                                console.log('✅ Shared URL: User authenticated, sending to Supabase...');

                                window.supabase
                                    .from('shared_urls')
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
                                        }
                                    });
                            } else {
                                console.log('⚠️ Shared URL: User not authenticated');
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
                print("❌ WebViewTab: Failed to execute shared URL script: \(error.localizedDescription)")
            } else {
                print("✅ WebViewTab: Shared URL script executed successfully")
            }
        }
    }
}

// MARK: - WebView Store

class WebViewStore: ObservableObject {
    let webView: WKWebView
    private let navigationDelegate: NavigationDelegate
    private var authStateTask: Task<Void, Never>?

    init() {
        let configuration = WKWebViewConfiguration()

        let websiteDataStore = WKWebsiteDataStore.default()
        configuration.websiteDataStore = websiteDataStore

        configuration.preferences.setValue(true, forKey: "offlineApplicationCacheIsEnabled")

        let contentController = WKUserContentController()
        let messageHandler = MessageHandler()
        contentController.add(messageHandler, name: "apiKeyHandler")
        contentController.add(messageHandler, name: "authHandler")
        contentController.add(messageHandler, name: "consoleHandler")
        contentController.add(messageHandler, name: "sessionHandler")
        contentController.add(messageHandler, name: "syncResultHandler")
        contentController.add(messageHandler, name: "statusBarHandler")
        contentController.add(messageHandler, name: "safeAreaHandler")
        contentController.add(messageHandler, name: "webviewHandler")
        configuration.userContentController = contentController

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

                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', interceptGoogleAuth);
                } else {
                    interceptGoogleAuth();
                }

                const observer = new MutationObserver(function(mutations) {
                    interceptGoogleAuth();
                });
                observer.observe(document.body, { childList: true, subtree: true });

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

                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', captureSession);
                } else {
                    captureSession();
                }

                const sessionObserver = new MutationObserver(function() {
                    captureSession();
                });
                sessionObserver.observe(document.body, { childList: true, subtree: true });

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

                window.setSafeAreaColors = function(topColor, bottomColor) {
                    window.webkit.messageHandlers.safeAreaHandler.postMessage({
                        type: 'safeArea',
                        topColor: topColor,
                        bottomColor: bottomColor
                    });
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

        // Listen for Supabase auth state changes
        setupAuthStateListener()
    }

    private func setupAuthStateListener() {
        authStateTask = Task {
            for await (event, session) in SupabaseManager.shared.client.auth.authStateChanges {
                print("🔐 WebViewStore: Auth state changed: \(event)")
                if session != nil {
                    // Session established - trigger inbox sync
                    await MainActor.run {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("TriggerInboxSync"),
                            object: nil
                        )
                    }
                }
            }
        }
    }

    deinit {
        authStateTask?.cancel()
    }
}

// MARK: - Message Handler

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
        case "statusBar":
            handleStatusBar(body: body)
        case "safeArea":
            handleSafeAreaColor(body: body)
        case "openUrl":
            handleOpenUrl(body: body)
        default:
            print("Unknown message type: \(type)")
        }
    }

    private func handleAPIKey(body: [String: Any]) {
        guard let token = body["token"] as? String else {
            return
        }

        let name = body["name"] as? String ?? "Mobile App Key"

        if storeAPIKeyInKeychain(token: token, name: name) {
            print("API key stored successfully in Keychain")

            if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
                sharedContainer.set(token, forKey: "api_key")
                sharedContainer.synchronize()
                print("✅ API key also stored in shared container")
            }

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

    private func handleStatusBar(body: [String: Any]) {
        guard let hidden = body["hidden"] as? Bool else {
            return
        }
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: NSNotification.Name("StatusBarVisibilityChanged"),
                object: nil,
                userInfo: ["hidden": hidden]
            )
        }
    }

    private func handleSafeAreaColor(body: [String: Any]) {
        let topColor = body["topColor"] as? String ?? body["color"] as? String ?? "#000000"
        let bottomColor = body["bottomColor"] as? String ?? body["color"] as? String ?? "#000000"

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: NSNotification.Name("SafeAreaColorChanged"),
                object: nil,
                userInfo: [
                    "topColor": topColor,
                    "bottomColor": bottomColor
                ]
            )
        }
    }

    private func handleOpenUrl(body: [String: Any]) {
        guard let url = body["url"] as? String else {
            print("❌ OpenUrl: Missing URL")
            return
        }

        let title = body["title"] as? String ?? url
        print("🔗 OpenUrl: Opening \(url) with title: \(title)")

        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: NSNotification.Name("OpenWebview"),
                object: nil,
                userInfo: [
                    "url": url,
                    "title": title
                ]
            )
        }
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

                fetchAndCacheGroupId(userId: userId, accessToken: accessToken)
            }

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

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: token.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
}

// MARK: - Navigation Delegate

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

        if url.host?.contains("accounts.google.com") == true ||
           url.absoluteString.contains("supabase.co/auth") ||
           url.absoluteString.contains("/auth/google") {
            print("🚫 NavigationDelegate: Blocking OAuth URL from WKWebView: \(url)")

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

// MARK: - WebView UIViewRepresentable

struct WebView: UIViewRepresentable {
    let webView: WKWebView
    var onRefresh: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(webView: webView, onRefresh: onRefresh)
    }

    func makeUIView(context: Context) -> WKWebView {
        let edgeSwipe = UIScreenEdgePanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleEdgeSwipe(_:))
        )
        edgeSwipe.edges = .left
        edgeSwipe.delegate = context.coordinator
        webView.addGestureRecognizer(edgeSwipe)

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let webView: WKWebView
        var onRefresh: (() -> Void)?

        init(webView: WKWebView, onRefresh: (() -> Void)?) {
            self.webView = webView
            self.onRefresh = onRefresh
            super.init()
        }

        @objc func handleEdgeSwipe(_ recognizer: UIScreenEdgePanGestureRecognizer) {
            if recognizer.state == .ended {
                webView.evaluateJavaScript("window.history.back();", completionHandler: nil)
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                              shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            return true
        }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            let dataTypes: Set<String> = [
                WKWebsiteDataTypeDiskCache,
                WKWebsiteDataTypeMemoryCache
            ]
            webView.configuration.websiteDataStore.removeData(
                ofTypes: dataTypes,
                modifiedSince: Date.distantPast
            ) { [weak self] in
                self?.onRefresh?()
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                sender.endRefreshing()
            }
        }
    }
}

// MARK: - ASWebAuthenticationSession Presentation Context Provider

class ASWebAuthenticationPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        print("🔍 PresentationContextProvider: Finding presentation anchor...")

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
