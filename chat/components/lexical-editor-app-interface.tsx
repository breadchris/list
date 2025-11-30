"use client";

import { useState } from "react";
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

import { theme } from "@/components/lexical/theme";
import { ToolbarPlugin } from "@/components/lexical/plugins/ToolbarPlugin";
import { YjsPlugin } from "@/components/lexical/plugins/YjsPlugin";

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

export function LexicalEditorAppInterface() {
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());

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

  return (
    <div className="h-screen w-full bg-background">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative h-full flex flex-col">
          <ToolbarPlugin />
          <div className="flex-1 overflow-auto">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="h-full w-full px-16 pt-4 pb-72 sm:px-24 outline-none text-foreground"
                  style={{ caretColor: userColor }}
                />
              }
              placeholder={
                <div className="absolute top-4 left-16 sm:left-24 text-neutral-600 pointer-events-none">
                  Start typing... Use # for headings, - for lists, ` for code
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <YjsPlugin userName={userName} userColor={userColor} />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}
