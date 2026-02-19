"use client";

import { use } from "react";
import { BookClubDetail } from "@/components/bookclub/bookclub-detail";
import { AppShell } from "@/components/app-shell";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function BookClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);

  return (
    <GlobalGroupProvider>
      <AppShell currentApp="bookclub">
        <BookClubDetail clubId={clubId} />
      </AppShell>
    </GlobalGroupProvider>
  );
}
