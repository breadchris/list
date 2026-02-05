"use client";

import { useConnectionStatus, useHasLocalChanges } from "@y-sweet/react";
import { CloudOff, RefreshCw, Check } from "lucide-react";

export type SyncStatus = "offline" | "syncing" | "synced";

/**
 * Hook to get the current sync status.
 * Must be used within a YDocProvider.
 */
export function useWikiSyncStatus(): SyncStatus {
  const connectionStatus = useConnectionStatus();
  const hasLocalChanges = useHasLocalChanges();

  // Offline or error states
  if (connectionStatus === "offline" || connectionStatus === "error") {
    return "offline";
  }
  // Connecting states
  if (connectionStatus === "connecting" || connectionStatus === "handshaking") {
    return "syncing";
  }
  // Connected but has unsynced changes
  if (connectionStatus === "connected" && hasLocalChanges) {
    return "syncing";
  }
  // Connected and fully synced
  if (connectionStatus === "connected" && !hasLocalChanges) {
    return "synced";
  }
  // Default to offline
  return "offline";
}

interface WikiSyncStatusProps {
  status: SyncStatus;
}

/**
 * Shows the sync status of the wiki document.
 * Receives status as a prop (call useWikiSyncStatus inside YDocProvider).
 */
export function WikiSyncStatus({ status }: WikiSyncStatusProps) {

  const statusConfig = {
    offline: {
      icon: CloudOff,
      text: "Offline",
      iconClassName: "text-yellow-500",
    },
    syncing: {
      icon: RefreshCw,
      text: "Syncing",
      iconClassName: "text-blue-400 animate-spin",
    },
    synced: {
      icon: Check,
      text: "Saved",
      iconClassName: "text-green-500",
    },
  };

  const { icon: Icon, text, iconClassName } = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
      <Icon className={`w-3.5 h-3.5 ${iconClassName}`} />
      <span>{text}</span>
    </div>
  );
}
