"use client";

import { BookClubLanding } from "@/components/bookclub/bookclub-landing";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function BookClubPage() {
  return (
    <GlobalGroupProvider>
      <AppShell currentApp="bookclub">
        <BookClubLanding />
      </AppShell>
    </GlobalGroupProvider>
  );
}
