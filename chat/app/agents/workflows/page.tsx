"use client";

import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { WorkflowLibrary } from "@/components/agent-studio/workflow-library";

export default function WorkflowsPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <WorkflowLibrary />
      </AppShell>
    </GlobalGroupProvider>
  );
}
