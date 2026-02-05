"use client";

import { use, useState } from "react";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { WorkflowEditor } from "@/components/agent-studio/workflow-editor";

interface WorkflowEditorPageProps {
  params: Promise<{ workflowId: string }>;
}

export default function WorkflowEditorPage({ params }: WorkflowEditorPageProps) {
  const { workflowId } = use(params);
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
        <WorkflowEditor workflowId={workflowId} />
      </div>
    </GlobalGroupProvider>
  );
}
