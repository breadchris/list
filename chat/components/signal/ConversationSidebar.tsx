"use client";

import { Menu, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Group {
  id: string;
  name: string;
}

interface ConversationSidebarProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (group: Group) => void;
  isLoading?: boolean;
}

export function ConversationSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  isLoading,
}: ConversationSidebarProps) {
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full h-full bg-[#3b3b3b] flex flex-col border-r border-[#2d2d2d]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2d2d2d]">
        <div className="flex items-center gap-3">
          <button className="text-gray-300 hover:text-white">
            <Menu size={20} />
          </button>
          <span className="text-white font-medium">Groups</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="flex items-center gap-2 bg-[#2d2d2d] rounded-md px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search groups"
            className="bg-transparent text-sm text-gray-300 placeholder-gray-500 outline-none flex-1"
          />
        </div>
      </div>

      {/* Group List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400 text-sm">Loading...</div>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="text-gray-400 text-sm text-center">
              No groups yet
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[#4a4a4a] transition-colors ${
                group.id === selectedGroupId ? "bg-[#4a4a4a]" : ""
              }`}
              onClick={() => onSelectGroup(group)}
            >
              <div className="w-12 h-12 rounded-full bg-[#e8d4f0] flex items-center justify-center flex-shrink-0">
                <span className="text-[#2d2d2d] font-medium text-sm">
                  {getInitials(group.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white truncate">{group.name}</div>
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
