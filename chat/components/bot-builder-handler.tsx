"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { BotBuilderResponse } from "@/lib/schema";

interface BotBuilderHandlerProps {
  botMessageId: string;
  onCreateBot?: (botData: {
    mention: string;
    description: string;
    personalityLines: string[];
  }) => void;
}

export function BotBuilderHandler({
  botMessageId,
  onCreateBot,
}: BotBuilderHandlerProps) {
  const [botData, setBotData] = useState<Partial<BotBuilderResponse> | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState(false);

  // Listen for object updates from the bot
  useEffect(() => {
    const handleObjectUpdate = (event: CustomEvent) => {
      if (event.detail.messageId === botMessageId) {
        setBotData(event.detail.partialObject?.response || null);
      }
    };

    window.addEventListener(
      "objectUpdate" as never,
      handleObjectUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "objectUpdate" as never,
        handleObjectUpdate as EventListener,
      );
    };
  }, [botMessageId]);

  const handleCreateBot = () => {
    if (
      !botData?.bot_mention ||
      !botData?.bot_description ||
      !botData?.personality_lines
    ) {
      setCreationError("Missing required bot information");
      return;
    }

    setIsCreating(true);
    setCreationError(null);
    setCreationSuccess(false);

    try {
      if (onCreateBot) {
        onCreateBot({
          mention: botData.bot_mention,
          description: botData.bot_description,
          personalityLines: botData.personality_lines,
        });

        // Show success feedback
        setTimeout(() => {
          setIsCreating(false);
          setCreationSuccess(true);

          // Clear success message after 3 seconds
          setTimeout(() => {
            setCreationSuccess(false);
          }, 3000);
        }, 500);
      } else {
        setIsCreating(false);
        setCreationError("Bot creation handler not available");
      }
    } catch (error) {
      setIsCreating(false);
      setCreationError(error instanceof Error ? error.message : "Failed to create bot");
    }
  };

  if (!botData) {
    return (
      <div className="text-neutral-500 text-sm font-mono">
        Waiting for Bot Builder...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main message from bot */}
      {botData.message ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>
            {botData.message}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-neutral-500 text-sm font-mono animate-pulse">
          Thinking...
        </div>
      )}

      {/* Bot details preview */}
      {botData.bot_mention && (
        <div className="bg-neutral-950 border border-neutral-800 rounded p-3 space-y-2">
          <div className="text-xs font-mono text-neutral-500 uppercase tracking-wide">
            Bot Configuration
          </div>

          <div className="space-y-2">
            {/* Bot name */}
            <div className="flex items-start gap-2">
              <span className="text-neutral-500 text-sm">Name:</span>
              <span className="text-blue-400 font-mono text-sm">
                @{botData.bot_mention}
              </span>
            </div>

            {/* Description */}
            {botData.bot_description && (
              <div className="flex items-start gap-2">
                <span className="text-neutral-500 text-sm">Description:</span>
                <span className="text-neutral-300 text-sm">
                  {botData.bot_description}
                </span>
              </div>
            )}

            {/* Personality */}
            {botData.personality_lines &&
              botData.personality_lines.length > 0 && (
                <div className="space-y-1">
                  <span className="text-neutral-500 text-sm">Personality:</span>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {botData.personality_lines.map((line, index) => (
                      <li
                        key={index}
                        className="text-neutral-300 text-sm"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Error message */}
      {creationError && (
        <div className="px-4 py-2 bg-red-900/30 border border-red-700 text-red-400 rounded font-mono text-sm">
          ❌ {creationError}
        </div>
      )}

      {/* Success message */}
      {creationSuccess && (
        <div className="px-4 py-2 bg-green-900/30 border border-green-700 text-green-400 rounded font-mono text-sm">
          ✅ Bot created successfully! Try @{botData.bot_mention}
        </div>
      )}

      {/* Create button */}
      {botData.show_create_button && onCreateBot && !creationSuccess && (
        <button
          onClick={handleCreateBot}
          disabled={isCreating}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-blue-100 rounded font-mono text-sm transition-colors"
        >
          {isCreating ? "Creating Bot..." : "🤖 Create Bot"}
        </button>
      )}

      {/* Step indicator */}
      {botData.step && (
        <div className="text-xs text-neutral-600 font-mono text-center">
          Step: {botData.step.replace(/_/g, " ")}
        </div>
      )}
    </div>
  );
}
