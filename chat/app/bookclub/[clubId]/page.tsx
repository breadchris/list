"use client";

import { use, useState } from "react";
import { BookClubDetail } from "@/components/bookclub/bookclub-detail";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function BookClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="bookclub"
        />
        <BookClubDetail clubId={clubId} />
      </div>
    </GlobalGroupProvider>
  );
}
