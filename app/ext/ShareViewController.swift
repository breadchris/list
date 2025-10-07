//
//  ShareViewController.swift
//  ext
//
//  Share extension that queues URLs to App Group inbox for main app to sync
//

import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    private var messageLabel: UILabel!
    private let appGroupId = "group.com.breadchris.share"

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        handleShare()
    }

    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground

        let titleLabel = UILabel()
        titleLabel.text = "Share to List"
        titleLabel.font = UIFont.boldSystemFont(ofSize: 20)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        messageLabel = UILabel()
        messageLabel.text = "Processing..."
        messageLabel.font = UIFont.systemFont(ofSize: 16)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        messageLabel.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(titleLabel)
        view.addSubview(messageLabel)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),

            messageLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 30),
            messageLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            messageLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
    }

    private func handleShare() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            showError("No content to share")
            return
        }

        extractURL(from: attachments) { [weak self] url in
            guard let self = self, let url = url else {
                self?.showError("Could not extract URL")
                return
            }

            self.saveToInbox(url: url)
        }
    }

    private func extractURL(from attachments: [NSItemProvider], completion: @escaping (String?) -> Void) {
        for provider in attachments {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, error in
                    DispatchQueue.main.async {
                        if let url = item as? URL {
                            completion(url.absoluteString)
                        } else if let error = error {
                            print("❌ Share Extension: Failed to load URL: \(error)")
                            completion(nil)
                        }
                    }
                }
                return
            }
        }
        completion(nil)
    }

    private func saveToInbox(url: String) {
        do {
            let inbox = try SharedInbox(appGroupId: appGroupId)
            let item = ShareItem(url: url)
            try inbox.enqueue(item)

            CFNotificationCenterPostNotification(
                CFNotificationCenterGetDarwinNotifyCenter(),
                CFNotificationName("com.breadchris.list.inbox.changed" as CFString),
                nil,
                nil,
                true
            )

            showSuccess()
        } catch {
            print("❌ Share Extension: Failed to save to inbox: \(error)")
            showError("Failed to save. Please try again.")
        }
    }

    private func showSuccess() {
        messageLabel.text = "Saved! Will sync when you open the app."
        messageLabel.textColor = UIColor.systemGreen

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    private func showError(_ message: String) {
        messageLabel.text = message
        messageLabel.textColor = UIColor.systemRed

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
}