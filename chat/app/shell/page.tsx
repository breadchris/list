"use client";

import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppShell } from "@/components/app-shell";
import { ShellLanding } from "@/components/shell/shell-landing";

export default function ShellPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="shell">
        <ShellLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
