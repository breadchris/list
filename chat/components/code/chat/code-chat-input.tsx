"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Send, Square, Loader2, ImagePlus, X } from "lucide-react";
import { ContentRepository } from "@/lib/list/ContentRepository";
import type { AttachedImage } from "@/components/code/types";

interface CodeChatInputProps {
  onSend: (message: string, images?: AttachedImage[]) => void;
  onCancel: () => void;
  isStreaming: boolean;
  groupId: string;
  sessionId: string;
  placeholder?: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function CodeChatInput({
  onSend,
  onCancel,
  isStreaming,
  groupId,
  sessionId,
  placeholder = "Describe your component...",
}: CodeChatInputProps) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if ((!input.trim() && images.length === 0) || isStreaming || isUploading) return;
    onSend(input.trim(), images.length > 0 ? images : undefined);
    setInput("");
    setImages([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    // Check total image count
    if (images.length + files.length > MAX_IMAGES) {
      setUploadError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const filesToUpload: File[] = [];
    for (const file of Array.from(files)) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`Invalid file type: ${file.name}. Allowed: PNG, JPEG, GIF, WebP`);
        continue;
      }
      // Validate size
      if (file.size > MAX_IMAGE_SIZE) {
        setUploadError(`File too large: ${file.name}. Maximum 10MB`);
        continue;
      }
      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    const contentRepository = new ContentRepository();

    try {
      for (const file of filesToUpload) {
        // Create content item for the image
        const content = await contentRepository.createContent({
          type: "image",
          data: "", // Will be updated with URL
          group_id: groupId,
          parent_content_id: sessionId, // Link to session
          metadata: {
            filename: file.name,
            size: file.size,
            mime_type: file.type,
          },
        });

        // Upload to storage
        const url = await contentRepository.uploadImage(file, content.id);

        // Update content with URL
        await contentRepository.updateContent(content.id, { data: url });

        // Add to local state
        setImages((prev) => [
          ...prev,
          { id: content.id, url, filename: file.name } as AttachedImage,
        ]);
      }
    } catch (err) {
      console.error("Image upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    // Note: We don't delete from Supabase - images persist as content
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-neutral-800 bg-neutral-950 p-4">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.filename || "Attached image"}
                className="w-16 h-16 object-cover rounded-lg border border-neutral-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-2 -right-2 p-1 bg-neutral-800 hover:bg-neutral-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-neutral-300" />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="w-16 h-16 flex items-center justify-center bg-neutral-900 rounded-lg border border-neutral-700">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="text-red-400 text-sm mb-2">{uploadError}</div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        {/* Attachment button */}
        <button
          onClick={handleAttachClick}
          disabled={isStreaming || isUploading || images.length >= MAX_IMAGES}
          className="flex-shrink-0 p-3 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:cursor-not-allowed text-neutral-400 hover:text-neutral-200 disabled:text-neutral-600 rounded-lg transition-colors"
          title={`Attach images (${images.length}/${MAX_IMAGES})`}
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isStreaming}
            rows={1}
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            title="Cancel"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && images.length === 0) || isUploading}
            className="flex-shrink-0 p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            title="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>

      {isStreaming && (
        <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Claude is thinking...</span>
        </div>
      )}

      <div className="mt-2 text-xs text-neutral-600">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
