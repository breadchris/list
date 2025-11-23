"use client";

import { UsernamePrompt } from "./username-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UsernamePrompt>
      {children}
    </UsernamePrompt>
  );
}
