"use client";

import { useState } from "react";
import { X, BookOpen, Search } from "lucide-react";
import { useGroupBooks, formatRelativeTime, GroupBook } from "@/hooks/reader/useGroupBooks";

interface BookPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: GroupBook) => void;
}

/**
 * Modal for selecting a book to open in a reader panel
 */
export function BookPickerModal({
  isOpen,
  onClose,
  onSelectBook,
}: BookPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { allBooks, recentlyReadBooks, unreadBooks, isLoading } = useGroupBooks();

  if (!isOpen) return null;

  // Filter books by search query
  const filterBooks = (books: GroupBook[]) => {
    if (!searchQuery.trim()) return books;
    const query = searchQuery.toLowerCase();
    return books.filter((book) =>
      book.title.toLowerCase().includes(query)
    );
  };

  const filteredRecentBooks = filterBooks(recentlyReadBooks);
  const filteredUnreadBooks = filterBooks(unreadBooks);
  const hasResults = filteredRecentBooks.length > 0 || filteredUnreadBooks.length > 0;

  const handleSelectBook = (book: GroupBook) => {
    onSelectBook(book);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-neutral-900 rounded-lg shadow-xl border border-neutral-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-neutral-400" />
            <h2 className="text-lg font-medium text-neutral-100">Open Book</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-neutral-800">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:border-neutral-500"
              autoFocus
            />
          </div>
        </div>

        {/* Book List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-neutral-500">
              Loading books...
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-neutral-500">
              {searchQuery ? "No books match your search" : "No books in this group"}
            </div>
          ) : (
            <div className="py-2">
              {/* Recently Read */}
              {filteredRecentBooks.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-1 text-xs font-medium text-neutral-500 uppercase">
                    Recently Read
                  </div>
                  {filteredRecentBooks.map((book) => (
                    <BookRow
                      key={book.bookContentId}
                      book={book}
                      onClick={() => handleSelectBook(book)}
                    />
                  ))}
                </div>
              )}

              {/* Unread */}
              {filteredUnreadBooks.length > 0 && (
                <div>
                  <div className="px-4 py-1 text-xs font-medium text-neutral-500 uppercase">
                    Not Started
                  </div>
                  {filteredUnreadBooks.map((book) => (
                    <BookRow
                      key={book.bookContentId}
                      book={book}
                      onClick={() => handleSelectBook(book)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface BookRowProps {
  book: GroupBook;
  onClick: () => void;
}

function BookRow({ book, onClick }: BookRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-800 text-left transition-colors"
    >
      <div className="flex-shrink-0 w-8 h-10 bg-neutral-700 rounded flex items-center justify-center">
        <BookOpen size={14} className="text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-100 truncate">
          {book.title}
        </div>
        {book.hasStartedReading && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-neutral-700 rounded-full max-w-[100px]">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${book.progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500">
              {Math.round(book.progressPercent)}%
            </span>
            {book.lastReadAt && (
              <span className="text-xs text-neutral-600">
                {formatRelativeTime(book.lastReadAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
