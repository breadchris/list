"use client";

import { useEffect, useRef } from "react";
import { FolderTree, Sparkles, BookOpen, Plus, MessageSquare } from "lucide-react";
import { useSetRailActions } from "@/components/AppSettingsContext";

interface WikiRailActionsProps {
  onToggleSidebar: () => void;
  onToggleTemplatesSidebar: () => void;
  onToggleBookPicker?: () => void;
  onCreateNewPage: () => void;
  onOpenChat: () => void;
}

function WikiRailActionsContent({
  propsRef,
}: {
  propsRef: React.MutableRefObject<WikiRailActionsProps>;
}) {
  const props = propsRef.current;

  return (
    <>
      <button
        onClick={props.onToggleSidebar}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
        title="Browse Pages"
      >
        <FolderTree className="w-4 h-4" />
      </button>
      <button
        onClick={props.onToggleTemplatesSidebar}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
        title="Templates"
      >
        <Sparkles className="w-4 h-4" />
      </button>
      {props.onToggleBookPicker && (
        <button
          onClick={props.onToggleBookPicker}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          title="Open Book"
        >
          <BookOpen className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => props.onOpenChat()}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
        title="AI Chat"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
      <button
        onClick={props.onCreateNewPage}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
        title="New Page"
      >
        <Plus className="w-4 h-4" />
      </button>
    </>
  );
}

/**
 * Registers wiki action buttons into the app shell's slim sidebar rail.
 * Uses the same ref pattern as WikiSettingsPanel to avoid re-render loops.
 */
export function WikiRailActions(props: WikiRailActionsProps) {
  const setRailActions = useSetRailActions();
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    setRailActions(<WikiRailActionsContent propsRef={propsRef} />);
    return () => setRailActions(null);
  }, [setRailActions]);

  return null;
}
