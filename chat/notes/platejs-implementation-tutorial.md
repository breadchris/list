# Building a Collaborative Rich Text Editor with PlateJS

This tutorial walks through implementing a full-featured collaborative rich text editor using PlateJS, a Slate-based framework with a powerful plugin architecture.

## Table of Contents

1. [Overview](#overview)
2. [Project Setup](#project-setup)
3. [Core Editor Component](#core-editor-component)
4. [Plugin Architecture](#plugin-architecture)
5. [Block Elements](#block-elements)
6. [Text Formatting (Marks)](#text-formatting-marks)
7. [Real-time Collaboration with Y.js](#real-time-collaboration-with-yjs)
8. [Drag and Drop](#drag-and-drop)
9. [Block Selection and Context Menu](#block-selection-and-context-menu)
10. [Complete Example](#complete-example)

## Overview

PlateJS provides a modular, plugin-based architecture for building rich text editors. Key features include:

- **Plugin System**: Compose editor functionality from reusable plugins
- **React Integration**: First-class React support with hooks and components
- **Collaboration**: Built-in Y.js support for real-time editing
- **Customizable**: Every element and leaf can be styled with custom components

## Project Setup

### Install Dependencies

```bash
npm install platejs @platejs/basic-nodes @platejs/list @platejs/indent \
  @platejs/dnd @platejs/selection @platejs/yjs @slate-yjs/react \
  react-dnd react-dnd-html5-backend
```

### Required Dependencies

```json
{
  "dependencies": {
    "platejs": "^52.0.1",
    "@platejs/basic-nodes": "^52.0.1",
    "@platejs/list": "^52.0.1",
    "@platejs/indent": "^52.0.1",
    "@platejs/dnd": "^52.0.1",
    "@platejs/selection": "^52.0.1",
    "@platejs/yjs": "^52.0.3",
    "@slate-yjs/react": "^1.1.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "yjs": "^13.6.27"
  }
}
```

## Core Editor Component

The main editor component uses `usePlateEditor` to configure plugins and `Plate` to render:

```tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { Plate, usePlateEditor } from "platejs/react";
import { YjsPlugin } from "@platejs/yjs/react";
import * as Y from "yjs";

// Import your plugin kits
import { BasicBlocksKit } from "./plugins/basic-blocks-kit";
import { BasicMarksKit } from "./plugins/basic-marks-kit";
import { ListKit } from "./plugins/list-kit";
import { CollaborationKit } from "./plugins/collaboration-kit";
import { Editor, EditorContainer } from "./ui/editor";

interface EditorAppInterfaceProps {
  messageId?: string;
  onClose?: () => void;
}

export function EditorAppInterface({ messageId, onClose }: EditorAppInterfaceProps) {
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());

  // Create Y.js document for collaboration
  const doc = useMemo(() => new Y.Doc(), []);
  const sharedType = useMemo(() => {
    return doc.get(messageId || "content", Y.XmlText);
  }, [doc, messageId]);

  const editor = usePlateEditor({
    plugins: [
      ...CollaborationKit,
      ...BasicBlocksKit,
      ...BasicMarksKit,
      ...ListKit,
    ],
    override: {
      plugins: {
        [YjsPlugin.key]: {
          options: {
            ydoc: doc,
            sharedType: sharedType,
          },
        },
      },
    },
  });

  return (
    <div className="h-screen w-full bg-background">
      <Plate editor={editor}>
        <EditorContainer variant="fullWidth">
          <Editor
            variant="fullWidth"
            placeholder="Start typing..."
            autoFocus
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}

// Helper functions
const generateUserColor = () => {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
  return colors[Math.floor(Math.random() * colors.length)];
};

const generateUserName = () => {
  const adjectives = ["Happy", "Swift", "Bright", "Clever", "Gentle"];
  const nouns = ["Panda", "Fox", "Eagle", "Dolphin", "Tiger"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};
```

## Plugin Architecture

PlateJS uses a kit pattern where plugins are grouped by functionality:

### Basic Blocks Kit

Configure block-level elements (paragraphs, headings, blockquotes):

```tsx
'use client';

import {
  BlockquotePlugin,
  H1Plugin, H2Plugin, H3Plugin, H4Plugin, H5Plugin, H6Plugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react';
import { ParagraphPlugin } from 'platejs/react';

// Import custom components
import { BlockquoteElement } from '@/components/ui/blockquote-node';
import { H1Element, H2Element, H3Element, H4Element, H5Element, H6Element } from '@/components/ui/heading-node';
import { HrElement } from '@/components/ui/hr-node';
import { ParagraphElement } from '@/components/ui/paragraph-node';

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),

  H1Plugin.configure({
    node: { component: H1Element },
    rules: { break: { empty: 'reset' } },
    shortcuts: { toggle: { keys: 'mod+alt+1' } },
  }),

  H2Plugin.configure({
    node: { component: H2Element },
    rules: { break: { empty: 'reset' } },
    shortcuts: { toggle: { keys: 'mod+alt+2' } },
  }),

  H3Plugin.configure({
    node: { component: H3Element },
    rules: { break: { empty: 'reset' } },
    shortcuts: { toggle: { keys: 'mod+alt+3' } },
  }),

  // H4-H6 follow the same pattern...

  BlockquotePlugin.configure({
    node: { component: BlockquoteElement },
    shortcuts: { toggle: { keys: 'mod+shift+period' } },
  }),

  HorizontalRulePlugin.withComponent(HrElement),
];
```

### Basic Marks Kit

Configure inline text formatting (bold, italic, code, etc.):

```tsx
'use client';

import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  HighlightPlugin,
  KbdPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
} from '@platejs/basic-nodes/react';

export const BasicMarksKit = [
  BoldPlugin.configure({
    shortcuts: { toggle: { keys: 'mod+b' } },
  }),

  ItalicPlugin.configure({
    shortcuts: { toggle: { keys: 'mod+i' } },
  }),

  UnderlinePlugin.configure({
    shortcuts: { toggle: { keys: 'mod+u' } },
  }),

  StrikethroughPlugin.configure({
    shortcuts: { toggle: { keys: 'mod+shift+s' } },
  }),

  CodePlugin.configure({
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),

  HighlightPlugin.configure({
    node: { component: HighlightLeaf },
    shortcuts: { toggle: { keys: 'mod+shift+h' } },
  }),

  KbdPlugin.withComponent(KbdLeaf),
  SubscriptPlugin,
  SuperscriptPlugin,
];
```

### List Kit

Configure list functionality:

```tsx
'use client';

import { ListPlugin } from '@platejs/list/react';
import { IndentPlugin } from '@platejs/indent/react';

export const ListKit = [
  ListPlugin,
  IndentPlugin,
];
```

## Block Elements

Create custom React components for block elements:

### Paragraph Element

```tsx
'use client';

import { PlateElement, PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function ParagraphElement({
  className,
  children,
  ...props
}: PlateElementProps) {
  return (
    <PlateElement
      className={cn('m-0 px-0 py-1', className)}
      {...props}
    >
      {children}
    </PlateElement>
  );
}
```

### Heading Elements

```tsx
'use client';

import { PlateElement, PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function H1Element({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      as="h1"
      className={cn('mb-1 mt-[2em] text-4xl font-bold', className)}
      {...props}
    >
      {children}
    </PlateElement>
  );
}

export function H2Element({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      as="h2"
      className={cn('mb-px mt-[1.4em] text-2xl font-semibold', className)}
      {...props}
    >
      {children}
    </PlateElement>
  );
}

// H3-H6 follow the same pattern with different sizes
```

### Blockquote Element

```tsx
'use client';

import { PlateElement, PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function BlockquoteElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      className={cn(
        'my-1 border-l-2 border-muted-foreground/30 pl-6 italic text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </PlateElement>
  );
}
```

## Text Formatting (Marks)

Create leaf components for inline text styles:

### Code Leaf

```tsx
'use client';

import { PlateLeaf, PlateLeafProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function CodeLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      as="code"
      className={cn(
        'whitespace-pre-wrap rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-sm',
        className
      )}
      {...props}
    >
      {children}
    </PlateLeaf>
  );
}
```

### Highlight Leaf

```tsx
'use client';

import { PlateLeaf, PlateLeafProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function HighlightLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      as="mark"
      className={cn('bg-yellow-200 dark:bg-yellow-800/50', className)}
      {...props}
    >
      {children}
    </PlateLeaf>
  );
}
```

## Real-time Collaboration with Y.js

### Collaboration Kit

```tsx
'use client';

import { YjsPlugin } from '@platejs/yjs/react';
import { RemoteCursorOverlay } from '@/components/ui/remote-cursor-overlay';

export const CollaborationKit = [
  YjsPlugin.configure({
    render: {
      afterEditable: RemoteCursorOverlay,
    },
  }),
];
```

### Remote Cursor Overlay

Display other users' cursors in real-time:

```tsx
'use client';

import { useRemoteCursorOverlayPositions } from '@platejs/yjs/react';
import { cn } from '@/lib/utils';

export function RemoteCursorOverlay() {
  const { cursors } = useRemoteCursorOverlayPositions();

  return (
    <>
      {cursors.map((cursor) => (
        <CursorCaret
          key={cursor.clientId}
          data={cursor.data}
          caretPosition={cursor.caretPosition}
          selectionRects={cursor.selectionRects}
        />
      ))}
    </>
  );
}

function CursorCaret({
  data,
  caretPosition,
  selectionRects,
}: {
  data: { name: string; color: string };
  caretPosition?: { left: number; top: number; height: number };
  selectionRects: { left: number; top: number; width: number; height: number }[];
}) {
  if (!caretPosition) return null;

  return (
    <>
      {/* Selection highlights */}
      {selectionRects.map((rect, i) => (
        <div
          key={i}
          className="pointer-events-none absolute opacity-25"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            backgroundColor: data.color,
          }}
        />
      ))}

      {/* Cursor caret */}
      <div
        className="pointer-events-none absolute w-0.5"
        style={{
          left: caretPosition.left,
          top: caretPosition.top,
          height: caretPosition.height,
          backgroundColor: data.color,
        }}
      >
        {/* Username label */}
        <div
          className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white"
          style={{ backgroundColor: data.color }}
        >
          {data.name}
        </div>
      </div>
    </>
  );
}
```

### Y-Sweet Provider Wrapper

Adapt Y-Sweet provider to PlateJS interface:

```tsx
import type { UnifiedProvider } from '@platejs/yjs';

export class YSweetProviderWrapper implements UnifiedProvider {
  private provider: YSweetProvider;
  private _isConnected = false;
  private _isSynced = false;

  constructor(provider: YSweetProvider) {
    this.provider = provider;
    this._isConnected = provider.ws?.readyState === WebSocket.OPEN;
    this._isSynced = provider.synced;

    provider.on('sync', (synced: boolean) => {
      this._isSynced = synced;
    });
  }

  get doc() {
    return this.provider.awareness?.doc;
  }

  get awareness() {
    return this.provider.awareness;
  }

  connect() {
    // Y-Sweet manages connection
    this._isConnected = true;
  }

  disconnect() {
    this._isConnected = false;
  }

  get isConnected() {
    return this._isConnected && this.provider.ws?.readyState === WebSocket.OPEN;
  }

  get isSynced() {
    return this._isSynced;
  }
}
```

## Drag and Drop

### DnD Kit

```tsx
'use client';

import { DndPlugin } from '@platejs/dnd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BlockDraggable } from '@/components/ui/block-draggable';

export const DndKit = [
  DndPlugin.configure({
    render: {
      aboveEditable: ({ children }) => (
        <DndProvider backend={HTML5Backend}>{children}</DndProvider>
      ),
    },
  }),
];
```

### Block Draggable Component

```tsx
'use client';

import { useDraggable } from '@platejs/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BlockDraggable({
  element,
  children,
}: {
  element: any;
  children: React.ReactNode;
}) {
  const { isDragging, handleRef, listeners, attributes } = useDraggable({
    element,
  });

  return (
    <div className={cn('group relative', isDragging && 'opacity-50')}>
      <div
        ref={handleRef}
        className="absolute -left-6 top-0 hidden cursor-grab group-hover:flex"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
```

## Block Selection and Context Menu

### Block Selection Kit

```tsx
'use client';

import { BlockSelectionPlugin } from '@platejs/selection/react';
import { BlockSelection } from '@/components/ui/block-selection';
import { BlockContextMenu } from '@/components/ui/block-context-menu';

export const BlockSelectionKit = [
  BlockSelectionPlugin.configure({
    render: {
      aboveEditable: BlockSelection,
    },
    options: {
      enableContextMenu: true,
    },
  }),
];
```

### Block Context Menu

```tsx
'use client';

import { useBlockSelectionContext } from '@platejs/selection/react';
import * as ContextMenu from '@radix-ui/react-context-menu';

export function BlockContextMenu({ children }: { children: React.ReactNode }) {
  const { selectedIds, clearSelection } = useBlockSelectionContext();

  const handleDelete = () => {
    // Delete selected blocks
    clearSelection();
  };

  const handleDuplicate = () => {
    // Duplicate selected blocks
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] rounded-md bg-popover p-1 shadow-md">
          <ContextMenu.Item
            className="cursor-pointer rounded px-2 py-1 hover:bg-accent"
            onSelect={handleDuplicate}
          >
            Duplicate
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-border" />
          <ContextMenu.Item
            className="cursor-pointer rounded px-2 py-1 text-destructive hover:bg-destructive/10"
            onSelect={handleDelete}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

## Complete Example

Here's how all the pieces come together:

```tsx
// app/editor/page.tsx
"use client";

import { YDocProvider } from "@y-sweet/react";
import { EditorAppInterface } from "@/components/editor-app-interface";

export default function EditorPage() {
  return (
    <YDocProvider
      docId="my-document"
      authEndpoint="/api/y-sweet/auth"
    >
      <EditorAppInterface />
    </YDocProvider>
  );
}
```

### Editor Container and Editor Components

```tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { PlateContainer, PlateContent } from 'platejs/react';
import { cn } from '@/lib/utils';

const editorContainerVariants = cva(
  'relative w-full cursor-text select-text overflow-y-auto caret-primary selection:bg-brand/25',
  {
    variants: {
      variant: {
        default: 'h-full',
        demo: 'h-[650px]',
        fullWidth: 'h-full',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function EditorContainer({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof editorContainerVariants>) {
  return (
    <PlateContainer
      className={cn(editorContainerVariants({ variant }), className)}
      {...props}
    />
  );
}

const editorVariants = cva(
  'relative w-full cursor-text whitespace-pre-wrap rounded-md text-foreground',
  {
    variants: {
      variant: {
        default: 'size-full px-16 pt-4 pb-72 text-base',
        fullWidth: 'size-full px-16 pt-4 pb-72 text-base sm:px-24',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Editor({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof PlateContent> & VariantProps<typeof editorVariants>) {
  return (
    <PlateContent
      className={cn(editorVariants({ variant }), className)}
      disableDefaultStyles
      {...props}
    />
  );
}
```

## Key Takeaways

1. **Plugin Composition**: PlateJS uses a composable plugin system. Group related plugins into "kits" for reusability.

2. **Custom Components**: Every element and leaf can be customized with React components using `withComponent()` or `configure({ node: { component } })`.

3. **Keyboard Shortcuts**: Configure shortcuts directly in plugin configuration with `shortcuts: { toggle: { keys: 'mod+b' } }`.

4. **Collaboration**: Y.js integration is built-in. Use `YjsPlugin` and provide Y.Doc and awareness from your provider.

5. **Styling**: Use `class-variance-authority` (cva) for variant-based styling of editor containers and content.

6. **React 19 Ready**: PlateJS works with React 19 and Next.js App Router with the `"use client"` directive.

## Resources

- [PlateJS Documentation](https://platejs.org)
- [Slate.js Documentation](https://docs.slatejs.org)
- [Y.js Documentation](https://docs.yjs.dev)
- [Y-Sweet Documentation](https://jamsocket.com/y-sweet)
