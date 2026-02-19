"use client";

import { RabbitHoleLanding } from "@/components/rabbit-hole/RabbitHoleLanding";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function RabbitHolePage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="rabbit-hole">
        <RabbitHoleLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
