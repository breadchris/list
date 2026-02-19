"use client";

import { useParams } from "next/navigation";
import { AgentEditor } from "@/components/agent-studio/agent-editor";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function AgentEditorPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <AgentEditor agentId={agentId} />
      </AppShell>
    </GlobalGroupProvider>
  );
}
