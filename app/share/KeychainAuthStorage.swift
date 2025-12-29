//
//  KeychainAuthStorage.swift
//  share
//
//  Custom auth storage for Supabase Swift SDK using shared Keychain
//  Enables session sharing between main app and share extension via App Group
//

import Foundation
import Auth

final class KeychainAuthStorage: AuthLocalStorage {
    private let service = "com.breadchris.list.supabase"
    private let accessGroup = "group.com.breadchris.share"

    func store(key: String, value: Data) throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        // Delete existing item first
        SecItemDelete(query as CFDictionary)

        // Add the new value
        query[kSecValueData as String] = value
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.storeFailed(status: status)
        }

        print("✅ KeychainAuthStorage: Stored key '\(key)' (\(value.count) bytes)")
    }

    func retrieve(key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            print("📭 KeychainAuthStorage: Key '\(key)' not found")
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainError.retrieveFailed(status: status)
        }

        let data = result as? Data
        print("✅ KeychainAuthStorage: Retrieved key '\(key)' (\(data?.count ?? 0) bytes)")
        return data
    }

    func remove(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup
        ]

        let status = SecItemDelete(query as CFDictionary)

        // errSecItemNotFound is acceptable - item may not exist
        if status != errSecSuccess && status != errSecItemNotFound {
            throw KeychainError.removeFailed(status: status)
        }

        print("✅ KeychainAuthStorage: Removed key '\(key)'")
    }
}

// MARK: - Keychain Errors

enum KeychainError: LocalizedError {
    case storeFailed(status: OSStatus)
    case retrieveFailed(status: OSStatus)
    case removeFailed(status: OSStatus)

    var errorDescription: String? {
        switch self {
        case .storeFailed(let status):
            return "Failed to store in Keychain: \(status)"
        case .retrieveFailed(let status):
            return "Failed to retrieve from Keychain: \(status)"
        case .removeFailed(let status):
            return "Failed to remove from Keychain: \(status)"
        }
    }
}
