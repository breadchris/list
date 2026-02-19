"use client";

import { use, useEffect } from "react";
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
import { AppShell } from "@/components/app-shell";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { ToastProvider } from "@/components/list/ToastProvider";
import { getAppById } from "@/lib/apps.config";

export default function AppPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = use(params);
  const appConfig = getAppById(app);
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
    if (appConfig?.renderMode === "shell") {
      router.replace("/shell");
    }
  }, [appConfig, router]);

  if (!appConfig) {
    notFound();
  }

  // List, DJ, Wiki, Time, and Code apps have their own route structures
  if (appConfig.renderMode === "list" || appConfig.renderMode === "dj" || appConfig.renderMode === "wiki" || appConfig.renderMode === "time" || appConfig.renderMode === "code" || appConfig.renderMode === "shell") {
    return null; // Will redirect
  }

  // Create app-specific document ID for isolated collaborative rooms
  const docId = `chat-session-${appConfig.id}`;

  // Chat app uses a different interface
  if (appConfig.renderMode === "chat") {
    return (
      <GlobalGroupProvider>
        <AppShell currentApp={app}>
          <YDocWrapper docId={docId}>
            <ChatInterface />
          </YDocWrapper>
        </AppShell>
      </GlobalGroupProvider>
    );
  }

  // Calendar app uses split view with chat + calendar
  if (appConfig.renderMode === "calendar") {
    return (
      <GlobalGroupProvider>
        <AppShell currentApp={app}>
          <YDocWrapper docId={docId}>
            <CalendarChatInterface />
          </YDocWrapper>
        </AppShell>
      </GlobalGroupProvider>
    );
  }

  // Reader app - EPUB reader
  if (appConfig.renderMode === "reader") {
    return (
      <GlobalGroupProvider>
        <AppSettingsProvider>
          <AppShell currentApp={app} bgColor="bg-neutral-900">
            <ReaderAppInterface />
          </AppShell>
        </AppSettingsProvider>
      </GlobalGroupProvider>
    );
  }

  // Money app for bank connections and transactions
  if (appConfig.renderMode === "money") {
    return (
      <AppShell currentApp={app}>
        <MoneyAppInterface />
      </AppShell>
    );
  }

  // Transfer app for P2P payments with Stripe Connect
  if (appConfig.renderMode === "transfer") {
    return (
      <GlobalGroupProvider>
        <AppShell currentApp={app}>
          <TransferAppInterface />
        </AppShell>
      </GlobalGroupProvider>
    );
  }

  // Maps app for location browsing and saving
  if (appConfig.renderMode === "maps") {
    return (
      <AppShell currentApp={app}>
        <MapsAppInterface />
      </AppShell>
    );
  }

  // Paint app for collaborative pixel art
  if (appConfig.renderMode === "paint") {
    return (
      <AppShell currentApp={app}>
        <YDocWrapper docId={docId}>
          <PaintAppInterface />
        </YDocWrapper>
      </AppShell>
    );
  }

  // Do app for habit tracking with stamps
  if (appConfig.renderMode === "do") {
    return (
      <AppShell currentApp={app}>
        <YDocWrapper docId={docId}>
          <DoAppInterface />
        </YDocWrapper>
      </AppShell>
    );
  }

  // Signal app for Signal-style messaging
  if (appConfig.renderMode === "signal") {
    return (
      <ToastProvider>
        <AppShell currentApp={app} bgColor="bg-[#2d2d2d]">
          <SignalAppInterface />
        </AppShell>
      </ToastProvider>
    );
  }

  // Wiki app for collaborative wiki building
  if (appConfig.renderMode === "wiki") {
    const wikiId = `wiki-${appConfig.id}`;
    const groupId = "default-wiki-group";

    return (
      <GlobalGroupProvider>
        <AppShell currentApp={app}>
          <WikiInterface
            wikiId={wikiId}
            groupId={groupId}
            ySweetUrl=""
          />
        </AppShell>
      </GlobalGroupProvider>
    );
  }

  // INeedArt app for art requests and submissions
  if (appConfig.renderMode === "ineedart") {
    return (
      <GlobalGroupProvider>
        <AppShell currentApp={app}>
          <IneedartInterface />
        </AppShell>
      </GlobalGroupProvider>
    );
  }

  return (
    <AppShell currentApp={app} bgColor="bg-neutral-900">
      <YDocWrapper docId={docId}>
        <SearchInterface appConfig={appConfig} />
      </YDocWrapper>
    </AppShell>
  );
}
