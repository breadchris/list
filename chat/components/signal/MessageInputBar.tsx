"use client";

import { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import { useCreateContentMutation } from "@/hooks/useContentQueries";
import { useToast } from "@/components/list/ToastProvider";

interface MessageInputBarProps {
  groupId: string;
  userId: string;
  onMessageSent?: () => void;
}

export function MessageInputBar({
  groupId,
  userId,
  onMessageSent,
}: MessageInputBarProps) {
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createContentMutation = useCreateContentMutation();
  const toast = useToast();

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      await createContentMutation.mutateAsync({
        type: "text",
        data: message.trim(),
        group_id: groupId,
        user_id: userId,
      });

      setMessage("");
      onMessageSent?.();
    } catch (error) {
      toast.error("Error", "Failed to send message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Error", "Only images are supported");
      return;
    }

    setIsUploading(true);

    try {
      // Convert file to base64 data URL for now
      // In production, you'd upload to storage and use the URL
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        await createContentMutation.mutateAsync({
          type: "image",
          data: dataUrl,
          group_id: groupId,
          user_id: userId,
        });

        onMessageSent?.();
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Error", "Failed to read image file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Error", "Failed to send image");
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="px-3 md:px-4 py-3 border-t border-[#404040] flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-3 bg-[#3b3b3b] rounded-full px-3 md:px-4 py-2">
        <button
          className="text-gray-300 hover:text-white flex-shrink-0 disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip size={20} />
        </button>

        <input
          type="text"
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm md:text-base min-w-0"
          disabled={isUploading}
        />

        {message.trim() && (
          <button
            className="text-gray-300 hover:text-white flex-shrink-0"
            onClick={handleSendMessage}
            disabled={createContentMutation.isPending}
          >
            <Send size={20} />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
