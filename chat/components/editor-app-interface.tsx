"use client";

import { useEffect, useState, useMemo } from "react";
import { normalizeNodeId } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useYjsProvider } from "@y-sweet/react";
import { YjsPlugin } from "@platejs/yjs/react";
import { YjsEditor } from "@slate-yjs/core";
import * as Y from "yjs";

import { BasicBlocksKit } from "@/components/editor/plugins/basic-blocks-kit";
import { BasicMarksKit } from "@/components/editor/plugins/basic-marks-kit";
import { ListKit } from "@/components/editor/plugins/list-kit";
import { CollaborationKit } from "@/components/editor/plugins/collaboration-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { YSweetProviderWrapper } from "@/components/editor/ysweet-provider-wrapper";

// Initial empty document
const initialValue = normalizeNodeId([
  {
    type: "p",
    children: [{ text: "" }],
  },
]);

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

// Generate a random user name (you may want to replace this with actual user data)
const generateUserName = () => {
  const adjectives = ["Happy", "Swift", "Bright", "Clever", "Gentle"];
  const nouns = ["Panda", "Fox", "Eagle", "Dolphin", "Tiger"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export function EditorAppInterface() {
  const ysweetProvider = useYjsProvider();
  const [userName] = useState(() => generateUserName());
  const [userColor] = useState(() => generateUserColor());
  const [isInitialized, setIsInitialized] = useState(false);

  // Get doc and awareness from the Y-Sweet provider's own instances
  // This ensures we use the exact same object references
  const awareness = ysweetProvider?.awareness;
  const doc = awareness?.doc;

  // Create shared type for editor content
  const sharedType = useMemo(() => {
    if (!doc) return null;
    return doc.get("content", Y.XmlText);
  }, [doc]);

  // Wrap Y-Sweet provider to match Plate.js UnifiedProvider interface
  const wrappedProvider = useMemo(() => {
    if (!ysweetProvider) return null;
    return new YSweetProviderWrapper(ysweetProvider);
  }, [ysweetProvider]);

  // Set awareness cursor data
  useEffect(() => {
    if (!awareness) return;

    awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
    });
  }, [awareness, userName, userColor]);

  const editor = usePlateEditor(
    {
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
              awareness: awareness,
              sharedType: sharedType,
              providers: wrappedProvider ? [wrappedProvider] : [],
            },
          },
        },
      },
      skipInitialization: true,
    },
    [doc, awareness, sharedType, wrappedProvider],
  );

  // Initialize YjsPlugin with Y-Sweet doc
  useEffect(() => {
    if (!editor || !doc || !awareness || !sharedType || !wrappedProvider)
      return;

    // Only initialize once - subsequent mounts reuse the already-initialized editor
    if (isInitialized) return;

    editor.getApi(YjsPlugin).yjs.init({
      autoConnect: false, // Y-Sweet already connected via YDocProvider
      autoSelect: "end",
    });

    setIsInitialized(true);

    // Only destroy on final unmount, not on Strict Mode cleanup
    // This prevents the "already connected" error on remount
    return () => {
      editor.getApi(YjsPlugin).yjs.destroy();
    };
  }, [editor, doc, awareness, sharedType, wrappedProvider, isInitialized]);

  return (
    <div className="h-screen w-full bg-background">
      <Plate editor={editor}>
        <EditorContainer variant="fullWidth">
          <Editor
            variant="fullWidth"
            placeholder="Start typing... Use Tab to indent, Shift+Tab to outdent, Cmd+Alt+1-6 for headings"
            autoFocus
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
