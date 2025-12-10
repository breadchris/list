"use client";

import { useEffect, useState } from "react";
import { ListVideo, FolderOpen } from "lucide-react";
import { useSetAppSettings } from "@/components/AppSettingsContext";
import { usePublishGroupOptional } from "@/components/PublishGroupContext";
import { DjRoomsModal } from "./dj-rooms-modal";

interface DjSettingsPanelProps {
  roomId: string;
  roomName: string;
}

export function DjSettingsPanel({ roomId, roomName }: DjSettingsPanelProps) {
  const setAppSettings = useSetAppSettings();
  const publishGroup = usePublishGroupOptional();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setAppSettings(
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ListVideo className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-neutral-300 truncate">{roomName}</span>
        </div>
        {publishGroup?.selectedGroup && (
          <div className="text-xs text-neutral-500">
            in {publishGroup.selectedGroup.name}
          </div>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Browse Rooms</span>
        </button>
      </div>
    );

    return () => {
      setAppSettings(null);
    };
  }, [setAppSettings, roomName, publishGroup?.selectedGroup]);

  return (
    <DjRoomsModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      currentRoomId={roomId}
    />
  );
}
