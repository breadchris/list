//
//  CalendarTab.swift
//  share
//
//  Main calendar tab container with view switching and FAB
//

import SwiftUI

struct CalendarTab: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CalendarViewModel()
    @State private var showGroupSelector = false

    var body: some View {
        NavigationStack {
            ZStack {
                VStack(spacing: 0) {
                    // Header with navigation and view picker
                    CalendarHeader(viewModel: viewModel)

                    Divider()

                    // Calendar content based on view mode
                    Group {
                        switch viewModel.viewMode {
                        case .month:
                            MonthCalendarView(viewModel: viewModel)
                        case .week:
                            WeekCalendarView(viewModel: viewModel)
                        case .day:
                            DayCalendarView(viewModel: viewModel)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // Loading overlay
                if viewModel.isLoading && viewModel.events.isEmpty {
                    ProgressView()
                        .scaleEffect(1.2)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(.systemBackground).opacity(0.8))
                }

            }
            .overlay(alignment: .bottomTrailing) {
                FABButton {
                    viewModel.createEvent()
                }
                .padding(.trailing, 20)
                .padding(.bottom, 20)
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundColor(.primary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showGroupSelector = true
                    } label: {
                        Image(systemName: "person.3")
                            .foregroundColor(.blue)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showEventSheet) {
                EventDetailSheet(viewModel: viewModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showGroupSelector) {
                GroupSelectorView { group in
                    viewModel.selectGroup(group.id)
                    showGroupSelector = false
                }
            }
            .task {
                await viewModel.loadEvents()
            }
            .refreshable {
                await viewModel.loadEvents()
            }
        }
    }
}

// MARK: - FAB Button

struct FABButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .frame(width: 56, height: 56)
                .background(Color.blue)
                .clipShape(Circle())
                .shadow(color: Color.blue.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }
}

// MARK: - Preview

#Preview {
    CalendarTab()
}
