"use client";

import { memo } from "react";
import { X, RefreshCw, Square, Loader2 } from "lucide-react";
import { RabbitHoleMarkdown } from "./RabbitHoleMarkdown";
import type { RabbitHolePage } from "@/types/rabbit-hole";

interface RabbitHolePanelProps {
  page: RabbitHolePage;
  isActive: boolean;
  isFirst: boolean;
  isReadOnly?: boolean;
  onLinkClick: (
    linkText: string,
    linkTarget: string,
    contextSnippet: string,
  ) => void;
  onClose: () => void;
  onActivate: () => void;
  onRegenerate: () => void;
  onCancel?: () => void;
}

export const RabbitHolePanel = memo(function RabbitHolePanel({
  page,
  isActive,
  isFirst,
  isReadOnly = false,
  onLinkClick,
  onClose,
  onActivate,
  onRegenerate,
  onCancel,
}: RabbitHolePanelProps) {
  const isStreaming = page.status === "streaming";
  const hasError = page.status === "error";

  return (
    <div
      className={`flex-shrink-0 w-[400px] md:w-[500px] lg:w-[600px] h-full flex flex-col border-r border-border transition-colors ${
        isActive ? "bg-card" : "bg-background"
      }`}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="text-sm font-medium text-foreground truncate">
            {page.query}
          </h3>
          {page.link_text && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              via "{page.link_text}"
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly &&
            (isStreaming ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.();
                }}
                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-muted rounded transition-colors"
                title="Stop"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            ))}
          {!isFirst && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {hasError ? (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Failed to load content</p>
            {!isReadOnly && (
              <button
                onClick={onRegenerate}
                className="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-lg transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        ) : page.content ? (
          <RabbitHoleMarkdown
            content={page.content}
            onLinkClick={onLinkClick}
            isStreaming={isStreaming}
          />
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Exploring...</span>
          </div>
        ) : (
          <p className="text-muted-foreground">No content yet</p>
        )}
      </div>
    </div>
  );
});
