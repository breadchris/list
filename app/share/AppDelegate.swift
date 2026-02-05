//
//  AppDelegate.swift
//  share
//
//  App delegate for background task management, Darwin notifications, and push notifications
//

import UIKit
import SwiftUI
import BackgroundTasks
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize network monitoring (starts automatically)
        _ = NetworkMonitor.shared
        print("📡 AppDelegate: NetworkMonitor started")

        // Initialize message sync service
        _ = MessageSyncService.shared
        print("🔄 AppDelegate: MessageSyncService started")

        // Register inbox background task
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

        // Set up push notifications
        setupPushNotifications(application)

        print("✅ AppDelegate: Initialized with background tasks, notifications, push notifications, and offline support")
        return true
    }

    // MARK: - Push Notification Setup

    private func setupPushNotifications(_ application: UIApplication) {
        // Set delegate for handling notifications
        UNUserNotificationCenter.current().delegate = self

        // Request authorization
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if let error = error {
                print("❌ Push notification authorization error: \(error)")
                return
            }

            if granted {
                print("✅ Push notification permission granted")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                print("⚠️ Push notification permission denied")
            }
        }
    }

    // MARK: - APNs Token Registration

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Convert token to hex string
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 Received APNs device token: \(tokenString)")

        // Register token with backend
        Task {
            await registerDeviceToken(tokenString)
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ Failed to register for remote notifications: \(error)")
    }

    private func registerDeviceToken(_ token: String) async {
        guard let userId = await SupabaseManager.shared.userId else {
            print("⚠️ Cannot register device token: user not authenticated")
            return
        }

        guard let groupId = try? await SupabaseManager.shared.getDefaultGroupId() else {
            print("⚠️ Cannot register device token: no default group")
            return
        }

        // Determine environment
        #if DEBUG
        let platform = "ios_sandbox"
        #else
        let platform = "ios"
        #endif

        // Call Lambda to register device token
        let lambdaEndpoint = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content"

        guard let url = URL(string: lambdaEndpoint) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload: [String: Any] = [
            "action": "register-device",
            "payload": [
                "device_token": token,
                "platform": platform,
                "user_id": userId,
                "group_id": groupId
            ]
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let (data, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                print("✅ Device token registered successfully")
            } else {
                print("❌ Failed to register device token: \(String(data: data, encoding: .utf8) ?? "")")
            }
        } catch {
            print("❌ Error registering device token: \(error)")
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    // Handle notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        print("📬 Received notification in foreground: \(userInfo)")

        // Show banner even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }

    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("📬 Notification tapped: \(userInfo)")

        // Extract content_id and navigate to it
        if let contentId = userInfo["content_id"] as? String {
            // Post notification to navigate to content
            NotificationCenter.default.post(
                name: NSNotification.Name("NavigateToContent"),
                object: nil,
                userInfo: ["content_id": contentId]
            )
        }

        completionHandler()
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        print("🔄 AppDelegate: App became active, triggering sync")

        // Trigger inbox sync (for shared URLs)
        NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)

        // Trigger message outbox sync (for offline messages)
        Task { @MainActor in
            await MessageSyncService.shared.syncPendingMessages()
        }
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

        let mainView = ChatTab()
            .onOpenURL { url in
                print("🔗 SceneDelegate: Received URL scheme: \(url)")
                self.handleSupabaseAuthURL(url)
            }

        let hostingController = StatusBarHostingController(rootView: mainView)

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = hostingController
        self.window = window
        window.makeKeyAndVisible()

        // Handle URLs passed during app launch
        if let urlContext = connectionOptions.urlContexts.first {
            handleSupabaseAuthURL(urlContext.url)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        print("🔄 SceneDelegate: Scene became active, triggering sync")

        // Trigger inbox sync (for shared URLs)
        NotificationCenter.default.post(name: NSNotification.Name("TriggerInboxSync"), object: nil)

        // Trigger message outbox sync (for offline messages)
        Task { @MainActor in
            await MessageSyncService.shared.syncPendingMessages()
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        print("🔗 SceneDelegate: Received URL: \(url)")
        handleSupabaseAuthURL(url)
    }

    private func handleSupabaseAuthURL(_ url: URL) {
        // Check if this is a Supabase auth callback
        guard url.scheme == "list" else {
            print("⚠️ SceneDelegate: Ignoring non-list URL scheme: \(url.scheme ?? "nil")")
            return
        }

        print("🔐 SceneDelegate: Processing Supabase auth URL: \(url)")

        Task {
            do {
                try await SupabaseManager.shared.client.auth.session(from: url)
                print("✅ SceneDelegate: Supabase session established from URL")

                // Trigger inbox sync after successful auth
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: NSNotification.Name("TriggerInboxSync"),
                        object: nil
                    )
                }
            } catch {
                print("❌ SceneDelegate: Failed to establish session from URL: \(error)")
                // Still trigger inbox sync in case this was a different kind of URL
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: NSNotification.Name("TriggerInboxSync"),
                        object: nil
                    )
                }
            }
        }
    }
}
