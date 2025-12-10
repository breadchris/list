"use client";

import { use, useState, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { SearchInterface } from "@/components/search-interface";
import { ChatInterface } from "@/components/chat-interface";
import { CalendarChatInterface } from "@/components/calendar-chat-interface";
import { ReaderAppInterface } from "@/components/reader-app-interface";
import { MoneyAppInterface } from "@/components/money-app-interface";
import { MapsAppInterface } from "@/components/maps-app-interface";
import { PaintAppInterface } from "@/components/paint/paint-app-interface";
import { DoAppInterface } from "@/components/do/do-app-interface";
import { SignalAppInterface } from "@/components/signal/SignalAppInterface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { PublishGroupProvider } from "@/components/PublishGroupContext";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { ToastProvider } from "@/components/list/ToastProvider";
import { getAppById } from "@/lib/apps.config";

export default function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = use(params);
  const appConfig = getAppById(app);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const router = useRouter();

  // Redirect list and dj apps to their dedicated routes
  useEffect(() => {
    if (appConfig?.renderMode === "list") {
      router.replace("/list");
    }
    if (appConfig?.renderMode === "dj") {
      router.replace("/dj");
    }
  }, [appConfig, router]);

  if (!appConfig) {
    notFound();
  }

  // List and DJ apps have their own route structures
  if (appConfig.renderMode === "list" || appConfig.renderMode === "dj") {
    return null; // Will redirect
  }

  // Create app-specific document ID for isolated collaborative rooms
  const docId = `chat-session-${appConfig.id}`;

  // Chat app uses a different interface
  if (appConfig.renderMode === "chat") {
    return (
      <PublishGroupProvider>
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
      </PublishGroupProvider>
    );
  }

  // Calendar app uses split view with chat + calendar
  if (appConfig.renderMode === "calendar") {
    return (
      <PublishGroupProvider>
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
      </PublishGroupProvider>
    );
  }

  // Reader app uses collaborative EPUB reader
  if (appConfig.renderMode === "reader") {
    return (
      <AppSettingsProvider>
        <div className="relative h-screen bg-neutral-900">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} variant="subtle" readerPosition />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp={app}
          />
          <YDocWrapper docId={docId}>
            <ReaderAppInterface />
          </YDocWrapper>
        </div>
      </AppSettingsProvider>
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
