//
//  AppDelegate.swift
//  share
//
//  App delegate for background task management and Darwin notifications
//

import UIKit
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

    func applicationDidBecomeActive(_ application: UIApplication) {
        print("🔄 AppDelegate: App became active, draining inbox")
        InboxDrainer.shared.drainInbox { _ in }
    }

    @objc private func handleInboxNotification() {
        print("📬 AppDelegate: Inbox notification received, draining")
        InboxDrainer.shared.drainInbox { _ in }
    }
}
