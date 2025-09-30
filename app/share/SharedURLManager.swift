//
//  SharedURLManager.swift
//  share
//
//  Manages shared URLs between share extension and main app
//

import Foundation

class SharedURLManager: ObservableObject {
    static let shared = SharedURLManager()
    
    private let sharedContainer: UserDefaults?
    
    private init() {
        self.sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share")
    }
    
    /// Check for new shared URLs and process them
    func checkForSharedURLs() {
        guard let container = sharedContainer else { return }
        
        // Get the latest share key
        guard let latestShareKey = container.object(forKey: "latest_share") as? String,
              let shareData = container.object(forKey: latestShareKey) as? [String: Any],
              let processed = shareData["processed"] as? Bool,
              !processed else {
            return
        }
        
        // Extract the URL data
        guard let urlString = shareData["url"] as? String,
              let url = URL(string: urlString) else {
            print("❌ SharedURLManager: Invalid URL in share data")
            return
        }
        
        let title = shareData["title"] as? String
        let timestamp = shareData["timestamp"] as? TimeInterval ?? Date().timeIntervalSince1970
        
        print("📥 SharedURLManager: Processing shared URL: \(url)")
        
        // Process the URL
        processSharedURL(url: url, title: title, timestamp: timestamp)
        
        // Mark as processed
        var updatedShareData = shareData
        updatedShareData["processed"] = true
        container.set(updatedShareData, forKey: latestShareKey)
        container.synchronize()
    }
    
    /// Process a shared URL by sending it to Supabase
    private func processSharedURL(url: URL, title: String?, timestamp: TimeInterval) {
        // Get the API key from keychain or shared storage
        guard let apiKey = getAPIKey() else {
            print("❌ SharedURLManager: No API key found")
            showErrorNotification("Please set up your API key in the app first")
            return
        }
        
        print("🔑 SharedURLManager: Using API key for URL processing")
        
        // Create the share data for Supabase
        let sharePayload: [String: Any] = [
            "url": url.absoluteString,
            "title": title ?? "",
            "shared_at": ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: timestamp)),
            "source": "ios_share_extension"
        ]
        
        // Send to Supabase via the web interface
        sendToSupabaseViaWebView(payload: sharePayload, apiKey: apiKey)
    }
    
    /// Get API key from keychain or shared storage
    private func getAPIKey() -> String? {
        // Try keychain first
        if let apiKey = getAPIKeyFromKeychain() {
            return apiKey
        }
        
        // Fallback to shared container
        return sharedContainer?.string(forKey: "api_key")
    }
    
    /// Get API key from keychain
    private func getAPIKeyFromKeychain() -> String? {
        let service = "list.app"
        let account = "api_key"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess,
           let data = result as? Data,
           let apiKey = String(data: data, encoding: .utf8) {
            return apiKey
        }
        
        return nil
    }
    
    /// Send URL to Supabase via the WebView
    private func sendToSupabaseViaWebView(payload: [String: Any], apiKey: String) {
        DispatchQueue.main.async {
            // Post notification to trigger JavaScript execution in WebView
            NotificationCenter.default.post(
                name: NSNotification.Name("ProcessSharedURL"),
                object: nil,
                userInfo: [
                    "payload": payload,
                    "apiKey": apiKey
                ]
            )
        }
    }
    
    /// Show error notification
    private func showErrorNotification(_ message: String) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: NSNotification.Name("SharedURLError"),
                object: nil,
                userInfo: ["message": message]
            )
        }
    }
    
    /// Handle URL schemes from share extension
    func handleURLScheme(_ url: URL) {
        guard url.scheme == "list",
              url.host == "share",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let shareKey = components.queryItems?.first(where: { $0.name == "key" })?.value else {
            print("❌ SharedURLManager: Invalid URL scheme: \(url)")
            return
        }
        
        print("🔗 SharedURLManager: Handling URL scheme with share key: \(shareKey)")
        
        // The shared URL should already be in the container, just trigger processing
        checkForSharedURLs()
    }
}