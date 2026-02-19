"use client";

import { use } from "react";
import { DjAppInterface } from "@/components/dj/dj-app-interface";
import { AppShell } from "@/components/app-shell";
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

  // Create a unique document ID for this DJ room
  const docId = `dj-room-${roomId}`;

  // Validate mode parameter
  const guestMode = mode === 'watch' || mode === 'contribute' ? mode : undefined;

  return (
    <GlobalGroupProvider>
      <AppSettingsProvider>
        <AppShell currentApp="dj" hideShell={!!guestMode}>
          <YDocWrapper docId={docId}>
            <DjAppInterface roomId={roomId} guestMode={guestMode} />
          </YDocWrapper>
        </AppShell>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
