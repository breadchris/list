"use client";

import { AuthPrompt } from "./auth-prompt";
import { QueryProvider } from "../providers/QueryProvider";
import { PublishGroupProvider } from "./PublishGroupContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthPrompt>
        <PublishGroupProvider>{children}</PublishGroupProvider>
      </AuthPrompt>
    </QueryProvider>
  );
}
