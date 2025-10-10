import { useState } from "react";
import { AnnotationManagerProps, formatTime } from './types';

export function AnnotationManager({
  annotations = [],
  currentTime,
  videoDuration,
  onAnnotationsChange,
  onSeekTo,
  isPlaying,
  onPlayPause
}: AnnotationManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

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

  const handleAddRange = () => {
    const endTime = Math.min(currentTime + 30, videoDuration);
    const newAnnotation = {
      id: crypto.randomUUID(),
      title: `Clip ${annotations.length + 1}`,
      description: 'Add description...',
      startTime: currentTime,
      endTime: endTime,
      type: 'range' as const
    };

    onAnnotationsChange([...annotations, newAnnotation]);
  };

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
    const updatedAnnotations = annotations.filter(annotation => annotation.id !== id);
    onAnnotationsChange(updatedAnnotations);
  };

  const handleSeekToAnnotation = (time: number) => {
    onSeekTo(time);
  };

  // Sort annotations by start time
  const sortedAnnotations = [...annotations].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Timestamps</h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
            {annotations.length}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5 flex-1 overflow-y-auto min-h-0">
        {/* Add Annotation Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Current: {formatTime(currentTime)}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={handleAddMarker}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Add Timestamp
            </button>

            <button
              onClick={handleAddRange}
              className="px-4 py-2.5 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Add Time Range
            </button>
          </div>
        </div>

        {/* Annotations List */}
        <div className="space-y-4">
          {sortedAnnotations.length === 0 ? (
            <div className="text-center py-12">
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
              <div key={annotation.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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
          <div className="pt-5 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={onPlayPause}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
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
