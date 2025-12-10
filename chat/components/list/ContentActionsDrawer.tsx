import React, { useState } from "react";
import { Drawer } from "./vaul/index";

export type ContentAction =
  | "text"
  | "rich-text"
  | "ai-chat"
  | "ai-chat-v2"
  | "claude-code"
  | "image"
  | "epub"
  | "plugin"
  | "import"
  | "map";

interface ActionConfig {
  id: ContentAction;
  icon: string;
  label: string;
  bg: string;
  text: string;
  hex: string;
}

// Color palette for each action type
export const ACTION_COLORS: Record<
  ContentAction,
  { bg: string; text: string; hex: string }
> = {
  text: { bg: "bg-gray-500", text: "text-gray-600", hex: "#6B7280" },
  "rich-text": { bg: "bg-slate-500", text: "text-slate-600", hex: "#64748B" },
  import: { bg: "bg-blue-500", text: "text-blue-600", hex: "#3B82F6" },
  "claude-code": {
    bg: "bg-indigo-500",
    text: "text-indigo-600",
    hex: "#6366F1",
  },
  "ai-chat": { bg: "bg-purple-500", text: "text-purple-600", hex: "#A855F7" },
  "ai-chat-v2": { bg: "bg-teal-500", text: "text-teal-600", hex: "#14B8A6" },
  image: { bg: "bg-green-500", text: "text-green-600", hex: "#10B981" },
  epub: { bg: "bg-orange-500", text: "text-orange-600", hex: "#F97316" },
  plugin: { bg: "bg-pink-500", text: "text-pink-600", hex: "#EC4899" },
  map: { bg: "bg-red-500", text: "text-red-600", hex: "#EF4444" },
};

const ACTIONS: ActionConfig[] = [
  {
    id: "text",
    icon: "📝",
    label: "Text",
    ...ACTION_COLORS["text"],
  },
  {
    id: "image",
    icon: "🖼️",
    label: "Image",
    ...ACTION_COLORS["image"],
  },
];

interface ContentActionsDrawerProps {
  onActionSelect: (action: ContentAction) => void;
  activeAction: ContentAction | null;
}

/**
 * Swipeable drawer for content input actions
 * Shows all available action types in a grid layout
 * Each action has a unique color that applies to the input when selected
 */
export const ContentActionsDrawer: React.FC<ContentActionsDrawerProps> = ({
  onActionSelect,
  activeAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleActionClick = (action: ContentAction) => {
    onActionSelect(action);
    setIsOpen(false);
  };

  // Dynamic height based on active action
  const drawerHeight = activeAction === "rich-text" ? "h-[80vh]" : "h-[240px]";

  return (
    <>
      <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
        <div className="fixed bottom-14 left-0 right-0 z-50 flex justify-center">
          <Drawer.Trigger asChild>
            <button
              className={`
                flex flex-col items-center justify-center relative
                px-4 py-1.5 rounded-t-xl
                bg-gray-800 text-white transition-all duration-200
                shadow-lg hover:scale-105 active:scale-95
                ${activeAction ? "border-t-2" : ""}
              `}
              style={
                activeAction
                  ? { borderTopColor: ACTION_COLORS[activeAction].hex }
                  : undefined
              }
            >
              <div
                className="transition-transform duration-200"
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              {activeAction && (
                <span className="text-xs mt-0.5 font-medium">
                  {ACTIONS.find((a) => a.id === activeAction)?.label}
                </span>
              )}
            </button>
          </Drawer.Trigger>
        </div>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content
            className={`fixed bottom-0 left-0 right-0 bg-gray-800 flex flex-col rounded-t-2xl ${drawerHeight} z-50 transition-all duration-300`}
          >
            <Drawer.Title className="sr-only">Content Actions</Drawer.Title>
            <Drawer.Description className="sr-only">
              Select an action to perform with your content
            </Drawer.Description>

            <div className="flex justify-center pt-3 pb-4">
              <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
            </div>

            <div className="px-6 pb-6 overflow-auto">
              <div className="grid grid-cols-3 gap-4">
                {ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action.id)}
                    className={`
                      flex flex-col items-center justify-center
                      p-4 rounded-xl
                      ${activeAction === action.id ? action.bg : "bg-gray-700"}
                      hover:bg-gray-600
                      transition-all duration-200
                      ${activeAction === action.id ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800" : ""}
                    `}
                  >
                    <span className="text-3xl mb-2">{action.icon}</span>
                    <span className="text-xs text-white font-medium text-center">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
};
