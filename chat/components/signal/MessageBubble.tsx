"use client";

import { Check, CheckCheck } from "lucide-react";
import type { Content } from "@/components/ContentRepository";

interface MessageBubbleProps {
  message: Content;
  isSent: boolean;
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isImage = message.type === "image";

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={`max-w-[85%] md:max-w-[70%] ${
          isSent ? "items-end" : "items-start"
        } flex flex-col min-w-0`}
      >
        {isImage ? (
          <div
            className={`${
              isSent ? "bg-[#2c6beb]" : "bg-[#3b3b3b]"
            } rounded-2xl p-1 max-w-full`}
          >
            <img
              src={message.data}
              alt="Message attachment"
              className="rounded-xl max-w-full h-auto max-h-80 object-contain"
            />
            <div className="flex items-center justify-end gap-1 px-2 pb-1">
              <span className="text-white text-xs">
                {formatTime(message.created_at)}
              </span>
              {isSent && <CheckCheck size={14} className="text-white" />}
            </div>
          </div>
        ) : (
          <div
            className={`${
              isSent ? "bg-[#2c6beb]" : "bg-[#3b3b3b]"
            } rounded-2xl px-3 md:px-4 py-2 max-w-full`}
          >
            <p className="text-white break-all whitespace-pre-wrap">
              {message.data}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-white text-xs opacity-70">
                {formatTime(message.created_at)}
              </span>
              {isSent && (
                <CheckCheck size={14} className="text-white opacity-70" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
