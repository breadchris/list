"use client";

import { use } from "react";
import { TimeAppInterface } from "@/components/time/time-app-interface";
import { AppShell } from "@/components/app-shell";
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

  // Create a unique document ID for this calendar
  const docId = `time-calendar-${calendarId}`;

  // Validate mode parameter
  const guestMode =
    mode === "view" || mode === "contribute" ? mode : undefined;

  return (
    <GlobalGroupProvider>
      <AppSettingsProvider>
        <AppShell currentApp="time" hideShell={!!guestMode}>
          <YDocWrapper docId={docId}>
            <TimeAppInterface calendarId={calendarId} guestMode={guestMode} />
          </YDocWrapper>
        </AppShell>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
