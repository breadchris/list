"use client";

import { use, useState } from "react";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { CollectionEditor } from "@/components/agent-studio/collection-editor";

interface CollectionEditorPageProps {
  params: Promise<{ collectionId: string }>;
}

export default function CollectionEditorPage({ params }: CollectionEditorPageProps) {
  const { collectionId } = use(params);
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
        <CollectionEditor collectionId={collectionId} />
      </div>
    </GlobalGroupProvider>
  );
}
