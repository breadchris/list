"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { SearchInterface } from "@/components/search-interface";
import { ChatInterface } from "@/components/chat-interface";
import { CalendarChatInterface } from "@/components/calendar-chat-interface";
import { LexicalEditorAppInterface } from "@/components/lexical-editor-app-interface";
import { ReaderAppInterface } from "@/components/reader-app-interface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { getAppById } from "@/lib/apps.config";

export default function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = use(params);
  const appConfig = getAppById(app);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  if (!appConfig) {
    notFound();
  }

  // Create app-specific document ID for isolated collaborative rooms
  const docId = `chat-session-${appConfig.id}`;

  // Chat app uses a different interface
  if (appConfig.renderMode === "chat") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <ChatInterface />
        </YDocWrapper>
      </div>
    );
  }

  // Calendar app uses split view with chat + calendar
  if (appConfig.renderMode === "calendar") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <CalendarChatInterface />
        </YDocWrapper>
      </div>
    );
  }

  // Editor app uses full-page collaborative editor (Lexical)
  if (appConfig.renderMode === "editor") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <LexicalEditorAppInterface />
        </YDocWrapper>
      </div>
    );
  }

  // Reader app uses collaborative EPUB reader
  if (appConfig.renderMode === "reader") {
    return (
      <div className="relative h-screen bg-neutral-900">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <ReaderAppInterface />
        </YDocWrapper>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-neutral-900">
      <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
      <AppSwitcherPanel
        isOpen={appSwitcherOpen}
        onClose={() => setAppSwitcherOpen(false)}
        currentApp={app}
      />
      <YDocWrapper docId={docId}>
        <SearchInterface appConfig={appConfig} />
      </YDocWrapper>
    </div>
  );
}
