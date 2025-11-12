/**
 * useCalendarEvents Hook
 *
 * Fetches content items and maps them to calendar events.
 * Supports filtering by date range, tags, and content types.
 */

import { useQuery } from '@tanstack/react-query';
import { CalendarEvent, DateRange, CalendarFilters } from '../types/CalendarTypes';
import { contentRepository, Content } from '../components/ContentRepository';

interface UseCalendarEventsOptions {
  groupId: string;
  dateRange: DateRange;
  filters?: CalendarFilters;
  enabled?: boolean;
}

/**
 * Map content item to calendar event
 */
function mapContentToEvent(content: Content): CalendarEvent {
  // Parse created_at timestamp to get both date and time
  const createdDate = new Date(content.created_at);
  const date = createdDate;

  // Extract time-of-day from created_at (HH:mm format for timeline positioning)
  const hours = createdDate.getHours();
  const minutes = createdDate.getMinutes();
  const extractedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  // Use metadata.event_time if explicitly set, otherwise use extracted time from created_at
  let time: string = extractedTime;
  let endTime: string | undefined;

  if (content.metadata?.event_time) {
    time = content.metadata.event_time; // Override with explicit time if available
  }

  if (content.metadata?.event_end_time) {
    endTime = content.metadata.event_end_time;
  }

  // Determine color from first tag or content type
  let color = '#3B82F6'; // Default blue

  if (content.tags && content.tags.length > 0 && content.tags[0].color) {
    color = content.tags[0].color;
  }

  // Create title from content data (truncate if too long)
  let title = content.data;
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }

  return {
    id: content.id,
    title,
    date,
    time,
    end_time: endTime,
    color,
    content_id: content.id,
    content_type: content.type,
    metadata: content.metadata,
    tags: content.tags,
  };
}

/**
 * Hook for fetching content as calendar events
 *
 * @param options - Query options including groupId, dateRange, and filters
 * @returns React Query result with calendar events
 */
export function useCalendarEvents(options: UseCalendarEventsOptions) {
  const { groupId, dateRange, filters, enabled = true } = options;

  return useQuery({
    queryKey: [
      'calendar-events',
      groupId,
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      filters?.tagIds,
      filters?.contentTypes,
      filters?.searchQuery,
    ],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!groupId) return [];

      // Fetch content items within the date range
      // Note: This uses a basic approach - for production, consider adding
      // a dedicated database query that filters by date range server-side
      const allContent = await contentRepository.getContentByParent(
        groupId,
        null, // Root level only for now
        0,
        1000 // Large limit to get all content
      );

      // Filter by date range
      let filteredContent = allContent.filter((item) => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
      });

      // Apply tag filters if provided
      if (filters?.tagIds && filters.tagIds.length > 0) {
        filteredContent = filteredContent.filter((item) => {
          if (!item.tags || item.tags.length === 0) return false;
          return filters.tagIds!.some((tagId) =>
            item.tags!.some((tag) => tag.id === tagId)
          );
        });
      }

      // Apply content type filters if provided
      if (filters?.contentTypes && filters.contentTypes.length > 0) {
        filteredContent = filteredContent.filter((item) =>
          filters.contentTypes!.includes(item.type)
        );
      }

      // Apply search query if provided
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        filteredContent = filteredContent.filter((item) =>
          item.data.toLowerCase().includes(query)
        );
      }

      // Map content items to calendar events
      const events = filteredContent.map(mapContentToEvent);

      // Sort by date
      events.sort((a, b) => a.date.getTime() - b.date.getTime());

      return events;
    },
    enabled: !!groupId && enabled,
    staleTime: 60000, // 1 minute - calendar data updates frequently
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook for fetching events for a specific day
 *
 * Convenience wrapper around useCalendarEvents for day view
 */
export function useDayEvents(
  groupId: string,
  date: Date,
  filters?: CalendarFilters
) {
  const dateRange: DateRange = {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  };

  return useCalendarEvents({
    groupId,
    dateRange,
    filters,
  });
}
