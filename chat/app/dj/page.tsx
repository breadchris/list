"use client";

import { DjLanding } from "@/components/dj/dj-landing";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function DjPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="dj">
        <DjLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
