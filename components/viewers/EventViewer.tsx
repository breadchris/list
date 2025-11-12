import React from 'react';
import { EventData } from '../contentTypeSchemas';

interface EventViewerProps {
  data: EventData;
}

/**
 * Viewer component for event content type
 * Displays event details, agenda, participants, and location
 */
export const EventViewer: React.FC<EventViewerProps> = ({ data }) => {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDuration = () => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.title}</h1>
        <p className="text-gray-600">{data.description}</p>
      </div>

      {/* Date & Time */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-3xl">📅</div>
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-1">When</div>
            <div className="font-semibold text-gray-900">
              {formatDateTime(data.start_date)}
            </div>
            <div className="text-sm text-gray-600">
              to {formatDateTime(data.end_date)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Duration: {getDuration()}
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      {data.location && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-3xl">📍</div>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">Location</div>
              <div className="font-semibold text-gray-900">{data.location.name}</div>
              {data.location.address && (
                <div className="text-sm text-gray-600 mt-1">{data.location.address}</div>
              )}
              {data.location.coordinates && (
                <a
                  href={`https://maps.google.com/?q=${data.location.coordinates.latitude},${data.location.coordinates.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  View on map →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tags & Category */}
      <div className="flex flex-wrap gap-2 mb-6">
        {data.category && (
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            {data.category}
          </span>
        )}
        {data.tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Agenda */}
      {data.agenda && data.agenda.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Agenda</h2>
          <div className="space-y-3">
            {data.agenda.map((item, index) => (
              <div key={index} className="flex gap-3 border-l-4 border-blue-600 pl-4 py-2">
                <div className="flex-shrink-0 font-semibold text-blue-600 min-w-[80px]">
                  {item.time}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.item}</div>
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  )}
                  {item.duration && (
                    <span className="text-xs text-gray-500">⏱️ {item.duration} min</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      {data.participants && data.participants.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 Participants</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.participants.map((participant, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {participant.name}
                  </div>
                  {participant.role && (
                    <div className="text-xs text-gray-500">{participant.role}</div>
                  )}
                  {participant.email && (
                    <a
                      href={`mailto:${participant.email}`}
                      className="text-xs text-blue-600 hover:underline truncate block"
                    >
                      {participant.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminders */}
      {data.reminders && data.reminders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔔 Reminders</h2>
          <div className="space-y-2">
            {data.reminders.map((reminder, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-lg">⏰</span>
                <span>
                  {reminder.time_before} minutes before
                  {reminder.message && `: ${reminder.message}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📝 Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}
    </div>
  );
};
