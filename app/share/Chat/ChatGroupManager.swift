//
//  ChatGroupManager.swift
//  share
//
//  Manages persistence of selected chat group
//

import Foundation

final class ChatGroupManager {
    static let shared = ChatGroupManager()

    private let groupIdKey = "selected_chat_group_id"
    private let groupNameKey = "selected_chat_group_name"

    private init() {}

    /// The currently selected group ID, persisted across app launches
    var selectedGroupId: String? {
        get { UserDefaults.standard.string(forKey: groupIdKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: groupIdKey)
            print("✅ ChatGroupManager: Selected group ID set to: \(newValue ?? "nil")")
        }
    }

    /// The currently selected group name, persisted for instant display
    var selectedGroupName: String? {
        get { UserDefaults.standard.string(forKey: groupNameKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: groupNameKey)
            print("✅ ChatGroupManager: Selected group name set to: \(newValue ?? "nil")")
        }
    }

    /// Select a group with both ID and name
    func selectGroup(id: String, name: String?) {
        selectedGroupId = id
        selectedGroupName = name
    }

    /// Clear the selected group
    func clearSelection() {
        UserDefaults.standard.removeObject(forKey: groupIdKey)
        UserDefaults.standard.removeObject(forKey: groupNameKey)
        print("✅ ChatGroupManager: Cleared group selection")
    }

    /// Check if a group is currently selected
    var hasSelectedGroup: Bool {
        selectedGroupId != nil
    }
}
