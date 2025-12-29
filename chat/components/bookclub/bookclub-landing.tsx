"use client";

import { useState, useEffect } from "react";
import {
  UsersRound,
  Plus,
  Link2,
  Trash2,
  ExternalLink,
  Users,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { GlobalGroupSelector } from "@/components/GlobalGroupSelector";
import { useBookClubRooms } from "@/hooks/bookclub/use-bookclub-rooms";
import { BookSelectorModal } from "./components/book-selector-modal";
import { supabase } from "@/lib/list/SupabaseClient";

// Anonymous group for users without groups
const ANONYMOUS_GROUP_ID = "00000000-0000-0000-0000-000000000001";

export function BookClubLanding() {
  const { selectedGroup, groups, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | undefined>();
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Determine effective group for room creation
  const effectiveGroupId =
    selectedGroup?.id || (groups.length === 0 ? ANONYMOUS_GROUP_ID : null);

  // Get user ID and username
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();

    const storedUsername = localStorage.getItem("chat-username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const {
    rooms,
    isLoading: roomsLoading,
    createAndNavigate,
    deleteRoom,
    getRoomUrl,
    navigateToRoom,
    isCreating,
    isDeleting,
  } = useBookClubRooms({
    groupId: effectiveGroupId,
    userId,
    username,
  });

  const handleCreateClub = async (bookContentId: string, bookTitle: string) => {
    const name = `${bookTitle} Club`;
    await createAndNavigate(name, bookContentId);
    setShowBookSelector(false);
  };

  const handleCopyLink = async (clubId: string) => {
    const url = getRoomUrl(clubId);
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(clubId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleDeleteClub = async (clubId: string) => {
    if (confirm("Are you sure you want to delete this book club?")) {
      await deleteRoom(clubId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isLoading = groupsLoading || roomsLoading;

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Group selector */}
          <GlobalGroupSelector
            trigger={
              <button className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Current Group</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500" />
                </div>
                <p className="mt-2 text-neutral-300 font-medium">
                  {groupsLoading
                    ? "Loading..."
                    : selectedGroup?.name || "No group selected"}
                </p>
              </button>
            }
          />

          {/* Create club section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <button
              onClick={() => setShowBookSelector(true)}
              disabled={isCreating || !effectiveGroupId}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Book Club
            </button>
          </div>

          {/* Book clubs list */}
          <div>
            <h2 className="text-sm font-medium text-neutral-400 mb-3">
              Book Clubs
              {rooms.length > 0 && (
                <span className="ml-2 text-neutral-500">({rooms.length})</span>
              )}
            </h2>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">
                Loading book clubs...
              </div>
            ) : rooms.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
                <UsersRound className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500">
                  No book clubs yet. Create one to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((club) => (
                  <div
                    key={club.id}
                    className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-4 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => navigateToRoom(club.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <h3 className="text-neutral-100 font-medium truncate group-hover:text-orange-400 transition-colors">
                          {club.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="text-sm text-neutral-400 truncate">
                            {club.book_title}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-1">
                          {formatDate(club.created_at)}
                          {club.created_by_username && (
                            <span className="ml-2">
                              by {club.created_by_username}
                            </span>
                          )}
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(club.id)}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Copy link"
                        >
                          {copySuccess === club.id ? (
                            <span className="text-xs text-green-400">
                              Copied!
                            </span>
                          ) : (
                            <Link2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            window.open(getRoomUrl(club.id), "_blank")
                          }
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClub(club.id)}
                          disabled={isDeleting}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Delete club"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Book selector modal */}
      <BookSelectorModal
        isOpen={showBookSelector}
        onClose={() => setShowBookSelector(false)}
        onSelect={handleCreateClub}
        isCreating={isCreating}
      />
    </div>
  );
}
