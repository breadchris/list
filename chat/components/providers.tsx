"use client";

import { UsernamePrompt } from "./username-prompt";
import { QueryProvider } from "../providers/QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UsernamePrompt>
        {children}
      </UsernamePrompt>
    </QueryProvider>
  );
}
