//
//  DayCalendarView.swift
//  share
//
//  Single day view with full hour timeline
//

import SwiftUI

struct DayCalendarView: View {
    @ObservedObject var viewModel: CalendarViewModel

    private let hourHeight: CGFloat = 80  // Larger than week view
    private let timeColumnWidth: CGFloat = 60

    var body: some View {
        VStack(spacing: 0) {
            // Day header
            DayHeader(
                date: viewModel.selectedDate,
                onPrevious: { viewModel.goToPrevious() },
                onNext: { viewModel.goToNext() }
            )

            Divider()

            // Time grid with events
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: true) {
                    ZStack(alignment: .topLeading) {
                        // Hour rows
                        VStack(spacing: 0) {
                            ForEach(0..<24, id: \.self) { hour in
                                HourRow(
                                    hour: hour,
                                    hourHeight: hourHeight,
                                    timeColumnWidth: timeColumnWidth,
                                    onTap: {
                                        viewModel.createEvent(at: viewModel.selectedDate, hour: hour)
                                    }
                                )
                                .id(hour)  // For scroll targeting
                            }
                        }

                        // Events overlay
                        EventsOverlay(
                            events: viewModel.eventsForSelectedDate,
                            hourHeight: hourHeight,
                            timeColumnWidth: timeColumnWidth,
                            onTapEvent: { event in
                                viewModel.editEvent(event)
                            }
                        )

                        // Current time indicator
                        if Calendar.current.isDateInToday(viewModel.selectedDate) {
                            DayCurrentTimeIndicator(
                                hourHeight: hourHeight,
                                timeColumnWidth: timeColumnWidth
                            )
                        }
                    }
                    .padding(.bottom, 80) // Space for FAB
                    .id("dayGrid")
                }
                .onAppear {
                    // Scroll to current time or first event
                    scrollToRelevantPosition(proxy: proxy)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }

    private func scrollToRelevantPosition(proxy: ScrollViewProxy) {
        // Scroll to current time if viewing today, otherwise scroll to first event or morning
        let calendar = Calendar.current

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: 0.3)) {
                if calendar.isDateInToday(viewModel.selectedDate) {
                    // Scroll to current hour (minus 2 to show context above)
                    let hour = calendar.component(.hour, from: Date())
                    proxy.scrollTo(max(0, hour - 2), anchor: .top)
                } else if let firstEvent = viewModel.eventsForSelectedDate.first {
                    // Scroll to first event of the day
                    let hour = calendar.component(.hour, from: firstEvent.startTime)
                    proxy.scrollTo(max(0, hour - 1), anchor: .top)
                } else {
                    // Default to 8 AM
                    proxy.scrollTo(8, anchor: .top)
                }
            }
        }
    }
}

// MARK: - Day Header

struct DayHeader: View {
    let date: Date
    let onPrevious: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack {
            Button(action: onPrevious) {
                Image(systemName: "chevron.left")
                    .font(.title3)
                    .foregroundColor(.blue)
            }
            .padding(.horizontal)

            Spacer()

            VStack(spacing: 2) {
                Text(dayOfWeek)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(isToday ? .blue : .secondary)

                HStack(spacing: 8) {
                    Text(fullDate)
                        .font(.headline)
                        .foregroundColor(.primary)

                    if isToday {
                        Text("Today")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.blue)
                            .cornerRadius(4)
                    }
                }
            }

            Spacer()

            Button(action: onNext) {
                Image(systemName: "chevron.right")
                    .font(.title3)
                    .foregroundColor(.blue)
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
    }

    private var dayOfWeek: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private var fullDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date)
    }

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }
}

// MARK: - Hour Row

struct HourRow: View {
    let hour: Int
    let hourHeight: CGFloat
    let timeColumnWidth: CGFloat
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            // Time label
            VStack {
                Text(formatHour(hour))
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .frame(width: timeColumnWidth)
            .padding(.top, -6)

            // Hour block
            VStack(spacing: 0) {
                Divider()
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .frame(height: hourHeight)
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)
        }
    }

    private func formatHour(_ hour: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h a"
        let date = Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
        return formatter.string(from: date)
    }
}

// MARK: - Events Overlay

struct EventsOverlay: View {
    let events: [CalendarEvent]
    let hourHeight: CGFloat
    let timeColumnWidth: CGFloat
    let onTapEvent: (CalendarEvent) -> Void

    var body: some View {
        GeometryReader { geometry in
            let contentWidth = geometry.size.width - timeColumnWidth - 16

            ForEach(events) { event in
                EventTimeBlock(
                    event: event,
                    hourHeight: hourHeight,
                    onTap: { onTapEvent(event) }
                )
                .frame(width: contentWidth, height: eventHeight(event))
                .offset(
                    x: timeColumnWidth + 8,
                    y: eventOffset(event)
                )
            }
        }
    }

    private func eventHeight(_ event: CalendarEvent) -> CGFloat {
        let minutes = CGFloat(event.durationMinutes)
        return max(30, (minutes / 60.0) * hourHeight)
    }

    private func eventOffset(_ event: CalendarEvent) -> CGFloat {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: event.startTime)
        let minute = calendar.component(.minute, from: event.startTime)
        return CGFloat(hour) * hourHeight + CGFloat(minute) / 60.0 * hourHeight
    }
}

// MARK: - Current Time Indicator

struct DayCurrentTimeIndicator: View {
    let hourHeight: CGFloat
    let timeColumnWidth: CGFloat

    var body: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: timeColumnWidth - 8)

            Circle()
                .fill(Color.red)
                .frame(width: 10, height: 10)

            Rectangle()
                .fill(Color.red)
                .frame(height: 2)
        }
        .offset(y: currentTimeOffset())
    }

    private func currentTimeOffset() -> CGFloat {
        let calendar = Calendar.current
        let now = Date()
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        return CGFloat(hour) * hourHeight + CGFloat(minute) / 60.0 * hourHeight - 5
    }
}

// MARK: - Preview

#Preview {
    DayCalendarView(viewModel: CalendarViewModel())
}
