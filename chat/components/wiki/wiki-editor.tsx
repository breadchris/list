"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
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
import { supabase } from "../SupabaseClient";
import { WikiLinkInlineContent, insertWikiLink } from "./wiki-link-inline";
import type { WikiLinkClickEvent, WikiPage } from "@/types/wiki";
import { parseWikiLink } from "@/lib/wiki/link-parser";
import { normalizePath, resolvePath } from "@/lib/wiki/path-utils";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";

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

// Create schema with wiki link support
const wikiSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLinkInlineContent,
  },
});

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
}

export function WikiEditor({
  page,
  onLinkClick,
  pageExists,
  panelId,
  isActive = false,
}: WikiEditorProps) {
  const ysweetProvider = useYjsProvider();
  const doc = useYDoc();
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const containerRef = useRef<HTMLDivElement>(null);

  // Create Yjs fragment for this page
  const fragment = useMemo(() => {
    if (!doc) return null;
    return doc.getXmlFragment(`wiki-page-${page.id}`);
  }, [doc, page.id]);

  // Upload file to Supabase storage
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const folder = `wiki-${page.wiki_id}/${page.id}`;
      const filePath = `${folder}/${timestamp}-${sanitizedName}`;

      const { error } = await supabase.storage
        .from("content")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload failed:", error);
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from("content")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    [page.wiki_id, page.id]
  );

  // Create BlockNote editor with wiki schema
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
        }
      : { schema: wikiSchema },
    [fragment, ysweetProvider, userName, userColor, uploadFile]
  );

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
  useEffect(() => {
    if (!editor) return;

    const handleTextChange = () => {
      // Get current text block
      const selection = editor.getTextCursorPosition();
      if (!selection?.block) return;

      const block = selection.block;
      if (block.type !== "paragraph" && block.type !== "heading") return;

      // Check if the text contains a completed wiki link pattern
      const content = block.content;
      if (!Array.isArray(content)) return;

      // Find text content
      for (let i = 0; i < content.length; i++) {
        const item = content[i] as { type?: string; text?: string };
        if (item.type === "text" && item.text) {
          const match = item.text.match(/\[\[([^\]]+)\]\]/);
          if (match) {
            const parsed = parseWikiLink(match[0]);
            if (parsed) {
              const exists = pageExists(parsed.target);

              // Replace text with wiki link inline content
              // This is a simplified approach - full implementation would
              // need to handle cursor position and text replacement
              console.log("Detected wiki link:", parsed, "exists:", exists);
            }
          }
        }
      }
    };

    // Listen for changes (debounced)
    let timeout: NodeJS.Timeout;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleTextChange, 300);
    };

    editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeout);
    };
  }, [editor, pageExists]);

  if (!fragment) {
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
    >
      <BlockNoteView
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
              <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
              <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
              <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
              <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
              <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
              <ColorStyleButton key="colorStyleButton" />
              <NestBlockButton key="nestBlockButton" />
              <UnnestBlockButton key="unnestBlockButton" />
              <CreateLinkButton key="createLinkButton" />
            </FormattingToolbar>
          )}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            getDefaultReactSlashMenuItems(editor).filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}
