//
//  CalendarRepository.swift
//  share
//
//  Data access layer for calendar events using Supabase
//

import Foundation
import Supabase
import Realtime

@MainActor
final class CalendarRepository {
    private let supabase: SupabaseClient

    init(supabase: SupabaseClient = SupabaseManager.shared.client) {
        self.supabase = supabase
    }

    // MARK: - Fetch Events

    /// Fetch all calendar events for a group
    func fetchEvents(groupId: String) async throws -> [CalendarEvent] {
        let response: [CalendarEventContent] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("type", value: "time_event")
            .order("created_at", ascending: true)
            .execute()
            .value

        print("CalendarRepository: Fetched \(response.count) events")
        return response.compactMap { CalendarEvent(from: $0) }
    }

    /// Fetch events within a date range
    func fetchEvents(groupId: String, from startDate: Date, to endDate: Date) async throws -> [CalendarEvent] {
        // Fetch all events for the group and filter by date range
        // Note: Supabase JSONB filtering on metadata fields requires special handling
        let response: [CalendarEventContent] = try await supabase
            .from("content")
            .select()
            .eq("group_id", value: groupId)
            .eq("type", value: "time_event")
            .execute()
            .value

        // Filter events that overlap with the date range
        let events = response.compactMap { CalendarEvent(from: $0) }
        return events.filter { event in
            event.startTime <= endDate && event.endTime >= startDate
        }
    }

    /// Fetch events for a specific day
    func fetchEventsForDay(groupId: String, date: Date) async throws -> [CalendarEvent] {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            return []
        }
        return try await fetchEvents(groupId: groupId, from: startOfDay, to: endOfDay)
    }

    /// Fetch events for a week
    func fetchEventsForWeek(groupId: String, weekStart: Date) async throws -> [CalendarEvent] {
        let calendar = Calendar.current
        guard let weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart) else {
            return []
        }
        return try await fetchEvents(groupId: groupId, from: weekStart, to: weekEnd)
    }

    /// Fetch events for a month
    func fetchEventsForMonth(groupId: String, monthDate: Date) async throws -> [CalendarEvent] {
        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: monthDate)),
              let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) else {
            return []
        }
        return try await fetchEvents(groupId: groupId, from: monthStart, to: monthEnd)
    }

    // MARK: - Create Event

    /// Create a new calendar event
    func createEvent(
        title: String,
        description: String?,
        startTime: Date,
        endTime: Date,
        groupId: String,
        calendarId: String? = nil
    ) async throws -> CalendarEvent {
        guard let userId = await SupabaseManager.shared.userId else {
            throw CalendarRepositoryError.notAuthenticated
        }

        let displayName = await SupabaseManager.shared.getCurrentUserDisplayName()

        // Encode event data as JSON
        let eventData = CalendarEventData(title: title, description: description)
        let dataJson = try JSONEncoder().encode(eventData)
        guard let dataString = String(data: dataJson, encoding: .utf8) else {
            throw CalendarRepositoryError.encodingFailed
        }

        // Format dates as ISO 8601
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        let metadata = CalendarEventMetadata(
            start_time: formatter.string(from: startTime),
            end_time: formatter.string(from: endTime),
            user_name: displayName,
            user_color: CalendarEvent.getUserColorHex(userId: userId)
        )

        let payload = CalendarEventPayload(
            data: dataString,
            group_id: groupId,
            user_id: userId,
            parent_content_id: calendarId,
            metadata: metadata
        )

        let content: CalendarEventContent = try await supabase
            .from("content")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value

        guard let event = CalendarEvent(from: content) else {
            throw CalendarRepositoryError.decodingFailed
        }

        print("CalendarRepository: Created event '\(title)' with ID: \(content.id)")
        return event
    }

    // MARK: - Update Event

    /// Update an existing calendar event
    func updateEvent(
        id: String,
        title: String,
        description: String?,
        startTime: Date,
        endTime: Date
    ) async throws -> CalendarEvent {
        guard let userId = await SupabaseManager.shared.userId else {
            throw CalendarRepositoryError.notAuthenticated
        }

        let displayName = await SupabaseManager.shared.getCurrentUserDisplayName()

        // Encode event data as JSON
        let eventData = CalendarEventData(title: title, description: description)
        let dataJson = try JSONEncoder().encode(eventData)
        guard let dataString = String(data: dataJson, encoding: .utf8) else {
            throw CalendarRepositoryError.encodingFailed
        }

        // Format dates as ISO 8601
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        let metadata = CalendarEventMetadata(
            start_time: formatter.string(from: startTime),
            end_time: formatter.string(from: endTime),
            user_name: displayName,
            user_color: CalendarEvent.getUserColorHex(userId: userId)
        )

        let payload = CalendarEventUpdatePayload(
            data: dataString,
            metadata: metadata,
            updated_at: formatter.string(from: Date())
        )

        let content: CalendarEventContent = try await supabase
            .from("content")
            .update(payload)
            .eq("id", value: id)
            .select()
            .single()
            .execute()
            .value

        guard let event = CalendarEvent(from: content) else {
            throw CalendarRepositoryError.decodingFailed
        }

        print("CalendarRepository: Updated event: \(id)")
        return event
    }

    // MARK: - Delete Event

    /// Delete a calendar event
    func deleteEvent(id: String) async throws {
        try await supabase
            .from("content")
            .delete()
            .eq("id", value: id)
            .execute()

        print("CalendarRepository: Deleted event: \(id)")
    }

    // MARK: - Realtime Subscription

    /// Subscribe to calendar event changes for a group
    func subscribeToEvents(
        groupId: String,
        onInsert: @escaping (CalendarEvent) -> Void,
        onUpdate: @escaping (CalendarEvent) -> Void,
        onDelete: @escaping (String) -> Void
    ) -> RealtimeChannelV2 {
        let channel = supabase.realtimeV2.channel("calendar:\(groupId)")

        let insertions = channel.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "content",
            filter: "group_id=eq.\(groupId)"
        )

        let updates = channel.postgresChange(
            UpdateAction.self,
            schema: "public",
            table: "content",
            filter: "group_id=eq.\(groupId)"
        )

        let deletions = channel.postgresChange(
            DeleteAction.self,
            schema: "public",
            table: "content",
            filter: "group_id=eq.\(groupId)"
        )

        Task {
            for await insertion in insertions {
                do {
                    let content = try insertion.decodeRecord(as: CalendarEventContent.self, decoder: JSONDecoder())
                    // Only process time_event type
                    if content.type == "time_event", let event = CalendarEvent(from: content) {
                        await MainActor.run {
                            onInsert(event)
                        }
                    }
                } catch {
                    print("CalendarRepository: Failed to decode inserted event: \(error)")
                }
            }
        }

        Task {
            for await update in updates {
                do {
                    let content = try update.decodeRecord(as: CalendarEventContent.self, decoder: JSONDecoder())
                    if content.type == "time_event", let event = CalendarEvent(from: content) {
                        await MainActor.run {
                            onUpdate(event)
                        }
                    }
                } catch {
                    print("CalendarRepository: Failed to decode updated event: \(error)")
                }
            }
        }

        Task {
            for await deletion in deletions {
                if let id = deletion.oldRecord["id"]?.stringValue {
                    await MainActor.run {
                        onDelete(id)
                    }
                }
            }
        }

        Task {
            await channel.subscribe()
            print("CalendarRepository: Subscribed to realtime for group: \(groupId)")
        }

        return channel
    }
}

// MARK: - Errors

enum CalendarRepositoryError: LocalizedError {
    case notAuthenticated
    case encodingFailed
    case decodingFailed
    case eventNotFound
    case updateFailed(Error)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to manage calendar events"
        case .encodingFailed:
            return "Failed to encode event data"
        case .decodingFailed:
            return "Failed to decode event from server response"
        case .eventNotFound:
            return "Event not found"
        case .updateFailed(let error):
            return "Failed to update event: \(error.localizedDescription)"
        }
    }
}
