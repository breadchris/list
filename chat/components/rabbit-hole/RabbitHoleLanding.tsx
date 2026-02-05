"use client";

import { useState, useEffect } from "react";
import { Compass, Plus, Link2, Trash2, ExternalLink, Users, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { GlobalGroupSelector } from "@/components/GlobalGroupSelector";
import {
  useRabbitHoleRoomsQuery,
  useCreateRabbitHoleRoomMutation,
  useDeleteRabbitHoleRoomMutation,
} from "@/hooks/rabbit-hole/use-rabbit-hole-rooms";
import { supabase } from "@/lib/list/SupabaseClient";
import type { RabbitHoleRoom } from "@/types/rabbit-hole";

// Anonymous group for users without groups
const ANONYMOUS_GROUP_ID = "00000000-0000-0000-0000-000000000001";
const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

export function RabbitHoleLanding() {
  const router = useRouter();
  const { selectedGroup, groups, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | undefined>();
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Determine effective group and user for room creation
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

  const { data: rooms = [], isLoading: roomsLoading } = useRabbitHoleRoomsQuery(effectiveGroupId);
  const createRoomMutation = useCreateRabbitHoleRoomMutation();
  const deleteRoomMutation = useDeleteRabbitHoleRoomMutation();

  const isCreating = createRoomMutation.isPending;
  const isDeleting = deleteRoomMutation.isPending;

  const getRoomUrl = (roomId: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/rabbit-hole/pub/${roomId}`;
    }
    return `/rabbit-hole/pub/${roomId}`;
  };

  const navigateToRoom = (roomId: string) => {
    router.push(`/rabbit-hole/${roomId}`);
  };

  const handleCreateRoom = async () => {
    if (!effectiveGroupId) return;

    const title = newRoomTitle.trim() || `Exploration ${new Date().toLocaleDateString()}`;
    const result = await createRoomMutation.mutateAsync({
      title,
      group_id: effectiveGroupId,
      user_id: effectiveUserId,
      username,
    });
    setNewRoomTitle("");
    setShowCreateInput(false);
    if (result) {
      navigateToRoom(result.id);
    }
  };

  const handleCopyLink = async (roomId: string) => {
    const url = getRoomUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(roomId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleDeleteRoom = async (roomId: string, groupId: string) => {
    if (confirm("Are you sure you want to delete this exploration? All pages will be deleted.")) {
      await deleteRoomMutation.mutateAsync({ roomId, groupId });
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

  const getPageCount = (room: RabbitHoleRoom): number => {
    return Object.keys(room.metadata?.pages || {}).length;
  };

  const isLoading = groupsLoading || roomsLoading;

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

          {/* Create room section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            {!showCreateInput ? (
              <button
                onClick={() => setShowCreateInput(true)}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Start New Exploration
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateRoom();
                    if (e.key === "Escape") {
                      setShowCreateInput(false);
                      setNewRoomTitle("");
                    }
                  }}
                  placeholder="Exploration title (optional)"
                  autoFocus
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors font-medium"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateInput(false);
                      setNewRoomTitle("");
                    }}
                    className="py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous explorations */}
          <div>
            <h2 className="text-sm font-medium text-neutral-400 mb-3">
              Your Explorations
              {rooms.length > 0 && (
                <span className="ml-2 text-neutral-500">({rooms.length})</span>
              )}
            </h2>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">
                Loading explorations...
              </div>
            ) : rooms.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center">
                <Compass className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500">
                  No explorations yet. Start one to go down the rabbit hole!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-4 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => navigateToRoom(room.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <h3 className="text-neutral-100 font-medium truncate group-hover:text-purple-400 transition-colors">
                          {room.metadata?.title || room.data || "Untitled Exploration"}
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {formatDate(room.created_at)}
                          {room.metadata?.created_by_username && (
                            <span className="ml-2">
                              by {room.metadata.created_by_username}
                            </span>
                          )}
                          <span className="ml-2">
                            {getPageCount(room)} page{getPageCount(room) !== 1 ? "s" : ""}
                          </span>
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(room.id)}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Copy link"
                        >
                          {copySuccess === room.id ? (
                            <span className="text-xs text-green-400">Copied!</span>
                          ) : (
                            <Link2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => window.open(getRoomUrl(room.id), "_blank")}
                          className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id, room.group_id)}
                          disabled={isDeleting}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Delete exploration"
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
