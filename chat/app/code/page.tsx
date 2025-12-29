"use client";

import { useState } from "react";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { CodeLanding } from "@/components/code/code-landing";

export default function CodePage() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="relative h-screen bg-neutral-950">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="code"
        />
        <CodeLanding />
      </div>
    </GlobalGroupProvider>
  );
}
