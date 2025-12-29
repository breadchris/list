"use client";

import { useState, useEffect } from "react";
import { BookText, Plus, Link2, Trash2, ExternalLink, Users, ChevronRight } from "lucide-react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { GlobalGroupSelector } from "@/components/GlobalGroupSelector";
import { useWikiRooms } from "@/hooks/wiki/use-wiki-rooms";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";

// Extract wiki title from content, handling serialized JSON blobs
function getWikiTitle(wiki: Content): string {
  // 1. Prefer metadata.title if set
  if (wiki.metadata?.title) {
    return wiki.metadata.title;
  }

  // 2. Try to extract title from data field
  if (wiki.data) {
    // Check if data is serialized JSON blob (published wiki state)
    if (typeof wiki.data === 'string' && wiki.data.startsWith('{')) {
      try {
        const parsed = JSON.parse(wiki.data);
        if (parsed.title) {
          return parsed.title;
        }
      } catch {
        // Not valid JSON, use as-is
      }
    }
    // Use data as plain string title
    return wiki.data;
  }

  return "Untitled Wiki";
}

// Anonymous group for users without groups
const ANONYMOUS_GROUP_ID = "00000000-0000-0000-0000-000000000001";
const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

export function WikiLanding() {
  const { selectedGroup, groups, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | undefined>();
  const [newWikiName, setNewWikiName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Determine effective group and user for wiki creation
  const effectiveGroupId = selectedGroup?.id || (groups.length === 0 ? ANONYMOUS_GROUP_ID : null);
  const effectiveUserId = userId || ANONYMOUS_USER_ID;

  // Get user ID and username
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
    wikis,
    isLoading: wikisLoading,
    createAndNavigate,
    deleteWiki,
    getWikiUrl,
    navigateToWiki,
    isCreating,
    isDeleting,
  } = useWikiRooms({
    groupId: effectiveGroupId,
    userId: effectiveUserId,
    username,
  });

  const handleCreateWiki = async () => {
    const name = newWikiName.trim() || `Wiki ${new Date().toLocaleDateString()}`;
    await createAndNavigate(name);
    setNewWikiName("");
    setShowCreateInput(false);
  };

  const handleCopyLink = async (wikiId: string) => {
    const url = getWikiUrl(wikiId);
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(wikiId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleDeleteWiki = async (wikiId: string) => {
    if (confirm("Are you sure you want to delete this wiki? All pages will be deleted.")) {
      await deleteWiki(wikiId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isLoading = groupsLoading || wikisLoading;

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Group selector - entire card is clickable */}
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
                  {groupsLoading ? "Loading..." : selectedGroup?.name || "No group selected"}
                </p>
              </button>
            }
          />

          {/* Create wiki section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            {!showCreateInput ? (
              <button
                onClick={() => setShowCreateInput(true)}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Create New Wiki
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newWikiName}
                  onChange={(e) => setNewWikiName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateWiki();
                    if (e.key === "Escape") {
                      setShowCreateInput(false);
                      setNewWikiName("");
                    }
                  }}
                  placeholder="Wiki name (optional)"
                  autoFocus
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateWiki}
                    disabled={isCreating}
                    className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateInput(false);
                      setNewWikiName("");
                    }}
                    className="py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous wikis */}
          <div>
            <h2 className="text-sm font-medium text-neutral-400 mb-3">
              Your Wikis
              {wikis.length > 0 && (
                <span className="ml-2 text-neutral-500">({wikis.length})</span>
              )}
            </h2>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">
                Loading wikis...
              </div>
            ) : wikis.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
                <BookText className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500">
                  No wikis yet. Create one to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {wikis.map((wiki) => (
                  <div
                    key={wiki.id}
                    className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-4 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => navigateToWiki(wiki.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <h3 className="text-neutral-100 font-medium truncate group-hover:text-teal-400 transition-colors">
                          {getWikiTitle(wiki)}
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {formatDate(wiki.created_at)}
                          {wiki.metadata?.created_by_username && (
                            <span className="ml-2">
                              by {wiki.metadata.created_by_username}
                            </span>
                          )}
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(wiki.id)}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Copy link"
                        >
                          {copySuccess === wiki.id ? (
                            <span className="text-xs text-green-400">Copied!</span>
                          ) : (
                            <Link2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => window.open(getWikiUrl(wiki.id), "_blank")}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWiki(wiki.id)}
                          disabled={isDeleting}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Delete wiki"
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
    </div>
  );
}
