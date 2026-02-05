//
//  StableLinkPreview.swift
//  share
//
//  A link preview with stable dimensions that doesn't cause layout jitter
//

import SwiftUI
import LinkPresentation

/// A link preview with stable dimensions that doesn't cause layout jitter
/// Uses fixed frame sizes to prevent layout recalculation as metadata loads
struct StableLinkPreview: View {
    let url: URL
    @State private var metadata: LPLinkMetadata?
    @State private var isLoading = true

    // Fixed dimensions to prevent layout shifts
    private let previewHeight: CGFloat = 80
    private let previewWidth: CGFloat = 280

    var body: some View {
        HStack(spacing: 12) {
            // Fixed-size icon/image area
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))

                if let iconProvider = metadata?.iconProvider {
                    AsyncIconView(provider: iconProvider)
                } else {
                    Image(systemName: "safari")
                        .font(.system(size: 20))
                        .foregroundColor(.secondary)
                }
            }
            .frame(width: 48, height: 48)

            // Text content
            VStack(alignment: .leading, spacing: 4) {
                if isLoading {
                    Text(url.host ?? url.absoluteString)
                        .font(.subheadline)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Text("Loading...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text(metadata?.title ?? url.host ?? "")
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.primary)
                        .lineLimit(2)

                    Text(url.host ?? "")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(12)
        .frame(width: previewWidth, height: previewHeight)
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .onTapGesture {
            UIApplication.shared.open(url)
        }
        .onAppear {
            fetchMetadata()
        }
    }

    private func fetchMetadata() {
        let provider = LPMetadataProvider()
        provider.startFetchingMetadata(for: url) { meta, error in
            DispatchQueue.main.async {
                if let meta = meta {
                    self.metadata = meta
                }
                self.isLoading = false
            }
        }
    }
}

/// Helper view to load icon from NSItemProvider asynchronously
struct AsyncIconView: View {
    let provider: NSItemProvider
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                Image(systemName: "safari")
                    .font(.system(size: 20))
                    .foregroundColor(.secondary)
            }
        }
        .onAppear {
            loadIcon()
        }
    }

    private func loadIcon() {
        provider.loadObject(ofClass: UIImage.self) { obj, error in
            if let img = obj as? UIImage {
                DispatchQueue.main.async {
                    self.image = img
                }
            }
        }
    }
}

// MARK: - URL Detection Helper

extension String {
    /// Extracts the first URL from a string using NSDataDetector
    func extractFirstURL() -> URL? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }
        let matches = detector.matches(in: self, options: [], range: NSRange(self.startIndex..., in: self))
        return matches.first?.url
    }
}

#Preview {
    VStack(spacing: 20) {
        StableLinkPreview(url: URL(string: "https://gamingcouch.com")!)
        StableLinkPreview(url: URL(string: "https://apple.com")!)
        StableLinkPreview(url: URL(string: "https://github.com")!)
    }
    .padding()
}
