"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Group } from "@/lib/list/ContentRepository";
import { useGroupsQuery } from "@/hooks/list/useGroupQueries";

const STORAGE_KEY = "publish-group-id";

interface PublishGroupContextType {
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group) => void;
  groups: Group[];
  isLoading: boolean;
}

const PublishGroupContext = createContext<PublishGroupContextType | null>(null);

export function PublishGroupProvider({ children }: { children: ReactNode }) {
  const { data: groups = [], isLoading } = useGroupsQuery();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Load saved group ID from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      setSelectedGroupId(savedId);
    }
  }, []);

  // Auto-select first group if none selected and groups are loaded
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      const firstGroup = groups[0];
      setSelectedGroupId(firstGroup.id);
      localStorage.setItem(STORAGE_KEY, firstGroup.id);
    }
  }, [groups, selectedGroupId]);

  // Validate that selected group still exists in user's groups
  useEffect(() => {
    if (selectedGroupId && groups.length > 0) {
      const groupExists = groups.some((g) => g.id === selectedGroupId);
      if (!groupExists) {
        // Group no longer accessible, select first available
        const firstGroup = groups[0];
        setSelectedGroupId(firstGroup.id);
        localStorage.setItem(STORAGE_KEY, firstGroup.id);
      }
    }
  }, [groups, selectedGroupId]);

  const selectedGroup =
    groups.find((g) => g.id === selectedGroupId) || null;

  const setSelectedGroup = useCallback((group: Group) => {
    setSelectedGroupId(group.id);
    localStorage.setItem(STORAGE_KEY, group.id);
  }, []);

  return (
    <PublishGroupContext.Provider
      value={{
        selectedGroup,
        setSelectedGroup,
        groups,
        isLoading,
      }}
    >
      {children}
    </PublishGroupContext.Provider>
  );
}

export function usePublishGroup() {
  const context = useContext(PublishGroupContext);
  if (!context) {
    throw new Error("usePublishGroup must be used within a PublishGroupProvider");
  }
  return context;
}

// Optional hook for components that may be outside provider
export function usePublishGroupOptional() {
  return useContext(PublishGroupContext);
}
