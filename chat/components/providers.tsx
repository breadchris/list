"use client";

import { UsernamePrompt } from "./username-prompt";
import { QueryProvider } from "../providers/QueryProvider";
import { PublishGroupProvider } from "./PublishGroupContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UsernamePrompt>
        <PublishGroupProvider>{children}</PublishGroupProvider>
      </UsernamePrompt>
    </QueryProvider>
  );
}
