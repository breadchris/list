"use client";

import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { ToolLibrary } from "@/components/agent-studio/tool-library";

export default function ToolsPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <ToolLibrary />
      </AppShell>
    </GlobalGroupProvider>
  );
}
