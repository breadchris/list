"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Folder, FolderOpen, GripVertical, Search, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlinePillsVariant } from "../TaggingVariants";

// Chat message type (matches chat-interface.tsx)
interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
  tags?: string[];
}

interface Thread {
  id: string;
  parent_message_id: string;
  message_ids: string[];
}

interface SortableMessageProps {
  message: Message;
  onMessageClick?: (message: Message) => void;
  onOpenThread?: (messageId: string) => void;
  onOpenEditor?: (messageId: string) => void;
  getThreadsForMessage?: (messageId: string) => Thread[];
  globalTags?: string[];
  onAddTag?: (messageId: string, tag: string) => void;
  onRemoveTag?: (messageId: string, tag: string) => void;
}

function SortableMessage({
  message,
  onMessageClick,
  onOpenThread,
  onOpenEditor,
  getThreadsForMessage,
  globalTags,
  onAddTag,
  onRemoveTag,
}: SortableMessageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: message.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Truncate long content
  const displayContent = message.content.length > 60
    ? message.content.slice(0, 60) + "..."
    : message.content;

  // Get thread count for this message
  const threads = getThreadsForMessage?.(message.id) || [];
  const hasThreads = threads.length > 0;
  const totalReplies = threads.reduce((sum, t) => sum + t.message_ids.length, 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group font-mono rounded transition-colors",
        "hover:bg-neutral-900",
        isDragging && "opacity-50 bg-neutral-800 z-50"
      )}
    >
      {/* Message row */}
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          className="touch-none cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onMessageClick?.(message)}
        >
          <span className="text-neutral-500">{message.timestamp}</span>
          <span className="text-neutral-400 mx-2">&lt;{message.username}&gt;</span>
          <span className="text-neutral-300">{displayContent}</span>
        </div>
      </div>

      {/* Action buttons - visible on hover */}
      <div className="ml-6 pb-1 sm:opacity-0 sm:group-hover:opacity-100 opacity-100">
        <div className="grid grid-cols-[auto_auto_auto_1fr] gap-3 items-start">
          {onOpenThread && (
            <button
              onClick={() => onOpenThread(message.id)}
              className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {hasThreads && <span className="text-xs">{totalReplies}</span>}
            </button>
          )}

          {onOpenEditor && (
            <button
              onClick={() => onOpenEditor(message.id)}
              className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono"
              title="Edit in editor"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Tag editor */}
          {globalTags && onAddTag && onRemoveTag && (
            <InlinePillsVariant
              messageId={message.id}
              existingTags={globalTags}
              messageTags={message.tags || []}
              onAddTag={(tag) => onAddTag(message.id, tag)}
              onRemoveTag={(tag) => onRemoveTag(message.id, tag)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface TagFolderProps {
  tagName: string;
  tagColor?: string;
  messages: Message[];
  isExpanded: boolean;
  onToggle: () => void;
  onReorder: (tagName: string, newOrder: Message[]) => void;
  onMessageClick?: (message: Message) => void;
  searchQuery: string;
  // Action callbacks
  onOpenThread?: (messageId: string) => void;
  onOpenEditor?: (messageId: string) => void;
  getThreadsForMessage?: (messageId: string) => Thread[];
  globalTags?: string[];
  onAddTag?: (messageId: string, tag: string) => void;
  onRemoveTag?: (messageId: string, tag: string) => void;
}

function TagFolder({
  tagName,
  tagColor,
  messages,
  isExpanded,
  onToggle,
  onReorder,
  onMessageClick,
  searchQuery,
  onOpenThread,
  onOpenEditor,
  getThreadsForMessage,
  globalTags,
  onAddTag,
  onRemoveTag,
}: TagFolderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(
      (msg) =>
        msg.content.toLowerCase().includes(query) ||
        msg.username.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredMessages.findIndex((msg) => msg.id === active.id);
    const newIndex = filteredMessages.findIndex((msg) => msg.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(filteredMessages, oldIndex, newIndex);
      onReorder(tagName, newOrder);
    }
  };

  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div className="border-b border-neutral-800 last:border-b-0">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 text-left font-mono",
          "hover:bg-neutral-900 transition-colors",
          isExpanded && "bg-neutral-900"
        )}
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 text-neutral-500 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
        <FolderIcon
          className="w-4 h-4"
          style={{ color: tagColor || "#737373" }}
        />
        <span className="flex-1 text-neutral-300 text-sm">{tagName}</span>
        <span className="text-neutral-500 text-xs">
          {filteredMessages.length}
        </span>
      </button>

      {isExpanded && filteredMessages.length > 0 && (
        <div className="pl-4 pr-2 pb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredMessages.map((msg) => msg.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0">
                {filteredMessages.map((msg) => (
                  <SortableMessage
                    key={msg.id}
                    message={msg}
                    onMessageClick={onMessageClick}
                    onOpenThread={onOpenThread}
                    onOpenEditor={onOpenEditor}
                    getThreadsForMessage={getThreadsForMessage}
                    globalTags={globalTags}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {isExpanded && filteredMessages.length === 0 && (
        <div className="pl-8 pr-2 pb-2 text-xs text-neutral-600 font-mono">
          {searchQuery ? "no matches" : "empty"}
        </div>
      )}
    </div>
  );
}

interface UntaggedFolderProps {
  messages: Message[];
  isExpanded: boolean;
  onToggle: () => void;
  onReorder: (newOrder: Message[]) => void;
  onMessageClick?: (message: Message) => void;
  searchQuery: string;
  // Action callbacks
  onOpenThread?: (messageId: string) => void;
  onOpenEditor?: (messageId: string) => void;
  getThreadsForMessage?: (messageId: string) => Thread[];
  globalTags?: string[];
  onAddTag?: (messageId: string, tag: string) => void;
  onRemoveTag?: (messageId: string, tag: string) => void;
}

function UntaggedFolder({
  messages,
  isExpanded,
  onToggle,
  onReorder,
  onMessageClick,
  searchQuery,
  onOpenThread,
  onOpenEditor,
  getThreadsForMessage,
  globalTags,
  onAddTag,
  onRemoveTag,
}: UntaggedFolderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(
      (msg) =>
        msg.content.toLowerCase().includes(query) ||
        msg.username.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredMessages.findIndex((msg) => msg.id === active.id);
    const newIndex = filteredMessages.findIndex((msg) => msg.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(filteredMessages, oldIndex, newIndex);
      onReorder(newOrder);
    }
  };

  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div className="border-t border-dashed border-neutral-700 mt-2 pt-2">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 text-left font-mono",
          "hover:bg-neutral-900 transition-colors",
          isExpanded && "bg-neutral-900"
        )}
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 text-neutral-600 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
        <FolderIcon className="w-4 h-4 text-neutral-600" />
        <span className="flex-1 text-neutral-500 text-sm">untagged</span>
        <span className="text-neutral-600 text-xs">
          {filteredMessages.length}
        </span>
      </button>

      {isExpanded && filteredMessages.length > 0 && (
        <div className="pl-4 pr-2 pb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredMessages.map((msg) => msg.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0">
                {filteredMessages.map((msg) => (
                  <SortableMessage
                    key={msg.id}
                    message={msg}
                    onMessageClick={onMessageClick}
                    onOpenThread={onOpenThread}
                    onOpenEditor={onOpenEditor}
                    getThreadsForMessage={getThreadsForMessage}
                    globalTags={globalTags}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {isExpanded && filteredMessages.length === 0 && (
        <div className="pl-8 pr-2 pb-2 text-xs text-neutral-600 font-mono">
          {searchQuery ? "no matches" : "empty"}
        </div>
      )}
    </div>
  );
}

export interface TagFolderViewProps {
  messages: Message[];
  globalTags: string[];
  onMessageClick?: (message: Message) => void;
  // Action callbacks
  onOpenThread?: (messageId: string) => void;
  onOpenEditor?: (messageId: string) => void;
  getThreadsForMessage?: (messageId: string) => Thread[];
  onAddTag?: (messageId: string, tag: string) => void;
  onRemoveTag?: (messageId: string, tag: string) => void;
}

export function TagFolderView({
  messages,
  globalTags,
  onMessageClick,
  onOpenThread,
  onOpenEditor,
  getThreadsForMessage,
  onAddTag,
  onRemoveTag,
}: TagFolderViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [localOrder, setLocalOrder] = useState<Record<string, Message[]>>({});

  // Group messages by tag
  const { tagGroups, untagged } = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    const noTags: Message[] = [];

    // Initialize groups for all global tags
    globalTags.forEach((tag) => {
      groups[tag] = [];
    });

    // Distribute messages into groups
    messages.forEach((msg) => {
      if (!msg.tags || msg.tags.length === 0) {
        noTags.push(msg);
      } else {
        msg.tags.forEach((tag) => {
          if (!groups[tag]) {
            groups[tag] = [];
          }
          groups[tag].push(msg);
        });
      }
    });

    return { tagGroups: groups, untagged: noTags };
  }, [messages, globalTags]);

  const toggleTag = (tagName: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  const handleReorder = (tagName: string, newOrder: Message[]) => {
    setLocalOrder((prev) => ({
      ...prev,
      [tagName]: newOrder,
    }));
  };

  const handleUntaggedReorder = (newOrder: Message[]) => {
    setLocalOrder((prev) => ({
      ...prev,
      __untagged__: newOrder,
    }));
  };

  // Filter tags that have messages matching search
  const filteredTags = useMemo(() => {
    const tagsWithMessages = Object.entries(tagGroups).filter(
      ([, msgs]) => msgs.length > 0
    );

    if (!searchQuery.trim()) {
      return tagsWithMessages;
    }

    const query = searchQuery.toLowerCase();
    return tagsWithMessages.filter(([, msgs]) =>
      msgs.some(
        (msg) =>
          msg.content.toLowerCase().includes(query) ||
          msg.username.toLowerCase().includes(query)
      )
    );
  }, [tagGroups, searchQuery]);

  const filteredUntagged = useMemo(() => {
    if (!searchQuery.trim()) return untagged;
    const query = searchQuery.toLowerCase();
    return untagged.filter(
      (msg) =>
        msg.content.toLowerCase().includes(query) ||
        msg.username.toLowerCase().includes(query)
    );
  }, [untagged, searchQuery]);

  const hasNoContent = filteredTags.length === 0 && filteredUntagged.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
      {/* Search Input */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
          <input
            type="text"
            placeholder="filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-7 pr-3 py-1.5 text-sm font-mono",
              "bg-neutral-900 border border-neutral-800 rounded",
              "text-neutral-300 placeholder-neutral-600",
              "focus:outline-none focus:border-neutral-700"
            )}
          />
        </div>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto">
        {hasNoContent ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-600 font-mono">
            <Folder className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs">
              {searchQuery ? "no matches" : "no messages"}
            </span>
          </div>
        ) : (
          <>
            {/* Tagged folders */}
            {filteredTags.map(([tagName, msgs]) => (
              <TagFolder
                key={tagName}
                tagName={tagName}
                messages={localOrder[tagName] || msgs}
                isExpanded={expandedTags.has(tagName)}
                onToggle={() => toggleTag(tagName)}
                onReorder={handleReorder}
                onMessageClick={onMessageClick}
                searchQuery={searchQuery}
                onOpenThread={onOpenThread}
                onOpenEditor={onOpenEditor}
                getThreadsForMessage={getThreadsForMessage}
                globalTags={globalTags}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
              />
            ))}

            {/* Untagged folder */}
            {(filteredUntagged.length > 0 || !searchQuery) && untagged.length > 0 && (
              <UntaggedFolder
                messages={localOrder.__untagged__ || untagged}
                isExpanded={expandedTags.has("__untagged__")}
                onToggle={() => toggleTag("__untagged__")}
                onReorder={handleUntaggedReorder}
                onMessageClick={onMessageClick}
                searchQuery={searchQuery}
                onOpenThread={onOpenThread}
                onOpenEditor={onOpenEditor}
                getThreadsForMessage={getThreadsForMessage}
                globalTags={globalTags}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
