//
//  MonthCalendarView.swift
//  share
//
//  Native iOS month calendar view using UICalendarView
//

import SwiftUI
import UIKit

struct MonthCalendarView: View {
    @ObservedObject var viewModel: CalendarViewModel

    var body: some View {
        GeometryReader { geometry in
            let calendarHeight = min(380, geometry.size.height * 0.55)

            VStack(spacing: 0) {
                // Native UICalendarView
                UICalendarViewRepresentable(
                    selectedDate: $viewModel.selectedDate,
                    events: viewModel.events
                )
                .frame(height: calendarHeight)
                .frame(maxWidth: .infinity)
                .clipped()

                Divider()

                // Events list for selected date
                EventsListForDate(viewModel: viewModel)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }
}

// MARK: - UICalendarView Wrapper

struct UICalendarViewRepresentable: UIViewRepresentable {
    @Binding var selectedDate: Date
    let events: [CalendarEvent]

    func makeUIView(context: Context) -> UICalendarView {
        let calendarView = UICalendarView()
        calendarView.calendar = Calendar.current
        calendarView.locale = Locale.current
        calendarView.fontDesign = .rounded
        calendarView.delegate = context.coordinator

        // Prevent touch targets from extending outside bounds (fixes picker overlap on device)
        calendarView.clipsToBounds = true

        // Allow single date selection
        let selection = UICalendarSelectionSingleDate(delegate: context.coordinator)
        selection.selectedDate = Calendar.current.dateComponents([.year, .month, .day], from: selectedDate)
        calendarView.selectionBehavior = selection

        return calendarView
    }

    func updateUIView(_ uiView: UICalendarView, context: Context) {
        // Update coordinator with current events
        context.coordinator.events = events
        context.coordinator.parentSelectedDate = selectedDate

        // Update visible date if month changed
        let calendar = Calendar.current
        let currentComponents = calendar.dateComponents([.year, .month], from: uiView.visibleDateComponents.date ?? Date())
        let newComponents = calendar.dateComponents([.year, .month], from: selectedDate)

        if currentComponents.year != newComponents.year || currentComponents.month != newComponents.month {
            uiView.visibleDateComponents = DateComponents(
                calendar: calendar,
                year: newComponents.year,
                month: newComponents.month
            )
        }

        // Reload decorations for all visible dates
        uiView.reloadDecorations(forDateComponents: context.coordinator.visibleDateComponents, animated: false)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UICalendarViewDelegate, UICalendarSelectionSingleDateDelegate {
        var parent: UICalendarViewRepresentable
        var events: [CalendarEvent] = []
        var parentSelectedDate: Date = Date()
        var visibleDateComponents: [DateComponents] = []

        init(_ parent: UICalendarViewRepresentable) {
            self.parent = parent
            self.events = parent.events
        }

        // MARK: - UICalendarViewDelegate

        func calendarView(_ calendarView: UICalendarView, decorationFor dateComponents: DateComponents) -> UICalendarView.Decoration? {
            guard let date = dateComponents.date else { return nil }

            // Track visible dates for refresh
            if !visibleDateComponents.contains(where: { $0.date == date }) {
                visibleDateComponents.append(dateComponents)
            }

            // Find events on this date
            let calendar = Calendar.current
            let dayEvents = events.filter { event in
                calendar.isDate(event.startTime, inSameDayAs: date) ||
                calendar.isDate(event.endTime, inSameDayAs: date) ||
                (event.startTime < date && event.endTime > calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))!)
            }

            guard !dayEvents.isEmpty else { return nil }

            // Show colored dot(s) for events
            if dayEvents.count == 1 {
                // Single colored dot
                let color = dayEvents[0].userColor
                return .customView {
                    let view = UIView(frame: CGRect(x: 0, y: 0, width: 6, height: 6))
                    view.backgroundColor = UIColor(color)
                    view.layer.cornerRadius = 3
                    return view
                }
            } else {
                // Multiple dots
                return .customView {
                    let container = UIStackView()
                    container.axis = .horizontal
                    container.spacing = 2
                    container.alignment = .center

                    for event in dayEvents.prefix(3) {
                        let dot = UIView()
                        dot.backgroundColor = UIColor(event.userColor)
                        dot.layer.cornerRadius = 2.5
                        dot.translatesAutoresizingMaskIntoConstraints = false
                        dot.widthAnchor.constraint(equalToConstant: 5).isActive = true
                        dot.heightAnchor.constraint(equalToConstant: 5).isActive = true
                        container.addArrangedSubview(dot)
                    }

                    return container
                }
            }
        }

        // MARK: - UICalendarSelectionSingleDateDelegate

        func dateSelection(_ selection: UICalendarSelectionSingleDate, didSelectDate dateComponents: DateComponents?) {
            guard let dateComponents = dateComponents,
                  let date = dateComponents.date else { return }
            parent.selectedDate = date
        }
    }
}

// MARK: - Events List

struct EventsListForDate: View {
    @ObservedObject var viewModel: CalendarViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Date header
            HStack {
                Text(dateHeader)
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                if isToday {
                    Text("Today")
                        .font(.caption)
                        .foregroundColor(.blue)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 12)

            if viewModel.eventsForSelectedDate.isEmpty {
                // Empty state
                VStack(spacing: 12) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 36))
                        .foregroundColor(.secondary)

                    Text("No events")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button {
                        viewModel.createEvent(at: viewModel.selectedDate)
                    } label: {
                        Text("Add Event")
                            .font(.subheadline)
                            .foregroundColor(.blue)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, 40)
            } else {
                // Events list
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(viewModel.eventsForSelectedDate) { event in
                            EventRowView(event: event) {
                                viewModel.editEvent(event)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 80) // Space for FAB
                }
            }
        }
        .frame(maxHeight: .infinity)
    }

    private var dateHeader: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: viewModel.selectedDate)
    }

    private var isToday: Bool {
        Calendar.current.isDateInToday(viewModel.selectedDate)
    }
}

// MARK: - Preview

#Preview {
    MonthCalendarView(viewModel: CalendarViewModel())
}
