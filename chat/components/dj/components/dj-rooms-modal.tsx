"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Link2, ExternalLink, Trash2, Plus, ListVideo } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublishGroupOptional } from "@/components/PublishGroupContext";
import { PublishGroupSelector } from "@/components/PublishGroupSelector";
import { useDjRooms } from "../hooks/use-dj-rooms";
import { supabase } from "@/lib/list/SupabaseClient";

interface DjRoomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRoomId?: string;
}

export function DjRoomsModal({
  open,
  onOpenChange,
  currentRoomId,
}: DjRoomsModalProps) {
  const router = useRouter();
  const publishGroup = usePublishGroupOptional();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | undefined>();
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

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
    isLoading,
    createRoom,
    deleteRoom,
    getRoomUrl,
    isCreating,
    isDeleting,
  } = useDjRooms({
    groupId: publishGroup?.selectedGroup?.id || null,
    userId,
    username,
  });

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

  const handleNavigateToRoom = (roomId: string) => {
    router.push(`/dj/${roomId}`);
    onOpenChange(false);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      await deleteRoom(roomId);
    }
  };

  const handleCreateRoom = async () => {
    const name =
      newRoomName.trim() || `Room ${new Date().toLocaleDateString()}`;
    const room = await createRoom(name);
    if (room) {
      setNewRoomName("");
      setShowCreateInput(false);
      router.push(`/dj/${room.id}`);
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-neutral-800 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-neutral-100 flex items-center gap-2">
            <ListVideo className="w-5 h-5 text-violet-400" />
            DJ Rooms
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* Group selector */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-neutral-400">Group</span>
            <PublishGroupSelector />
          </div>

          {/* Create room */}
          <div className="px-1">
            {!showCreateInput ? (
              <button
                onClick={() => setShowCreateInput(true)}
                disabled={!publishGroup?.selectedGroup || isCreating}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create New Room
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateRoom();
                    if (e.key === "Escape") {
                      setShowCreateInput(false);
                      setNewRoomName("");
                    }
                  }}
                  placeholder="Room name (optional)"
                  autoFocus
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateInput(false);
                      setNewRoomName("");
                    }}
                    className="py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rooms list */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider px-1">
              Previous Rooms
              {rooms.length > 0 && (
                <span className="ml-1 text-neutral-600">({rooms.length})</span>
              )}
            </h3>

            {isLoading ? (
              <div className="text-center py-6 text-neutral-500 text-sm">
                Loading rooms...
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-sm">
                {publishGroup?.selectedGroup
                  ? "No rooms yet"
                  : "Select a group to see rooms"}
              </div>
            ) : (
              <div className="space-y-1">
                {rooms.map((room) => {
                  const isCurrent = room.id === currentRoomId;
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        isCurrent
                          ? "bg-violet-600/20 border border-violet-500/30"
                          : "bg-neutral-800/50 hover:bg-neutral-800"
                      }`}
                    >
                      <button
                        onClick={() => handleNavigateToRoom(room.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div
                          className={`text-sm font-medium truncate ${
                            isCurrent ? "text-violet-300" : "text-neutral-200"
                          }`}
                        >
                          {room.data || "Untitled Room"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(room.created_at)}
                          {room.metadata?.created_by_username && (
                            <span className="ml-1">
                              by {room.metadata.created_by_username}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(room.id)}
                          className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 rounded transition-colors"
                          title="Copy link"
                        >
                          {copySuccess === room.id ? (
                            <span className="text-xs text-green-400">✓</span>
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            window.open(getRoomUrl(room.id), "_blank")
                          }
                          className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          disabled={isDeleting}
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-700 rounded transition-colors"
                          title="Delete room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
