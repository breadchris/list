//
//  WeekCalendarView.swift
//  share
//
//  Week view with 7 day columns and hourly time grid
//

import SwiftUI

struct WeekCalendarView: View {
    @ObservedObject var viewModel: CalendarViewModel

    private let hourHeight: CGFloat = 64  // Matches React calendar
    private let timeColumnWidth: CGFloat = 50
    private let headerHeight: CGFloat = 60

    var body: some View {
        GeometryReader { geometry in
            let availableWidth = max(geometry.size.width, 320) // Minimum screen width
            let dayColumnWidth = max((availableWidth - timeColumnWidth) / 7, 30) // Minimum 30pt per day

            VStack(spacing: 0) {
                // Day headers
                WeekHeader(
                    weekStart: viewModel.weekStart,
                    selectedDate: viewModel.selectedDate,
                    dayColumnWidth: dayColumnWidth,
                    timeColumnWidth: timeColumnWidth,
                    onSelectDate: { date in
                        viewModel.selectedDate = date
                    }
                )
                .frame(height: headerHeight)

                Divider()

                // Time grid with events
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        ZStack(alignment: .topLeading) {
                            // Hour lines
                            TimeGridLines(
                                hourHeight: hourHeight,
                                timeColumnWidth: timeColumnWidth
                            )

                            // Day columns with events
                            HStack(spacing: 0) {
                                // Time labels column
                                VStack(spacing: 0) {
                                    ForEach(0..<24, id: \.self) { hour in
                                        HStack {
                                            Spacer()
                                            Text(formatHour(hour))
                                                .font(.caption2)
                                                .foregroundColor(.secondary)
                                                .padding(.trailing, 4)
                                        }
                                        .frame(width: timeColumnWidth, height: hourHeight)
                                        .id(hour)  // For scroll targeting
                                    }
                                }

                                // Day columns
                                ForEach(0..<7, id: \.self) { dayOffset in
                                    let date = dayDate(offset: dayOffset)
                                    let dayEvents = eventsForDay(date)

                                    DayColumn(
                                        date: date,
                                        events: dayEvents,
                                        hourHeight: hourHeight,
                                        width: dayColumnWidth,
                                        onTapEvent: { event in
                                            viewModel.editEvent(event)
                                        },
                                        onTapHour: { hour in
                                            viewModel.createEvent(at: date, hour: hour)
                                        }
                                    )
                                }
                            }

                            // Current time indicator
                            if isCurrentWeek {
                                CurrentTimeIndicator(
                                    hourHeight: hourHeight,
                                    timeColumnWidth: timeColumnWidth,
                                    dayColumnWidth: dayColumnWidth,
                                    weekStart: viewModel.weekStart
                                )
                            }
                        }
                        .id("timeGrid")
                    }
                    .onAppear {
                        // Scroll to current time
                        scrollToCurrentTime(proxy: proxy)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }

    // MARK: - Helpers

    private func dayDate(offset: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: offset, to: viewModel.weekStart) ?? viewModel.weekStart
    }

    private func eventsForDay(_ date: Date) -> [CalendarEvent] {
        let calendar = Calendar.current
        return viewModel.eventsForSelectedWeek.filter { event in
            calendar.isDate(event.startTime, inSameDayAs: date)
        }
    }

    private var isCurrentWeek: Bool {
        let calendar = Calendar.current
        return calendar.isDate(Date(), equalTo: viewModel.weekStart, toGranularity: .weekOfYear)
    }

    private func formatHour(_ hour: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "ha"
        let date = Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
        return formatter.string(from: date).lowercased()
    }

    private func scrollToCurrentTime(proxy: ScrollViewProxy) {
        // Calculate scroll position to center current time in view
        let now = Date()
        let hour = Calendar.current.component(.hour, from: now)

        // Scroll to hour with a slight delay to ensure view is ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: 0.3)) {
                proxy.scrollTo(max(0, hour - 2), anchor: .top)
            }
        }
    }
}

// MARK: - Week Header

struct WeekHeader: View {
    let weekStart: Date
    let selectedDate: Date
    let dayColumnWidth: CGFloat
    let timeColumnWidth: CGFloat
    let onSelectDate: (Date) -> Void

    // Sky blue color matching React's sky-500
    private let skyBlue = Color(red: 0.34, green: 0.63, blue: 0.93)

    var body: some View {
        HStack(spacing: 0) {
            // Empty space for time column
            Color.clear
                .frame(width: timeColumnWidth)

            // Day headers
            ForEach(0..<7, id: \.self) { dayOffset in
                let date = Calendar.current.date(byAdding: .day, value: dayOffset, to: weekStart) ?? weekStart
                let isSelected = Calendar.current.isDate(date, inSameDayAs: selectedDate)
                let isToday = Calendar.current.isDateInToday(date)

                Button {
                    onSelectDate(date)
                } label: {
                    VStack(spacing: 4) {
                        Text(dayOfWeek(date))
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(isToday ? skyBlue : .secondary)

                        Text(dayNumber(date))
                            .font(.title3)
                            .fontWeight(isToday ? .bold : .regular)
                            .foregroundColor(isToday ? .white : (isSelected ? skyBlue : .primary))
                            .frame(width: 36, height: 36)
                            .background(
                                Circle()
                                    .fill(isToday ? skyBlue : (isSelected ? skyBlue.opacity(0.1) : Color.clear))
                            )
                    }
                }
                .frame(width: dayColumnWidth)
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    private func dayOfWeek(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).uppercased()
    }

    private func dayNumber(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

// MARK: - Time Grid Lines

struct TimeGridLines: View {
    let hourHeight: CGFloat
    let timeColumnWidth: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<24, id: \.self) { hour in
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        Color.clear.frame(width: timeColumnWidth)
                        Divider()
                    }
                    Spacer()
                }
                .frame(height: hourHeight)
            }
        }
    }
}

// MARK: - Day Column

struct DayColumn: View {
    let date: Date
    let events: [CalendarEvent]
    let hourHeight: CGFloat
    let width: CGFloat
    let onTapEvent: (CalendarEvent) -> Void
    let onTapHour: (Int) -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Tap targets for each hour
            VStack(spacing: 0) {
                ForEach(0..<24, id: \.self) { hour in
                    Rectangle()
                        .fill(Color.clear)
                        .contentShape(Rectangle())
                        .frame(height: hourHeight)
                        .onTapGesture {
                            onTapHour(hour)
                        }
                }
            }

            // Events
            ForEach(events) { event in
                EventTimeBlock(
                    event: event,
                    hourHeight: hourHeight,
                    onTap: { onTapEvent(event) }
                )
                .frame(width: width - 4, height: eventHeight(event))
                .offset(y: eventOffset(event))
                .padding(.horizontal, 2)
            }
        }
        .frame(width: width)
    }

    private func eventHeight(_ event: CalendarEvent) -> CGFloat {
        let minutes = CGFloat(event.durationMinutes)
        return max(20, (minutes / 60.0) * hourHeight)
    }

    private func eventOffset(_ event: CalendarEvent) -> CGFloat {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: event.startTime)
        let minute = calendar.component(.minute, from: event.startTime)
        return CGFloat(hour) * hourHeight + CGFloat(minute) / 60.0 * hourHeight
    }
}

// MARK: - Current Time Indicator

struct CurrentTimeIndicator: View {
    let hourHeight: CGFloat
    let timeColumnWidth: CGFloat
    let dayColumnWidth: CGFloat
    let weekStart: Date

    var body: some View {
        let calendar = Calendar.current
        let now = Date()
        let dayOfWeek = calendar.component(.weekday, from: now) - calendar.firstWeekday
        let normalizedDay = (dayOfWeek + 7) % 7

        GeometryReader { geometry in
            HStack(spacing: 0) {
                Color.clear.frame(width: timeColumnWidth + CGFloat(normalizedDay) * dayColumnWidth - 4)

                Circle()
                    .fill(Color.red)
                    .frame(width: 8, height: 8)

                Rectangle()
                    .fill(Color.red)
                    .frame(height: 2)
            }
            .offset(y: currentTimeOffset())
        }
    }

    private func currentTimeOffset() -> CGFloat {
        let calendar = Calendar.current
        let now = Date()
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
        return CGFloat(hour) * hourHeight + CGFloat(minute) / 60.0 * hourHeight - 4
    }
}

// MARK: - Preview

#Preview {
    WeekCalendarView(viewModel: CalendarViewModel())
}
