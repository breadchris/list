"use client";

import { useState } from "react";
import { RabbitHoleLanding } from "@/components/rabbit-hole/RabbitHoleLanding";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function RabbitHolePage() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="rabbit-hole"
        />
        <RabbitHoleLanding />
      </div>
    </GlobalGroupProvider>
  );
}
