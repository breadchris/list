//
//  AppsMenuView.swift
//  share
//
//  Bottom sheet menu for selecting apps (Books, Calendar, etc.)
//

import SwiftUI

struct AppsMenuView: View {
    @Environment(\.dismiss) private var dismiss
    let onSelectBooks: () -> Void
    let onSelectCalendar: () -> Void

    var body: some View {
        NavigationStack {
            List {
                // Calendar
                Button {
                    dismiss()
                    onSelectCalendar()
                } label: {
                    AppMenuRow(
                        icon: "calendar",
                        iconColor: .blue,
                        title: "Calendar",
                        subtitle: "Schedule and view events"
                    )
                }
                .buttonStyle(.plain)

                // Books
                Button {
                    dismiss()
                    onSelectBooks()
                } label: {
                    AppMenuRow(
                        icon: "book.fill",
                        iconColor: .orange,
                        title: "Books",
                        subtitle: "Read your EPUB books"
                    )
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("Apps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - App Menu Row

struct AppMenuRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(iconColor)
                .font(.title2)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    AppsMenuView(onSelectBooks: {}, onSelectCalendar: {})
}
