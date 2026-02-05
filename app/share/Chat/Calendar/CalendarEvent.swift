//
//  CalendarEvent.swift
//  share
//
//  Data models for calendar events stored in Supabase content table
//

import Foundation
import SwiftUI

/// Calendar view types
enum CalendarViewMode: String, CaseIterable, Hashable {
    case month = "month"
    case week = "week"
    case day = "day"
}

/// A calendar event stored in Supabase content table as type "time_event"
struct CalendarEventContent: Codable, Identifiable {
    let id: String
    let created_at: String
    let updated_at: String?
    let type: String  // "time_event"
    let data: String  // JSON: { title, description }
    let group_id: String
    let user_id: String
    let parent_content_id: String?  // Optional: link to calendar container
    let metadata: CalendarEventMetadata?
}

/// Metadata for calendar events (stored as JSONB in Supabase)
struct CalendarEventMetadata: Codable {
    let start_time: String  // ISO 8601
    let end_time: String    // ISO 8601
    let user_name: String?
    let user_color: String?

    enum CodingKeys: String, CodingKey {
        case start_time
        case end_time
        case user_name
        case user_color
    }
}

/// Event data stored in the `data` field as JSON
struct CalendarEventData: Codable {
    let title: String
    let description: String?
}

/// Payload for inserting new calendar events
struct CalendarEventPayload: Encodable {
    let type: String = "time_event"
    let data: String  // JSON encoded CalendarEventData
    let group_id: String
    let user_id: String
    let parent_content_id: String?
    let metadata: CalendarEventMetadata
}

/// Payload for updating calendar events
struct CalendarEventUpdatePayload: Encodable {
    let data: String  // JSON encoded CalendarEventData
    let metadata: CalendarEventMetadata
    let updated_at: String
}

// MARK: - Parsed Event Model

/// Convenience struct with parsed dates and data for UI display
struct CalendarEvent: Identifiable {
    let id: String
    let title: String
    let description: String?
    let startTime: Date
    let endTime: Date
    let userId: String
    let userName: String?
    let userColor: Color
    let groupId: String
    let createdAt: Date

    /// Initialize from Supabase content
    init?(from content: CalendarEventContent) {
        self.id = content.id
        self.groupId = content.group_id
        self.userId = content.user_id

        // Parse event data JSON
        guard let dataJson = content.data.data(using: .utf8),
              let eventData = try? JSONDecoder().decode(CalendarEventData.self, from: dataJson) else {
            return nil
        }
        self.title = eventData.title
        self.description = eventData.description

        // Parse metadata dates
        guard let metadata = content.metadata else { return nil }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var startDate = formatter.date(from: metadata.start_time)
        var endDate = formatter.date(from: metadata.end_time)

        // Fallback without fractional seconds
        if startDate == nil || endDate == nil {
            formatter.formatOptions = [.withInternetDateTime]
            startDate = startDate ?? formatter.date(from: metadata.start_time)
            endDate = endDate ?? formatter.date(from: metadata.end_time)
        }

        guard let start = startDate, let end = endDate else { return nil }
        self.startTime = start
        self.endTime = end

        self.userName = metadata.user_name

        // Parse user color or generate from userId
        if let colorHex = metadata.user_color {
            self.userColor = Color(hex: colorHex)
        } else {
            self.userColor = CalendarEvent.getUserColor(userId: content.user_id)
        }

        // Parse created_at
        var created = formatter.date(from: content.created_at)
        if created == nil {
            formatter.formatOptions = [.withInternetDateTime]
            created = formatter.date(from: content.created_at)
        }
        self.createdAt = created ?? Date()
    }

    /// Create a new event (for local use before saving)
    init(
        id: String = UUID().uuidString,
        title: String,
        description: String? = nil,
        startTime: Date,
        endTime: Date,
        userId: String,
        userName: String? = nil,
        groupId: String
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.startTime = startTime
        self.endTime = endTime
        self.userId = userId
        self.userName = userName
        self.userColor = CalendarEvent.getUserColor(userId: userId)
        self.groupId = groupId
        self.createdAt = Date()
    }
}

// MARK: - User Colors

extension CalendarEvent {
    /// User color hex strings matching the web app (from types/time.ts)
    static let userColorHexStrings: [String] = [
        "#3b82f6",  // blue-500
        "#22c55e",  // green-500
        "#f59e0b",  // amber-500
        "#ec4899",  // pink-500
        "#8b5cf6",  // violet-500
        "#06b6d4",  // cyan-500
        "#f97316",  // orange-500
        "#14b8a6",  // teal-500
    ]

    /// Get a consistent color for a user based on their ID (matches web app algorithm)
    static func getUserColor(userId: String) -> Color {
        let hexString = getUserColorHex(userId: userId)
        return Color(hex: hexString)
    }

    /// Get hex string for the user color
    static func getUserColorHex(userId: String) -> String {
        var hash: Int = 0
        for char in userId.utf8 {
            hash = ((hash << 5) &- hash) &+ Int(char)
            hash = hash & hash
        }
        let index = abs(hash) % userColorHexStrings.count
        return userColorHexStrings[index]
    }
}

// MARK: - Time Formatting

extension CalendarEvent {
    /// Format time range as "9:00 AM - 10:00 AM"
    var timeRangeString: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: startTime)) - \(formatter.string(from: endTime))"
    }

    /// Duration in minutes
    var durationMinutes: Int {
        Int(endTime.timeIntervalSince(startTime) / 60)
    }

    /// Check if event spans multiple days
    var isMultiDay: Bool {
        !Calendar.current.isDate(startTime, inSameDayAs: endTime)
    }
}

// Note: Color(hex:) extension is defined in ContentView.swift
