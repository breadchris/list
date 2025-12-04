import { useState } from "react";
import { AnnotationManagerProps, formatTime } from './types';

export function AnnotationManager({
  annotations = [],
  sections = [],
  currentTime,
  videoDuration,
  onAnnotationsChange,
  onSeekTo,
  isPlaying,
  onPlayPause,
  onSectionClick,
  onSectionDelete,
  onSectionUpdate,
  onDeleteAnnotation,
  onQuickClip,
  onCreateSection
}: AnnotationManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');
  const [showSections, setShowSections] = useState(true);
  const [sectionStartTime, setSectionStartTime] = useState<number | null>(null);

  const handleAddMarker = () => {
    const newAnnotation = {
      id: crypto.randomUUID(),
      title: `Timestamp ${annotations.length + 1}`,
      description: 'Add description...',
      startTime: currentTime,
      endTime: currentTime,
      type: 'marker' as const
    };

    onAnnotationsChange([...annotations, newAnnotation]);
  };

  const handleStartSection = () => {
    setSectionStartTime(currentTime);
  };

  const handleEndSection = () => {
    if (sectionStartTime === null || !onCreateSection) return;

    onCreateSection(sectionStartTime, currentTime, []);
    setSectionStartTime(null);
  };

  // Check if section recording is in progress
  const isRecordingSection = sectionStartTime !== null;

  const handleStartEdit = (annotation: { id: string; title: string; description: string }) => {
    setEditingId(annotation.id);
    setEditTitle(annotation.title);
    setEditDescription(annotation.description);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;

    const updatedAnnotations = annotations.map(annotation =>
      annotation.id === editingId
        ? { ...annotation, title: editTitle, description: editDescription }
        : annotation
    );

    onAnnotationsChange(updatedAnnotations);
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const handleDelete = (id: string) => {
    if (onDeleteAnnotation) {
      // Use parent's delete handler (deletes from database)
      onDeleteAnnotation(id);
    } else {
      // Fallback to local state update only
      const updatedAnnotations = annotations.filter(annotation => annotation.id !== id);
      onAnnotationsChange(updatedAnnotations);
    }
  };

  const handleSeekToAnnotation = (time: number) => {
    onSeekTo(time);
  };

  // Section handlers
  const handleSectionClick = (sectionId: string) => {
    if (onSectionClick) {
      onSectionClick(sectionId);
    }
  };

  const handleStartSectionEdit = (section: { id: string; title: string }) => {
    setEditingSectionId(section.id);
    setEditSectionTitle(section.title);
  };

  const handleSaveSectionEdit = () => {
    if (!editingSectionId || !onSectionUpdate) return;
    onSectionUpdate(editingSectionId, editSectionTitle);
    setEditingSectionId(null);
    setEditSectionTitle('');
  };

  const handleCancelSectionEdit = () => {
    setEditingSectionId(null);
    setEditSectionTitle('');
  };

  const handleDeleteSection = (sectionId: string) => {
    if (onSectionDelete) {
      onSectionDelete(sectionId);
    }
  };

  // Sort annotations and sections by start time
  const sortedAnnotations = [...annotations].sort((a, b) => a.startTime - b.startTime);
  const sortedSections = [...sections].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm lg:h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Annotations</h3>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
              {sections.length} sections
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {annotations.length} timestamps
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 lg:flex-1 lg:overflow-y-auto lg:min-h-0">
        {/* Add Annotation Controls */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {/* Section Start/End Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleStartSection}
                disabled={isRecordingSection}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                  isRecordingSection
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Start
              </button>
              <button
                onClick={handleEndSection}
                disabled={!isRecordingSection}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                  isRecordingSection
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                End
              </button>
            </div>

            {/* Recording Indicator */}
            {isRecordingSection && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                <span className="text-red-800 font-medium">
                  Recording section from {formatTime(sectionStartTime)}
                </span>
              </div>
            )}

            {/* Quick Clip Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onQuickClip && onQuickClip(10)}
                disabled={isRecordingSection}
                className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5 ${
                  isRecordingSection
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
                title="Create section from last 10 seconds"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Last 10s
              </button>
              <button
                onClick={() => onQuickClip && onQuickClip(30)}
                disabled={isRecordingSection}
                className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5 ${
                  isRecordingSection
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
                title="Create section from last 30 seconds"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Last 30s
              </button>
            </div>
          </div>
        </div>

        {/* Sections List */}
        {sections.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSections(!showSections)}
              className="flex items-center justify-between w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="text-sm font-semibold text-gray-900">Sections ({sections.length})</span>
              </div>
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${showSections ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSections && (
              <div className="space-y-2">
                {sortedSections.map((section, index) => (
                  <div
                    key={section.id}
                    className="bg-purple-50 rounded-lg p-3 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
                    onClick={() => handleSectionClick(section.id)}
                  >
                    {editingSectionId === section.id ? (
                      // Edit mode
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editSectionTitle}
                          onChange={(e) => setEditSectionTitle(e.target.value)}
                          placeholder="Section title..."
                          className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveSectionEdit}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs flex items-center gap-1"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save
                          </button>
                          <button
                            onClick={handleCancelSectionEdit}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{section.title}</h4>
                              <div className="text-xs text-purple-700">
                                {formatTime(section.startTime)} - {formatTime(section.endTime)}
                                <span className="text-purple-600 ml-2">
                                  ({section.timestampIds.length} timestamps)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartSectionEdit(section);
                              }}
                              className="p-1.5 text-purple-600 hover:bg-purple-200 rounded-lg transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSection(section.id);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamps List */}
        <div className="space-y-3">
          {sortedAnnotations.length === 0 ? (
            <div className="text-center py-8">
              <svg className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-gray-600">
                No timestamps added yet.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click "Add Timestamp" to mark important moments in the video.
              </p>
            </div>
          ) : (
            sortedAnnotations.map((annotation, index) => (
              <div key={annotation.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                {editingId === annotation.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Timestamp title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />

                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[60px]"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </button>

                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{annotation.title}</h4>
                          <button
                            onClick={() => handleSeekToAnnotation(annotation.startTime)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {formatTime(annotation.startTime)}
                            {annotation.type === 'range' && ` - ${formatTime(annotation.endTime)}`}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleStartEdit(annotation)}
                          className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDelete(annotation.id)}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 mb-2">{annotation.description}</p>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        annotation.type === 'marker'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {annotation.type === 'marker' ? 'Timestamp' : 'Range'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Video Controls */}
        {annotations.length > 0 && (
          <div className="pt-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={onPlayPause}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Play
                  </>
                )}
              </button>

              <div className="text-xs text-gray-600">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
