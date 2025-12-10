"use client";

import { YDocProvider } from "@y-sweet/react";

interface YDocWrapperProps {
  docId: string;
  children: React.ReactNode;
}

export function YDocWrapper({ docId, children }: YDocWrapperProps) {
  // Create auth function with access to docId
  // Returns null on error to allow offline mode to work
  const getClientToken = async () => {
    try {
      const response = await fetch("/api/y-sweet-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ docId }),
      });

      if (!response.ok) {
        console.warn("Y-Sweet auth failed, using offline mode");
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn("Y-Sweet auth error, using offline mode:", error);
      return null;
    }
  };

  return (
    <YDocProvider
      docId={docId}
      authEndpoint={getClientToken}
      offlineSupport={true}
    >
      {children}
    </YDocProvider>
  );
}
