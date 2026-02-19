"use client";

import { useState } from "react";
import { X, BookOpen, Search } from "lucide-react";
import { useGroupBooks, formatRelativeTime, GroupBook } from "@/hooks/reader/useGroupBooks";

interface BookPickerSidebarProps {
  onClose: () => void;
  onSelectBook: (book: GroupBook) => void;
}

/**
 * Sidebar for selecting a book to open in a reader panel
 */
export function BookPickerSidebar({
  onClose,
  onSelectBook,
}: BookPickerSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { allBooks, recentlyReadBooks, unreadBooks, isLoading } = useGroupBooks();

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
  };

  return (
    <div className="w-64 h-full flex flex-col bg-neutral-900 border-r border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-neutral-200 font-medium">Books</h2>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Book List */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">
            Loading books...
          </div>
        ) : !hasResults ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">
            {searchQuery ? "No books match your search" : "No books in this group"}
          </div>
        ) : (
          <>
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
          </>
        )}
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
      className="w-full px-3 py-2 mx-2 flex items-center gap-2 rounded hover:bg-neutral-800 text-left transition-colors"
      style={{ width: "calc(100% - 16px)" }}
    >
      <div className="flex-shrink-0 w-6 h-8 bg-neutral-700 rounded flex items-center justify-center">
        <BookOpen size={12} className="text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-300 truncate">
          {book.title}
        </div>
        {book.hasStartedReading && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-neutral-700 rounded-full max-w-[80px]">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${book.progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500">
              {Math.round(book.progressPercent)}%
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
