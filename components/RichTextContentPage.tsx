import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { LexicalRichEditor } from './LexicalRichEditor';
import { useRichTextContent } from '../hooks/useRichTextContent';
import { useAutoSaveContent } from '../hooks/useAutoSaveContent';
import { useTags } from '../hooks/useTags';

/**
 * Minimal Rich Text Content Page
 *
 * Features:
 * - Clean, distraction-free layout
 * - Click to edit (auto-edit on click)
 * - Auto-save on change with debounce
 * - Read-only view mode by default
 * - Escape key to exit edit mode
 */
export const RichTextContentPage: React.FC = () => {
  const { groupId, contentId } = useParams<{ groupId: string; contentId: string }>();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [currentContent, setCurrentContent] = useState('');

  // Fetch content
  const { content, isLoading, error: fetchError } = useRichTextContent({
    contentId: contentId!,
    groupId: groupId!,
    enabled: !!contentId && !!groupId,
  });

  // Fetch available tags for mentions
  const { data: tags = [] } = useTags(groupId!);

  // Auto-save functionality
  const { saveState, save, error: saveError } = useAutoSaveContent({
    contentId: contentId!,
    debounceMs: 500,
  });

  // Initialize content when loaded
  useEffect(() => {
    if (content?.data) {
      setCurrentContent(content.data);
    }
  }, [content]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setCurrentContent(newContent);
    save(newContent);
  }, [save]);

  // Handle escape key to exit edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        setIsEditing(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  // Navigate back to list
  const handleBack = () => {
    navigate(`/group/${groupId}`);
  };

  // Error states
  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Content</h2>
          <p className="text-gray-600 mb-4">{fetchError.message}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  if (!groupId || !contentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Invalid content URL</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Save status indicator */}
            <div className="flex items-center space-x-2">
              {saveState === 'saving' && (
                <span className="text-sm text-gray-500">Saving...</span>
              )}
              {saveState === 'saved' && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Saved</span>
                </div>
              )}
              {saveState === 'error' && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Save failed</span>
                </div>
              )}
              {saveError && (
                <span className="text-xs text-red-500">{saveError.message}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : isEditing ? (
            /* Edit mode - Rich text editor */
            <div className="min-h-[60vh]">
              <LexicalRichEditor
                onSubmit={(text, mentions) => {
                  // In auto-save mode, onSubmit is just for Cmd/Ctrl+Enter
                  // We don't need to do anything special here
                  handleContentChange(text);
                }}
                onChange={(editorState) => {
                  editorState.read(() => {
                    const textContent = editorState.read(() =>
                      editorState._nodeMap.get('root')?.__cachedText || ''
                    );
                    if (textContent !== currentContent) {
                      handleContentChange(textContent);
                    }
                  });
                }}
                placeholder="Start typing..."
                disabled={false}
                availableTags={tags}
                showSubmitButton={false}
              />
              <div className="mt-4 text-sm text-gray-500">
                <p>Press Escape to stop editing</p>
              </div>
            </div>
          ) : (
            /* View mode - Click to edit */
            <div
              onClick={() => setIsEditing(true)}
              className="min-h-[60vh] cursor-text rounded-lg hover:bg-gray-50 transition-colors px-6 py-4"
            >
              {currentContent ? (
                <div className="prose prose-gray max-w-none">
                  {/* Render content as formatted text */}
                  <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                    {currentContent}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  Click to start writing...
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
