"use client";

import { ListApp } from "@/components/list/ListApp";
import { AppShell } from "@/components/app-shell";

export default function ListPage() {
  return (
    <AppShell currentApp="list">
      <ListApp />
    </AppShell>
  );
}
