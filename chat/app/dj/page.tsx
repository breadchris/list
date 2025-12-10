"use client";

import { useState } from "react";
import { DjLanding } from "@/components/dj/dj-landing";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { PublishGroupProvider } from "@/components/PublishGroupContext";

export default function DjPage() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <PublishGroupProvider>
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="dj"
        />
        <DjLanding />
      </div>
    </PublishGroupProvider>
  );
}
