//
//  ThreadSubjectHeader.swift
//  share
//
//  Header component for thread view showing the parent URL/content as subject
//

import SwiftUI

struct ThreadSubjectHeader: View {
    let title: String
    let url: URL?
    let childCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title
            Text(title)
                .font(.headline)
                .lineLimit(2)
                .foregroundColor(.primary)

            // URL domain
            if let url = url {
                HStack(spacing: 4) {
                    Image(systemName: "link")
                        .font(.caption)
                    Text(url.host ?? url.absoluteString)
                        .font(.caption)
                        .lineLimit(1)
                }
                .foregroundColor(.secondary)
            }

            // Child count
            if childCount > 0 {
                Text("\(childCount) \(childCount == 1 ? "item" : "items")")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
    }
}

#Preview {
    VStack(spacing: 0) {
        ThreadSubjectHeader(
            title: "Example Article Title That Might Be Long",
            url: URL(string: "https://example.com/article"),
            childCount: 5
        )
        Divider()
        Spacer()
    }
}
