"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { CodeAppInterface } from "@/components/code/code-app-interface";

export default function CodeSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
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
        <CodeAppInterface sessionId={sessionId} />
      </div>
    </GlobalGroupProvider>
  );
}
