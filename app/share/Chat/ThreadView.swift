//
//  ThreadView.swift
//  share
//
//  Thread view showing parent URL content with child messages (highlights, notes)
//

import SwiftUI
import ExyteChat

struct ThreadView: View {
    @StateObject private var viewModel: ThreadViewModel
    @Environment(\.dismiss) private var dismiss

    init(parentId: String, groupId: String, parentURL: URL?, parentTitle: String) {
        _viewModel = StateObject(wrappedValue: ThreadViewModel(
            parentId: parentId,
            groupId: groupId,
            parentURL: parentURL,
            parentTitle: parentTitle
        ))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Subject header
            ThreadSubjectHeader(
                title: viewModel.parentTitle,
                url: viewModel.parentURL,
                childCount: viewModel.childMessages.count
            )

            Divider()

            // Content area
            if viewModel.isLoading && viewModel.childMessages.isEmpty {
                Spacer()
                ProgressView()
                    .scaleEffect(1.2)
                Spacer()
            } else if viewModel.childMessages.isEmpty {
                // Empty state
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "text.bubble")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No notes yet")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Add highlights or notes about this content")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Spacer()
                }
                .padding()
            } else {
                // Child messages as chat view
                ChatView(
                    messages: viewModel.childMessages,
                    chatType: .conversation,
                    didSendMessage: { draft in
                        Task {
                            await viewModel.sendNote(text: draft.text)
                        }
                    },
                    messageMenuAction: { (action: ChatMenuAction, _, message) in
                        if case .delete = action {
                            Task {
                                await viewModel.deleteNote(id: message.id)
                            }
                        }
                    }
                )
                .setAvailableInputs([.text])
                .messageUseMarkdown(true)
                .showDateHeaders(true)
                .showNetworkConnectionProblem(false)
                .keyboardDismissMode(.interactive)
            }

            // Input bar when empty (ChatView handles its own input when showing messages)
            if viewModel.childMessages.isEmpty {
                ThreadInputBar { text in
                    Task {
                        await viewModel.sendNote(text: text)
                    }
                }
            }
        }
        .navigationTitle("Thread")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Done") {
                    dismiss()
                }
            }
        }
        .alert("Error", isPresented: .constant(viewModel.error != nil)) {
            Button("OK") {
                viewModel.error = nil
            }
        } message: {
            if let error = viewModel.error {
                Text(error.localizedDescription)
            }
        }
        .task {
            await viewModel.loadThread()
        }
    }
}

// MARK: - Thread Input Bar

/// Simple input bar for empty state
struct ThreadInputBar: View {
    @State private var text = ""
    let onSend: (String) -> Void

    var body: some View {
        HStack(spacing: 12) {
            TextField("Add a note...", text: $text)
                .textFieldStyle(.roundedBorder)

            Button {
                guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                onSend(text)
                text = ""
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(.blue)
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding()
        .background(Color(.systemBackground))
    }
}

#Preview {
    NavigationStack {
        ThreadView(
            parentId: "test-id",
            groupId: "test-group",
            parentURL: URL(string: "https://example.com/article"),
            parentTitle: "Example Article"
        )
    }
}
