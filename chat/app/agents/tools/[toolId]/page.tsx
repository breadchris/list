"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { ToolEditor } from "@/components/agent-studio/tool-editor";

interface ToolEditorPageProps {
  params: Promise<{ toolId: string }>;
}

export default function ToolEditorPage({ params }: ToolEditorPageProps) {
  const { toolId } = use(params);

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <ToolEditor toolId={toolId} />
      </AppShell>
    </GlobalGroupProvider>
  );
}
