"use client";

import { use, useState, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { SearchInterface } from "@/components/search-interface";
import { ChatInterface } from "@/components/chat-interface";
import { CalendarChatInterface } from "@/components/calendar-chat-interface";
import { ReaderAppInterface } from "@/components/reader-app-interface";
import { MoneyAppInterface } from "@/components/money-app-interface";
import { TransferAppInterface } from "@/components/transfer/transfer-app-interface";
import { MapsAppInterface } from "@/components/maps-app-interface";
import { PaintAppInterface } from "@/components/paint/paint-app-interface";
import { DoAppInterface } from "@/components/do/do-app-interface";
import { SignalAppInterface } from "@/components/signal/SignalAppInterface";
import { WikiInterface } from "@/components/wiki/wiki-interface";
import { IneedartInterface } from "@/components/ineedart/ineedart-interface";
import { NotesAppWrapper } from "@/components/notes/notes-app-wrapper";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { ToastProvider } from "@/components/list/ToastProvider";
import { getAppById } from "@/lib/apps.config";

export default function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = use(params);
  const appConfig = getAppById(app);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const router = useRouter();

  // Redirect list, dj, wiki, time, and code apps to their dedicated routes
  useEffect(() => {
    if (appConfig?.renderMode === "list") {
      router.replace("/list");
    }
    if (appConfig?.renderMode === "dj") {
      router.replace("/dj");
    }
    if (appConfig?.renderMode === "wiki") {
      router.replace("/wiki");
    }
    if (appConfig?.renderMode === "time") {
      router.replace("/time");
    }
    if (appConfig?.renderMode === "code") {
      router.replace("/code");
    }
  }, [appConfig, router]);

  if (!appConfig) {
    notFound();
  }

  // List, DJ, Wiki, Time, and Code apps have their own route structures
  if (appConfig.renderMode === "list" || appConfig.renderMode === "dj" || appConfig.renderMode === "wiki" || appConfig.renderMode === "time" || appConfig.renderMode === "code") {
    return null; // Will redirect
  }

  // Create app-specific document ID for isolated collaborative rooms
  const docId = `chat-session-${appConfig.id}`;

  // Chat app uses a different interface
  if (appConfig.renderMode === "chat") {
    return (
      <GlobalGroupProvider>
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
      </GlobalGroupProvider>
    );
  }

  // Calendar app uses split view with chat + calendar
  if (appConfig.renderMode === "calendar") {
    return (
      <GlobalGroupProvider>
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
      </GlobalGroupProvider>
    );
  }

  // Reader app - EPUB reader
  if (appConfig.renderMode === "reader") {
    return (
      <GlobalGroupProvider>
        <AppSettingsProvider>
          <div className="relative h-screen bg-neutral-900">
            {/* AppSwitcherButton is inside ReaderAppInterface - shown on tap */}
            <AppSwitcherPanel
              isOpen={appSwitcherOpen}
              onClose={() => setAppSwitcherOpen(false)}
              currentApp={app}
            />
            <ReaderAppInterface onToggleAppSwitcher={() => setAppSwitcherOpen(prev => !prev)} />
          </div>
        </AppSettingsProvider>
      </GlobalGroupProvider>
    );
  }

  // Money app for bank connections and transactions
  if (appConfig.renderMode === "money") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <MoneyAppInterface />
      </div>
    );
  }

  // Transfer app for P2P payments with Stripe Connect
  if (appConfig.renderMode === "transfer") {
    return (
      <GlobalGroupProvider>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <TransferAppInterface />
        </div>
      </GlobalGroupProvider>
    );
  }

  // Maps app for location browsing and saving
  if (appConfig.renderMode === "maps") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <MapsAppInterface />
      </div>
    );
  }

  // Paint app for collaborative pixel art
  if (appConfig.renderMode === "paint") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <PaintAppInterface />
        </YDocWrapper>
      </div>
    );
  }

  // Do app for habit tracking with stamps
  if (appConfig.renderMode === "do") {
    return (
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp={app}
        />
        <YDocWrapper docId={docId}>
          <DoAppInterface />
        </YDocWrapper>
      </div>
    );
  }

  // Signal app for Signal-style messaging
  if (appConfig.renderMode === "signal") {
    return (
      <ToastProvider>
        <div className="relative h-screen bg-[#2d2d2d]">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <SignalAppInterface />
        </div>
      </ToastProvider>
    );
  }

  // Wiki app for collaborative wiki building
  if (appConfig.renderMode === "wiki") {
    // For wiki, we need a wiki ID. For now, use a default wiki per app
    // In a full implementation, this would come from user selection or URL params
    const wikiId = `wiki-${appConfig.id}`;
    const groupId = "default-wiki-group"; // TODO: Get from user context

    return (
      <GlobalGroupProvider>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <WikiInterface
            wikiId={wikiId}
            groupId={groupId}
            ySweetUrl=""
          />
        </div>
      </GlobalGroupProvider>
    );
  }

  // INeedArt app for art requests and submissions
  if (appConfig.renderMode === "ineedart") {
    return (
      <GlobalGroupProvider>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <IneedartInterface />
        </div>
      </GlobalGroupProvider>
    );
  }

  // Notes app for collaborative note-taking with Electric SQL + Yjs
  if (appConfig.renderMode === "notes") {
    return (
      <GlobalGroupProvider>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <NotesAppWrapper />
        </div>
      </GlobalGroupProvider>
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
