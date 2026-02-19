"use client";

import { TimeLanding } from "@/components/time/time-landing";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function TimePage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="time">
        <TimeLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
