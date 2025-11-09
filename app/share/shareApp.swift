//
//  shareApp.swift
//  share
//
//  Created by hacked on 11/13/24.
//

import SwiftUI

@main
struct shareApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    // Handle URL schemes from share extension
                    print("🔗 shareApp: Received URL scheme: \(url)")
                    // Trigger inbox draining when app is opened via share extension
                    InboxDrainer.shared.drainInbox { success in
                        if success {
                            print("✅ shareApp: Inbox drained successfully")
                        } else {
                            print("⚠️ shareApp: Inbox draining completed with some failures")
                        }
                    }
                }
        }
    }
}
