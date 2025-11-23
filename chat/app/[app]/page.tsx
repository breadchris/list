"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { SearchInterface } from "@/components/search-interface";
import { ChatInterface } from "@/components/chat-interface";
import { AppHeader } from "@/components/app-header";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { getAppById } from "@/lib/apps.config";

export default function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = use(params);
  const appConfig = getAppById(app);

  if (!appConfig) {
    notFound();
  }

  // Create app-specific document ID for isolated collaborative rooms
  const docId = `chat-session-${appConfig.id}`;

  // Chat app uses a different interface
  if (appConfig.renderMode === "chat") {
    return (
      <div className="min-h-screen bg-neutral-950">
        <AppHeader title={appConfig.name} showBackButton />
        <YDocWrapper docId={docId}>
          <ChatInterface />
        </YDocWrapper>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      <AppHeader title={appConfig.name} showBackButton />
      <YDocWrapper docId={docId}>
        <SearchInterface appConfig={appConfig} />
      </YDocWrapper>
    </div>
  );
}
