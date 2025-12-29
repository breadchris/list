"use client";

import { Suspense, useEffect } from "react";
import { AuthPrompt } from "./auth-prompt";
import { QueryProvider } from "../providers/QueryProvider";
import { GlobalGroupProvider } from "./GlobalGroupContext";

export function Providers({ children }: { children: React.ReactNode }) {
  // Suppress React DevTools warning about searchParams._debugInfo access
  // This is a false positive caused by DevTools inspecting Promise objects
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;

    const filter = (...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === "string" &&
        message.includes("searchParams") &&
        message.includes("_debugInfo")
      ) {
        return true;
      }
      return false;
    };

    console.warn = (...args: unknown[]) => {
      if (!filter(...args)) originalWarn.apply(console, args);
    };
    console.error = (...args: unknown[]) => {
      if (!filter(...args)) originalError.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <QueryProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <AuthPrompt>
          <GlobalGroupProvider>{children}</GlobalGroupProvider>
        </AuthPrompt>
      </Suspense>
    </QueryProvider>
  );
}
