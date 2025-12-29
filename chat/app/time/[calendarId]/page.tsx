"use client";

import { use, useState } from "react";
import { TimeAppInterface } from "@/components/time/time-app-interface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { YDocWrapper } from "@/components/y-doc-wrapper";

export default function TimeCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ calendarId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { calendarId } = use(params);
  const { mode } = use(searchParams);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  // Create a unique document ID for this calendar
  const docId = `time-calendar-${calendarId}`;

  // Validate mode parameter
  const guestMode =
    mode === "view" || mode === "contribute" ? mode : undefined;

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
                currentApp="time"
              />
            </>
          )}
          <YDocWrapper docId={docId}>
            <TimeAppInterface calendarId={calendarId} guestMode={guestMode} />
          </YDocWrapper>
        </div>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
