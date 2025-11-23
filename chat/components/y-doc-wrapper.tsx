"use client";

import { YDocProvider } from "@y-sweet/react";

interface YDocWrapperProps {
  docId: string;
  children: React.ReactNode;
}

export function YDocWrapper({ docId, children }: YDocWrapperProps) {
  // Create auth function with access to docId
  const getClientToken = async () => {
    const response = await fetch("/api/y-sweet-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ docId }),
    });

    if (!response.ok) {
      throw new Error("Failed to get Y-Sweet authentication token");
    }

    return await response.json();
  };

  return (
    <YDocProvider docId={docId} authEndpoint={getClientToken}>
      {children}
    </YDocProvider>
  );
}
