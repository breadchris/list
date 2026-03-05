"use client";

import { ContextInterface } from "@/components/context/ContextInterface";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function ContextPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="context">
        <ContextInterface />
      </AppShell>
    </GlobalGroupProvider>
  );
}
