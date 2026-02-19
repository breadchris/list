"use client";

import { useParams } from "next/navigation";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { AppShell } from "@/components/app-shell";
import { YDocWrapper } from "@/components/y-doc-wrapper";
import { TerminalView } from "@/components/shell/terminal-view";

export default function ShellSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const docId = `terminal-${sessionId}`;

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="shell">
        <YDocWrapper docId={docId}>
          <TerminalView docId={docId} />
        </YDocWrapper>
      </AppShell>
    </GlobalGroupProvider>
  );
}
