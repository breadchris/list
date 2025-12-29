"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Users,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { useBookClubDetail } from "@/hooks/bookclub/use-bookclub-detail";
import { MemberHighlights } from "./components/member-highlights";
import { supabase } from "@/lib/list/SupabaseClient";

interface BookClubDetailProps {
  clubId: string;
}

// Progress bar component for member progress
function MemberProgressBar({
  displayName,
  email,
  progressPercent,
  isCurrentUser,
}: {
  displayName?: string;
  email: string;
  progressPercent: number;
  isCurrentUser: boolean;
}) {
  // Get display name - use first part of email if no display name
  const name = displayName || email.split("@")[0] || "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const progress = Math.round(progressPercent * 100);

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Avatar/Initial */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isCurrentUser
            ? "bg-orange-500/20 text-orange-400"
            : "bg-neutral-700 text-neutral-400"
        }`}
      >
        {initial}
      </div>
      {/* Name and progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-sm truncate ${
              isCurrentUser ? "text-neutral-200 font-medium" : "text-neutral-400"
            }`}
          >
            {isCurrentUser ? "You" : name}
          </span>
          <span className="text-xs text-neutral-500 ml-2">{progress}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCurrentUser ? "bg-orange-500" : "bg-neutral-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function BookClubDetail({ clubId }: BookClubDetailProps) {
  const router = useRouter();
  const { club, members, isLoading, isLoadingMembers, error } =
    useBookClubDetail(clubId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Sort members: current user first, then by progress descending
  const sortedMembers = [...members].sort((a, b) => {
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    return b.progress_percent - a.progress_percent;
  });

  const handleReadBook = () => {
    if (club?.book_content_id) {
      router.push(`/reader?book=${club.book_content_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-neutral-950 p-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-medium text-neutral-200 mb-2">
          Book Club Not Found
        </h2>
        <p className="text-neutral-500 text-center mb-4">
          This book club may have been deleted or you don't have access.
        </p>
        <button
          onClick={() => router.push("/bookclub")}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Book Clubs
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-neutral-800">
        <button
          onClick={() => router.push("/bookclub")}
          className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium text-neutral-100 truncate">
            {club.name}
          </h1>
          <p className="text-sm text-neutral-500">
            {sortedMembers.length} member{sortedMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Book info card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-medium text-neutral-100 mb-1">
                  {club.book_title}
                </h2>
                <p className="text-sm text-neutral-500 mb-4">
                  Created{" "}
                  {new Date(club.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {club.created_by_username && ` by ${club.created_by_username}`}
                </p>
                <button
                  onClick={handleReadBook}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Read in Reader
                </button>
              </div>
            </div>
          </div>

          {/* Member progress section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="flex items-center gap-2 p-4 border-b border-neutral-800">
              <Users className="w-4 h-4 text-neutral-400" />
              <h3 className="text-sm font-medium text-neutral-300">
                Reading Progress
              </h3>
            </div>
            <div className="p-4">
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                </div>
              ) : sortedMembers.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No one has started reading yet
                </p>
              ) : (
                <div className="space-y-1">
                  {sortedMembers.map((member) => (
                    <MemberProgressBar
                      key={member.user_id}
                      displayName={member.display_name}
                      email={member.email}
                      progressPercent={member.progress_percent}
                      isCurrentUser={member.user_id === currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Member highlights section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400">Highlights</h3>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
              </div>
            ) : sortedMembers.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-sm text-neutral-500 text-center">
                  No highlights yet
                </p>
              </div>
            ) : (
              sortedMembers
                .filter((member) => member.highlights.length > 0)
                .map((member) => {
                  const isCurrentUser = member.user_id === currentUserId;
                  const displayName =
                    member.display_name ||
                    member.email.split("@")[0] ||
                    "Unknown";
                  return (
                    <MemberHighlights
                      key={member.user_id}
                      memberName={displayName}
                      highlights={member.highlights}
                      isCurrentUser={isCurrentUser}
                      defaultExpanded={isCurrentUser}
                    />
                  );
                })
            )}
            {sortedMembers.every((m) => m.highlights.length === 0) &&
              sortedMembers.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <p className="text-sm text-neutral-500 text-center">
                    No highlights yet. Start reading and highlight passages to
                    share with the club!
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
