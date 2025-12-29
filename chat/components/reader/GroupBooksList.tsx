"use client";

import Link from "next/link";
import { BookOpen, Loader2, Library, UsersRound } from "lucide-react";
import {
  useGroupBooks,
  formatRelativeTime,
  type GroupBook,
} from "@/hooks/reader/useGroupBooks";

interface GroupBooksListProps {
  onSelectBook: (book: GroupBook) => void;
  variant?: "sidebar" | "landing";
}

// Link to the Book Club app
function BookClubLink({ variant }: { variant: "sidebar" | "landing" }) {
  if (variant === "landing") {
    return (
      <div className="mb-6">
        <Link
          href="/bookclub"
          className="flex items-center gap-3 p-4 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded-lg transition-colors group"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <UsersRound className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-neutral-100 font-medium group-hover:text-white">
              Book Clubs
            </div>
            <div className="text-xs text-neutral-500">
              Read together with friends
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Sidebar variant
  return (
    <div className="px-4 py-3 border-b border-neutral-800">
      <Link
        href="/bookclub"
        className="flex items-center gap-2 p-2 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded transition-colors group"
      >
        <UsersRound className="w-4 h-4 text-orange-400 flex-shrink-0" />
        <span className="text-xs text-neutral-200 group-hover:text-white">
          Book Clubs
        </span>
      </Link>
    </div>
  );
}

export function GroupBooksList({
  onSelectBook,
  variant = "sidebar",
}: GroupBooksListProps) {
  const { recentlyReadBooks, unreadBooks, isLoading, selectedGroup } = useGroupBooks();

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${variant === "landing" ? "py-8" : "py-4"}`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
      </div>
    );
  }

  const hasBooks = recentlyReadBooks.length > 0 || unreadBooks.length > 0;

  if (!hasBooks) {
    if (variant === "landing") {
      return (
        <div className="text-center py-6">
          <Library className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">
            No books in {selectedGroup?.name || "this group"} yet
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            Upload an EPUB to get started
          </p>
        </div>
      );
    }
    return null;
  }

  if (variant === "landing") {
    return (
      <div className="w-full max-w-md space-y-6">
        {/* Book Club link */}
        <BookClubLink variant="landing" />

        {/* Continue Reading section */}
        {recentlyReadBooks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-400 mb-3">
              Continue Reading
            </h3>
            <div className="space-y-2">
              {recentlyReadBooks.map((book) => (
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
        )}

        {/* Library section - unread books */}
        {unreadBooks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-400 mb-3">
              Library
            </h3>
            <div className="space-y-2">
              {unreadBooks.map((book) => (
                <button
                  key={book.bookContentId}
                  onClick={() => onSelectBook(book)}
                  className="w-full flex items-center gap-3 p-3 bg-neutral-800/30 hover:bg-neutral-800 border border-neutral-700/30 rounded-lg transition-colors text-left group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-neutral-700/50 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-300 font-medium truncate group-hover:text-white">
                      {book.title}
                    </div>
                    <div className="text-xs text-neutral-600">
                      Not started
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sidebar variant - more compact
  return (
    <div>
      {/* Book Club link */}
      <BookClubLink variant="sidebar" />

      <div className="px-4 py-3 border-t border-neutral-800">
        {recentlyReadBooks.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Continue Reading
          </h4>
          <div className="space-y-1 mb-3">
            {recentlyReadBooks.slice(0, 3).map((book) => (
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
        </>
      )}

      {unreadBooks.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Library
          </h4>
          <div className="space-y-1">
            {unreadBooks.slice(0, 5).map((book) => (
              <button
                key={book.bookContentId}
                onClick={() => onSelectBook(book)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-800 rounded transition-colors text-left group"
              >
                <BookOpen className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-neutral-400 truncate group-hover:text-white">
                    {book.title}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
