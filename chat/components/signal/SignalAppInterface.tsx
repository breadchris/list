"use client";

import { useEffect, useState, useCallback } from "react";
import { contentRepository } from "@/lib/list/ContentRepository";
import { getCurrentUser } from "@/lib/list/SupabaseClient";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatView } from "./ChatView";
import { MessageCircle } from "lucide-react";

interface Group {
  id: string;
  name: string;
}

export function SignalAppInterface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user and groups on mount
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = await getCurrentUser();
        if (!user) {
          setError("Please sign in to use messaging");
          setLoading(false);
          return;
        }
        setUserId(user.id);

        const userGroups = await contentRepository.getUserGroups();
        setGroups(userGroups);
      } catch (err) {
        console.error("Error initializing signal app:", err);
        setError("Failed to load your data");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleSelectGroup = useCallback((group: Group) => {
    setSelectedGroup(group);
    setShowChat(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setShowChat(false);
  }, []);

  if (loading && !userId) {
    return (
      <div className="h-full bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="h-full bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#2d2d2d] text-white overflow-hidden w-full">
      {/* Sidebar */}
      <div
        className={`${
          showChat ? "hidden md:flex" : "flex"
        } w-full md:w-[320px] flex-shrink-0 h-full`}
      >
        <ConversationSidebar
          groups={groups}
          selectedGroupId={selectedGroup?.id ?? null}
          onSelectGroup={handleSelectGroup}
          isLoading={loading}
        />
      </div>

      {/* Chat View */}
      <div
        className={`${
          showChat ? "flex" : "hidden md:flex"
        } flex-1 min-w-0 h-full`}
      >
        <ChatView
          group={selectedGroup}
          userId={userId ?? ""}
          onBack={handleBackToList}
        />
      </div>
    </div>
  );
}
