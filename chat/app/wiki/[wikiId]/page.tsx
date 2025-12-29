"use client";

import { use, useState, useEffect } from "react";
import { WikiInterface } from "@/components/wiki/wiki-interface";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { AppSettingsProvider } from "@/components/AppSettingsContext";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { contentRepository } from "@/lib/list/ContentRepository";

export default function WikiRoomPage({
  params,
}: {
  params: Promise<{ wikiId: string }>;
}) {
  const { wikiId } = use(params);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the wiki to get its group_id
  useEffect(() => {
    const fetchWiki = async () => {
      try {
        const wiki = await contentRepository.getContentById(wikiId);
        if (wiki) {
          setGroupId(wiki.group_id);
        } else {
          setError("Wiki not found");
        }
      } catch (err) {
        console.error("Failed to fetch wiki:", err);
        setError("Failed to load wiki");
      } finally {
        setIsLoading(false);
      }
    };
    fetchWiki();
  }, [wikiId]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-500">Loading wiki...</div>
      </div>
    );
  }

  if (error || !groupId) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-red-400">{error || "Wiki not found"}</div>
      </div>
    );
  }

  return (
    <GlobalGroupProvider>
      <AppSettingsProvider onCloseAppSwitcher={() => setAppSwitcherOpen(false)}>
        <div className="relative h-screen bg-neutral-950">
          <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
          <AppSwitcherPanel
            isOpen={appSwitcherOpen}
            onClose={() => setAppSwitcherOpen(false)}
            currentApp="wiki"
          />
          <WikiInterface
            wikiId={wikiId}
            groupId={groupId}
            ySweetUrl=""
          />
        </div>
      </AppSettingsProvider>
    </GlobalGroupProvider>
  );
}
