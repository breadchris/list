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
                    SharedURLManager.shared.handleURLScheme(url)
                }
        }
    }
}
