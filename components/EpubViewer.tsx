import React, { useEffect, useState } from 'react';
import { ReactReader } from 'react-reader';
import type { Contents, Rendition } from 'epubjs';
import { useCreateContentMutation } from '../hooks/useContentQueries';
import { useToast } from './ToastProvider';

interface EpubSelection {
  text: string;
  cfiRange: string;
}

interface EpubViewerProps {
  epubUrl: string;
  contentId: string;
  groupId: string;
  onChildContentCreated?: () => void;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({
  epubUrl,
  contentId,
  groupId,
  onChildContentCreated
}) => {
  const [selections, setSelections] = useState<EpubSelection[]>([]);
  const [rendition, setRendition] = useState<Rendition | undefined>(undefined);
  const [location, setLocation] = useState<string | number>(0);
  const [currentSelection, setCurrentSelection] = useState<EpubSelection | null>(null);
  const createContentMutation = useCreateContentMutation();
  const toast = useToast();

  // Handle text selection in epub
  useEffect(() => {
    if (rendition) {
      function setRenderSelection(cfiRange: string, contents: Contents) {
        if (rendition) {
          const selectedText = rendition.getRange(cfiRange).toString();
          setCurrentSelection({
            text: selectedText,
            cfiRange,
          });
        }
      }
      rendition.on('selected', setRenderSelection);
      return () => {
        rendition?.off('selected', setRenderSelection);
      };
    }
  }, [rendition]);

  const handleSaveSelection = () => {
    if (!currentSelection) return;

    // Add to selections list
    setSelections((list) => [...list, currentSelection]);

    // Add highlight annotation to epub
    if (rendition) {
      rendition.annotations.add(
        'highlight',
        currentSelection.cfiRange,
        {},
        undefined,
        'hl',
        { fill: 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
      );
    }

    setCurrentSelection(null);
    toast.success('Selection saved', 'Text highlighted in epub');
  };

  const handleCreateChildContent = async (selection: EpubSelection) => {
    try {
      await createContentMutation.mutateAsync({
        type: 'text',
        data: selection.text,
        group_id: groupId,
        parent_content_id: contentId,
        metadata: {
          cfiRange: selection.cfiRange,
          source: 'epub-selection'
        }
      });

      toast.success('Child Content Created', 'Selection saved as child content');

      if (onChildContentCreated) {
        onChildContentCreated();
      }
    } catch (error) {
      console.error('Error creating child content:', error);
      toast.error('Failed to create content', 'Please try again');
    }
  };

  const handleRemoveSelection = (index: number) => {
    const selection = selections[index];

    // Remove highlight from epub
    if (rendition) {
      rendition.annotations.remove(selection.cfiRange, 'highlight');
    }

    // Remove from list
    setSelections(selections.filter((_, i) => i !== index));
    toast.success('Selection removed', 'Highlight removed from epub');
  };

  const handleNavigateToSelection = (cfiRange: string) => {
    if (rendition) {
      rendition.display(cfiRange);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Current Selection Panel */}
      {currentSelection && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-900 line-clamp-2">
                "{currentSelection.text}"
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSelection}
                className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
              >
                Save Selection
              </button>
              <button
                onClick={() => setCurrentSelection(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selections Panel */}
      {selections.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Saved Selections ({selections.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selections.map((selection, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <p className="text-xs text-gray-700 line-clamp-2 mb-2">
                  "{selection.text}"
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateChildContent(selection)}
                    disabled={createContentMutation.isPending}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50"
                  >
                    Create Child Content
                  </button>
                  <button
                    onClick={() => handleNavigateToSelection(selection.cfiRange)}
                    className="px-2 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 rounded border border-gray-300 transition-colors"
                  >
                    Go to
                  </button>
                  <button
                    onClick={() => handleRemoveSelection(index)}
                    className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Epub Reader */}
      <div className="flex-1 relative">
        <ReactReader
          url={epubUrl}
          epubInitOptions={{ openAs: 'epub' }}
          location={location}
          locationChanged={(epubcfi: string) => setLocation(epubcfi)}
          getRendition={(_rendition: Rendition) => {
            setRendition(_rendition);
          }}
        />
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-3">
        <p className="text-xs text-blue-800">
          💡 <strong>Tip:</strong> Select text in the epub to highlight it, then create child content from your selections
        </p>
      </div>
    </div>
  );
};
