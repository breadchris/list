"use client";

import { useEffect, useState, useCallback } from "react";
import { ListVideo, FolderOpen, Share2, Copy, Check, Eye, Users } from "lucide-react";
import { useSetAppSettings } from "@/components/AppSettingsContext";
import { useGlobalGroupOptional } from "@/components/GlobalGroupContext";
import { DjRoomsModal } from "./dj-rooms-modal";

interface DjSettingsPanelProps {
  roomId: string;
  roomName: string;
}

function ShareLinkButton({
  label,
  url,
  icon: Icon
}: {
  label: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [url]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {copied ? (
        <Check className="w-4 h-4 text-green-400 shrink-0" />
      ) : (
        <Copy className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
}

export function DjSettingsPanel({ roomId, roomName }: DjSettingsPanelProps) {
  const setAppSettings = useSetAppSettings();
  const publishGroup = useGlobalGroupOptional();
  const [modalOpen, setModalOpen] = useState(false);

  // Generate share URLs
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const watchUrl = `${baseUrl}/dj/${roomId}?mode=watch`;
  const contributeUrl = `${baseUrl}/dj/${roomId}?mode=contribute`;

  useEffect(() => {
    setAppSettings(
      <div className="px-4 py-3 space-y-4">
        {/* Room info */}
        <div>
          <div className="flex items-center gap-2">
            <ListVideo className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-neutral-300 truncate">{roomName}</span>
          </div>
          {publishGroup?.selectedGroup && (
            <div className="text-xs text-neutral-500 mt-1">
              in {publishGroup.selectedGroup.name}
            </div>
          )}
        </div>

        {/* Browse rooms button */}
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Browse Rooms</span>
        </button>

        {/* Share links section */}
        <div className="pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-4 h-4 text-neutral-500" />
            <span className="text-xs text-neutral-500">Share Links</span>
          </div>
          <div className="space-y-2">
            <ShareLinkButton
              label="Watch only"
              url={watchUrl}
              icon={Eye}
            />
            <ShareLinkButton
              label="Can add videos"
              url={contributeUrl}
              icon={Users}
            />
          </div>
        </div>
      </div>
    );

    return () => {
      setAppSettings(null);
    };
  }, [setAppSettings, roomName, publishGroup?.selectedGroup, watchUrl, contributeUrl]);

  return (
    <DjRoomsModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      currentRoomId={roomId}
    />
  );
}
