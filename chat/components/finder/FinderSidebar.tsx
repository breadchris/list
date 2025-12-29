"use client";

import React from "react";
import { Folder, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Group {
  id: string;
  name: string;
}

interface FinderSidebarProps {
  groups: Group[];
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string) => void;
  onClose?: () => void;
  isLoading?: boolean;
}

export function FinderSidebar({
  groups,
  selectedGroupId,
  onGroupSelect,
  onClose,
  isLoading,
}: FinderSidebarProps) {
  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Mobile Close Button */}
      {onClose && (
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-300">
          <span className="text-sm text-gray-600 uppercase tracking-wide">
            Menu
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Favorites Section */}
      <div className="mt-6 mb-6 flex-1">
        <div className="flex items-center px-4 py-2 text-xs text-gray-600 uppercase tracking-wide">
          Favorites
        </div>
        <div className="space-y-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No groups</div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center px-4 py-2 mx-2 rounded cursor-pointer hover:bg-gray-200 ${
                  selectedGroupId === group.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700"
                }`}
                onClick={() => onGroupSelect(group.id)}
              >
                <Folder
                  className={`w-4 h-4 ${
                    selectedGroupId === group.id
                      ? "text-blue-500"
                      : "text-blue-400"
                  }`}
                />
                <span className="ml-3 text-sm truncate">{group.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
