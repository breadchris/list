"use client";

import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { KnowledgeLibrary } from "@/components/agent-studio/knowledge-library";

export default function KnowledgePage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <KnowledgeLibrary />
      </AppShell>
    </GlobalGroupProvider>
  );
}
