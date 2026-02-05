"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useYDoc, useYjsProvider } from "@y-sweet/react";
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
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  aiDocumentFormats,
} from "@blocknote/xl-ai";
import { offset, size } from "@floating-ui/react";
import type { FloatingUIOptions } from "@blocknote/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, Youtube, Calendar } from "lucide-react";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { wikiSchema } from "./wiki-schema";
import { extractYouTubeId, isYouTubeUrl } from "./youtube-block";
import { useWikiEditorRegistry, useWikiAIContext, useWikiAIScratch } from "./wiki-interface";
import { useStorageUpload } from "@/hooks/use-storage-upload";
import type { WikiLinkClickEvent, WikiPage, WikiTemplate } from "@/types/wiki";
import { resolvePath, getTodayPath } from "@/lib/wiki/path-utils";
import { getDailyQuote } from "@/lib/wiki/daily-quotes";
import { WikiPageMentionMenu } from "./wiki-page-mention-menu";
import { WikiPageExistsContext } from "./wiki-link-inline";
import { WikiAICancelFAB } from "./wiki-ai-cancel-fab";
import { useBlockNoteAIStatus } from "@/hooks/wiki/use-blocknote-ai-status";

import "@blocknote/shadcn/style.css";
import "@blocknote/xl-ai/style.css";

/**
 * Convert BlockNote blocks to plain text
 * Used for extracting prompt text from templates stored in blocknote format
 */
function blocksToText(blocks: unknown[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const b = block as { type?: string; content?: unknown[] };
    if (b.content && Array.isArray(b.content)) {
      const lineText: string[] = [];
      for (const item of b.content) {
        const i = item as { type?: string; text?: string };
        if (i.type === "text" && i.text) {
          lineText.push(i.text);
        }
      }
      lines.push(lineText.join(""));
    } else {
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Get prompt text from template, handling both text and blocknote formats
 */
function getTemplatePromptText(template: WikiTemplate): string {
  if (template.prompt_format === "blocknote") {
    try {
      const blocks = JSON.parse(template.prompt);
      return blocksToText(blocks);
    } catch {
      // Fallback to raw prompt if JSON parsing fails
      return template.prompt;
    }
  }
  // Legacy text format
  return template.prompt;
}

import "@blocknote/core/fonts/inter.css";
import "@blocknote/xl-ai/style.css";

// Inline AI menu configuration - appears attached to block instead of floating
const inlineAIMenuOptions: FloatingUIOptions = {
  useFloatingOptions: {
    placement: "bottom-start",
    middleware: [
      offset(0),
      size({
        apply({ rects, elements }) {
          const width =
            rects.reference.width > 0 ? `${rects.reference.width}px` : "100%";
          Object.assign(elements.floating.style, {
            width,
            minWidth: "300px",
          });
        },
      }),
    ],
  },
  elementProps: {
    style: {
      zIndex: 100,
      boxShadow: "none",
      borderRadius: 0,
      borderTop: "1px solid var(--bn-colors-border)",
    },
  },
};

// Generate a random user color
const generateUserColor = () => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B788",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Generate a random user name
const generateUserName = () => {
  const adjectives = ["Happy", "Swift", "Bright", "Clever", "Gentle"];
  const nouns = ["Panda", "Fox", "Eagle", "Dolphin", "Tiger"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

interface WikiEditorProps {
  /** The page being edited */
  page: WikiPage;
  /** Callback when a wiki link is clicked */
  onLinkClick: (event: WikiLinkClickEvent) => void;
  /** Check if a page exists (for link styling) */
  pageExists: (path: string) => boolean;
  /** Panel ID for link click events */
  panelId: string;
  /** Whether this panel is active */
  isActive?: boolean;
  /** Available templates for slash commands */
  templates?: WikiTemplate[];
  /** All wiki pages for mention search */
  pages: Map<string, WikiPage>;
  /** Create a new page (for daily notes) */
  onCreatePage?: (path: string) => WikiPage;
}

export function WikiEditor({
  page,
  onLinkClick,
  pageExists,
  panelId,
  isActive = false,
  templates = [],
  pages,
  onCreatePage,
}: WikiEditorProps) {
  const { resolvedTheme } = useTheme();
  const doc = useYDoc();
  const ysweetProvider = useYjsProvider();
  const awareness = ysweetProvider?.awareness || null;
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const isEditorMountedRef = useRef(false);
  const editorRegistry = useWikiEditorRegistry();
  const wikiAIContext = useWikiAIContext();
  const wikiAIScratch = useWikiAIScratch();

  // State for [[ bracket menu
  const [bracketMenuState, setBracketMenuState] = useState<{
    query: string;
    position: { top: number; left: number };
    isAbsoluteMode: boolean;
  } | null>(null);

  // State for # hash menu
  const [hashMenuState, setHashMenuState] = useState<{
    query: string;
    position: { top: number; left: number };
    isAbsoluteMode: boolean;
  } | null>(null);

  // Create Yjs fragment for this page
  const fragment = useMemo(() => {
    if (!doc) return null;
    return doc.getXmlFragment(`wiki-page-${page.id}`);
  }, [doc, page.id]);

  // Centralized file upload with RLS-compliant paths
  // Uses wiki_id directly as it's already a valid content UUID
  const { uploadFile } = useStorageUpload({
    contentId: page.wiki_id,
  });

  // Create BlockNote editor with wiki schema and AI
  const editor = useCreateBlockNote(
    fragment
      ? {
          schema: wikiSchema,
          collaboration: {
            provider: ysweetProvider,
            fragment: fragment,
            user: {
              name: userName,
              color: userColor,
            },
          },
          uploadFile: uploadFile,
          extensions: [
            AIExtension({
              transport: new DefaultChatTransport({
                api: "/api/blocknote-ai",
              }),
              streamToolsProvider:
                aiDocumentFormats.html.getStreamToolsProvider({
                  withDelays: false,
                }),
            }),
          ],
          dictionary: {
            ...en,
            ai: aiEn,
          },
        }
      : { schema: wikiSchema },
    [fragment, ysweetProvider, userName, userColor, uploadFile],
  );

  // Track AI status for cancel FAB
  const { isAIActive, cancel: cancelAI } = useBlockNoteAIStatus(editor);

  // Generate a unique ID that changes when editor is recreated
  // Used as key prop on BlockNoteView to force clean remount during provider transitions
  const editorId = useMemo(() => Math.random().toString(36).slice(2), [editor]);

  // Register editor with registry for serialization during publish
  // Content is stored in Y.js only - no database save on unmount
  useEffect(() => {
    if (!editor || !editorRegistry) return;

    editorRegistry.registerEditor(page.id, editor);

    return () => {
      editorRegistry.unregisterEditor(page.id);
    };
  }, [editor, editorRegistry, page.id]);

  // Track when editor view is ready (prevents "posAtDOM" errors on early clicks)
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

  // Handle click events on wiki links
  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check for wiki link click
      const wikiLink = target.closest("[data-wiki-link]");
      if (wikiLink) {
        event.preventDefault();
        event.stopPropagation();

        const pagePath = wikiLink.getAttribute("data-page-path");
        if (pagePath) {
          // Resolve relative path from current page
          const resolvedPath = resolvePath(page.path, pagePath);

          onLinkClick({
            path: resolvedPath,
            mouse_event: event,
            source_panel_id: panelId,
          });
        }
        return;
      }

      // Check for regular link click (markdown style)
      const link = target.closest("a");
      if (link) {
        const href = link.getAttribute("href");
        if (href && !href.startsWith("http") && !href.startsWith("mailto:")) {
          event.preventDefault();
          event.stopPropagation();

          // Resolve relative path from current page
          const resolvedPath = resolvePath(page.path, href);

          onLinkClick({
            path: resolvedPath,
            mouse_event: event,
            source_panel_id: panelId,
          });
        }
      }
    };

    containerRef.current.addEventListener("click", handleClick);

    return () => {
      containerRef.current?.removeEventListener("click", handleClick);
    };
  }, [page.path, panelId, onLinkClick]);

  // Handle text input for wiki link syntax [[...]]
  // Converts [[link]] to clickable inline content when space/enter is pressed
  useEffect(() => {
    if (!editor) return;

    const handleTextChange = () => {
      // Guard: Don't access editor methods until view is ready
      if (!isEditorMountedRef.current) return;

      // Get current text block
      const selection = editor.getTextCursorPosition();
      if (!selection?.block) return;

      const block = selection.block;
      if (block.type !== "paragraph" && block.type !== "heading") return;

      // Check if the text contains a completed wiki link pattern followed by space/newline
      const content = block.content;
      if (!Array.isArray(content)) return;

      // Find text content with wiki link pattern followed by space or newline
      for (let i = 0; i < content.length; i++) {
        const item = content[i] as {
          type?: string;
          text?: string;
          styles?: Record<string, unknown>;
        };
        if (item.type === "text" && item.text) {
          // Match [[link]] or [[link|display]] followed by space or at end of text
          const match = item.text.match(
            /\[\[([^\]|]+)(?:\|([^\]]+))?\]\](\s|$)/,
          );
          if (match) {
            const target = match[1].trim();
            const displayText = match[2]?.trim();
            const trailingChar = match[3] || "";
            const matchStart = match.index!;
            const matchEnd = matchStart + match[0].length;

            const exists = pageExists(target);
            const beforeText = item.text.substring(0, matchStart);
            const afterText = item.text.substring(matchEnd);

            // Build new content array
            const newContent: Array<unknown> = [];

            // Add content items before the matched text item
            for (let j = 0; j < i; j++) {
              newContent.push(content[j]);
            }

            // Add text before the wiki link (if any)
            if (beforeText) {
              newContent.push({
                type: "text",
                text: beforeText,
                styles: item.styles || {},
              });
            }

            // Add the wiki link inline content
            newContent.push({
              type: "wikiLink",
              props: {
                page_path: target,
                display_text: displayText || "",
                exists,
              },
            });

            // Add trailing space/text after the wiki link
            const remainingText = trailingChar + afterText;
            if (remainingText) {
              newContent.push({
                type: "text",
                text: remainingText,
                styles: item.styles || {},
              });
            }

            // Add content items after the matched text item
            for (let j = i + 1; j < content.length; j++) {
              newContent.push(content[j]);
            }

            // Update the block with new content
            editor.updateBlock(block, {
              content: newContent as typeof block.content,
            });
            return; // Only process one wiki link per change
          }
        }
      }
    };

    // Listen for changes (debounced)
    let timeout: NodeJS.Timeout;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleTextChange, 100);
    };

    editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeout);
    };
  }, [editor, pageExists]);

  // Handle paste events to auto-convert YouTube URLs to embeds
  useEffect(() => {
    if (!containerRef.current || !editor) return;

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;

      // Check if pasted text is a YouTube URL
      if (isYouTubeUrl(text)) {
        const videoId = extractYouTubeId(text);
        if (videoId) {
          event.preventDefault();
          const cursor = editor.getTextCursorPosition();
          editor.insertBlocks(
            [
              {
                type: "youtube",
                props: { video_id: videoId, title: "YouTube video" },
              },
            ],
            cursor.block,
            "after",
          );
        }
      }
    };

    containerRef.current.addEventListener("paste", handlePaste);

    return () => {
      containerRef.current?.removeEventListener("paste", handlePaste);
    };
  }, [editor]);

  // Detect [[ pattern for bracket menu
  useEffect(() => {
    if (!editor) return;

    const handleBracketDetection = () => {
      if (!isEditorMountedRef.current) return;

      const selection = editor.getTextCursorPosition();
      if (!selection?.block) {
        setBracketMenuState(null);
        return;
      }

      const block = selection.block;
      if (block.type !== "paragraph" && block.type !== "heading") {
        setBracketMenuState(null);
        return;
      }

      const content = block.content;
      if (!Array.isArray(content)) {
        setBracketMenuState(null);
        return;
      }

      // Find text with [[ but no closing ]]
      for (const item of content) {
        const textItem = item as { type?: string; text?: string };
        if (textItem.type === "text" && textItem.text) {
          // Match [[ followed by non-] chars at end of text (no closing ]])
          const match = textItem.text.match(/\[\[([^\]]*?)$/);
          if (match) {
            const query = match[1];
            // Detect absolute mode: query starts with /
            const isAbsoluteMode = query.startsWith("/");
            // Get cursor position for dropdown placement
            try {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                // Validate rect - collapsed ranges can return zero values
                if (rect.bottom > 0 && rect.left >= 0) {
                  setBracketMenuState({
                    query,
                    position: { top: rect.bottom + 4, left: rect.left },
                    isAbsoluteMode,
                  });
                }
                // If rect is invalid, skip this frame - next onChange will retry
                return;
              }
            } catch {
              // Selection not available, skip this frame
              return;
            }
          }
        }
      }
      setBracketMenuState(null);
    };

    let timeout: NodeJS.Timeout;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleBracketDetection, 50);
    };

    editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeout);
    };
  }, [editor]);

  // Detect # pattern for hash menu
  useEffect(() => {
    if (!editor) return;

    const handleHashDetection = () => {
      if (!isEditorMountedRef.current) return;

      const selection = editor.getTextCursorPosition();
      if (!selection?.block) {
        setHashMenuState(null);
        return;
      }

      const block = selection.block;
      if (block.type !== "paragraph" && block.type !== "heading") {
        setHashMenuState(null);
        return;
      }

      const content = block.content;
      if (!Array.isArray(content)) {
        setHashMenuState(null);
        return;
      }

      // Find text with # followed by non-whitespace chars at end
      for (const item of content) {
        const textItem = item as { type?: string; text?: string };
        if (textItem.type === "text" && textItem.text) {
          // Match # followed by any non-whitespace chars at end of text
          const match = textItem.text.match(/#([^\s]*)$/);
          if (match) {
            const query = match[1];
            // Detect absolute mode: query starts with /
            const isAbsoluteMode = query.startsWith("/");
            // Get cursor position for dropdown placement
            try {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                // Validate rect - collapsed ranges can return zero values
                if (rect.bottom > 0 && rect.left >= 0) {
                  setHashMenuState({
                    query,
                    position: { top: rect.bottom + 4, left: rect.left },
                    isAbsoluteMode,
                  });
                }
                // If rect is invalid, skip this frame - next onChange will retry
                return;
              }
            } catch {
              // Selection not available, skip this frame
              return;
            }
          }
        }
      }
      setHashMenuState(null);
    };

    let timeout: NodeJS.Timeout;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleHashDetection, 50);
    };

    editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeout);
    };
  }, [editor]);

  // Handle bracket menu selection - replace [[query with wikiLink
  const handleBracketMenuSelect = useCallback(
    (selectedPath: string, exists: boolean) => {
      if (!editor || !bracketMenuState) return;

      const selection = editor.getTextCursorPosition();
      if (!selection?.block) return;

      const block = selection.block;
      const content = block.content;
      if (!Array.isArray(content)) return;

      // Find and replace [[query with wikiLink
      for (let i = 0; i < content.length; i++) {
        const item = content[i] as {
          type?: string;
          text?: string;
          styles?: Record<string, unknown>;
        };
        if (item.type === "text" && item.text) {
          const match = item.text.match(/\[\[([^\]]*?)$/);
          if (match) {
            const matchStart = match.index!;
            const beforeText = item.text.substring(0, matchStart);

            // Build new content array
            const newContent: Array<unknown> = [];

            // Add content items before the matched text item
            for (let j = 0; j < i; j++) {
              newContent.push(content[j]);
            }

            // Add text before the [[
            if (beforeText) {
              newContent.push({
                type: "text",
                text: beforeText,
                styles: item.styles || {},
              });
            }

            // Add the wiki link inline content
            newContent.push({
              type: "wikiLink",
              props: {
                page_path: selectedPath,
                display_text: "",
                exists,
              },
            });

            // Add trailing space
            newContent.push({
              type: "text",
              text: " ",
              styles: {},
            });

            // Add content items after the matched text item
            for (let j = i + 1; j < content.length; j++) {
              newContent.push(content[j]);
            }

            // Update the block with new content
            editor.updateBlock(block, {
              content: newContent as typeof block.content,
            });
            break;
          }
        }
      }

      setBracketMenuState(null);
    },
    [editor, bracketMenuState],
  );

  // Handle hash menu selection - replace #query with wikiLink
  const handleHashMenuSelect = useCallback(
    (selectedPath: string, exists: boolean) => {
      if (!editor || !hashMenuState) return;

      const selection = editor.getTextCursorPosition();
      if (!selection?.block) return;

      const block = selection.block;
      const content = block.content;
      if (!Array.isArray(content)) return;

      // Find and replace #query with wikiLink
      for (let i = 0; i < content.length; i++) {
        const item = content[i] as {
          type?: string;
          text?: string;
          styles?: Record<string, unknown>;
        };
        if (item.type === "text" && item.text) {
          const match = item.text.match(/#([^\s]*)$/);
          if (match) {
            const matchStart = match.index!;
            const beforeText = item.text.substring(0, matchStart);

            // Build new content array
            const newContent: Array<unknown> = [];

            // Add content items before the matched text item
            for (let j = 0; j < i; j++) {
              newContent.push(content[j]);
            }

            // Add text before the #
            if (beforeText) {
              newContent.push({
                type: "text",
                text: beforeText,
                styles: item.styles || {},
              });
            }

            // Add the wiki link inline content
            newContent.push({
              type: "wikiLink",
              props: {
                page_path: selectedPath,
                display_text: "",
                exists,
              },
            });

            // Add trailing space
            newContent.push({
              type: "text",
              text: " ",
              styles: {},
            });

            // Add content items after the matched text item
            for (let j = i + 1; j < content.length; j++) {
              newContent.push(content[j]);
            }

            // Update the block with new content
            editor.updateBlock(block, {
              content: newContent as typeof block.content,
            });
            break;
          }
        }
      }

      setHashMenuState(null);
    },
    [editor, hashMenuState],
  );

  // Helper to get currently selected text in the editor
  const getSelectedText = useCallback(() => {
    // Use DOM selection - works across BlockNote/TipTap
    const selection = window.getSelection();
    return selection?.toString().trim() || "";
  }, []);

  // Keyboard shortcut: Cmd+J or Ctrl+J to open AI scratch panel
  useEffect(() => {
    if (!editor || !isEditorMounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        const selectedText = getSelectedText();
        wikiAIScratch?.openAIScratchPanel(selectedText);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, isEditorMounted, wikiAIScratch, getSelectedText]);

  // Insert daily template for newly created daily pages
  useEffect(() => {
    if (!editor || !isEditorMounted) return;

    // Check if this is a daily page
    if (!page.path.startsWith("daily/")) return;

    // Check if the page is empty (newly created)
    const blocks = editor.document;
    const isEmpty =
      blocks.length === 0 ||
      (blocks.length === 1 &&
        blocks[0].type === "paragraph" &&
        (!blocks[0].content ||
          (Array.isArray(blocks[0].content) && blocks[0].content.length === 0)));

    if (!isEmpty) return;

    // Extract date from path (daily/YYYY-MM-DD)
    const datePart = page.path.replace("daily/", "");
    const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return;

    const [, year, month, day] = dateMatch;
    const pageDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    const quote = getDailyQuote(pageDate);

    // Insert daily template
    editor.replaceBlocks(editor.document, [
      {
        type: "paragraph",
        content: `"${quote.text}" — ${quote.author}`,
      },
      {
        type: "paragraph",
        content: "",
      },
      {
        type: "heading",
        props: { level: 3 },
        content: "Tasks",
      },
      {
        type: "bulletListItem",
        content: "",
      },
      {
        type: "heading",
        props: { level: 3 },
        content: "Notes",
      },
      {
        type: "paragraph",
        content: "",
      },
    ]);
  }, [editor, isEditorMounted, page.path]);

  if (!fragment || !isEditorMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-muted-foreground">Loading editor...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col ${isActive ? "ring-1 ring-blue-500/30" : ""}`}
      style={{ pointerEvents: isEditorMounted ? "auto" : "none" }}
    >
      <WikiPageExistsContext.Provider value={pageExists}>
        <div className="flex-1 overflow-y-auto pb-32">
          <BlockNoteView
            key={editorId}
            editor={editor}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            className="h-full"
            formattingToolbar={false}
            slashMenu={false}
          >
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
                // Suppress slash menu when wiki link menu is active
                if (bracketMenuState || hashMenuState) {
                  return [];
                }

                // Build template menu items
                const templateItems = templates.map((template) => ({
                  key: `template-${template.id}`,
                  title: template.name,
                  onItemClick: async () => {
                    const ai = editor.getExtension(AIExtension);
                    if (!ai) {
                      console.error("AI extension not available");
                      return;
                    }
                    // Get prompt text (handles both text and blocknote formats)
                    const promptText = getTemplatePromptText(template);
                    // Replace template variables with page context
                    let contextualPrompt = promptText
                      .replace(/\{\{page_title\}\}/g, page.title)
                      .replace(/\{\{page_path\}\}/g, page.path);

                    // Replace {{selection}} if include_selection is enabled
                    if (template.include_selection) {
                      const selectedText = getSelectedText();
                      contextualPrompt = contextualPrompt.replace(
                        /\{\{selection\}\}/g,
                        selectedText || "[No text selected]"
                      );
                    }

                    // Add wiki context from selected panels
                    if (wikiAIContext) {
                      const wikiContextMarkdown =
                        await wikiAIContext.getSelectedAIContextMarkdown();
                      if (wikiContextMarkdown) {
                        contextualPrompt = `## Reference Context from Selected Wiki Pages\n\n${wikiContextMarkdown}\n\n---\n\n## Your Task\n\n${contextualPrompt}`;
                      }
                    }

                    // Open AI menu at current block to enable state tracking
                    const cursor = editor.getTextCursorPosition();
                    if (cursor?.block?.id) {
                      ai.openAIMenuAtBlock(cursor.block.id);
                    }

                    // Invoke AI with template prompt
                    ai.invokeAI({
                      userPrompt: contextualPrompt,
                    });
                  },
                  aliases: template.aliases || [template.name.toLowerCase()],
                  group: "Templates",
                  icon: <Sparkles className="w-4 h-4" />,
                  subtext:
                    template.description || `Use ${template.name} template`,
                }));

                // YouTube embed menu item
                const youtubeItem = {
                  key: "youtube",
                  title: "YouTube",
                  onItemClick: () => {
                    const url = prompt("Enter YouTube URL:");
                    if (!url) return;
                    const videoId = extractYouTubeId(url);
                    if (videoId) {
                      const cursor = editor.getTextCursorPosition();
                      editor.insertBlocks(
                        [
                          {
                            type: "youtube",
                            props: {
                              video_id: videoId,
                              title: "YouTube video",
                            },
                          },
                        ],
                        cursor.block,
                        "after",
                      );
                    } else {
                      alert("Invalid YouTube URL");
                    }
                  },
                  aliases: ["video", "embed", "yt"],
                  group: "Embeds",
                  icon: <Youtube className="w-4 h-4" />,
                  subtext: "Embed a YouTube video",
                };

                // AI Scratch panel item (replaces inline AI prompt)
                const aiScratchItem = {
                  key: "ai-scratch",
                  title: "Ask AI",
                  onItemClick: () => {
                    const selectedText = getSelectedText();
                    wikiAIScratch?.openAIScratchPanel(selectedText);
                  },
                  aliases: ["ai", "prompt", "ask", "generate", "scratch"],
                  group: "Tools",
                  icon: <Sparkles className="w-4 h-4" />,
                  subtext: "Open AI scratch panel",
                };

                // Daily note menu item
                const dailyNoteItem = {
                  key: "daily-note",
                  title: "Daily Note",
                  onItemClick: () => {
                    const todayPath = getTodayPath();

                    // Navigate to today's daily page
                    // WikiPanel's handleLinkClick will create the page if it doesn't exist
                    onLinkClick({
                      path: todayPath,
                      mouse_event: new MouseEvent("click"),
                      source_panel_id: panelId,
                    });
                  },
                  aliases: ["today", "journal", "note"],
                  group: "Pages",
                  icon: <Calendar className="w-4 h-4" />,
                  subtext: "Open or create today's daily note",
                };

                return [
                  ...getDefaultReactSlashMenuItems(editor),
                  // Note: getAISlashMenuItems removed - using custom AI scratch panel instead
                  ...templateItems,
                  youtubeItem,
                  aiScratchItem,
                  dailyNoteItem,
                ].filter((item) => {
                  const queryLower = query.toLowerCase();
                  const titleMatch = item.title
                    .toLowerCase()
                    .includes(queryLower);
                  const aliasMatch = item.aliases?.some((alias: string) =>
                    alias.toLowerCase().includes(queryLower),
                  );
                  return titleMatch || aliasMatch;
                });
              }}
            />
            <AIMenuController />
          </BlockNoteView>
        </div>
      </WikiPageExistsContext.Provider>

      {/* Bracket [[ mention menu */}
      {bracketMenuState && (
        <WikiPageMentionMenu
          pages={pages}
          query={bracketMenuState.query}
          position={bracketMenuState.position}
          onSelect={handleBracketMenuSelect}
          onClose={() => setBracketMenuState(null)}
          currentPagePath={page.path}
          isAbsoluteMode={bracketMenuState.isAbsoluteMode}
        />
      )}

      {/* Hash # mention menu */}
      {hashMenuState && (
        <WikiPageMentionMenu
          pages={pages}
          query={hashMenuState.query}
          position={hashMenuState.position}
          onSelect={handleHashMenuSelect}
          onClose={() => setHashMenuState(null)}
          currentPagePath={page.path}
          isAbsoluteMode={hashMenuState.isAbsoluteMode}
        />
      )}

      {/* AI Cancel FAB - shows when AI inference is in progress */}
      <WikiAICancelFAB isVisible={isAIActive} onCancel={cancelAI} />
    </div>
  );
}
