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
                    // Trigger inbox sync via WebView when app is opened via share extension
                    NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
                }
        }
    }
}
