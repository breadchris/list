//
//  TestHelpers.swift
//  share
//
//  Testing and debugging utilities
//

import Foundation
import UIKit

class TestHelpers {
    
    /// Test App Group connectivity
    static func testAppGroup() -> Bool {
        guard let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") else {
            print("❌ Test: App Group not accessible")
            return false
        }
        
        // Test write/read
        let testKey = "test_\(Date().timeIntervalSince1970)"
        let testValue = "Hello from main app"
        
        sharedContainer.set(testValue, forKey: testKey)
        sharedContainer.synchronize()
        
        let readValue = sharedContainer.string(forKey: testKey)
        let success = readValue == testValue
        
        print(success ? "✅ Test: App Group working" : "❌ Test: App Group read/write failed")
        
        // Cleanup
        sharedContainer.removeObject(forKey: testKey)
        sharedContainer.synchronize()
        
        return success
    }
    
    /// Test Keychain access
    static func testKeychain() -> Bool {
        let service = "list.app"
        let account = "test_key"
        let testValue = "test_api_key_123"
        
        // Test write
        let writeQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: testValue.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(writeQuery as CFDictionary) // Remove if exists
        let writeStatus = SecItemAdd(writeQuery as CFDictionary, nil)
        
        if writeStatus != errSecSuccess {
            print("❌ Test: Keychain write failed with status: \(writeStatus)")
            return false
        }
        
        // Test read
        let readQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let readStatus = SecItemCopyMatching(readQuery as CFDictionary, &result)
        
        let success = readStatus == errSecSuccess && 
                     (result as? Data).flatMap({ String(data: $0, encoding: .utf8) }) == testValue
        
        print(success ? "✅ Test: Keychain working" : "❌ Test: Keychain read failed")
        
        // Cleanup
        SecItemDelete(writeQuery as CFDictionary)
        
        return success
    }
    
    /// Simulate a shared URL for testing
    static func simulateSharedURL(url: String, title: String? = nil) {
        guard let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") else {
            print("❌ Test: Cannot simulate share - App Group not accessible")
            return
        }
        
        let shareData: [String: Any] = [
            "url": url,
            "title": title ?? "Test URL",
            "timestamp": Date().timeIntervalSince1970,
            "processed": false
        ]
        
        let shareKey = "share_test_\(Int(Date().timeIntervalSince1970))"
        sharedContainer.set(shareData, forKey: shareKey)
        sharedContainer.set(shareKey, forKey: "latest_share")
        sharedContainer.synchronize()
        
        print("✅ Test: Simulated shared URL - \(url)")
        print("📝 Test: Use key '\(shareKey)' to check processing")
        
        // Trigger processing
        NotificationCenter.default.post(
            name: NSNotification.Name("TestSharedURL"),
            object: nil,
            userInfo: ["shareKey": shareKey]
        )
    }
    
    /// Check shared container contents
    static func inspectSharedContainer() {
        guard let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") else {
            print("❌ Test: App Group not accessible for inspection")
            return
        }
        
        print("🔍 Test: Shared Container Contents:")
        let dict = sharedContainer.dictionaryRepresentation()
        
        for (key, value) in dict {
            if key.hasPrefix("share_") || key == "latest_share" || key == "api_key" {
                print("  📝 \(key): \(value)")
            }
        }
        
        if dict.isEmpty {
            print("  (empty)")
        }
    }
    
    /// Test URL sharing by creating a test item and draining inbox
    static func testURLScheme() {
        let testURL = "https://example.com/test-\(UUID().uuidString.prefix(8))"

        print("🔗 Test: Testing URL sharing flow - \(testURL)")

        do {
            // Create a test item in the inbox
            let inbox = try SharedInbox(appGroupId: "group.com.breadchris.share")
            let item = ShareItem(url: testURL)
            try inbox.enqueue(item)
            print("✅ Test: Created test inbox item: \(item.id)")

            // Trigger inbox drain
            Task {
                let success = await InboxDrainer.shared.drainInboxAsync()
                print("🔄 Test: Inbox drain result: \(success ? "success" : "failed")")
            }
        } catch {
            print("❌ Test: Failed to create test inbox item: \(error)")
        }
    }
    
    /// Generate test API key and store it
    static func generateTestAPIKey() -> String {
        let testAPIKey = "ak_test_\(UUID().uuidString.prefix(8))"
        
        // Store in keychain
        let service = "list.app"
        let account = "api_key"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: testAPIKey.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            print("✅ Test: Generated test API key - \(testAPIKey)")
            
            // Also store in shared container
            if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
                sharedContainer.set(testAPIKey, forKey: "api_key")
                sharedContainer.synchronize()
                print("✅ Test: API key also stored in shared container")
            }
        } else {
            print("❌ Test: Failed to store test API key")
        }
        
        return testAPIKey
    }
    
    /// Clear all test data
    static func clearTestData() {
        // Clear keychain
        let keychainQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "list.app"
        ]
        SecItemDelete(keychainQuery as CFDictionary)
        
        // Clear shared container
        if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
            let dict = sharedContainer.dictionaryRepresentation()
            for key in dict.keys {
                if key.hasPrefix("share_") || key.hasPrefix("test_") || key == "latest_share" || key == "api_key" {
                    sharedContainer.removeObject(forKey: key)
                }
            }
            sharedContainer.synchronize()
        }
        
        print("🧹 Test: Cleared all test data")
    }
}