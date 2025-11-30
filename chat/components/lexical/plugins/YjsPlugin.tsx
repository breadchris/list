"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { useYjsProvider } from "@y-sweet/react";
import {
  createBinding,
  syncCursorPositions,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
  type Provider,
} from "@lexical/yjs";
import * as Y from "yjs";

// Create a minimal provider adapter for Y-Sweet
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

export function YjsPlugin({
  userName,
  userColor,
}: {
  userName: string;
  userColor: string;
}) {
  const [editor] = useLexicalComposerContext();
  const ysweetProvider = useYjsProvider();

  useEffect(() => {
    const awareness = ysweetProvider?.awareness;
    const doc = awareness?.doc;

    if (!editor || !doc || !awareness) {
      return;
    }

    // Set user awareness data
    awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      focusing: true,
    });

    // Create provider adapter
    const provider = createYSweetProviderAdapter(awareness);

    // Create document map
    const docMap = new Map<string, Y.Doc>();
    docMap.set("main", doc);

    // Create binding between Lexical and Yjs
    const binding = createBinding(editor, provider, "main", doc, docMap);

    // Sync Lexical updates to Yjs - register update listener
    const removeUpdateListener = editor.registerUpdateListener(
      ({
        editorState,
        prevEditorState,
        dirtyElements,
        dirtyLeaves,
        normalizedNodes,
        tags,
      }) => {
        // Skip updates tagged with 'skip-collab' to avoid circular updates
        if (tags.has("skip-collab")) {
          return;
        }

        syncLexicalUpdateToYjs(
          binding,
          provider,
          prevEditorState,
          editorState,
          dirtyElements,
          dirtyLeaves,
          normalizedNodes,
          tags
        );
      }
    );

    // Sync Yjs changes to Lexical - observe Yjs document
    const onYjsChange = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      const isFromUndoManager = transaction.origin instanceof Y.UndoManager;
      syncYjsChangesToLexical(binding, provider, events, isFromUndoManager);
    };

    binding.root.getSharedType().observeDeep(onYjsChange);

    // Sync cursor positions
    syncCursorPositions(binding, provider);

    // Cleanup
    return () => {
      removeUpdateListener();
      binding.root.getSharedType().unobserveDeep(onYjsChange);
    };
  }, [editor, ysweetProvider, userName, userColor]);

  return null;
}
