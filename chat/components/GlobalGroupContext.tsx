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

const STORAGE_KEY = "global-group-id";
const OLD_STORAGE_KEYS = ["publish-group-id", "lastViewedGroupId"];

interface GlobalGroupContextType {
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group) => void;
  groups: Group[];
  isLoading: boolean;
}

const GlobalGroupContext = createContext<GlobalGroupContextType | null>(null);

export function GlobalGroupProvider({ children }: { children: ReactNode }) {
  const { data: groups = [], isLoading } = useGroupsQuery();

  // Initialize synchronously from localStorage to avoid race condition with auto-select
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    // Try current storage key first
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) return savedId;

    // Migrate from old storage keys
    for (const oldKey of OLD_STORAGE_KEYS) {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue) {
        localStorage.setItem(STORAGE_KEY, oldValue);
        return oldValue;
      }
    }
    return null;
  });

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
    <GlobalGroupContext.Provider
      value={{
        selectedGroup,
        setSelectedGroup,
        groups,
        isLoading,
      }}
    >
      {children}
    </GlobalGroupContext.Provider>
  );
}

export function useGlobalGroup() {
  const context = useContext(GlobalGroupContext);
  if (!context) {
    throw new Error("useGlobalGroup must be used within a GlobalGroupProvider");
  }
  return context;
}

// Optional hook for components that may be outside provider
export function useGlobalGroupOptional() {
  return useContext(GlobalGroupContext);
}
