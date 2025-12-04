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
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t-2 border-[#9a8a6a] bg-[#F5EFE3] p-3 sm:p-4">
      {isEditing && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-[#F4D03F]/30 border border-[#9a8a6a]/30 rounded">
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
          className="flex-1 bg-background border border-[#9a8a6a] px-3 py-2 sm:px-4 sm:py-3 focus:outline-none focus:border-[#F4D03F] text-sm sm:text-base"
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="bg-[#E67E50] hover:bg-[#d06e40] border border-[#9a8a6a] px-4 py-2 sm:px-6 sm:py-3 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}