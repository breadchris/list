"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/list/SupabaseClient";
import { UserAuth } from "./list/UserAuth";

export function AuthPrompt({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  // Allow unauthenticated access to DJ rooms with guest mode (watch/contribute)
  const isDjGuestAccess = pathname?.startsWith('/dj/') &&
                          pathname !== '/dj' &&
                          (mode === 'watch' || mode === 'contribute');

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user && !isDjGuestAccess) {
    return <UserAuth onAuthSuccess={() => {}} />;
  }

  return <>{children}</>;
}
