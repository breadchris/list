"use client";

import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { TraceViewer } from "@/components/agent-studio/trace-viewer";

export default function LogsPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <TraceViewer />
      </AppShell>
    </GlobalGroupProvider>
  );
}
