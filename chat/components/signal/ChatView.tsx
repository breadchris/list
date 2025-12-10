"use client";

import { useRef, useEffect, useMemo } from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";
import { DateDivider } from "./DateDivider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInfiniteContentByParent } from "@/hooks/useContentQueries";
import type { Content } from "@/components/ContentRepository";

interface Group {
  id: string;
  name: string;
}

interface ChatViewProps {
  group: Group | null;
  userId: string;
  onBack: () => void;
}

export function ChatView({
  group,
  userId,
  onBack,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } =
    useInfiniteContentByParent(group?.id ?? "", null, {
      enabled: !!group?.id,
      viewMode: "oldest",
    });

  const messages = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  // Group messages by date for dividers
  const messagesWithDividers = useMemo(() => {
    const result: Array<{ type: "message" | "divider"; data: Content | Date }> =
      [];
    let lastDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at).toDateString();
      if (messageDate !== lastDate) {
        result.push({ type: "divider", data: new Date(message.created_at) });
        lastDate = messageDate;
      }
      result.push({ type: "message", data: message });
    });

    return result;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!group) {
    return (
      <div className="flex flex-col bg-[#2d2d2d] w-full h-full items-center justify-center">
        <div className="text-gray-400 text-center">
          <p className="text-lg mb-2">No group selected</p>
          <p className="text-sm">Select a group from the sidebar</p>
        </div>
      </div>
    );
  }

  const displayName = group.name;

  return (
    <div className="flex flex-col bg-[#2d2d2d] w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-[#404040] flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <button
            className="md:hidden text-gray-300 hover:text-white flex-shrink-0"
            onClick={onBack}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#e8d4f0] flex items-center justify-center flex-shrink-0">
            <span className="text-[#2d2d2d] font-medium text-sm">
              {getInitials(displayName)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-white truncate">{displayName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <button className="text-gray-300 hover:text-white">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-3 md:px-4">
          <div className="py-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-400 text-sm">Loading messages...</div>
              </div>
            ) : messagesWithDividers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-400 text-sm">
                  No messages yet. Start the conversation!
                </div>
              </div>
            ) : (
              messagesWithDividers.map((item, index) => {
                if (item.type === "divider") {
                  return <DateDivider key={`divider-${index}`} date={item.data as Date} />;
                }
                const message = item.data as Content;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isSent={message.user_id === userId}
                  />
                );
              })
            )}
            <div ref={messagesEndRef}></div>
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <MessageInputBar
        groupId={group.id}
        userId={userId}
        onMessageSent={scrollToBottom}
      />
    </div>
  );
}
