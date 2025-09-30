//
//  ShareViewController.swift
//  ext
//
//  Share extension for sending URLs to the main app
//

import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    private var messageLabel: UILabel!
    private var doneButton: UIButton!
    private var activityIndicator: UIActivityIndicatorView!
    private var hasProcessedShare = false

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
        messageLabel.textColor = UIColor.label
        messageLabel.translatesAutoresizingMaskIntoConstraints = false

        activityIndicator = UIActivityIndicatorView(style: .medium)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.startAnimating()

        doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.backgroundColor = UIColor.systemBlue
        doneButton.setTitleColor(UIColor.white, for: .normal)
        doneButton.layer.cornerRadius = 8
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.isHidden = true

        view.addSubview(titleLabel)
        view.addSubview(messageLabel)
        view.addSubview(activityIndicator)
        view.addSubview(doneButton)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),

            messageLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 30),
            messageLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            messageLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),

            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 20),

            doneButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            doneButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 40),
            doneButton.widthAnchor.constraint(equalToConstant: 100),
            doneButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    private func handleShare() {
        guard !hasProcessedShare else { return }
        hasProcessedShare = true

        extractURL { [weak self] url in
            DispatchQueue.main.async {
                if let url = url {
                    self?.sendURLToMainApp(url)
                } else {
                    self?.showError("No URL found in shared content")
                }
            }
        }
    }

    private func extractURL(completion: @escaping (URL?) -> Void) {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            completion(nil)
            return
        }

        // Look for URL type first
        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, error in
                    if let url = item as? URL {
                        completion(url)
                        return
                    }
                }
            }
        }

        // If no direct URL, look for text that might contain URLs
        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { item, error in
                    if let text = item as? String {
                        // Try to extract URL from text
                        if let url = self.extractURLFromText(text) {
                            completion(url)
                            return
                        }
                    }
                }
            }
        }

        // If still no URL found, check for property list (some apps share URLs this way)
        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.propertyList.identifier, options: nil) { item, error in
                    if let plist = item as? [String: Any],
                       let urlString = plist[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any],
                       let url = urlString["URL"] as? String {
                        completion(URL(string: url))
                        return
                    }
                }
            }
        }

        completion(nil)
    }

    private func extractURLFromText(_ text: String) -> URL? {
        // Simple URL extraction - you might want to make this more sophisticated
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
        return matches?.first?.url
    }

    private func sendURLToMainApp(_ url: URL) {
        print("📤 ShareExtension: Sending URL to main app: \(url)")

        // Store URL in shared container for main app to pick up
        if let sharedContainer = UserDefaults(suiteName: "group.com.breadchris.share") {
            let shareData: [String: Any] = [
                "url": url.absoluteString,
                "title": extractTitle(),
                "timestamp": Date().timeIntervalSince1970,
                "processed": false
            ]

            // Store the data with a unique key
            let shareKey = "share_\(Int(Date().timeIntervalSince1970))"
            sharedContainer.set(shareData, forKey: shareKey)
            
            // Also store the latest share key so the main app knows what to look for
            sharedContainer.set(shareKey, forKey: "latest_share")
            sharedContainer.synchronize()

            print("✅ ShareExtension: URL stored in shared container with key: \(shareKey)")

            // Try to open the main app
            openMainApp(shareKey: shareKey)
        } else {
            showError("Failed to access shared storage")
        }
    }

    private func extractTitle() -> String? {
        // Try to get title from the shared content
        if let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem {
            return extensionItem.attributedTitle?.string ?? extensionItem.attributedContentText?.string
        }
        return nil
    }

    private func openMainApp(shareKey: String) {
        // Create URL scheme to open main app with the share key
        let urlString = "list://share?key=\(shareKey)"
        
        if let url = URL(string: urlString) {
            var responder: UIResponder? = self as UIResponder
            while responder != nil {
                if let application = responder as? UIApplication {
                    application.open(url, options: [:]) { [weak self] success in
                        DispatchQueue.main.async {
                            if success {
                                self?.showSuccess("URL sent to List app successfully!")
                            } else {
                                self?.showSuccess("URL saved! Open List app to process it.")
                            }
                        }
                    }
                    return
                }
                responder = responder?.next
            }
        }

        // Fallback if we can't open the app
        showSuccess("URL saved! Open List app to process it.")
    }

    private func showSuccess(_ message: String) {
        activityIndicator.stopAnimating()
        activityIndicator.isHidden = true
        messageLabel.text = message
        messageLabel.textColor = UIColor.systemGreen
        doneButton.isHidden = false
    }

    private func showError(_ message: String) {
        activityIndicator.stopAnimating()
        activityIndicator.isHidden = true
        messageLabel.text = "Error: \(message)"
        messageLabel.textColor = UIColor.systemRed
        doneButton.isHidden = false
    }

    @objc private func doneButtonTapped() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}