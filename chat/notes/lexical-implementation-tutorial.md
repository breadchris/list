# Building a Collaborative Rich Text Editor with Lexical

This tutorial walks through implementing a full-featured collaborative rich text editor using Lexical, Meta's extensible text editor framework.

## Table of Contents

1. [Overview](#overview)
2. [Project Setup](#project-setup)
3. [Basic Editor Setup](#basic-editor-setup)
4. [Theme Configuration](#theme-configuration)
5. [Built-in Plugins](#built-in-plugins)
6. [Custom Plugins](#custom-plugins)
7. [Real-time Collaboration](#real-time-collaboration)
8. [Mentions and Tags](#mentions-and-tags)
9. [Toolbar Implementation](#toolbar-implementation)
10. [Content Input Component](#content-input-component)

## Overview

Lexical is a lightweight, extensible text editor framework from Meta. Key features include:

- **Plugin Architecture**: Extend functionality through composable plugins
- **Command System**: Dispatch and handle commands for all editor actions
- **Node System**: Define custom nodes for different content types
- **React Integration**: First-class React support with `@lexical/react`
- **Collaboration**: Y.js support for real-time editing

## Project Setup

### Install Dependencies

```bash
npm install lexical @lexical/react @lexical/rich-text @lexical/list \
  @lexical/code @lexical/link @lexical/markdown @lexical/selection \
  @lexical/utils @lexical/yjs lexical-beautiful-mentions
```

### Required Dependencies

```json
{
  "dependencies": {
    "lexical": "^0.38.2",
    "@lexical/code": "^0.38.2",
    "@lexical/link": "^0.38.2",
    "@lexical/list": "^0.38.2",
    "@lexical/markdown": "^0.38.2",
    "@lexical/react": "^0.38.2",
    "@lexical/rich-text": "^0.38.2",
    "@lexical/selection": "^0.38.2",
    "@lexical/utils": "^0.38.2",
    "@lexical/yjs": "^0.38.2",
    "lexical-beautiful-mentions": "^0.1.48",
    "yjs": "^13.6.27"
  }
}
```

## Basic Editor Setup

The core of a Lexical editor is the `LexicalComposer`:

```tsx
"use client";

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

import { theme } from "./theme";

export function LexicalEditor() {
  const initialConfig = {
    namespace: "MyEditor",
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
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="editor-input"
              aria-placeholder="Start typing..."
            />
          }
          placeholder={
            <div className="editor-placeholder">
              Start typing... Use # for headings, - for lists
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      </div>
    </LexicalComposer>
  );
}
```

## Theme Configuration

Lexical uses a theme object to apply CSS classes to different elements:

```ts
// theme.ts
import { EditorThemeClasses } from "lexical";

export const theme: EditorThemeClasses = {
  // Root and paragraph styling
  paragraph: "mb-2 text-base",

  // Blockquote styling
  quote: "border-l-4 border-neutral-700 pl-4 italic text-neutral-400 my-4",

  // Heading styles (h1-h6)
  heading: {
    h1: "text-4xl font-bold mb-4 mt-6",
    h2: "text-3xl font-bold mb-3 mt-5",
    h3: "text-2xl font-bold mb-3 mt-4",
    h4: "text-xl font-bold mb-2 mt-3",
    h5: "text-lg font-bold mb-2 mt-2",
    h6: "text-base font-bold mb-2 mt-2",
  },

  // List styling
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "list-decimal list-inside my-2",
    ul: "list-disc list-inside my-2",
    listitem: "ml-4 my-1",
  },

  // Text formatting marks
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "underline line-through",
    code: "bg-neutral-800 text-cyan-400 px-1 py-0.5 rounded font-mono text-sm",
  },

  // Code block
  code: "bg-neutral-900 border border-neutral-800 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto block",

  // Link styling
  link: "text-cyan-400 hover:underline cursor-pointer",
};
```

## Built-in Plugins

Lexical provides several built-in plugins:

### RichTextPlugin

The core plugin that enables rich text editing:

```tsx
<RichTextPlugin
  contentEditable={<ContentEditable className="editor-input" />}
  placeholder={<div className="placeholder">Type something...</div>}
  ErrorBoundary={LexicalErrorBoundary}
/>
```

### HistoryPlugin

Enables undo/redo functionality:

```tsx
<HistoryPlugin />
```

### ListPlugin

Enables ordered and unordered lists:

```tsx
<ListPlugin />
```

### MarkdownShortcutPlugin

Enables markdown shortcuts (# for headings, - for lists, etc.):

```tsx
import { TRANSFORMERS } from "@lexical/markdown";

<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
```

### OnChangePlugin

Listen for editor state changes:

```tsx
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";

<OnChangePlugin
  onChange={(editorState) => {
    editorState.read(() => {
      const text = $getRoot().getTextContent();
      console.log("Content changed:", text);
    });
  }}
/>
```

## Custom Plugins

### Toolbar Plugin

Create a formatting toolbar with state tracking:

```tsx
"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useState } from "react";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from "@lexical/rich-text";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3, Quote, List, ListOrdered } from "lucide-react";

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  // Update toolbar state when selection changes
  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
    }
  }, []);

  // Register selection change listener
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateToolbar]);

  // Format heading function
  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  // Format quote function
  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm px-4 py-2">
      {/* Text formatting buttons */}
      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        active={isBold}
        aria-label="Format Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        active={isItalic}
        aria-label="Format Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        active={isUnderline}
        aria-label="Format Underline"
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
        active={isStrikethrough}
        aria-label="Format Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
        active={isCode}
        aria-label="Format Code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-neutral-800 mx-1" />

      {/* Heading buttons */}
      <ToolbarButton onClick={() => formatHeading("h1")} aria-label="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton onClick={() => formatHeading("h2")} aria-label="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton onClick={() => formatHeading("h3")} aria-label="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton onClick={formatQuote} aria-label="Quote">
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-neutral-800 mx-1" />

      {/* List buttons */}
      <ToolbarButton
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        aria-label="Bulleted List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        aria-label="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

// Reusable toolbar button component
function ToolbarButton({
  onClick,
  active = false,
  children,
  ...props
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded hover:bg-neutral-800 transition-colors ${
        active ? "bg-neutral-800 text-cyan-400" : "text-neutral-400"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### Enter Key Submit Plugin

Custom plugin for submitting content on Enter (Shift+Enter for new line):

```tsx
"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import {
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  CLEAR_EDITOR_COMMAND,
  $getRoot,
} from "lexical";

interface EnterKeySubmitPluginProps {
  onSubmit: (text: string, mentions: string[]) => void;
  disabled?: boolean;
}

export function EnterKeySubmitPlugin({
  onSubmit,
  disabled = false,
}: EnterKeySubmitPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (disabled) return false;

        // Shift+Enter creates new line (default behavior)
        if (event?.shiftKey) {
          return false;
        }

        // Prevent default Enter behavior
        event?.preventDefault();

        // Get content and submit
        editor.getEditorState().read(() => {
          const text = $getRoot().getTextContent().trim();

          if (text) {
            // Extract mentions if using BeautifulMentions
            const mentions: string[] = [];
            // Note: You can traverse nodes to extract BeautifulMentionNode values

            onSubmit(text, mentions);

            // Clear the editor
            editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onSubmit, disabled]);

  // Also register clear command handler
  useEffect(() => {
    return editor.registerCommand(
      CLEAR_EDITOR_COMMAND,
      () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}
```

## Real-time Collaboration

### Collaborative Editor with Y.js

```tsx
"use client";

import { useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { CollaborationPluginV2__EXPERIMENTAL as CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { useYjsProvider } from "@y-sweet/react";
import type { Provider } from "@lexical/yjs";

import { theme } from "./theme";

// Create Y-Sweet provider adapter for Lexical
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

// Generate random user color
const generateUserColor = () => {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Generate random username
const generateUserName = () => {
  const adjectives = ["Happy", "Swift", "Bright", "Clever", "Gentle"];
  const nouns = ["Panda", "Fox", "Eagle", "Dolphin", "Tiger"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export function CollaborativeEditor() {
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const ysweetProvider = useYjsProvider();

  const initialConfig = {
    namespace: "CollaborativeEditor",
    theme,
    onError: (error: Error) => console.error(error),
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode],
    editorState: null, // Let collaboration plugin manage state
  };

  if (!ysweetProvider?.awareness?.doc) {
    return <div>Loading...</div>;
  }

  const doc = ysweetProvider.awareness.doc;
  const provider = createYSweetProviderAdapter(ysweetProvider.awareness);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <LexicalCollaboration>
        <div className="relative h-full flex flex-col">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="h-full w-full max-w-4xl mx-auto px-16 pt-16 pb-72 outline-none"
                style={{ caretColor: userColor }}
              />
            }
            placeholder={
              <div className="placeholder">
                Start typing... Use # for headings, - for lists
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
      </LexicalCollaboration>
    </LexicalComposer>
  );
}
```

## Mentions and Tags

### Using lexical-beautiful-mentions

```tsx
"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { BeautifulMentionsPlugin, BeautifulMentionNode } from "lexical-beautiful-mentions";

interface Tag {
  id: string;
  name: string;
}

interface EditorWithMentionsProps {
  availableTags: Tag[];
  onSubmit: (text: string, mentions: string[]) => void;
}

export function EditorWithMentions({ availableTags, onSubmit }: EditorWithMentionsProps) {
  const initialConfig = {
    namespace: "MentionsEditor",
    nodes: [BeautifulMentionNode],
    theme: {
      root: "lexical-root",
      paragraph: "lexical-paragraph",
      beautifulMentions: {
        "#": "bg-blue-100 text-blue-800 px-1 rounded", // Tag styling
        "@": "bg-green-100 text-green-800 px-1 rounded", // User mention styling
      },
    },
    onError: (error: Error) => console.error("Lexical error:", error),
  };

  // Convert tags to mention items
  const mentionItems = {
    "#": availableTags.map((tag) => tag.name),
    "@": ["Alice", "Bob", "Charlie"], // User mentions
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-md"
              aria-label="Content editor"
            />
          }
          placeholder={
            <div className="placeholder">
              Type # for tags, @ for mentions...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <BeautifulMentionsPlugin
          items={mentionItems}
          menuAnchorClassName="mentions-menu"
        />
      </div>
    </LexicalComposer>
  );
}
```

## Content Input Component

A complete content input component with ref handling:

```tsx
"use client";

import React, { forwardRef, useImperativeHandle } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { BeautifulMentionsPlugin, BeautifulMentionNode } from "lexical-beautiful-mentions";
import { EditorState, $getRoot, CLEAR_EDITOR_COMMAND } from "lexical";
import { EnterKeySubmitPlugin } from "./EnterKeySubmitPlugin";

interface ContentInputProps {
  onSubmit: (text: string, mentions: string[]) => void;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  disabled?: boolean;
  availableTags?: { id: string; name: string }[];
}

export interface ContentInputRef {
  submit: () => void;
  clear: () => void;
}

// Internal component with editor context access
const ContentInputInternal: React.FC<
  ContentInputProps & { innerRef: React.Ref<ContentInputRef> }
> = ({ onSubmit, onChange, placeholder, disabled = false, availableTags = [], innerRef }) => {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(
    innerRef,
    () => ({
      submit: () => {
        editor.getEditorState().read(() => {
          const plainText = $getRoot().getTextContent().trim();
          if (plainText) {
            onSubmit(plainText, []);
          }
        });
      },
      clear: () => {
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
      },
    }),
    [editor, onSubmit]
  );

  const mentionItems = {
    "#": availableTags.map((tag) => tag.name),
  };

  return (
    <div className="relative">
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className="w-full px-3 py-2 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            ariaLabel="Content editor"
            aria-placeholder={placeholder || "Type something..."}
          />
        }
        placeholder={
          <div className="absolute top-2 left-3 text-gray-500 pointer-events-none">
            {placeholder || "Type something..."}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <BeautifulMentionsPlugin items={mentionItems} menuAnchorClassName="mentions-menu" />
      <EnterKeySubmitPlugin onSubmit={onSubmit} disabled={disabled} />
      {onChange && <OnChangePlugin onChange={onChange} />}
    </div>
  );
};

// Exported component with forwardRef
export const ContentInput = forwardRef<ContentInputRef, ContentInputProps>(
  ({ onSubmit, onChange, placeholder, disabled = false, availableTags = [] }, ref) => {
    const initialConfig = {
      namespace: "ContentEditor",
      nodes: [BeautifulMentionNode],
      theme: {
        root: "lexical-root",
        paragraph: "lexical-paragraph",
        beautifulMentions: {
          "#": "bg-blue-100 text-blue-800 px-1 rounded",
        },
      },
      onError: (error: Error) => console.error("Lexical error:", error),
    };

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <ContentInputInternal
          onSubmit={onSubmit}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          availableTags={availableTags}
          innerRef={ref}
        />
      </LexicalComposer>
    );
  }
);

ContentInput.displayName = "ContentInput";
```

### Usage Example

```tsx
import { useRef } from "react";
import { ContentInput, ContentInputRef } from "./ContentInput";

function MyForm() {
  const inputRef = useRef<ContentInputRef>(null);

  const handleSubmit = (text: string, mentions: string[]) => {
    console.log("Submitted:", text);
    console.log("Mentions:", mentions);
    // Clear the editor after submission
    inputRef.current?.clear();
  };

  return (
    <div>
      <ContentInput
        ref={inputRef}
        onSubmit={handleSubmit}
        placeholder="What's on your mind?"
        availableTags={[
          { id: "1", name: "important" },
          { id: "2", name: "todo" },
          { id: "3", name: "idea" },
        ]}
      />
      <button onClick={() => inputRef.current?.submit()}>
        Submit
      </button>
    </div>
  );
}
```

## Key Takeaways

1. **LexicalComposer**: The root component that provides editor context. Configure namespace, theme, nodes, and error handling here.

2. **Plugin System**: Lexical uses a composable plugin system. Add functionality by including plugins as children of LexicalComposer.

3. **Command System**: Use `editor.dispatchCommand()` to trigger actions and `editor.registerCommand()` to handle them.

4. **Node System**: Custom content types (mentions, embeds, etc.) are implemented as custom nodes.

5. **Theming**: Use the theme object to apply CSS classes to different element types. Tailwind CSS works great.

6. **React Hooks**: Access the editor with `useLexicalComposerContext()` inside any component within LexicalComposer.

7. **Collaboration**: Use `@lexical/yjs` with a Y.js provider for real-time collaboration.

8. **Mentions**: `lexical-beautiful-mentions` provides an easy way to add mention functionality with autocomplete.

## Common Patterns

### Reading Editor Content

```tsx
const [editor] = useLexicalComposerContext();

const getText = () => {
  let text = "";
  editor.getEditorState().read(() => {
    text = $getRoot().getTextContent();
  });
  return text;
};
```

### Updating Editor Content

```tsx
const [editor] = useLexicalComposerContext();

editor.update(() => {
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode("New content"));
  root.append(paragraph);
});
```

### Listening to Changes

```tsx
<OnChangePlugin
  onChange={(editorState, editor) => {
    editorState.read(() => {
      const json = editorState.toJSON();
      // Save to database, etc.
    });
  }}
/>
```

## Resources

- [Lexical Documentation](https://lexical.dev)
- [Lexical Playground](https://playground.lexical.dev)
- [lexical-beautiful-mentions](https://github.com/sodenn/lexical-beautiful-mentions)
- [Y.js Documentation](https://docs.yjs.dev)
