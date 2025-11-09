import { X, Highlighter } from 'lucide-react';

export interface Highlight {
  id: string;
  text: string;
  messageId: string;
  messageSender: 'user' | 'assistant';
  timestamp: string;
}

interface HighlightsSidebarProps {
  highlights: Highlight[];
  onRemoveHighlight: (highlightId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export function HighlightsSidebar({ highlights, onRemoveHighlight, onJumpToMessage }: HighlightsSidebarProps) {
  return (
    <div className="w-80 h-full bg-[#F5EFE3] border-l-2 border-[#9a8a6a] flex flex-col">
      {/* Header */}
      <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-4 flex items-center gap-3">
        <Highlighter className="w-5 h-5" />
        <h2 className="text-sm">Highlights</h2>
        <span className="ml-auto text-xs opacity-60">{highlights.length}</span>
      </div>

      {/* Highlights List */}
      <div className="flex-1 overflow-y-auto p-4">
        {highlights.length === 0 ? (
          <div className="text-center py-8 opacity-60 text-sm">
            <Highlighter className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No highlights yet</p>
            <p className="text-xs mt-1">Select text in messages to highlight</p>
          </div>
        ) : (
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="bg-[#E8DCC8] border-2 border-[#9a8a6a] p-3 relative group"
              >
                {/* Remove button */}
                <button
                  onClick={() => onRemoveHighlight(highlight.id)}
                  className="absolute top-2 right-2 p-1 bg-[#E67E50] border border-[#9a8a6a] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#d66e40]"
                  title="Remove highlight"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Highlight content */}
                <div className="pr-8">
                  <div className="text-sm mb-2 bg-[#F4D03F] px-2 py-1 border border-[#9a8a6a] inline-block">
                    "{highlight.text}"
                  </div>
                  
                  <div className="text-xs opacity-60 mt-2 flex items-center gap-2">
                    <span className="capitalize">{highlight.messageSender}</span>
                    <span>•</span>
                    <span>{highlight.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-[#9a8a6a] p-3 bg-[#E8DCC8]">
        <div className="text-xs opacity-60">
          Select text in any message and click "Highlight" to save it here
        </div>
      </div>
    </div>
  );
}
