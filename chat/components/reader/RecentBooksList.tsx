"use client";

import { BookOpen, Loader2 } from "lucide-react";
import {
  useRecentBooks,
  formatRelativeTime,
  type RecentBook,
} from "@/hooks/reader/useRecentBooks";

interface RecentBooksListProps {
  onSelectBook: (book: RecentBook) => void;
  variant?: "sidebar" | "landing";
}

export function RecentBooksList({
  onSelectBook,
  variant = "sidebar",
}: RecentBooksListProps) {
  const { recentBooks, isLoading } = useRecentBooks();

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${variant === "landing" ? "py-8" : "py-4"}`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (recentBooks.length === 0) {
    return null;
  }

  if (variant === "landing") {
    return (
      <div className="w-full max-w-md">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">
          Continue Reading
        </h3>
        <div className="space-y-2">
          {recentBooks.map((book) => (
            <button
              key={book.bookContentId}
              onClick={() => onSelectBook(book)}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 rounded-lg transition-colors text-left group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-200 font-medium truncate group-hover:text-white">
                  {book.title}
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>{Math.round(book.progressPercent * 100)}%</span>
                  <span className="text-neutral-600">•</span>
                  <span>{formatRelativeTime(book.lastReadAt)}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-12 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.round(book.progressPercent * 100)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Sidebar variant - more compact
  return (
    <div className="px-4 py-3 border-t border-neutral-800">
      <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        Recent Books
      </h4>
      <div className="space-y-1">
        {recentBooks.slice(0, 5).map((book) => (
          <button
            key={book.bookContentId}
            onClick={() => onSelectBook(book)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-800 rounded transition-colors text-left group"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-300 truncate group-hover:text-white">
                {book.title}
              </div>
            </div>
            <span className="text-[10px] text-neutral-600">
              {Math.round(book.progressPercent * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
