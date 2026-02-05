//
//  AddNotesPromptSheet.swift
//  share
//
//  Bottom sheet prompting user to add notes after sending a photo
//

import SwiftUI

struct AddNotesPromptSheet: View {
    let onAddNotes: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            // Handle
            RoundedRectangle(cornerRadius: 2.5)
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 36, height: 5)
                .padding(.top, 8)

            // Content
            VStack(spacing: 12) {
                Image(systemName: "note.text.badge.plus")
                    .font(.system(size: 36))
                    .foregroundColor(.blue)

                Text("Photo Sent!")
                    .font(.headline)

                Text("Would you like to add notes to this photo?")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal)

            // Buttons
            HStack(spacing: 16) {
                Button("Not Now") {
                    onDismiss()
                }
                .buttonStyle(.bordered)

                Button("Add Notes") {
                    onAddNotes()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.bottom)
        }
        .presentationDetents([.height(220)])
        .presentationDragIndicator(.hidden)
    }
}

#Preview {
    Text("Preview")
        .sheet(isPresented: .constant(true)) {
            AddNotesPromptSheet(
                onAddNotes: {},
                onDismiss: {}
            )
        }
}
