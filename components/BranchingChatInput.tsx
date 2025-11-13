import { useState, KeyboardEvent, useEffect } from 'react';
import { Send, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  initialValue?: string;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export function BranchingChatInput({ onSend, initialValue = '', isEditing = false, onCancelEdit }: ChatInputProps) {
  const [input, setInput] = useState(initialValue);

  useEffect(() => {
    setInput(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input);
        setInput('');
      }
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
      {isEditing && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
          <span style={{ fontSize: '0.85rem' }} className="opacity-70">
            Editing message...
          </span>
          {onCancelEdit && (
            <button
              onClick={onCancelEdit}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white border border-gray-300 px-3 py-2 sm:px-4 sm:py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 border border-gray-300 px-4 py-2 sm:px-6 sm:py-3 transition-colors flex items-center gap-2 text-white"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}