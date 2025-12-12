//
//  AppDelegate.swift
//  share
//
//  App delegate for background task management and Darwin notifications
//

import UIKit
import SwiftUI
import BackgroundTasks

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        InboxDrainer.shared.registerBackgroundTask()
        InboxDrainer.shared.scheduleNextDrain()

        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            { _, observer, name, _, _ in
                guard let observer = observer else { return }
                let appDelegate = Unmanaged<AppDelegate>.fromOpaque(observer).takeUnretainedValue()
                appDelegate.handleInboxNotification()
            },
            "com.breadchris.list.inbox.changed" as CFString,
            nil,
            .deliverImmediately
        )

        print("✅ AppDelegate: Initialized with background tasks and notifications")
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        print("🔄 AppDelegate: App became active, triggering inbox sync")
        NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
    }

    @objc private func handleInboxNotification() {
        print("📬 AppDelegate: Inbox notification received, triggering sync")
        NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
    }
}

// MARK: - Scene Delegate for Custom Hosting Controller
class SceneDelegate: NSObject, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let contentView = ContentView()
            .onOpenURL { url in
                print("🔗 SceneDelegate: Received URL scheme: \(url)")
                NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
            }

        let hostingController = StatusBarHostingController(rootView: contentView)

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = hostingController
        self.window = window
        window.makeKeyAndVisible()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        print("🔗 SceneDelegate: Received URL: \(url)")
        NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)
    }
}
