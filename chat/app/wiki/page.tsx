"use client";

import { WikiLanding } from "@/components/wiki/wiki-landing";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function WikiPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="wiki">
        <WikiLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
