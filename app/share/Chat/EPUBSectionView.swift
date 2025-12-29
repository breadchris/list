//
//  EPUBSectionView.swift
//  share
//
//  Collapsible section showing EPUB books in the chat
//

import SwiftUI

struct EPUBSectionView: View {
    let epubs: [EPUBItem]
    @Binding var isExpanded: Bool
    let isLoading: Bool
    let onSelectEPUB: (EPUBItem) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header with collapse toggle
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "book.fill")
                        .foregroundColor(.orange)
                    Text("Books")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Spacer()
                    if !epubs.isEmpty {
                        Text("\(epubs.count)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            // Expandable content
            if isExpanded {
                if isLoading {
                    ProgressView()
                        .padding()
                } else if epubs.isEmpty {
                    Text("No books in this group")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding()
                } else {
                    // Horizontal scrolling book list
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(epubs) { epub in
                                EPUBItemView(epub: epub) {
                                    onSelectEPUB(epub)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                    }
                }
            }

            Divider()
        }
        .background(Color(.systemBackground))
    }
}

struct EPUBItemView: View {
    let epub: EPUBItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 4) {
                // Book icon placeholder
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.orange.opacity(0.2))
                    .frame(width: 60, height: 80)
                    .overlay(
                        Image(systemName: "book.closed.fill")
                            .foregroundColor(.orange)
                    )

                Text(epub.displayTitle)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .lineLimit(2)
                    .frame(width: 60, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    EPUBSectionView(
        epubs: [
            EPUBItem(
                id: "1",
                created_at: "2024-01-01",
                data: "Sample Book Title",
                group_id: "g1",
                user_id: "u1",
                metadata: nil
            ),
            EPUBItem(
                id: "2",
                created_at: "2024-01-02",
                data: "Another Great Book",
                group_id: "g1",
                user_id: "u1",
                metadata: nil
            )
        ],
        isExpanded: .constant(true),
        isLoading: false,
        onSelectEPUB: { _ in }
    )
}
