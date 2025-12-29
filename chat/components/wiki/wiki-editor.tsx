"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { DefaultChatTransport } from "ai";
import { RiSparkling2Fill } from "react-icons/ri";
import { Sparkles, Square, Youtube } from "lucide-react";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { wikiSchema } from "./wiki-schema";
import { extractYouTubeId, isYouTubeUrl } from "./youtube-block";
import { useWikiEditorRegistry } from "./wiki-interface";
import { useStorageUpload } from "@/hooks/use-storage-upload";
import type { WikiLinkClickEvent, WikiPage, WikiTemplate } from "@/types/wiki";
import { resolvePath } from "@/lib/wiki/path-utils";

import "@blocknote/shadcn/style.css";

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
}

export function WikiEditor({
  page,
  onLinkClick,
  pageExists,
  panelId,
  isActive = false,
  templates = [],
}: WikiEditorProps) {
  const doc = useYDoc();
  const ysweetProvider = useYjsProvider();
  const awareness = ysweetProvider?.awareness || null;
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const isEditorMountedRef = useRef(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const editorRegistry = useWikiEditorRegistry();

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

  // Create transport with page context headers for AI
  const aiTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/blocknote-ai",
        headers: {
          "X-Wiki-Page-Title": page.title,
          "X-Wiki-Page-Path": page.path,
        },
      }),
    [page.title, page.path],
  );

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
              transport: aiTransport,
            }),
          ],
          dictionary: {
            ...en,
            ai: aiEn,
          },
        }
      : { schema: wikiSchema },
    [fragment, ysweetProvider, userName, userColor, uploadFile, aiTransport],
  );

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

  // Subscribe to AI extension state to track generation status
  useEffect(() => {
    if (!editor) return;
    const ai = editor.getExtension(AIExtension);
    if (!ai) return;

    // Subscribe to AI state changes
    const unsubscribe = ai.store.subscribe(() => {
      const state = ai.store.state;
      const isGenerating =
        state.aiMenuState !== "closed" &&
        (state.aiMenuState.status === "thinking" ||
          state.aiMenuState.status === "ai-writing");
      setIsAIGenerating(isGenerating);
    });

    return unsubscribe;
  }, [editor]);

  // Handler to stop AI generation
  const handleStopAI = useCallback(async () => {
    const ai = editor?.getExtension(AIExtension);
    if (ai) {
      await ai.abort("User cancelled");
    }
  }, [editor]);

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

  if (!fragment || !isEditorMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-neutral-500">Loading editor...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col ${isActive ? "ring-1 ring-blue-500/30" : ""}`}
      style={{ pointerEvents: isEditorMounted ? "auto" : "none" }}
    >
      <BlockNoteView
        key={editorId}
        editor={editor}
        theme="dark"
        className="h-full flex-1 overflow-auto"
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
            const ai = editor.getExtension(AIExtension);
            const draftPageItem = ai
              ? {
                  key: "draft-page",
                  title: "Draft Page",
                  onItemClick: () => {
                    const cursor = editor.getTextCursorPosition();
                    const blockId = cursor.block.id;
                    ai.openAIMenuAtBlock(blockId);
                    // Small delay to ensure menu is open before invoking AI
                    setTimeout(() => {
                      ai.invokeAI({
                        userPrompt: `Write comprehensive content for a wiki page titled "${page.title}". Generate well-structured prose with appropriate headings, paragraphs, and details relevant to the topic. Start directly with the content - do not include the page title as the first heading since it's already displayed.`,
                      });
                    }, 50);
                  },
                  aliases: ["draft", "generate", "write"],
                  group: "AI",
                  icon: <RiSparkling2Fill />,
                  subtext: `Generate content for "${page.title}"`,
                }
              : null;

            // Build template menu items
            const templateItems = ai
              ? templates.map((template) => ({
                  key: `template-${template.id}`,
                  title: template.name,
                  onItemClick: () => {
                    const cursor = editor.getTextCursorPosition();
                    const blockId = cursor.block.id;
                    ai.openAIMenuAtBlock(blockId);
                    // Small delay to ensure menu is open before invoking AI
                    setTimeout(() => {
                      // Get prompt text (handles both text and blocknote formats)
                      const promptText = getTemplatePromptText(template);
                      // Replace template variables with page context
                      const contextualPrompt = promptText
                        .replace(/\{\{page_title\}\}/g, page.title)
                        .replace(/\{\{page_path\}\}/g, page.path);
                      ai.invokeAI({
                        userPrompt: contextualPrompt,
                      });
                    }, 50);
                  },
                  aliases: template.aliases || [template.name.toLowerCase()],
                  group: "Templates",
                  icon: <Sparkles className="w-4 h-4" />,
                  subtext:
                    template.description || `Use ${template.name} template`,
                }))
              : [];

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
                        props: { video_id: videoId, title: "YouTube video" },
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

            return [
              ...getDefaultReactSlashMenuItems(editor),
              ...getAISlashMenuItems(editor),
              ...(draftPageItem ? [draftPageItem] : []),
              ...templateItems,
              youtubeItem,
            ].filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            );
          }}
        />
        <AIMenuController />
      </BlockNoteView>

      {/* Stop AI generation FAB */}
      {isAIGenerating && (
        <button
          onClick={handleStopAI}
          className="fixed bottom-6 right-6 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-30 flex items-center justify-center"
          aria-label="Stop AI generation"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>
      )}
    </div>
  );
}
