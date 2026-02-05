//
//  HighlightPopupView.swift
//  share
//
//  Floating popup view with Highlight button that appears above text selection
//

import UIKit

class HighlightPopupView: UIView {
    private let highlightButton = UIButton(type: .system)
    var onHighlight: (() -> Void)?
    var onDismiss: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupView() {
        backgroundColor = UIColor.systemGray6
        layer.cornerRadius = 8
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowOpacity = 0.15
        layer.shadowRadius = 4

        // Configure highlight button
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: "highlighter")
        config.title = "Highlight"
        config.imagePadding = 6
        config.baseForegroundColor = .systemOrange
        config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
        highlightButton.configuration = config
        highlightButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        highlightButton.addTarget(self, action: #selector(handleHighlightTap), for: .touchUpInside)

        addSubview(highlightButton)
        highlightButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            highlightButton.topAnchor.constraint(equalTo: topAnchor),
            highlightButton.bottomAnchor.constraint(equalTo: bottomAnchor),
            highlightButton.leadingAnchor.constraint(equalTo: leadingAnchor),
            highlightButton.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    @objc private func handleHighlightTap() {
        onHighlight?()
    }

    /// Position the popup above the selection rect
    func position(above rect: CGRect, in containerView: UIView) {
        // Intrinsic size of button
        let buttonSize = highlightButton.intrinsicContentSize
        let padding: CGFloat = 8

        // Center horizontally above selection
        var x = rect.midX - buttonSize.width / 2
        var y = rect.minY - buttonSize.height - padding

        // Clamp to container bounds with padding
        x = max(8, min(x, containerView.bounds.width - buttonSize.width - 8))

        // If not enough space above, show below the selection
        if y < containerView.safeAreaInsets.top + 8 {
            y = rect.maxY + padding
        }

        frame = CGRect(origin: CGPoint(x: x, y: y), size: buttonSize)
    }

    /// Animate the popup appearing
    func animateIn() {
        alpha = 0
        transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
        UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseOut) {
            self.alpha = 1
            self.transform = .identity
        }
    }

    /// Animate the popup disappearing
    func animateOut(completion: (() -> Void)? = nil) {
        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseIn) {
            self.alpha = 0
            self.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
        } completion: { _ in
            self.removeFromSuperview()
            completion?()
        }
    }
}
