//
//  PhotoThreadHeader.swift
//  share
//
//  Header component for photo thread view showing the image
//

import SwiftUI

struct PhotoThreadHeader: View {
    let imageURL: URL?
    let noteCount: Int

    var body: some View {
        VStack(alignment: .center, spacing: 12) {
            if let imageURL = imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 200)
                            .cornerRadius(12)
                    case .failure:
                        Image(systemName: "photo")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
            }

            Text("\(noteCount) \(noteCount == 1 ? "note" : "notes")")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemBackground))
    }
}

#Preview {
    PhotoThreadHeader(
        imageURL: URL(string: "https://picsum.photos/200"),
        noteCount: 3
    )
}
