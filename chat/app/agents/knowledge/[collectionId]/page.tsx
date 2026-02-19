"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { CollectionEditor } from "@/components/agent-studio/collection-editor";

interface CollectionEditorPageProps {
  params: Promise<{ collectionId: string }>;
}

export default function CollectionEditorPage({ params }: CollectionEditorPageProps) {
  const { collectionId } = use(params);

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="agents">
        <CollectionEditor collectionId={collectionId} />
      </AppShell>
    </GlobalGroupProvider>
  );
}
