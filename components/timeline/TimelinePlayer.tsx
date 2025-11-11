import React, { useRef, useEffect, useState } from 'react';
import type { TimelinePlayerProps } from './types';
import { formatMarkerTime } from './types';
import TimelineControls from './TimelineControls';
import { useTimelinePlayer } from '../../hooks/useTimelinePlayer';

export default function TimelinePlayer({
  contentId,
  title,
  metadata,
  onUpdate,
  onClose,
}: TimelinePlayerProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');

  const {
    isPlaying,
    currentTime,
    duration,
    markers,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    addMarker,
    updateMarker,
    deleteMarker,
    jumpToMarker,
    setDuration: setDurationManually,
  } = useTimelinePlayer({
    initialMetadata: metadata,
    onUpdate,
    autoSave: true,
    autoSaveDelay: 1000,
  });

  // Convert time to X position on timeline
  const timeToPosition = (time: number): number => {
    if (duration === 0) return 0;
    return (time / duration) * 100; // percentage
  };

  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    // Don't seek if clicking on a marker
    if ((e.target as HTMLElement).closest('.timeline-marker')) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    seekTo(Math.max(0, Math.min(newTime, duration)));
  };

  // Handle mark button
  const handleMark = () => {
    addMarker(currentTime, `Marker ${markers.length + 1}`);
  };

  // Handle marker click
  const handleMarkerClick = (markerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      jumpToMarker(markerId);
      setSelectedMarkerId(markerId);
    }
  };

  // Start editing marker
  const handleEditMarker = (markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      setEditingMarkerId(markerId);
      setEditLabel(marker.label || '');
      setEditNote(marker.note || '');
    }
  };

  // Save marker edits
  const saveMarkerEdit = () => {
    if (editingMarkerId) {
      updateMarker(editingMarkerId, {
        label: editLabel,
        note: editNote,
      });
      setEditingMarkerId(null);
      setSelectedMarkerId(null);
    }
  };

  // Cancel marker edit
  const cancelMarkerEdit = () => {
    setEditingMarkerId(null);
    setEditLabel('');
    setEditNote('');
  };

  // Delete marker
  const handleDeleteMarker = (markerId: string) => {
    deleteMarker(markerId);
    if (selectedMarkerId === markerId) {
      setSelectedMarkerId(null);
    }
    if (editingMarkerId === markerId) {
      setEditingMarkerId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {metadata.context && (
              <p className="text-sm text-gray-500">{metadata.context}</p>
            )}
          </div>
        </div>

        {/* Duration Editor */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Duration:</label>
          <input
            type="number"
            value={Math.floor(duration)}
            onChange={(e) => setDurationManually(Number(e.target.value))}
            className="w-20 px-2 py-1 text-sm border rounded"
            min="1"
            step="1"
          />
          <span className="text-sm text-gray-500">seconds</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Timeline Visualization */}
        <div className="p-6">
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="relative w-full h-32 bg-gray-100 rounded-lg cursor-pointer overflow-hidden"
          >
            {/* Waveform-style background */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-12 flex items-center space-x-1 px-2">
                {Array.from({ length: 100 }).map((_, i) => {
                  const height = Math.sin(i * 0.5) * 20 + 20;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-red-400 rounded-full opacity-30"
                      style={{ height: `${height}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="absolute top-0 left-0 h-full bg-red-500 opacity-20"
              style={{ width: `${timeToPosition(currentTime)}%` }}
            />

            {/* Markers */}
            {markers.map((marker) => (
              <div
                key={marker.id}
                className="timeline-marker absolute top-0 bottom-0 flex flex-col items-center justify-center cursor-pointer group"
                style={{ left: `${timeToPosition(marker.time)}%` }}
                onClick={(e) => handleMarkerClick(marker.id, e)}
              >
                {/* Marker line */}
                <div
                  className={`w-0.5 h-full ${
                    selectedMarkerId === marker.id
                      ? 'bg-blue-600'
                      : 'bg-red-600 group-hover:bg-red-700'
                  }`}
                />

                {/* Marker dot */}
                <div
                  className={`absolute top-2 w-3 h-3 rounded-full border-2 ${
                    selectedMarkerId === marker.id
                      ? 'bg-blue-600 border-white'
                      : 'bg-red-600 border-white group-hover:bg-red-700'
                  }`}
                />

                {/* Marker label (on hover) */}
                {marker.label && (
                  <div className="absolute -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {marker.label}
                  </div>
                )}
              </div>
            ))}

            {/* Current time indicator (playhead) */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-red-600 pointer-events-none"
              style={{ left: `${timeToPosition(currentTime)}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rounded-full" />
            </div>
          </div>

          {/* Time markers */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0:00</span>
            <span>{formatMarkerTime(duration / 2)}</span>
            <span>{formatMarkerTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-t">
          <TimelineControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={togglePlayPause}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onMark={handleMark}
          />
        </div>

        {/* Marker List */}
        <div className="flex-1 overflow-y-auto border-t">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Markers ({markers.length})
            </h3>

            {markers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No markers yet. Click "Mark" to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMarkerId === marker.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      if (editingMarkerId !== marker.id) {
                        handleMarkerClick(marker.id, {} as React.MouseEvent);
                      }
                    }}
                  >
                    {editingMarkerId === marker.id ? (
                      // Edit mode
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Label"
                          className="w-full px-2 py-1 text-sm border rounded"
                          autoFocus
                        />
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Notes..."
                          className="w-full px-2 py-1 text-sm border rounded resize-none"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={saveMarkerEdit}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelMarkerEdit}
                            className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-red-600">
                                {formatMarkerTime(marker.time)}
                              </span>
                              {marker.label && (
                                <span className="text-sm font-semibold">
                                  {marker.label}
                                </span>
                              )}
                            </div>
                            {marker.note && (
                              <p className="text-sm text-gray-600 mt-1">
                                {marker.note}
                              </p>
                            )}
                          </div>

                          <div className="flex space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditMarker(marker.id);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-600"
                              title="Edit"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this marker?')) {
                                  handleDeleteMarker(marker.id);
                                }
                              }}
                              className="p-1 text-gray-500 hover:text-red-600"
                              title="Delete"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
