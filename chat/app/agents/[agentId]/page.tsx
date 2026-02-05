"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AgentEditor } from "@/components/agent-studio/agent-editor";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function AgentEditorPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="agents"
        />
        <AgentEditor agentId={agentId} />
      </div>
    </GlobalGroupProvider>
  );
}
