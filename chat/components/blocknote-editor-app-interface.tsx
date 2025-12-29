"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { X, Upload, Check, Loader2, ExternalLink } from "lucide-react";
import { useGlobalGroupOptional } from "./GlobalGroupContext";
import { contentRepository } from "@/lib/list/ContentRepository";
import { useStorageUpload } from "@/hooks/use-storage-upload";

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
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/xl-ai/style.css";

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
  tags?: string[];
}

interface BlockNoteEditorAppInterfaceProps {
  messageId?: string;
  parentMessage?: Message;
  onClose?: () => void;
}

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

export function BlockNoteEditorAppInterface({
  messageId,
  parentMessage,
  onClose,
}: BlockNoteEditorAppInterfaceProps = {}) {
  const ysweetProvider = useYjsProvider();
  const doc = useYDoc();
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());

  // Publish state
  const publishGroupContext = useGlobalGroupOptional();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishedContentId, setPublishedContentId] = useState<string | null>(null);

  // Y.js Map for storing publish metadata (persists content_id across sessions)
  const publishMetaMap = useMemo(() => {
    if (!doc || !messageId) return null;
    return doc.getMap(`publishMeta-${messageId}`);
  }, [doc, messageId]);

  // Load published content_id from Y.js Map
  useEffect(() => {
    if (!publishMetaMap) return;

    const loadContentId = () => {
      const contentId = publishMetaMap.get("content_id") as string | undefined;
      if (contentId) {
        setPublishedContentId(contentId);
      }
    };

    loadContentId();

    // Listen for changes (from other collaborators)
    const observer = () => loadContentId();
    publishMetaMap.observe(observer);
    return () => publishMetaMap.unobserve(observer);
  }, [publishMetaMap]);

  // Determine if we're in panel mode (has messageId and onClose)
  const isPanelMode = Boolean(messageId && onClose);

  // Centralized file upload with RLS-compliant paths
  const { uploadFile } = useStorageUpload({
    contentId: publishedContentId || undefined,
    groupId: publishGroupContext?.selectedGroup?.id,
    onContentCreated: (id) => {
      setPublishedContentId(id);
      // Also persist to Y.js Map for cross-session sync
      publishMetaMap?.set("content_id", id);
    },
  });

  // Handle publish/update content
  const handlePublish = useCallback(async (editor: any) => {
    if (!publishGroupContext?.selectedGroup) {
      alert("Please select a group to publish to in the sidebar.");
      return;
    }

    setIsPublishing(true);
    setPublishSuccess(null);

    try {
      // Get blocks from BlockNote editor
      const blocks = editor.document;
      const data = editor.blocksToMarkdownLossy(blocks);

      // Extract title from first heading or paragraph
      let title = "Untitled";
      for (const block of blocks) {
        if (block.type === "heading" || block.type === "paragraph") {
          const textContent = block.content?.[0]?.text;
          if (textContent) {
            title = textContent.slice(0, 100);
            break;
          }
        }
      }

      if (publishedContentId) {
        // Update existing content
        await contentRepository.updateContent(publishedContentId, {
          data,
          metadata: {
            title,
            source_message_id: messageId,
            updated_at: new Date().toISOString(),
          },
        });
        const publicUrl = `${window.location.origin}/list/public/${publishedContentId}`;
        setPublishSuccess(publicUrl);
      } else {
        // Create new content
        const content = await contentRepository.createContent({
          type: "markdown",
          data,
          group_id: publishGroupContext.selectedGroup.id,
          metadata: {
            title,
            source_message_id: messageId,
          },
        });

        // Mark as public
        await contentRepository.toggleContentSharing(content.id, true);

        // Store content_id in Y.js Map for persistence
        if (publishMetaMap) {
          publishMetaMap.set("content_id", content.id);
        }
        setPublishedContentId(content.id);

        const publicUrl = `${window.location.origin}/list/public/${content.id}`;
        setPublishSuccess(publicUrl);
      }
    } catch (error) {
      console.error("Publish failed:", error);
      alert("Failed to publish. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  }, [publishGroupContext?.selectedGroup, publishedContentId, publishMetaMap, messageId]);

  // Create Yjs fragment for BlockNote collaboration
  const fragment = useMemo(() => {
    if (!doc) return null;
    return doc.getXmlFragment(messageId || "blocknote-content");
  }, [doc, messageId]);

  // Create BlockNote editor with collaboration, file upload, and AI
  const editor = useCreateBlockNote(
    fragment
      ? {
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
            }),
          ],
          dictionary: {
            ...en,
            ai: aiEn,
          },
        }
      : {},
    [fragment, ysweetProvider, userName, userColor, uploadFile]
  );

  // Track when editor view is ready (prevents "posAtDOM" errors on early clicks)
  const [isEditorMounted, setIsEditorMounted] = useState(false);

  useEffect(() => {
    if (!editor) {
      setIsEditorMounted(false);
      return;
    }

    // Check if view is already available
    const tiptapEditor = (editor as unknown as { _tiptapEditor?: { view?: unknown } })._tiptapEditor;
    if (tiptapEditor?.view) {
      setIsEditorMounted(true);
      return;
    }

    // Poll for view availability (TipTap mounts async)
    const checkMount = setInterval(() => {
      const editor_internal = (editor as unknown as { _tiptapEditor?: { view?: unknown } })._tiptapEditor;
      if (editor_internal?.view) {
        setIsEditorMounted(true);
        clearInterval(checkMount);
      }
    }, 10);

    return () => {
      clearInterval(checkMount);
      setIsEditorMounted(false);
    };
  }, [editor]);

  // Don't render until we have a fragment
  if (!fragment) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <span className="text-neutral-500">Loading editor...</span>
      </div>
    );
  }

  // Panel mode layout
  if (isPanelMode) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 text-sm">BlockNote Editor</span>
            {parentMessage && (
              <span className="text-neutral-600 text-xs">
                {parentMessage.username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Published indicator */}
            {publishedContentId && !publishSuccess && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Published
              </span>
            )}

            {/* Success message with link */}
            {publishSuccess && (
              <a
                href={publishSuccess}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            )}

            {/* Publish button */}
            <button
              onClick={() => handlePublish(editor)}
              disabled={isPublishing || !publishGroupContext?.selectedGroup}
              className={`p-1.5 rounded transition-colors ${
                isPublishing
                  ? "text-neutral-500 cursor-not-allowed"
                  : publishedContentId
                    ? "text-green-500 hover:text-green-400"
                    : "text-neutral-500 hover:text-neutral-300"
              }`}
              title={
                !publishGroupContext?.selectedGroup
                  ? "Select a group in the sidebar first"
                  : publishedContentId
                    ? "Update published content"
                    : "Publish to selected group"
              }
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Parent message context */}
        {parentMessage && (
          <div className="px-4 py-2 bg-neutral-900">
            <div className="text-neutral-500 text-xs mb-1">
              Editing message:
            </div>
            <div className="font-mono text-xs">
              <span className="text-neutral-400">
                {parentMessage.timestamp}
              </span>
              <span className="text-neutral-300 mx-2">
                &lt;{parentMessage.username}&gt;
              </span>
              <span className="text-neutral-400 line-clamp-1">
                {parentMessage.content}
              </span>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-auto" style={{ pointerEvents: isEditorMounted ? 'auto' : 'none' }}>
          <BlockNoteView
            editor={editor}
            theme="dark"
            className="h-full"
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
                  <AIToolbarButton key="aiToolbarButton" />
                </FormattingToolbar>
              )}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  ...getAISlashMenuItems(editor),
                ].filter((item) =>
                  item.title.toLowerCase().includes(query.toLowerCase())
                )
              }
            />
            <AIMenuController />
          </BlockNoteView>
        </div>
      </div>
    );
  }

  // Full-screen mode layout
  return (
    <div className="h-screen w-full" style={{ pointerEvents: isEditorMounted ? 'auto' : 'none' }}>
      <BlockNoteView
        editor={editor}
        theme="dark"
        className="h-full"
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
              <AIToolbarButton key="aiToolbarButton" />
            </FormattingToolbar>
          )}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            [
              ...getDefaultReactSlashMenuItems(editor),
              ...getAISlashMenuItems(editor),
            ].filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            )
          }
        />
        <AIMenuController />
      </BlockNoteView>
    </div>
  );
}
