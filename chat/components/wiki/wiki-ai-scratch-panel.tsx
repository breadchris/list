"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, Sparkles, ChevronDown } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  BasicTextStyleButton,
  BlockTypeSelect,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
  aiDocumentFormats,
} from "@blocknote/xl-ai";
import { DefaultChatTransport } from "ai";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { WikiAICancelFAB } from "./wiki-ai-cancel-fab";
import { useWikiAIContext } from "./wiki-interface";
import { useBlockNoteAIStatus } from "@/hooks/wiki/use-blocknote-ai-status";
import { WIKI_TEMPLATE_MODELS, DEFAULT_TEMPLATE_MODEL } from "@/types/wiki";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/xl-ai/style.css";

interface WikiAIScratchPanelProps {
  /** Unique panel ID */
  id: string;
  /** Whether this panel is active */
  isActive: boolean;
  /** Panel index */
  index: number;
  /** Close this panel */
  onClose: () => void;
  /** Set this panel as active */
  onActivate: () => void;
  /** Panel width (desktop only) */
  width?: number;
  /** Callback for resize */
  onResize?: (width: number) => void;
  /** Whether to show resize handle */
  showResizeHandle?: boolean;
  /** Current AI model */
  model?: string;
  /** Callback when model changes */
  onModelChange?: (model: string) => void;
  /** Initial selected text from editor (displayed as blockquote) */
  initialSelectedText?: string;
}

/**
 * Extract text from a BlockNote block's content array
 */
function extractTextFromBlock(block: { content?: unknown }): string {
  const content = block.content;
  if (!Array.isArray(content)) return "";

  let text = "";
  for (const item of content) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
    ) {
      text += item.text;
    }
  }
  return text;
}

/**
 * WikiAIScratchPanel - Temporary AI scratch panel for quick AI interactions
 *
 * Features:
 * - Ephemeral BlockNote editor (no persistence)
 * - Enter-to-submit: Type prompt, press Enter, AI generates content
 * - Can continue conversation by typing more prompts
 * - Content is discarded on close (user manually copies what they need)
 */
export function WikiAIScratchPanel({
  id,
  isActive,
  index,
  onClose,
  onActivate,
  width,
  onResize,
  showResizeHandle = false,
  model = DEFAULT_TEMPLATE_MODEL,
  onModelChange,
  initialSelectedText,
}: WikiAIScratchPanelProps) {
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const isEditorMountedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const hasInitializedSelectionRef = useRef(false);

  // Create transport with model header
  const aiTransport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/blocknote-ai",
      headers: {
        "x-model": model,
      },
    });
  }, [model]);

  // Create BlockNote editor (no collaboration - temporary scratch)
  const editor = useCreateBlockNote(
    {
      extensions: [
        AIExtension({
          transport: aiTransport,
          streamToolsProvider: aiDocumentFormats.html.getStreamToolsProvider({
            withDelays: false,
            defaultStreamTools: {
              add: true,
              delete: false,
              update: false,
            },
          }),
        }),
      ],
      dictionary: {
        ...en,
        ai: aiEn,
      },
    },
    [id, model] // Recreate editor when ID or model changes
  );

  // AI status tracking for cancel FAB
  const { isAIActive, cancel: cancelAI } = useBlockNoteAIStatus(editor);

  // Get AI context from selected panels
  const wikiAIContext = useWikiAIContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isModelDropdownOpen) return;

    const handleClickOutside = () => {
      setIsModelDropdownOpen(false);
    };

    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Track when editor view is ready
  useEffect(() => {
    if (!editor) {
      isEditorMountedRef.current = false;
      setIsEditorMounted(false);
      return;
    }

    // Check if view is already available
    const tiptapEditor = (
      editor as unknown as { _tiptapEditor?: { view?: unknown } }
    )._tiptapEditor;
    if (tiptapEditor?.view) {
      isEditorMountedRef.current = true;
      setIsEditorMounted(true);
      return;
    }

    // Poll for view availability (TipTap mounts async)
    const checkMount = setInterval(() => {
      const editor_internal = (
        editor as unknown as { _tiptapEditor?: { view?: unknown } }
      )._tiptapEditor;
      if (editor_internal?.view) {
        isEditorMountedRef.current = true;
        setIsEditorMounted(true);
        clearInterval(checkMount);
      }
    }, 10);

    return () => {
      clearInterval(checkMount);
      isEditorMountedRef.current = false;
      setIsEditorMounted(false);
    };
  }, [editor]);

  // Enter-to-submit handler: Type prompt, press Enter, AI runs
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor || !isEditorMounted) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle plain Enter (no modifiers except for checking current block)
      if (
        e.key !== "Enter" ||
        e.shiftKey ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }

      // Check if we're in a paragraph block with text
      const cursor = editor.getTextCursorPosition();
      if (!cursor?.block) return;

      const block = cursor.block;
      if (block.type !== "paragraph") return;

      // Extract text from content
      const text = extractTextFromBlock(block);
      if (!text.trim()) return;

      // Prevent default Enter behavior (new line)
      e.preventDefault();
      e.stopPropagation();

      // Get AI extension and invoke
      const ai = editor.getExtension(AIExtension);
      if (ai) {
        // Insert a new paragraph block AFTER the prompt block
        // AI will generate content in this new block, preserving the original prompt
        const newBlockId = crypto.randomUUID();
        editor.insertBlocks(
          [{ id: newBlockId, type: "paragraph" }],
          block,
          "after"
        );
        ai.openAIMenuAtBlock(newBlockId);

        // Include selected AI context in the prompt
        let finalPrompt = text.trim();
        const context = await wikiAIContext?.getSelectedAIContextMarkdown();
        if (context) {
          finalPrompt = `## Reference Context from Selected Wiki Pages\n\n${context}\n\n---\n\n## Your Prompt\n\n${finalPrompt}`;
        }

        ai.invokeAI({ userPrompt: finalPrompt, useSelection: false });
      }
    };

    // Use capture phase to intercept before BlockNote processes
    container.addEventListener("keydown", handleKeyDown, true);
    return () => container.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, isEditorMounted, wikiAIContext]);

  // Focus editor on mount
  useEffect(() => {
    if (editor && isEditorMounted) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        editor.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editor, isEditorMounted]);

  // Insert initial selected text as blockquote when editor first mounts
  useEffect(() => {
    if (
      editor &&
      isEditorMounted &&
      initialSelectedText &&
      !hasInitializedSelectionRef.current
    ) {
      hasInitializedSelectionRef.current = true;

      // Get first block (where we'll insert before)
      const firstBlock = editor.document[0];
      if (!firstBlock) return;

      // Create blockquote with selected text and empty paragraph for prompt
      const blockquoteId = crypto.randomUUID();
      const paragraphId = crypto.randomUUID();

      // Split multi-line text into separate text items within the blockquote
      const textContent = initialSelectedText.split('\n').map((line, i, arr) => {
        // Add text with newline character between lines except for the last
        if (i < arr.length - 1) {
          return { type: "text" as const, text: line + '\n', styles: {} };
        }
        return { type: "text" as const, text: line, styles: {} };
      });

      // Insert blockquote with selection, then empty paragraph
      editor.insertBlocks(
        [
          {
            id: blockquoteId,
            type: "paragraph",
            props: { backgroundColor: "gray" },
            content: textContent,
          },
          {
            id: paragraphId,
            type: "paragraph",
            content: [],
          },
        ],
        firstBlock,
        "before"
      );

      // Remove the original empty first block
      editor.removeBlocks([firstBlock]);

      // Focus the empty paragraph for user input
      setTimeout(() => {
        editor.setTextCursorPosition(paragraphId, "end");
        editor.focus();
      }, 50);
    }
  }, [editor, isEditorMounted, initialSelectedText]);

  return (
    <div
      className={`relative h-full flex flex-col bg-neutral-950 ${
        isActive ? "ring-1 ring-amber-500/30" : ""
      }`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-neutral-300 text-sm font-medium">
            AI Scratch
          </span>
          <span className="text-neutral-600 text-xs">temporary</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDropdownOpen(!isModelDropdownOpen);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            >
              {WIKI_TEMPLATE_MODELS.find((m) => m.id === model)?.name || model}
              <ChevronDown className="w-3 h-3" />
            </button>
            {isModelDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-neutral-800 border border-neutral-700 rounded-md shadow-lg">
                {WIKI_TEMPLATE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelChange?.(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-700 transition-colors ${
                      model === m.id
                        ? "text-amber-400"
                        : "text-neutral-300"
                    }`}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-neutral-500 ml-1">({m.provider})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hint text */}
      <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-800/50">
        Type a prompt and press Enter to generate content. Shift+Enter for new
        line.
      </div>

      {/* BlockNote Editor */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{ pointerEvents: isEditorMounted ? "auto" : "none" }}
      >
        {editor && (
          <BlockNoteView editor={editor} theme="dark" className="h-full">
            <FormattingToolbarController
              formattingToolbar={() => (
                <FormattingToolbar>
                  <BlockTypeSelect key="blockTypeSelect" />
                  <BasicTextStyleButton
                    basicTextStyle="bold"
                    key="boldStyleButton"
                  />
                  <BasicTextStyleButton
                    basicTextStyle="italic"
                    key="italicStyleButton"
                  />
                  <BasicTextStyleButton
                    basicTextStyle="underline"
                    key="underlineStyleButton"
                  />
                  <BasicTextStyleButton
                    basicTextStyle="strike"
                    key="strikeStyleButton"
                  />
                  <BasicTextStyleButton
                    basicTextStyle="code"
                    key="codeStyleButton"
                  />
                  <ColorStyleButton key="colorStyleButton" />
                  <NestBlockButton key="nestBlockButton" />
                  <UnnestBlockButton key="unnestBlockButton" />
                  <CreateLinkButton key="createLinkButton" />
                  <AIToolbarButton key="aiToolbarButton" />
                </FormattingToolbar>
              )}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                return [
                  ...getDefaultReactSlashMenuItems(editor),
                  ...getAISlashMenuItems(editor),
                ].filter((item) =>
                  item.title.toLowerCase().includes(query.toLowerCase())
                );
              }}
            />
            <AIMenuController />
          </BlockNoteView>
        )}
      </div>

      {/* AI Cancel FAB - shows when AI inference is in progress */}
      <WikiAICancelFAB isVisible={isAIActive} onCancel={cancelAI} />

      {/* Resize handle (desktop only) */}
      {showResizeHandle && onResize && (
        <ResizeHandle currentWidth={width || 450} onResize={onResize} />
      )}
    </div>
  );
}

interface ResizeHandleProps {
  currentWidth: number;
  onResize: (width: number) => void;
}

function ResizeHandle({ currentWidth, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(200, Math.min(800, startWidth + delta));
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentWidth, onResize]
  );

  return (
    <div
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-amber-500/50 transition-colors ${
        isDragging ? "bg-amber-500" : "bg-transparent"
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
