"use client";

import { useState, useEffect } from "react";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider, useGlobalGroup } from "@/components/GlobalGroupContext";
import { BuilderChat } from "@/components/agent-studio/builder-chat";
import { supabase } from "@/lib/list/SupabaseClient";

function AgentsPageContent() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const { selectedGroup, isLoading: groupsLoading } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user ID from Supabase auth
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Show loading while fetching user and groups
  if (groupsLoading || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show message if no group selected
  if (!selectedGroup) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">No group selected</p>
          <p className="text-sm text-neutral-500">
            Select a group to start building agents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-neutral-950">
      <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
      <AppSwitcherPanel
        isOpen={appSwitcherOpen}
        onClose={() => setAppSwitcherOpen(false)}
        currentApp="agents"
      />
      <BuilderChat groupId={selectedGroup.id} userId={userId} />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <GlobalGroupProvider>
      <AgentsPageContent />
    </GlobalGroupProvider>
  );
}
