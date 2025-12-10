"use client";

import { use, useState } from "react";
import { DjAppInterface } from "@/components/dj/dj-app-interface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { PublishGroupProvider } from "@/components/PublishGroupContext";
import { YDocWrapper } from "@/components/y-doc-wrapper";

export default function DjRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  // Create a unique document ID for this DJ room
  const docId = `dj-room-${roomId}`;

  return (
    <PublishGroupProvider>
      <AppSettingsProvider>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp="dj"
          />
          <YDocWrapper docId={docId}>
            <DjAppInterface roomId={roomId} />
          </YDocWrapper>
        </div>
      </AppSettingsProvider>
    </PublishGroupProvider>
  );
}
