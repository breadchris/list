"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";
import type { ElectricSyncStatus } from "@/types/notes";

interface NoteSyncStatusProps {
  status: ElectricSyncStatus;
}

export function NoteSyncStatus({ status }: NoteSyncStatusProps) {
  const statusConfig = {
    connecting: {
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      text: "Connecting",
      color: "text-yellow-500",
    },
    synced: {
      icon: <Cloud className="w-4 h-4" />,
      text: "Synced",
      color: "text-green-500",
    },
    offline: {
      icon: <CloudOff className="w-4 h-4" />,
      text: "Offline",
      color: "text-neutral-500",
    },
    error: {
      icon: <CloudOff className="w-4 h-4" />,
      text: "Error",
      color: "text-red-500",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${config.color}`}
      title={config.text}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
}
