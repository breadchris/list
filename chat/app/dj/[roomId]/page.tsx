"use client";

import { use, useState } from "react";
import { DjAppInterface } from "@/components/dj/dj-app-interface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { YDocWrapper } from "@/components/y-doc-wrapper";

export default function DjRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { roomId } = use(params);
  const { mode } = use(searchParams);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  // Create a unique document ID for this DJ room
  const docId = `dj-room-${roomId}`;

  // Validate mode parameter
  const guestMode = mode === 'watch' || mode === 'contribute' ? mode : undefined;

  return (
    <GlobalGroupProvider>
      <AppSettingsProvider>
        <div className="relative h-screen bg-neutral-950">
          {/* Hide app switcher for guests */}
          {!guestMode && (
            <>
              <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
              <AppSwitcherPanel
                isOpen={appSwitcherOpen}
                onClose={() => setAppSwitcherOpen(false)}
                currentApp="dj"
              />
            </>
          )}
          <YDocWrapper docId={docId}>
            <DjAppInterface roomId={roomId} guestMode={guestMode} />
          </YDocWrapper>
        </div>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
