//
//  ShareViewController.swift
//  ext
//
//  Created by hacked on 11/13/24.
//

import UIKit
import Social
import Security

class ShareViewController: SLComposeServiceViewController {
    
    // Supabase configuration - matches your list app
    private let supabaseURL = "https://zazsrepfnamdmibcyenx.supabase.co"
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM"
    private var defaultGroupID: String?

    override func isContentValid() -> Bool {
        // Do validation of contentText and/or NSExtensionContext attachments here
        return true
    }

    override func didSelectPost() {
        // This is called after the user selects Post. Do the upload of contentText and/or NSExtensionContext attachments.
        
        // First, get the session token from shared container or API key from Keychain  
        var sessionToken: String?
        
        print("🔍 ShareExtension: Starting authentication lookup...")
        
        // Try to get Supabase access token from shared container first
        if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
            print("✅ ShareExtension: Shared container accessible")
            
            // Force refresh from disk before reading
            sharedContainer.synchronize()
            print("🔄 ShareExtension: Forced synchronization")
            
            // Try up to 3 times with small delays for process synchronization
            var accessToken: String?
            var refreshToken: String?
            var userId: String?
            var apiKey: String?
            var authTimestamp: Any?
            
            for attempt in 1...3 {
                print("🔍 ShareExtension: Attempt \(attempt)/3 - Reading shared container...")
                
                accessToken = sharedContainer.string(forKey: "supabase_access_token")
                refreshToken = sharedContainer.string(forKey: "supabase_refresh_token")
                userId = sharedContainer.string(forKey: "supabase_user_id")
                apiKey = sharedContainer.string(forKey: "api_key")
                authTimestamp = sharedContainer.object(forKey: "auth_timestamp")
                
                // If we found any auth data, break out of retry loop
                if accessToken != nil || apiKey != nil {
                    print("✅ ShareExtension: Found auth data on attempt \(attempt)")
                    break
                }
                
                // Wait briefly and force another sync before next attempt
                if attempt < 3 {
                    print("⏳ ShareExtension: No data found, waiting 0.5s before retry...")
                    Thread.sleep(forTimeInterval: 0.5)
                    sharedContainer.synchronize()
                }
            }
            
            print("📊 ShareExtension: Final shared container contents:")
            print("  - supabase_access_token: \(accessToken?.prefix(20) ?? "nil")...")
            print("  - supabase_refresh_token: \(refreshToken?.prefix(20) ?? "nil")...")
            print("  - supabase_user_id: \(userId ?? "nil")")
            print("  - api_key: \(apiKey?.prefix(20) ?? "nil")...")
            print("  - auth_timestamp: \(authTimestamp ?? "nil")")
            
            if let accessToken = accessToken {
                sessionToken = accessToken
                print("✅ ShareExtension: Using Supabase access token")
            } else if let apiKey = apiKey {
                sessionToken = apiKey
                print("✅ ShareExtension: Using API key from shared container")
            }
        } else {
            print("❌ ShareExtension: Failed to access shared container")
        }
        
        // Fallback to API key from Keychain
        if sessionToken == nil {
            print("🔑 ShareExtension: Checking Keychain for API key...")
            if let apiKey = getAPIKeyFromKeychain() {
                sessionToken = apiKey
                print("✅ ShareExtension: Found API key in Keychain: \(apiKey.prefix(20))...")
            } else {
                print("❌ ShareExtension: No API key found in Keychain")
            }
        }
        
        guard let token = sessionToken else {
            print("❌ ShareExtension: No authentication found anywhere")
            self.showError("Please open the main app and log in first to enable sharing.")
            return
        }
        
        print("🎯 ShareExtension: Using token: \(token.prefix(20))...")
        
        // Get default group first, then process the shared content
        getDefaultGroup(session: token) { [weak self] groupID in
            guard let self = self else { return }
            
            self.defaultGroupID = groupID
            
            if let item = self.extensionContext?.inputItems.first as? NSExtensionItem,
               let itemProvider = item.attachments?.first {

                if itemProvider.hasItemConformingToTypeIdentifier("public.url") {
                    itemProvider.loadItem(forTypeIdentifier: "public.url", options: nil) { (url, error) in
                        if let shareURL = url as? URL {
                            self.sendToSupabase(url: shareURL, session: token)
                        } else {
                            DispatchQueue.main.async {
                                self.showError("Failed to get URL from shared content")
                            }
                        }
                    }
                } else if itemProvider.hasItemConformingToTypeIdentifier("public.plain-text") {
                    itemProvider.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { (text, error) in
                        if let sharedText = text as? String {
                            self.sendTextToSupabase(text: sharedText, session: token)
                        } else {
                            DispatchQueue.main.async {
                                self.showError("Failed to get text from shared content")
                            }
                        }
                    }
                } else {
                    self.showError("Unsupported content type. Please share URLs or text.")
                }
            } else {
                self.showError("No content to share")
            }
        }
    }
    
    private func getAPIKeyFromKeychain() -> String? {
        let service = "list.app"
        let account = "api_key"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let apiKey = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return apiKey
    }
    
    private func getDefaultGroup(session: String, completion: @escaping (String?) -> Void) {
        // Get user's first group from Supabase
        guard let requestURL = URL(string: "\(supabaseURL)/rest/v1/groups?select=id&limit=1") else {
            completion(nil)
            return
        }
        
        var request = URLRequest(url: requestURL)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(session)", forHTTPHeaderField: "Authorization")
        request.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let firstGroup = json.first,
                  let groupID = firstGroup["id"] as? String else {
                completion(nil)
                return
            }
            
            completion(groupID)
        }
        task.resume()
    }
    
    private func sendToSupabase(url: URL, session: String) {
        // Get the user's comment/note if any
        let userComment = self.contentText ?? ""
        
        // Create the request to send the URL directly to Supabase
        guard let requestURL = URL(string: "\(supabaseURL)/rest/v1/content") else {
            DispatchQueue.main.async {
                self.showError("Invalid Supabase URL")
            }
            return
        }
        
        var request = URLRequest(url: requestURL)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(session)", forHTTPHeaderField: "Authorization")
        request.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        // Match your Supabase schema: content table expects type, data, group_id
        // user_id will be automatically set by Supabase from the JWT token
        let body: [String: Any] = [
            "type": "url",
            "data": "\(url.absoluteString)\(userComment.isEmpty ? "" : "\n\n\(userComment)")",
            "group_id": defaultGroupID ?? ""
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            DispatchQueue.main.async {
                self.showError("Failed to prepare request")
            }
            return
        }

        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("Error sending URL: \(error)")
                    self.showError("Failed to save URL: \(error.localizedDescription)")
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                        print("Successfully sent URL to Supabase")
                        self.showSuccess("URL saved to your list!")
                    } else if httpResponse.statusCode == 401 {
                        self.showError("Authentication failed. Please open the main app and log in again.")
                    } else if httpResponse.statusCode == 403 {
                        self.showError("Insufficient permissions. Please check your access.")
                    } else {
                        print("Supabase returned status code: \(httpResponse.statusCode)")
                        if let data = data,
                           let responseBody = String(data: data, encoding: .utf8) {
                            print("Response body: \(responseBody)")
                        }
                        self.showError("Database error (status: \(httpResponse.statusCode))")
                    }
                } else {
                    self.showError("Invalid server response")
                }
            }
        }
        task.resume()
    }
    
    private func sendTextToSupabase(text: String, session: String) {
        // Get the user's comment/note if any
        let userComment = self.contentText ?? ""
        
        // Create the request to send the text directly to Supabase
        guard let requestURL = URL(string: "\(supabaseURL)/rest/v1/content") else {
            DispatchQueue.main.async {
                self.showError("Invalid Supabase URL")
            }
            return
        }
        
        var request = URLRequest(url: requestURL)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(session)", forHTTPHeaderField: "Authorization")
        request.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        // Match your Supabase schema: content table expects type, data, group_id
        // user_id will be automatically set by Supabase from the JWT token
        let body: [String: Any] = [
            "type": "text", 
            "data": "\(text)\(userComment.isEmpty ? "" : "\n\n\(userComment)")",
            "group_id": defaultGroupID ?? ""
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            DispatchQueue.main.async {
                self.showError("Failed to prepare request")
            }
            return
        }

        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("Error sending text: \(error)")
                    self.showError("Failed to save text: \(error.localizedDescription)")
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                        print("Successfully sent text to Supabase")
                        self.showSuccess("Text saved to your list!")
                    } else if httpResponse.statusCode == 401 {
                        self.showError("Authentication failed. Please open the main app and log in again.")
                    } else if httpResponse.statusCode == 403 {
                        self.showError("Insufficient permissions. Please check your access.")
                    } else {
                        print("Supabase returned status code: \(httpResponse.statusCode)")
                        if let data = data,
                           let responseBody = String(data: data, encoding: .utf8) {
                            print("Response body: \(responseBody)")
                        }
                        self.showError("Database error (status: \(httpResponse.statusCode))")
                    }
                } else {
                    self.showError("Invalid server response")
                }
            }
        }
        task.resume()
    }
    
    private func showError(_ message: String) {
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        })
        self.present(alert, animated: true)
    }
    
    private func showSuccess(_ message: String) {
        let alert = UIAlertController(title: "Success", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        })
        self.present(alert, animated: true)
    }

    override func configurationItems() -> [Any]! {
        // To add configuration options via table cells at the bottom of the sheet, return an array of SLComposeSheetConfigurationItem here.
        return []
    }
}
