"use client";

import { QueryProvider } from "@/providers/list/QueryProvider";
import { ToastProvider } from "@/components/list/ToastProvider";
import { ErrorBoundary } from "@/components/list/ErrorBoundary";

export default function ListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
