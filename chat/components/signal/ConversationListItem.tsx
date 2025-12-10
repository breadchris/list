"use client";

import type { Content } from "@/components/ContentRepository";

interface ConversationListItemProps {
  conversation: Content;
  lastMessage?: Content;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ConversationListItem({
  conversation,
  lastMessage,
  isSelected = false,
  onClick,
}: ConversationListItemProps) {
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPreview = (): string => {
    if (!lastMessage) return "";
    if (lastMessage.type === "image") return "Image";
    return lastMessage.data.slice(0, 50) + (lastMessage.data.length > 50 ? "..." : "");
  };

  const displayName = conversation.data.slice(0, 30) || "Conversation";
  const timeString = lastMessage
    ? formatTime(lastMessage.created_at)
    : formatTime(conversation.created_at);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 hover:bg-[#2d2d2d] cursor-pointer ${
        isSelected ? "bg-[#2d2d2d]" : ""
      }`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-[#e8d4f0] flex items-center justify-center">
          <span className="text-[#2d2d2d] font-medium">
            {getInitials(displayName)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-sm truncate">{displayName}</span>
          <span className="text-gray-400 text-xs flex-shrink-0 ml-2">
            {timeString}
          </span>
        </div>
        <p className="text-gray-400 text-sm truncate">{getPreview()}</p>
      </div>
    </div>
  );
}
