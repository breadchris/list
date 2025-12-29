//
//  shareApp.swift
//  share
//
//  Created by hacked on 11/13/24.
//

import SwiftUI

// MARK: - Custom Hosting Controller for Status Bar Control
class StatusBarHostingController<Content: View>: UIHostingController<Content> {
    private var isStatusBarHidden = false

    override init(rootView: Content) {
        super.init(rootView: rootView)
        setupNotificationObserver()
    }

    @MainActor required dynamic init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupNotificationObserver()
    }

    private func setupNotificationObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleStatusBarChange),
            name: NSNotification.Name("StatusBarVisibilityChanged"),
            object: nil
        )
    }

    @objc private func handleStatusBarChange(_ notification: Notification) {
        guard let hidden = notification.userInfo?["hidden"] as? Bool else { return }

        print("📱 StatusBar: Received notification, hidden=\(hidden)")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isStatusBarHidden = hidden
            UIView.animate(withDuration: 0.3) {
                self.setNeedsStatusBarAppearanceUpdate()
            }
        }
    }

    override var prefersStatusBarHidden: Bool {
        isStatusBarHidden
    }

    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        .fade
    }
}

@main
struct shareApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        // Configure aggressive URL caching for WKWebView
        // 50 MB in memory, 200 MB on disk
        let cache = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 200 * 1024 * 1024,
            diskPath: "webCache"
        )
        URLCache.shared = cache
    }

    var body: some Scene {
        // Scene managed by SceneDelegate for status bar control
        WindowGroup {
            EmptyView()
        }
    }
}
