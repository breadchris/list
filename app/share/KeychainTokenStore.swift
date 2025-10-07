//
//  KeychainTokenStore.swift
//  share
//
//  Keychain storage for Supabase session tokens shared between app and extension
//

import Foundation
import Security

protocol TokenStorage {
    func read() throws -> String?
    func write(_ token: String) throws
    func clear() throws
}

final class KeychainTokenStore: TokenStorage {
    private let service: String
    private let account: String
    private let accessGroup: String?

    init(service: String, account: String, accessGroup: String? = nil) {
        self.service = service
        self.account = account
        self.accessGroup = accessGroup
    }

    func read() throws -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        if let ag = accessGroup {
            query[kSecAttrAccessGroup as String] = ag
        }

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess, let data = result as? Data else {
            throw NSError(domain: "KeychainTokenStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Failed to read from Keychain"])
        }

        return String(data: data, encoding: .utf8)
    }

    func write(_ token: String) throws {
        let data = Data(token.utf8)
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if let ag = accessGroup {
            query[kSecAttrAccessGroup as String] = ag
        }

        SecItemDelete(query as CFDictionary)

        query[kSecValueData as String] = data
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw NSError(domain: "KeychainTokenStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Failed to write to Keychain"])
        }
    }

    func clear() throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if let ag = accessGroup {
            query[kSecAttrAccessGroup as String] = ag
        }

        SecItemDelete(query as CFDictionary)
    }
}
