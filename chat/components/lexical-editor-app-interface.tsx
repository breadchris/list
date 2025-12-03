"use client";

import { useState, useCallback } from "react";
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
import { useYjsProvider } from "@y-sweet/react";
import * as Y from "yjs";
import type { Provider } from "@lexical/yjs";

import { theme } from "@/components/lexical/theme";

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

export function LexicalEditorAppInterface() {
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const ysweetProvider = useYjsProvider();

  const initialConfig = {
    namespace: "CollaborativeEditor",
    theme,
    onError: (error: Error) => {
      console.error(error);
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
    ],
    editorState: null, // Let collaboration plugin manage state
  };

  if (!ysweetProvider?.awareness?.doc) {
    return <div className="h-screen w-full bg-background flex items-center justify-center text-neutral-600">Loading...</div>;
  }

  const doc = ysweetProvider.awareness.doc;
  const provider = createYSweetProviderAdapter(ysweetProvider.awareness);

  return (
    <div className="h-screen w-full bg-background">
      <LexicalComposer initialConfig={initialConfig}>
        <LexicalCollaboration>
          <div className="relative h-full flex flex-col">
            <div className="flex-1 overflow-auto">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="h-full w-full max-w-4xl mx-auto px-16 pt-16 pb-72 sm:px-24 sm:pt-24 outline-none text-foreground"
                    style={{ caretColor: userColor }}
                  />
                }
                placeholder={
                  <div className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 max-w-4xl w-full px-16 sm:px-24 text-neutral-600 pointer-events-none">
                    Start typing... Use # for headings, - for lists, ` for code
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
              <CollaborationPlugin
                id="yjs-collaboration"
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
  );
}
