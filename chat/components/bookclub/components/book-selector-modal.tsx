"use client";

import { useState } from "react";
import { X, BookOpen, Loader2, Library } from "lucide-react";
import { useGroupBooks, type GroupBook } from "@/hooks/reader/useGroupBooks";

interface BookSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (bookContentId: string, bookTitle: string) => void;
  isCreating: boolean;
}

export function BookSelectorModal({
  isOpen,
  onClose,
  onSelect,
  isCreating,
}: BookSelectorModalProps) {
  const { allBooks, isLoading, selectedGroup } = useGroupBooks();
  const [selectedBook, setSelectedBook] = useState<GroupBook | null>(null);

  if (!isOpen) return null;

  const handleSelect = () => {
    if (selectedBook) {
      onSelect(selectedBook.bookContentId, selectedBook.title);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-medium text-neutral-100">
            Select a Book
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
            </div>
          ) : allBooks.length === 0 ? (
            <div className="text-center py-8">
              <Library className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500">
                No books in {selectedGroup?.name || "this group"} yet
              </p>
              <p className="text-sm text-neutral-600 mt-1">
                Upload an EPUB in the Reader app first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allBooks.map((book) => (
                <button
                  key={book.bookContentId}
                  onClick={() => setSelectedBook(book)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedBook?.bookContentId === book.bookContentId
                      ? "bg-orange-500/20 border border-orange-500/50"
                      : "bg-neutral-800/50 hover:bg-neutral-800 border border-transparent"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedBook?.bookContentId === book.bookContentId
                        ? "bg-orange-500/30"
                        : "bg-neutral-700/50"
                    }`}
                  >
                    <BookOpen
                      className={`w-5 h-5 ${
                        selectedBook?.bookContentId === book.bookContentId
                          ? "text-orange-400"
                          : "text-neutral-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium truncate ${
                        selectedBook?.bookContentId === book.bookContentId
                          ? "text-orange-200"
                          : "text-neutral-200"
                      }`}
                    >
                      {book.title}
                    </div>
                    {book.hasStartedReading && (
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {Math.round(book.progressPercent * 100)}% read
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedBook || isCreating}
            className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
          >
            {isCreating ? "Creating..." : "Create Club"}
          </button>
        </div>
      </div>
    </div>
  );
}
