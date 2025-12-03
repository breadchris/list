"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { CollaborationPluginV2__EXPERIMENTAL as CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { useYDoc, useYjsProvider } from "@y-sweet/react";
import * as Y from "yjs";
import type { Provider } from "@lexical/yjs";

import { theme } from "@/components/lexical/theme";

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
  tags?: string[];
}

interface EditorPanelProps {
  messageId: string;
  parentMessage?: Message;
  doc: Y.Doc;
  onClose: () => void;
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

// Create a Y-Sweet provider adapter for Lexical
function createYSweetProviderAdapter(awareness: any): Provider {
  return {
    awareness,
    connect: () => {
      // Y-Sweet already manages connection
    },
    disconnect: () => {
      // Y-Sweet already manages disconnection
    },
    on: () => {
      // No-op for Y-Sweet
    },
    off: () => {
      // No-op for Y-Sweet
    },
  };
}

export function EditorPanel({
  messageId,
  parentMessage,
  doc,
  onClose,
}: EditorPanelProps) {
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const ysweetProvider = useYjsProvider();

  if (!doc) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center text-neutral-600">
        Loading...
      </div>
    );
  }

  const initialConfig = {
    namespace: `EditorPanel`,
    theme,
    onError: (error: Error) => {
      console.error(error);
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode],
    editorState: null, // Let collaboration plugin manage state
  };

  if (!doc) {
    return (
      <div className="min-w-full sm:min-w-[400px] w-full sm:w-[400px] h-full flex items-center justify-center bg-neutral-950 border-r border-neutral-800 snap-start">
        <div className="text-neutral-600">Loading editor...</div>
      </div>
    );
  }

  // Use the doc from Y-Sweet provider to ensure provider and doc are connected
  const provider = createYSweetProviderAdapter(ysweetProvider.awareness);

  return (
    <div className="min-w-full sm:min-w-[400px] w-full sm:w-[400px] h-full flex flex-col border-r border-neutral-800 snap-start bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-sm">Lexical Editor</span>
          {parentMessage && (
            <span className="text-neutral-600 text-xs">
              {parentMessage.username}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Parent message context */}
      {parentMessage && (
        <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800">
          <div className="text-neutral-500 text-xs mb-1">Editing message:</div>
          <div className="font-mono text-xs">
            <span className="text-neutral-400">{parentMessage.timestamp}</span>
            <span className="text-neutral-300 mx-2">
              &lt;{parentMessage.username}&gt;
            </span>
            <span className="text-neutral-400 line-clamp-1">
              {parentMessage.content}
            </span>
          </div>
        </div>
      )}
      {/* Lexical Editor */}
      <div className="flex-1 overflow-hidden">
        <LexicalComposer initialConfig={initialConfig}>
          <LexicalCollaboration>
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable
                      className="h-full w-full px-4 py-4 outline-none text-neutral-300 prose prose-invert prose-sm max-w-none"
                      style={{ caretColor: userColor }}
                    />
                  }
                  placeholder={
                    <div className="absolute top-4 left-4 text-neutral-600 text-sm pointer-events-none">
                      Start typing... Use # for headings, - for lists, ` for
                      code
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                <CollaborationPlugin
                  id={`editor-test`}
                  doc={doc}
                  provider={provider}
                  __shouldBootstrapUnsafe={true}
                  username={userName}
                  cursorColor={userColor}
                />
              </div>
            </div>
          </LexicalCollaboration>
        </LexicalComposer>
      </div>
    </div>
  );
}
