"use client";

import { use, useState } from "react";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { ToolEditor } from "@/components/agent-studio/tool-editor";

interface ToolEditorPageProps {
  params: Promise<{ toolId: string }>;
}

export default function ToolEditorPage({ params }: ToolEditorPageProps) {
  const { toolId } = use(params);
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
        <ToolEditor toolId={toolId} />
      </div>
    </GlobalGroupProvider>
  );
}
