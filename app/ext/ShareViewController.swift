//
//  ShareViewController.swift
//  ext
//
//  Simple share extension stub for App Store submission
//

import UIKit

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        setupSimpleUI()
        handleShare()
    }

    private func setupSimpleUI() {
        view.backgroundColor = UIColor.systemBackground

        let titleLabel = UILabel()
        titleLabel.text = "Share to List"
        titleLabel.font = UIFont.boldSystemFont(ofSize: 20)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let messageLabel = UILabel()
        messageLabel.text = "Content shared successfully!"
        messageLabel.font = UIFont.systemFont(ofSize: 16)
        messageLabel.textAlignment = .center
        messageLabel.textColor = UIColor.systemGreen
        messageLabel.translatesAutoresizingMaskIntoConstraints = false

        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.backgroundColor = UIColor.systemBlue
        doneButton.setTitleColor(UIColor.white, for: .normal)
        doneButton.layer.cornerRadius = 8
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(titleLabel)
        view.addSubview(messageLabel)
        view.addSubview(doneButton)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),

            messageLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 30),

            doneButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            doneButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 40),
            doneButton.widthAnchor.constraint(equalToConstant: 100),
            doneButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    private func handleShare() {
        // Stub: Just log what would be shared without actually doing anything
        if let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem {
            print("Share extension received item: \(extensionItem.attributedTitle?.string ?? "No title")")

            if let attachments = extensionItem.attachments {
                for attachment in attachments {
                    print("Attachment: \(attachment)")
                }
            }
        }

        // Simulate a brief delay to show the UI
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("Share stubbed - content would be saved here")
        }
    }

    @objc private func doneButtonTapped() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}