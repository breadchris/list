//
//  EventRowView.swift
//  share
//
//  Reusable event row component for calendar views
//

import SwiftUI

struct EventRowView: View {
    let event: CalendarEvent
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Color indicator bar
                Rectangle()
                    .fill(event.userColor)
                    .frame(width: 4)
                    .cornerRadius(2)

                // Event details
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        // Time
                        Text(event.timeRangeString)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        // User name if available
                        if let userName = event.userName {
                            Text("•")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Text(userName)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    // Description preview
                    if let description = event.description, !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .background(Color(.systemBackground))
            .cornerRadius(10)
            .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Compact Row (for week view cells)

struct EventRowCompact: View {
    let event: CalendarEvent
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Rectangle()
                    .fill(event.userColor)
                    .frame(width: 3)
                    .cornerRadius(1.5)

                VStack(alignment: .leading, spacing: 2) {
                    Text(event.title)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Text(formatTime(event.startTime))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .background(event.userColor.opacity(0.1))
            .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Time Block (for day/week grid positioning)

struct EventTimeBlock: View {
    let event: CalendarEvent
    let hourHeight: CGFloat
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Left color stripe (matches React's 3-4px border-left)
                Rectangle()
                    .fill(event.userColor)
                    .frame(width: 4)

                VStack(alignment: .leading, spacing: 2) {
                    Text(event.title)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    // Always show time range (React shows this)
                    Text(event.timeRangeString)
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    // Show user name at height >= 60 (matches React)
                    if height >= 60, let userName = event.userName {
                        Text(userName)
                            .font(.caption2)
                            .foregroundColor(Color(.tertiaryLabel))
                    }

                    // Show description at height >= 80 (matches React)
                    if height >= 80, let description = event.description, !description.isEmpty {
                        Text(description)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)

                Spacer()
            }
            .frame(maxWidth: .infinity)
            .background(Color(.systemGray5))  // Dark solid background (matches React's bg-neutral-800)
            .cornerRadius(4)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(Color(.systemGray4), lineWidth: 1)  // Border (matches React's border-neutral-600)
            )
        }
        .buttonStyle(.plain)
    }

    private var height: CGFloat {
        let minutes = CGFloat(event.durationMinutes)
        return (minutes / 60.0) * hourHeight
    }
}

// MARK: - Preview

#Preview("Event Row") {
    VStack(spacing: 12) {
        EventRowView(
            event: CalendarEvent(
                title: "Team Meeting",
                description: "Discuss Q1 roadmap",
                startTime: Date(),
                endTime: Date().addingTimeInterval(3600),
                userId: "user1",
                userName: "John",
                groupId: "group1"
            ),
            onTap: {}
        )

        EventRowView(
            event: CalendarEvent(
                title: "Lunch with Sarah",
                startTime: Date().addingTimeInterval(7200),
                endTime: Date().addingTimeInterval(10800),
                userId: "user2",
                groupId: "group1"
            ),
            onTap: {}
        )
    }
    .padding()
    .background(Color(.systemGray6))
}

#Preview("Compact Row") {
    VStack(spacing: 8) {
        EventRowCompact(
            event: CalendarEvent(
                title: "Standup",
                startTime: Date(),
                endTime: Date().addingTimeInterval(1800),
                userId: "user1",
                groupId: "group1"
            ),
            onTap: {}
        )

        EventRowCompact(
            event: CalendarEvent(
                title: "Code Review",
                startTime: Date().addingTimeInterval(3600),
                endTime: Date().addingTimeInterval(7200),
                userId: "user2",
                groupId: "group1"
            ),
            onTap: {}
        )
    }
    .padding()
    .frame(width: 150)
    .background(Color(.systemGray6))
}
