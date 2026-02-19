"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { WorkflowEditor } from "@/components/agent-studio/workflow-editor";

interface WorkflowEditorPageProps {
  params: Promise<{ workflowId: string }>;
}

export default function WorkflowEditorPage({ params }: WorkflowEditorPageProps) {
  const { workflowId } = use(params);

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <WorkflowEditor workflowId={workflowId} />
      </AppShell>
    </GlobalGroupProvider>
  );
}
