//
//  ChatTab.swift
//  share
//
//  Native chat tab using ExyteChat framework with Supabase integration
//

import SwiftUI
import ExyteChat

struct ChatTab: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var showAppsMenu = false
    @State private var showBookPicker = false
    @State private var showCalendar = false

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.isLoading && viewModel.messages.isEmpty {
                    // Show loading indicator when initially loading
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Loading messages...")
                            .foregroundColor(.secondary)
                    }
                } else if viewModel.currentGroupId == nil {
                    // No group selected
                    VStack(spacing: 16) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("Select a group to start chatting")
                            .font(.headline)
                        Button("Select Group") {
                            viewModel.showGroupPicker()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    // Show chat view with EPUB reader support
                    ChatWithReaderView(viewModel: viewModel)
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showAppsMenu = true
                    } label: {
                        Image(systemName: "square.grid.2x2")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showGroupPicker()
                    } label: {
                        Image(systemName: "person.3")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showGroupSelector) {
                GroupSelectorView { group in
                    viewModel.selectGroup(group)
                }
            }
            .sheet(item: $viewModel.selectedThreadContent) { threadData in
                NavigationStack {
                    ThreadView(
                        parentId: threadData.id,
                        groupId: threadData.groupId,
                        parentURL: threadData.url,
                        parentTitle: threadData.title
                    )
                }
            }
            .sheet(isPresented: $showAppsMenu) {
                AppsMenuView(
                    onSelectBooks: {
                        showBookPicker = true
                    },
                    onSelectCalendar: {
                        showCalendar = true
                    }
                )
            }
            .fullScreenCover(isPresented: $showCalendar) {
                CalendarTab()
            }
            .sheet(isPresented: $showBookPicker) {
                BookPickerView(
                    epubs: viewModel.epubs,
                    isLoading: viewModel.isLoadingEPUBs,
                    onSelectEPUB: { epub in
                        viewModel.selectEPUB(epub)
                    }
                )
            }
            .sheet(isPresented: $viewModel.showAddNotesPrompt) {
                AddNotesPromptSheet(
                    onAddNotes: {
                        if let photoId = viewModel.lastSentPhotoId {
                            viewModel.dismissNotesPrompt()
                            viewModel.openPhotoThread(photoId: photoId)
                        }
                    },
                    onDismiss: {
                        viewModel.dismissNotesPrompt()
                    }
                )
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
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("OpenWebview"))) { notification in
                if let urlString = notification.userInfo?["url"] as? String,
                   let title = notification.userInfo?["title"] as? String,
                   let url = URL(string: urlString) {
                    viewModel.openWebview(url: url, title: title)
                }
            }
        }
    }

    private var navigationTitle: String {
        if let name = viewModel.currentGroupName {
            return name
        } else if viewModel.currentGroupId != nil {
            return "Chat"
        } else {
            return "Chat"
        }
    }
}

#Preview {
    ChatTab()
}
