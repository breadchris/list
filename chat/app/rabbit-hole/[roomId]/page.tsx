"use client";

import { use, useState, useEffect } from "react";
import { RabbitHoleInterface } from "@/components/rabbit-hole/RabbitHoleInterface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { contentRepository } from "@/lib/list/ContentRepository";

export default function RabbitHoleRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the room to get its group_id
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const room = await contentRepository.getContentById(roomId);
        if (room) {
          setGroupId(room.group_id);
        } else {
          setError("Exploration not found");
        }
      } catch (err) {
        console.error("Failed to fetch exploration:", err);
        setError("Failed to load exploration");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading exploration...</div>
      </div>
    );
  }

  if (error || !groupId) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-red-400">{error || "Exploration not found"}</div>
      </div>
    );
  }

  return (
    <GlobalGroupProvider>
      <AppSettingsProvider onCloseAppSwitcher={() => setAppSwitcherOpen(false)}>
        <div className="relative h-screen bg-background">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp="rabbit-hole"
          />
          <RabbitHoleInterface roomId={roomId} />
        </div>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
