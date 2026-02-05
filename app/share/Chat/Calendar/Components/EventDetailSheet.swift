//
//  EventDetailSheet.swift
//  share
//
//  Modal sheet for creating and editing calendar events
//

import SwiftUI

struct EventDetailSheet: View {
    @ObservedObject var viewModel: CalendarViewModel
    @Environment(\.dismiss) private var dismiss

    // Form state
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date().addingTimeInterval(3600)
    @State private var showDeleteConfirmation: Bool = false
    @State private var isSaving: Bool = false

    private var isEditing: Bool {
        viewModel.selectedEvent != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                // Title
                Section {
                    TextField("Event title", text: $title)
                        .font(.body)
                }

                // Date & Time
                Section {
                    DatePicker(
                        "Starts",
                        selection: $startDate,
                        displayedComponents: [.date, .hourAndMinute]
                    )

                    DatePicker(
                        "Ends",
                        selection: $endDate,
                        in: startDate...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }

                // Description
                Section {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                        .overlay(alignment: .topLeading) {
                            if description.isEmpty {
                                Text("Add description (optional)")
                                    .foregroundColor(.secondary)
                                    .padding(.top, 8)
                                    .padding(.leading, 4)
                                    .allowsHitTesting(false)
                            }
                        }
                } header: {
                    Text("Description")
                }

                // Delete button (only when editing)
                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Spacer()
                                Text("Delete Event")
                                Spacer()
                            }
                        }
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Event" : "New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        saveEvent()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                setupInitialValues()
            }
            .alert("Delete Event", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    deleteEvent()
                }
            } message: {
                Text("Are you sure you want to delete this event? This action cannot be undone.")
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    // MARK: - Setup

    private func setupInitialValues() {
        if let event = viewModel.selectedEvent {
            // Editing existing event
            title = event.title
            description = event.description ?? ""
            startDate = event.startTime
            endDate = event.endTime
        } else {
            // Creating new event
            let calendar = Calendar.current

            // Round to next hour
            var components = calendar.dateComponents([.year, .month, .day, .hour], from: viewModel.selectedDate)
            let currentHour = calendar.component(.hour, from: Date())

            // If selected date is today, start from next hour
            if calendar.isDateInToday(viewModel.selectedDate) {
                components.hour = min(currentHour + 1, 23)
            } else {
                components.hour = 9 // Default to 9 AM for future dates
            }
            components.minute = 0

            startDate = calendar.date(from: components) ?? Date()
            endDate = startDate.addingTimeInterval(3600) // 1 hour duration
        }
    }

    // MARK: - Actions

    private func saveEvent() {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        isSaving = true

        Task {
            await viewModel.saveEvent(
                title: title.trimmingCharacters(in: .whitespaces),
                description: description.trimmingCharacters(in: .whitespaces).isEmpty ? nil : description,
                startTime: startDate,
                endTime: endDate
            )
            isSaving = false
            dismiss()
        }
    }

    private func deleteEvent() {
        isSaving = true

        Task {
            await viewModel.deleteEvent()
            isSaving = false
            dismiss()
        }
    }
}

// MARK: - Quick Time Picker

struct QuickTimePicker: View {
    @Binding var startDate: Date
    @Binding var endDate: Date

    private let durations: [(String, TimeInterval)] = [
        ("30m", 30 * 60),
        ("1h", 60 * 60),
        ("2h", 2 * 60 * 60),
        ("All day", 24 * 60 * 60)
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(durations, id: \.0) { label, duration in
                    Button {
                        endDate = startDate.addingTimeInterval(duration)
                    } label: {
                        Text(label)
                            .font(.caption)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(isSelected(duration) ? Color.blue : Color(.systemGray5))
                            .foregroundColor(isSelected(duration) ? .white : .primary)
                            .cornerRadius(16)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func isSelected(_ duration: TimeInterval) -> Bool {
        abs(endDate.timeIntervalSince(startDate) - duration) < 60
    }
}

// MARK: - Preview

#Preview("New Event") {
    EventDetailSheet(viewModel: CalendarViewModel())
}

#Preview("Edit Event") {
    let viewModel = CalendarViewModel()
    viewModel.selectedEvent = CalendarEvent(
        title: "Team Meeting",
        description: "Discuss Q1 roadmap and priorities",
        startTime: Date(),
        endTime: Date().addingTimeInterval(3600),
        userId: "user1",
        userName: "John",
        groupId: "group1"
    )
    return EventDetailSheet(viewModel: viewModel)
}
