"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/list/SupabaseClient";
import { UserAuth } from "./list/UserAuth";
import { LandingPage } from "./LandingPage";
import { isPublicRoute } from "@/lib/public-routes";

export function AuthPrompt({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check if current route is public based on app configurations
  const isPublic = isPublicRoute(
    pathname || "",
    new URLSearchParams(searchParams?.toString() || "")
  );

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

  if (!user && !isPublic) {
    if (pathname === "/") {
      return <LandingPage />;
    }
    return <UserAuth onAuthSuccess={() => {}} />;
  }

  return <>{children}</>;
}
