"use client";

import { useState } from "react";
import { BookClubLanding } from "@/components/bookclub/bookclub-landing";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function BookClubPage() {
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
        <BookClubLanding />
      </div>
    </GlobalGroupProvider>
  );
}
