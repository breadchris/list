//
//  BookPickerView.swift
//  share
//
//  Bottom sheet for selecting a book to read
//

import SwiftUI

struct BookPickerView: View {
    @Environment(\.dismiss) private var dismiss
    let epubs: [EPUBItem]
    let isLoading: Bool
    let onSelectEPUB: (EPUBItem) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading books...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if epubs.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "book.closed")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("No books available")
                            .font(.headline)
                        Text("Books added to this group will appear here")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                } else {
                    List(epubs) { epub in
                        Button {
                            onSelectEPUB(epub)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                // Book icon
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.orange.opacity(0.2))
                                    .frame(width: 44, height: 60)
                                    .overlay(
                                        Image(systemName: "book.closed.fill")
                                            .foregroundColor(.orange)
                                    )

                                // Book title
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(epub.displayTitle)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                        .lineLimit(2)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Books")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    BookPickerView(
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
                data: "Another Great Book with a Very Long Title",
                group_id: "g1",
                user_id: "u1",
                metadata: nil
            )
        ],
        isLoading: false,
        onSelectEPUB: { _ in }
    )
}
