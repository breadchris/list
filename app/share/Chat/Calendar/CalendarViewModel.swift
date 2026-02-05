//
//  CalendarViewModel.swift
//  share
//
//  State management for calendar views
//

import Foundation
import SwiftUI
import Combine
import Realtime

@MainActor
final class CalendarViewModel: ObservableObject {
    // MARK: - Published State

    /// All events for the current group
    @Published var events: [CalendarEvent] = []

    /// Currently selected date
    @Published var selectedDate: Date = Date()

    /// Current view mode (month/week/day)
    @Published var viewMode: CalendarViewMode = .month

    /// Event being edited (nil for new event)
    @Published var selectedEvent: CalendarEvent?

    /// Show event detail sheet
    @Published var showEventSheet: Bool = false

    /// Loading state
    @Published var isLoading: Bool = false

    /// Error state
    @Published var error: Error?

    /// Current group ID
    @Published var currentGroupId: String?

    // MARK: - Private

    private let repository = CalendarRepository()
    private var realtimeChannel: RealtimeChannelV2?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Events for the selected date
    var eventsForSelectedDate: [CalendarEvent] {
        let calendar = Calendar.current
        return events.filter { event in
            calendar.isDate(event.startTime, inSameDayAs: selectedDate) ||
            calendar.isDate(event.endTime, inSameDayAs: selectedDate) ||
            (event.startTime < selectedDate && event.endTime > selectedDate)
        }.sorted { $0.startTime < $1.startTime }
    }

    /// Events for the selected week
    var eventsForSelectedWeek: [CalendarEvent] {
        let calendar = Calendar.current
        guard let weekStart = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: selectedDate)),
              let weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart) else {
            return []
        }
        return events.filter { event in
            event.startTime < weekEnd && event.endTime > weekStart
        }.sorted { $0.startTime < $1.startTime }
    }

    /// Events for the selected month
    var eventsForSelectedMonth: [CalendarEvent] {
        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: selectedDate)),
              let monthEnd = calendar.date(byAdding: DateComponents(month: 1), to: monthStart) else {
            return []
        }
        return events.filter { event in
            event.startTime < monthEnd && event.endTime > monthStart
        }
    }

    /// Get events for a specific date (for calendar decorations)
    func events(for date: Date) -> [CalendarEvent] {
        let calendar = Calendar.current
        return events.filter { event in
            calendar.isDate(event.startTime, inSameDayAs: date) ||
            calendar.isDate(event.endTime, inSameDayAs: date) ||
            (event.startTime < date && event.endTime > calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))!)
        }
    }

    /// Check if a date has events
    func hasEvents(on date: Date) -> Bool {
        !events(for: date).isEmpty
    }

    /// Get the start of the current week
    var weekStart: Date {
        let calendar = Calendar.current
        return calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: selectedDate)) ?? selectedDate
    }

    // MARK: - Initialization

    init() {
        // Load saved group if available
        if let savedGroupId = ChatGroupManager.shared.selectedGroupId {
            currentGroupId = savedGroupId
        }
    }

    deinit {
        Task { [weak channel = realtimeChannel] in
            await channel?.unsubscribe()
        }
    }

    // MARK: - Public Methods

    /// Load events for the current group
    func loadEvents() async {
        guard let groupId = currentGroupId else {
            print("CalendarViewModel: No group selected")
            return
        }

        isLoading = true
        error = nil

        do {
            events = try await repository.fetchEvents(groupId: groupId)
            setupRealtimeSubscription(groupId: groupId)
        } catch {
            self.error = error
            print("CalendarViewModel: Failed to load events: \(error)")
        }

        isLoading = false
    }

    /// Switch to a different group
    func selectGroup(_ groupId: String) {
        guard groupId != currentGroupId else { return }

        // Clear existing data
        events = []
        selectedEvent = nil
        showEventSheet = false

        // Unsubscribe from old channel
        Task { [weak channel = realtimeChannel] in
            await channel?.unsubscribe()
        }
        realtimeChannel = nil

        // Set new group
        currentGroupId = groupId

        // Load events
        Task {
            await loadEvents()
        }
    }

    // MARK: - Navigation

    /// Navigate to previous period based on view mode
    func goToPrevious() {
        let calendar = Calendar.current
        switch viewMode {
        case .month:
            if let newDate = calendar.date(byAdding: .month, value: -1, to: selectedDate) {
                selectedDate = newDate
            }
        case .week:
            if let newDate = calendar.date(byAdding: .weekOfYear, value: -1, to: selectedDate) {
                selectedDate = newDate
            }
        case .day:
            if let newDate = calendar.date(byAdding: .day, value: -1, to: selectedDate) {
                selectedDate = newDate
            }
        }
    }

    /// Navigate to next period based on view mode
    func goToNext() {
        let calendar = Calendar.current
        switch viewMode {
        case .month:
            if let newDate = calendar.date(byAdding: .month, value: 1, to: selectedDate) {
                selectedDate = newDate
            }
        case .week:
            if let newDate = calendar.date(byAdding: .weekOfYear, value: 1, to: selectedDate) {
                selectedDate = newDate
            }
        case .day:
            if let newDate = calendar.date(byAdding: .day, value: 1, to: selectedDate) {
                selectedDate = newDate
            }
        }
    }

    /// Navigate to today
    func goToToday() {
        selectedDate = Date()
    }

    // MARK: - Event Actions

    /// Open sheet to create a new event
    func createEvent(at date: Date? = nil, hour: Int? = nil) {
        selectedEvent = nil

        // Set selected date if provided
        if let date = date {
            if let hour = hour {
                // Set specific hour
                let calendar = Calendar.current
                var components = calendar.dateComponents([.year, .month, .day], from: date)
                components.hour = hour
                components.minute = 0
                selectedDate = calendar.date(from: components) ?? date
            } else {
                selectedDate = date
            }
        }

        showEventSheet = true
    }

    /// Open sheet to edit an existing event
    func editEvent(_ event: CalendarEvent) {
        selectedEvent = event
        showEventSheet = true
    }

    /// Save event (create or update)
    func saveEvent(
        title: String,
        description: String?,
        startTime: Date,
        endTime: Date
    ) async {
        guard let groupId = currentGroupId else { return }

        do {
            if let existingEvent = selectedEvent {
                // Update existing
                let updated = try await repository.updateEvent(
                    id: existingEvent.id,
                    title: title,
                    description: description,
                    startTime: startTime,
                    endTime: endTime
                )
                // Update local array
                if let index = events.firstIndex(where: { $0.id == updated.id }) {
                    events[index] = updated
                }
            } else {
                // Create new
                let newEvent = try await repository.createEvent(
                    title: title,
                    description: description,
                    startTime: startTime,
                    endTime: endTime,
                    groupId: groupId
                )
                events.append(newEvent)
            }
            showEventSheet = false
            selectedEvent = nil
        } catch {
            self.error = error
            print("CalendarViewModel: Failed to save event: \(error)")
        }
    }

    /// Delete the currently selected event
    func deleteEvent() async {
        guard let event = selectedEvent else { return }

        do {
            try await repository.deleteEvent(id: event.id)
            events.removeAll { $0.id == event.id }
            showEventSheet = false
            selectedEvent = nil
        } catch {
            self.error = error
            print("CalendarViewModel: Failed to delete event: \(error)")
        }
    }

    // MARK: - Private Methods

    private func setupRealtimeSubscription(groupId: String) {
        let subscribedGroupId = groupId

        realtimeChannel = repository.subscribeToEvents(
            groupId: groupId,
            onInsert: { [weak self] event in
                guard let self = self,
                      self.currentGroupId == subscribedGroupId,
                      !self.events.contains(where: { $0.id == event.id }) else { return }
                self.events.append(event)
            },
            onUpdate: { [weak self] event in
                guard let self = self,
                      self.currentGroupId == subscribedGroupId else { return }
                if let index = self.events.firstIndex(where: { $0.id == event.id }) {
                    self.events[index] = event
                }
            },
            onDelete: { [weak self] eventId in
                guard let self = self,
                      self.currentGroupId == subscribedGroupId else { return }
                self.events.removeAll { $0.id == eventId }
            }
        )
    }
}

// MARK: - Date Formatting Helpers

extension CalendarViewModel {
    /// Format the current period title based on view mode
    var periodTitle: String {
        let formatter = DateFormatter()
        switch viewMode {
        case .month:
            formatter.dateFormat = "MMMM yyyy"
        case .week:
            formatter.dateFormat = "MMM d"
            let calendar = Calendar.current
            if let weekEnd = calendar.date(byAdding: .day, value: 6, to: weekStart) {
                let endFormatter = DateFormatter()
                endFormatter.dateFormat = "d, yyyy"
                return "\(formatter.string(from: weekStart)) - \(endFormatter.string(from: weekEnd))"
            }
            return formatter.string(from: selectedDate)
        case .day:
            formatter.dateStyle = .full
        }
        return formatter.string(from: selectedDate)
    }
}
