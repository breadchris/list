"use client";

import { Doc } from "yjs";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { VirtualizedMessageList } from "./VirtualizedMessageList";
import { X, MessageSquare, Tag, FileText, FolderTree, LayoutList } from "lucide-react";
import { useArray, useYDoc } from "@y-sweet/react";
import { useIsDesktop } from "./ui/use-mobile";
import ReactMarkdown from "react-markdown";
import { useUsername } from "./username-prompt";
import { BotQueueProvider, useBotQueue } from "./bot-queue-provider";
import { BlockNoteEditorAppInterface } from "./blocknote-editor-app-interface";
import {
  parseMentions,
  buildBotContext,
  type ChatMessage,
  parseBotDefinition,
  buildSystemPromptFromMessages,
} from "@/lib/bot-utils";
import {
  getAllBots,
  type BotConfig,
  setDynamicBots,
  isReservedMention,
} from "@/lib/bots.config";
import { CodeRenderer, parseCodeVariant } from "./code-renderer";
import { BotMentionSuggestions } from "./bot-mention-suggestions";
import { InlinePillsVariant } from "./TaggingVariants";
import { BotBuilderHandler } from "./bot-builder-handler";
import { TagFolderView } from "./list/TagFolderView";

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

interface OpenThread {
  thread_id: string;
  parent_message_id: string;
  available_thread_ids: string[];
}

type PanelType = "thread" | "editor";

interface OpenPanel {
  type: PanelType;
  panel_id: string;
  parent_message_id: string;
  // For threads
  thread_id?: string;
  available_thread_ids?: string[];
  // For editor
  editor_message_id?: string;
}

export function ChatInterface() {
  const doc = useYDoc();
  const messages = useArray<Message>("messages");
  const threads = useArray<Thread>("threads");
  const globalTags = useArray<string>("tags");
  const dynamicBots = useArray<BotConfig>("dynamicBots");

  return (
    <BotQueueProvider doc={doc} messagesArray={messages} threadsArray={threads}>
      <ChatInterfaceInner
        messages={messages}
        threads={threads}
        globalTags={globalTags}
        dynamicBots={dynamicBots}
        doc={doc}
      />
    </BotQueueProvider>
  );
}

interface ChatInterfaceInnerProps {
  messages: {
    push: (items: Message[]) => void;
    toArray: () => Message[];
    delete: (index: number, length: number) => void;
    insert: (index: number, items: Message[]) => void;
  };
  threads: {
    push: (items: Thread[]) => void;
    toArray: () => Thread[];
    delete: (index: number, length: number) => void;
    insert: (index: number, items: Thread[]) => void;
  };
  globalTags: {
    push: (items: string[]) => void;
    toArray: () => string[];
    delete: (index: number, length: number) => void;
    insert: (index: number, items: string[]) => void;
  };
  dynamicBots: {
    push: (items: BotConfig[]) => void;
    toArray: () => BotConfig[];
    delete: (index: number, length: number) => void;
    insert: (index: number, items: BotConfig[]) => void;
    observe: (callback: () => void) => void;
    unobserve: (callback: () => void) => void;
  };
  doc: Doc;
}

function ChatInterfaceInner({
  messages,
  threads,
  globalTags,
  dynamicBots,
  doc,
}: ChatInterfaceInnerProps) {
  const username = useUsername();
  const isDesktop = useIsDesktop();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevThreadCountRef = useRef(0);
  const { dispatch } = useBotQueue();

  // Local state for open panels (threads and editors) - each user has their own view
  const [openPanels, setOpenPanels] = useState<OpenPanel[]>([]);

  // Panel width state for resizable panels (desktop only)
  const [panelWidths, setPanelWidths] = useState<Record<string, number>>({});
  const DEFAULT_PANEL_WIDTH = 400;
  const MIN_PANEL_WIDTH = 200;
  const MAX_PANEL_WIDTH = 800;

  const getPanelWidth = useCallback((panelId: string) =>
    panelWidths[panelId] ?? DEFAULT_PANEL_WIDTH, [panelWidths]);

  const handlePanelResize = useCallback((panelId: string, newWidth: number) => {
    setPanelWidths(prev => ({
      ...prev,
      [panelId]: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth))
    }));
  }, []);

  // Sync dynamic bots with the global bot registry
  useEffect(() => {
    const updateBots = () => {
      setDynamicBots(dynamicBots.toArray());
    };

    // Initial sync
    updateBots();

    // Listen for Yjs array changes
    dynamicBots.observe(updateBots);

    return () => dynamicBots.unobserve(updateBots);
  }, [dynamicBots]);

  // Auto-scroll to the newest panel when opened
  useEffect(() => {
    if (
      openPanels.length > prevThreadCountRef.current &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current;
      setTimeout(() => {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: "smooth",
        });
      }, 50);
    }
    prevThreadCountRef.current = openPanels.length;
  }, [openPanels.length]);

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const getMessageById = useCallback(
    (id: string): Message | undefined => {
      return messages.toArray().find((m) => m.id === id);
    },
    [messages],
  );

  const getThreadById = useCallback(
    (id: string): Thread | undefined => {
      return threads.toArray().find((t) => t.id === id);
    },
    [threads],
  );

  const getThreadsForMessage = useCallback(
    (messageId: string): Thread[] => {
      return threads.toArray().filter((t) => t.parent_message_id === messageId);
    },
    [threads],
  );

  const getMessagesForThread = useCallback(
    (threadId: string): Message[] => {
      const thread = getThreadById(threadId);
      if (!thread) return [];
      return thread.message_ids
        .map((id) => getMessageById(id))
        .filter((m): m is Message => m !== undefined);
    },
    [getThreadById, getMessageById],
  );

  const addTagToMessage = useCallback(
    (messageId: string, tag: string) => {
      doc.transact(() => {
        // Update message tags
        const msgArray = messages.toArray();
        const msgIndex = msgArray.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          const msg = msgArray[msgIndex];
          const currentTags = msg.tags || [];
          if (!currentTags.includes(tag)) {
            const updatedMsg: Message = {
              ...msg,
              tags: [...currentTags, tag],
            };
            messages.delete(msgIndex, 1);
            messages.insert(msgIndex, [updatedMsg]);
          }
        }

        // Add to global tags if new
        const existingGlobalTags = globalTags.toArray();
        if (!existingGlobalTags.includes(tag)) {
          globalTags.push([tag]);
        }
      });
    },
    [doc, messages, globalTags],
  );

  const removeTagFromMessage = useCallback(
    (messageId: string, tag: string) => {
      doc.transact(() => {
        const msgArray = messages.toArray();
        const msgIndex = msgArray.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          const msg = msgArray[msgIndex];
          const currentTags = msg.tags || [];
          const updatedMsg: Message = {
            ...msg,
            tags: currentTags.filter((t) => t !== tag),
          };
          messages.delete(msgIndex, 1);
          messages.insert(msgIndex, [updatedMsg]);
        }
      });
    },
    [doc, messages],
  );

  // Bot management functions
  const activateBot = useCallback(
    (parentMessageId: string, threadId: string): string | null => {
      const parentMessage = getMessageById(parentMessageId);
      if (!parentMessage) return "Parent message not found";

      // Check if message has 'bot' tag
      if (!parentMessage.tags?.includes("bot")) {
        return "Message must have 'bot' tag";
      }

      // Parse bot definition from parent message
      const botDef = parseBotDefinition(parentMessage.content);
      if (!botDef) {
        return "Invalid bot definition format. Use: @mention - Description";
      }

      // Check if mention is reserved
      if (isReservedMention(botDef.mention)) {
        return `@${botDef.mention} is a reserved bot name`;
      }

      // Get thread messages to build system prompt
      const threadMessages = getMessagesForThread(threadId);
      const systemPrompt = buildSystemPromptFromMessages(threadMessages);

      // Check if bot already exists (update it)
      const existingBots = dynamicBots.toArray();
      const existingIndex = existingBots.findIndex(
        (b) => b.mention === botDef.mention,
      );

      const newBot: BotConfig = {
        id: `dynamic-${botDef.mention}`,
        mention: botDef.mention,
        display_name: botDef.description,
        system_prompt: systemPrompt,
        model: "gpt-4o-mini",
        context_mode: "thread",
        response_type: "object",
        schema_id: "chat",
        source_thread_id: threadId,
        activated_at: new Date().toISOString(),
      };

      if (existingIndex !== -1) {
        // Update existing bot
        dynamicBots.delete(existingIndex, 1);
        dynamicBots.insert(existingIndex, [newBot]);
      } else {
        // Add new bot
        dynamicBots.push([newBot]);
      }

      return null; // Success
    },
    [getMessageById, getMessagesForThread, dynamicBots],
  );

  const deactivateBot = useCallback(
    (mention: string) => {
      const bots = dynamicBots.toArray();
      const botIndex = bots.findIndex((b) => b.mention === mention);
      if (botIndex !== -1) {
        dynamicBots.delete(botIndex, 1);
      }
    },
    [dynamicBots],
  );

  const createTestMessage = useCallback(
    (parentMessageId: string, threadId: string, testPrompt: string) => {
      const testMessage: Message = {
        id: generateId(),
        username: username || "anonymous",
        timestamp: getCurrentTime(),
        content: `🧪 Test: ${testPrompt}`,
      };

      doc.transact(() => {
        // Add test message to messages array
        messages.push([testMessage]);

        // Add to thread
        const threadArray = threads.toArray();
        const threadIndex = threadArray.findIndex((t) => t.id === threadId);
        if (threadIndex !== -1) {
          const thread = threadArray[threadIndex];
          const updatedThread: Thread = {
            ...thread,
            message_ids: [...thread.message_ids, testMessage.id],
          };
          threads.delete(threadIndex, 1);
          threads.insert(threadIndex, [updatedThread]);
        }
      });

      // Open sub-thread for this test message
      handleOpenThread(testMessage.id, openPanels.length);
    },
    [doc, messages, threads, username, openPanels.length],
  );

  const createBotFromConversation = useCallback(
    (botData: {
      mention: string;
      description: string;
      personalityLines: string[];
    }) => {
      // 1. Create bot definition message with 'bot' tag
      const botDefMessage: Message = {
        id: generateId(),
        username: username || "anonymous",
        timestamp: getCurrentTime(),
        content: `@${botData.mention} - ${botData.description}`,
        tags: ["bot"],
      };

      // 2. Create thread
      const threadId = generateId();
      const thread: Thread = {
        id: threadId,
        parent_message_id: botDefMessage.id,
        message_ids: [],
      };

      // 3. Create personality messages
      const personalityMessages: Message[] = botData.personalityLines.map(
        (line) => ({
          id: generateId(),
          username: username || "anonymous",
          timestamp: getCurrentTime(),
          content: line,
        }),
      );

      doc.transact(() => {
        // Add bot definition message
        messages.push([botDefMessage]);

        // Add personality messages
        for (const msg of personalityMessages) {
          messages.push([msg]);
        }

        // Update bot def message with thread reference
        const msgIndex = messages
          .toArray()
          .findIndex((m) => m.id === botDefMessage.id);
        if (msgIndex !== -1) {
          const updatedBotDefMsg: Message = {
            ...botDefMessage,
            thread_ids: [threadId],
          };
          messages.delete(msgIndex, 1);
          messages.insert(msgIndex, [updatedBotDefMsg]);
        }

        // Create thread with personality message IDs
        const threadWithMessages: Thread = {
          ...thread,
          message_ids: personalityMessages.map((m) => m.id),
        };
        threads.push([threadWithMessages]);
      });

      // 4. Activate the bot (after transaction commits)
      setTimeout(() => {
        const error = activateBot(botDefMessage.id, threadId);
        if (error) {
          console.error("Failed to activate bot:", error);
          // TODO: Show user-facing error message
        }
      }, 0);

      // 5. Open the thread to show the user
      handleOpenThread(botDefMessage.id, openPanels.length);
    },
    [doc, messages, threads, username, activateBot, openPanels.length],
  );

  const handleSendMessage = useCallback(
    (content: string, threadId?: string, autoRespondBot?: BotConfig) => {
      if (!content.trim()) return;
      const effectiveUsername = username || "anonymous";

      const newMessage: Message = {
        id: generateId(),
        username: effectiveUsername,
        timestamp: getCurrentTime(),
        content: content.trim(),
      };

      doc.transact(() => {
        // Add message to main messages array
        messages.push([newMessage]);

        if (threadId) {
          // Add message to existing thread
          const threadArray = threads.toArray();
          const threadIndex = threadArray.findIndex((t) => t.id === threadId);
          if (threadIndex !== -1) {
            const thread = threadArray[threadIndex];
            const updatedThread: Thread = {
              ...thread,
              message_ids: [...thread.message_ids, newMessage.id],
            };
            threads.delete(threadIndex, 1);
            threads.insert(threadIndex, [updatedThread]);
          }
        }
      });

      // Check for bot mentions and dispatch to queue
      const mentions = parseMentions(content);

      // Determine which bots to invoke:
      // 1. Explicit @mentions in the message
      // 2. Auto-respond bot (if enabled and no explicit mention of that bot)
      const botsToInvoke: BotConfig[] = mentions.map((m) => m.bot);

      // Add auto-respond bot if enabled and not already explicitly mentioned
      if (
        autoRespondBot &&
        !botsToInvoke.some((b) => b.id === autoRespondBot.id)
      ) {
        botsToInvoke.push(autoRespondBot);
      }

      if (botsToInvoke.length > 0) {
        // Build context and dispatch each bot invocation
        for (const bot of botsToInvoke) {
          // Get thread messages for context
          let threadMessages: ChatMessage[] = [];
          let parentMessage: ChatMessage | null = null;

          if (threadId) {
            const thread = threads.toArray().find((t) => t.id === threadId);
            if (thread) {
              // Get messages in this thread (excluding the one we just sent)
              threadMessages = thread.message_ids
                .map((id) => messages.toArray().find((m) => m.id === id))
                .filter((m): m is Message => m !== undefined)
                .map((m) => ({
                  id: m.id,
                  username: m.username,
                  content: m.content,
                  timestamp: m.timestamp,
                }));

              // Get parent message
              const parent = messages
                .toArray()
                .find((m) => m.id === thread.parent_message_id);
              if (parent) {
                parentMessage = {
                  id: parent.id,
                  username: parent.username,
                  content: parent.content,
                  timestamp: parent.timestamp,
                };
              }
            }
          }

          const triggerChatMessage: ChatMessage = {
            id: newMessage.id,
            username: newMessage.username,
            content: newMessage.content,
            timestamp: newMessage.timestamp,
          };

          const botContext = buildBotContext(
            triggerChatMessage,
            threadMessages,
            parentMessage,
            bot,
            mentions,
          );

          // Dispatch to queue - all bots handled uniformly
          dispatch({
            bot,
            prompt: `[${newMessage.username}]: ${botContext.cleaned_content}`,
            trigger_message_id: newMessage.id,
            existing_thread_id: threadId,
            context_messages: botContext.context_messages.map((m) => ({
              username: m.username,
              content: m.content,
            })),
          });
        }
      }
    },
    [doc, messages, threads, username, dispatch],
  );

  const handleOpenThread = useCallback(
    (messageId: string, depth: number, threadIndex: number = 0) => {
      const existingThreads = getThreadsForMessage(messageId);
      let threadId: string;
      let availableThreadIds: string[];

      if (existingThreads.length === 0) {
        // Create new thread (shared via yjs)
        const newThread: Thread = {
          id: generateId(),
          parent_message_id: messageId,
          message_ids: [],
        };

        doc.transact(() => {
          threads.push([newThread]);

          // Update message to reference thread
          const msgArray = messages.toArray();
          const msgIndex = msgArray.findIndex((m) => m.id === messageId);
          if (msgIndex !== -1) {
            const msg = msgArray[msgIndex];
            const updatedMsg: Message = {
              ...msg,
              thread_ids: [...(msg.thread_ids || []), newThread.id],
            };
            messages.delete(msgIndex, 1);
            messages.insert(msgIndex, [updatedMsg]);
          }
        });

        threadId = newThread.id;
        availableThreadIds = [newThread.id];
      } else {
        threadId = existingThreads[threadIndex]?.id || existingThreads[0].id;
        availableThreadIds = existingThreads.map((t) => t.id);
      }

      // Update local open panels - truncate to depth and add new thread panel
      setOpenPanels((prev) => {
        const newOpenPanels = prev.slice(0, depth);
        newOpenPanels.push({
          type: "thread",
          panel_id: threadId,
          parent_message_id: messageId,
          thread_id: threadId,
          available_thread_ids: availableThreadIds,
        });
        return newOpenPanels;
      });
    },
    [doc, threads, messages, getThreadsForMessage],
  );

  const handleClosePanel = useCallback((depth: number) => {
    setOpenPanels((prev) => prev.slice(0, depth));
  }, []);

  const handleSwitchThread = useCallback(
    (depth: number, threadIndex: number) => {
      setOpenPanels((prev) => {
        const updated = [...prev];
        const openPanel = updated[depth];
        if (
          openPanel &&
          openPanel.type === "thread" &&
          openPanel.available_thread_ids &&
          openPanel.available_thread_ids[threadIndex]
        ) {
          updated[depth] = {
            ...openPanel,
            thread_id: openPanel.available_thread_ids[threadIndex],
            panel_id: openPanel.available_thread_ids[threadIndex],
          };
        }
        return updated;
      });
    },
    [],
  );

  const handleCreateNewThread = useCallback(
    (depth: number) => {
      const openPanel = openPanels[depth];
      if (!openPanel || openPanel.type !== "thread") return;

      const newThread: Thread = {
        id: generateId(),
        parent_message_id: openPanel.parent_message_id,
        message_ids: [],
      };

      doc.transact(() => {
        threads.push([newThread]);

        // Update parent message's thread_ids
        const msgArray = messages.toArray();
        const msgIndex = msgArray.findIndex(
          (m) => m.id === openPanel.parent_message_id,
        );
        if (msgIndex !== -1) {
          const msg = msgArray[msgIndex];
          const updatedMsg: Message = {
            ...msg,
            thread_ids: [...(msg.thread_ids || []), newThread.id],
          };
          messages.delete(msgIndex, 1);
          messages.insert(msgIndex, [updatedMsg]);
        }
      });

      // Switch to the new thread locally
      setOpenPanels((prev) => {
        const updated = [...prev];
        updated[depth] = {
          ...openPanel,
          thread_id: newThread.id,
          panel_id: newThread.id,
          available_thread_ids: [
            ...(openPanel.available_thread_ids || []),
            newThread.id,
          ],
        };
        return updated;
      });
    },
    [doc, threads, messages, openPanels],
  );

  const handleOpenEditor = useCallback((messageId: string, depth: number) => {
    const editorId = `editor-${messageId}`;

    // Update local open panels - truncate to depth and add new editor panel
    setOpenPanels((prev) => {
      const newOpenPanels = prev.slice(0, depth);
      newOpenPanels.push({
        type: "editor",
        panel_id: editorId,
        parent_message_id: messageId,
        editor_message_id: messageId,
      });
      return newOpenPanels;
    });
  }, []);

  // Main channel messages (not in any thread)
  const mainMessages = messages.toArray().filter((m) => {
    // Check if this message is part of any thread
    const allThreads = threads.toArray();
    for (const thread of allThreads) {
      if (thread.message_ids.includes(m.id)) {
        return false;
      }
    }
    return true;
  });

  // Helper to render a thread/editor panel content
  const renderPanelContent = (panel: OpenPanel, index: number) => {
    if (panel.type === "thread" && panel.thread_id) {
      const threadMessages = getMessagesForThread(panel.thread_id);
      const parentMessage = getMessageById(panel.parent_message_id);
      const currentThreadIndex = (
        panel.available_thread_ids || []
      ).indexOf(panel.thread_id);

      return (
        <ChatPanel
          messages={threadMessages}
          parentMessage={parentMessage}
          threadId={panel.thread_id}
          title="Thread"
          onOpenThread={(messageId) =>
            handleOpenThread(messageId, index + 1)
          }
          onOpenEditor={(messageId) =>
            handleOpenEditor(messageId, index + 1)
          }
          onSendMessage={(content, autoBot) =>
            handleSendMessage(content, panel.thread_id, autoBot)
          }
          onClose={() => handleClosePanel(index)}
          showClose={true}
          getThreadsForMessage={getThreadsForMessage}
          currentThreadIndex={currentThreadIndex}
          totalThreads={panel.available_thread_ids?.length || 0}
          onSwitchThread={(idx) => handleSwitchThread(index, idx)}
          onCreateNewThread={() => handleCreateNewThread(index)}
          globalTags={globalTags.toArray()}
          onAddTag={addTagToMessage}
          onRemoveTag={removeTagFromMessage}
          onActivateBot={activateBot}
          onDeactivateBot={deactivateBot}
          onTestBot={createTestMessage}
          onCreateBot={createBotFromConversation}
          doc={doc}
        />
      );
    } else if (panel.type === "editor" && panel.editor_message_id) {
      const parentMessage = getMessageById(panel.parent_message_id);
      return (
        <BlockNoteEditorAppInterface
          messageId={panel.editor_message_id}
          parentMessage={parentMessage}
          onClose={() => handleClosePanel(index)}
        />
      );
    }
    return null;
  };

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <div
        className="h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        ref={scrollContainerRef}
      >
        {/* Main chat panel */}
        <div
          className="relative h-full flex-shrink-0 snap-start"
          style={isDesktop ? { width: getPanelWidth("main") } : { width: "100%", maxWidth: "100vw" }}
        >
          <ChatPanel
            messages={mainMessages}
            title="let's chat!"
            onOpenThread={(messageId) => handleOpenThread(messageId, 0)}
            onOpenEditor={(messageId) => handleOpenEditor(messageId, 0)}
            onSendMessage={(content, autoBot) =>
              handleSendMessage(content, undefined, autoBot)
            }
            showClose={false}
            getThreadsForMessage={getThreadsForMessage}
            globalTags={globalTags.toArray()}
            onAddTag={addTagToMessage}
            onRemoveTag={removeTagFromMessage}
            onCreateBot={createBotFromConversation}
            doc={doc}
          />
          {isDesktop && (
            <PanelResizeHandle
              onResizeStart={() => getPanelWidth("main")}
              onResize={(delta) => handlePanelResize("main", delta)}
            />
          )}
        </div>

        {/* Panel rendering - threads and editors */}
        {openPanels.map((panel, index) => (
          <div
            key={panel.panel_id}
            className="relative h-full flex-shrink-0 snap-start"
            style={isDesktop ? { width: getPanelWidth(panel.panel_id) } : { width: "100%", maxWidth: "100vw" }}
          >
            {renderPanelContent(panel, index)}
            {isDesktop && (
              <PanelResizeHandle
                onResizeStart={() => getPanelWidth(panel.panel_id)}
                onResize={(delta) => handlePanelResize(panel.panel_id, delta)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Resize handle component for draggable panel width adjustment
interface PanelResizeHandleProps {
  onResizeStart: () => number;
  onResize: (newWidth: number) => void;
}

function PanelResizeHandle({ onResizeStart, onResize }: PanelResizeHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = onResizeStart();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-neutral-700 active:bg-neutral-600 transition-colors"
    />
  );
}

interface ChatPanelProps {
  messages: Message[];
  title: string;
  parentMessage?: Message;
  threadId?: string;
  onOpenThread: (messageId: string) => void;
  onOpenEditor: (messageId: string) => void;
  onSendMessage: (content: string, autoRespondBot?: BotConfig) => void;
  onClose?: () => void;
  showClose: boolean;
  getThreadsForMessage: (messageId: string) => Thread[];
  currentThreadIndex?: number;
  totalThreads?: number;
  onSwitchThread?: (threadIndex: number) => void;
  onCreateNewThread?: () => void;
  globalTags: string[];
  onAddTag: (messageId: string, tag: string) => void;
  onRemoveTag: (messageId: string, tag: string) => void;
  onActivateBot?: (parentMessageId: string, threadId: string) => string | null;
  onDeactivateBot?: (mention: string) => void;
  onTestBot?: (
    parentMessageId: string,
    threadId: string,
    testPrompt: string,
  ) => void;
  onCreateBot?: (botData: {
    mention: string;
    description: string;
    personalityLines: string[];
  }) => void;
  doc?: Doc;
}

function ChatPanel({
  messages,
  title,
  parentMessage,
  threadId,
  onOpenThread,
  onOpenEditor,
  onSendMessage,
  onClose,
  showClose,
  getThreadsForMessage,
  currentThreadIndex,
  totalThreads,
  onSwitchThread,
  onCreateNewThread,
  globalTags,
  onAddTag,
  onRemoveTag,
  onActivateBot,
  onDeactivateBot,
  onTestBot,
  onCreateBot,
  doc,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "folders">("list");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [autoRespondEnabled, setAutoRespondEnabled] = useState(true);
  const [testPrompt, setTestPrompt] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const allBots = getAllBots();

  // Measure container height for virtualized list using ResizeObserver
  // Re-run when viewMode changes to reattach observer after folder view unmounts the container
  useLayoutEffect(() => {
    if (viewMode !== "list") return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [viewMode]);

  // Detect bot from @mentions in the parent message
  const threadBot = parentMessage
    ? parseMentions(parentMessage.content)[0]?.bot
    : undefined;

  // Detect if this is a bot definition thread
  const isBotDefinitionThread =
    parentMessage?.tags?.includes("bot") &&
    parseBotDefinition(parentMessage.content) !== null;
  const botDefinition = isBotDefinitionThread && parentMessage
    ? parseBotDefinition(parentMessage.content)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      // Pass auto-respond bot if enabled and in a bot thread
      const autoBot = threadBot && autoRespondEnabled ? threadBot : undefined;
      onSendMessage(inputValue, autoBot);
      setInputValue("");
      setShowMentions(false);
      setMentionFilter("");
      setMentionStartIndex(-1);
    }
  };

  // Filter bots based on current mention filter
  const filteredBots = allBots.filter((bot) =>
    bot.mention.toLowerCase().startsWith(mentionFilter.toLowerCase()),
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setInputValue(value);

    // Find if we're in a mention context (after @)
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check if there's a space between @ and cursor
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        // We're in a mention context
        setShowMentions(true);
        setMentionFilter(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }

    // Not in mention context
    setShowMentions(false);
    setMentionFilter("");
    setMentionStartIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions || filteredBots.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredBots.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredBots.length - 1,
        );
        break;
      case "Enter":
        if (showMentions && filteredBots[selectedMentionIndex]) {
          e.preventDefault();
          handleSelectBot(filteredBots[selectedMentionIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowMentions(false);
        setMentionFilter("");
        setMentionStartIndex(-1);
        break;
      case "Tab":
        if (showMentions && filteredBots[selectedMentionIndex]) {
          e.preventDefault();
          handleSelectBot(filteredBots[selectedMentionIndex]);
        }
        break;
    }
  };

  const handleSelectBot = (bot: (typeof allBots)[0]) => {
    // Replace @filter with @mention
    const beforeMention = inputValue.slice(0, mentionStartIndex);
    const afterMention = inputValue.slice(
      mentionStartIndex + 1 + mentionFilter.length,
    );
    const newValue = `${beforeMention}@${bot.mention} ${afterMention}`;
    setInputValue(newValue);
    setShowMentions(false);
    setMentionFilter("");
    setMentionStartIndex(-1);

    // Set cursor position after the mention
    // Focus is preserved via onMouseDown preventDefault on the button
    if (inputRef.current) {
      const newCursorPos = beforeMention.length + bot.mention.length + 2; // +2 for @ and space
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  const handleCloseMentions = () => {
    setShowMentions(false);
    setMentionFilter("");
    setMentionStartIndex(-1);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 border border-neutral-800 rounded p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded transition-colors ${
                viewMode === "list"
                  ? "bg-neutral-800 text-neutral-300"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("folders")}
              className={`p-1 rounded transition-colors ${
                viewMode === "folders"
                  ? "bg-neutral-800 text-neutral-300"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              title="Folder view"
            >
              <FolderTree className="w-3.5 h-3.5" />
            </button>
          </div>
          {showClose && onClose && (
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Parent message context for threads */}
      {parentMessage && (
        <div className="px-4 py-3 bg-neutral-900">
          <div className="flex items-center justify-between mb-2">
            <div className="text-neutral-500 text-sm">
              {parentMessage.content.startsWith("🧪 Test:")
                ? "Test thread:"
                : "Thread started by:"}
            </div>
            <div className="flex gap-2">
              {parentMessage.content.startsWith("🧪 Test:") &&
                onCreateNewThread && (
                  <button
                    onClick={onCreateNewThread}
                    className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded font-mono transition-colors"
                  >
                    🔄 Rerun Test
                  </button>
                )}
              {onCreateNewThread && (
                <button
                  onClick={onCreateNewThread}
                  className="text-xs px-1 text-neutral-600 hover:text-neutral-400 font-mono transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>
          <div className="font-mono text-sm">
            <span className="text-neutral-400">{parentMessage.timestamp}</span>
            <span className="text-neutral-300 mx-2">
              &lt;{parentMessage.username}&gt;
            </span>
            <CollapsibleContent
              content={parentMessage.content}
              className="text-neutral-400"
            />
          </div>

          {/* Bot Builder Toolbar */}
          {isBotDefinitionThread &&
            botDefinition &&
            threadId &&
            onActivateBot &&
            onTestBot && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-neutral-500">
                    📝 Bot Definition: @{botDefinition.mention}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const error = onActivateBot(parentMessage.id, threadId);
                      if (error) {
                        alert(error);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-blue-100 rounded text-xs font-mono transition-colors"
                  >
                    ⚡ Activate Bot
                  </button>
                  <button
                    onClick={() => setShowTestInput(!showTestInput)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded text-xs font-mono transition-colors"
                  >
                    🧪 Test Bot
                  </button>
                  {onDeactivateBot && (
                    <button
                      onClick={() => onDeactivateBot(botDefinition.mention)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700 rounded text-xs font-mono transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
                {showTestInput && (
                  <div className="mt-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (testPrompt.trim()) {
                          onTestBot(parentMessage.id, threadId, testPrompt);
                          setTestPrompt("");
                          setShowTestInput(false);
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder="What should the bot respond to?"
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-blue-100 rounded text-xs font-mono transition-colors"
                      >
                        Create Test
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

          {/* Thread tabs - show if multiple threads */}
          {totalThreads !== undefined && totalThreads > 1 && onSwitchThread && (
            <div className="mt-3 -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-0 border-b border-neutral-800">
                {Array.from({ length: totalThreads }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => onSwitchThread(i)}
                    className={`px-3 py-1.5 text-xs font-mono whitespace-nowrap transition-colors relative ${
                      i === currentThreadIndex
                        ? "text-neutral-300"
                        : "text-neutral-600 hover:text-neutral-400"
                    }`}
                  >
                    Thread {i + 1}
                    {i === currentThreadIndex && (
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-neutral-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {viewMode === "list" ? (
        <div className="flex-1 min-h-0 overflow-hidden py-2" ref={messagesContainerRef}>
          <VirtualizedMessageList
            messages={messages}
            height={containerHeight}
            onOpenThread={onOpenThread}
            onOpenEditor={onOpenEditor}
            getThreadsForMessage={getThreadsForMessage}
            globalTags={globalTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateBot={onCreateBot}
            MessageRowComponent={MessageRow}
            doc={doc}
          />
        </div>
      ) : (
        <TagFolderView
          messages={messages}
          globalTags={globalTags}
          onOpenThread={onOpenThread}
          onOpenEditor={onOpenEditor}
          getThreadsForMessage={getThreadsForMessage}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />
      )}

      {/* Input */}
      <div className="px-4 py-3">
        <div className="relative">
          <BotMentionSuggestions
            bots={allBots}
            filter={mentionFilter}
            selectedIndex={selectedMentionIndex}
            visible={showMentions && filteredBots.length > 0}
            onSelect={handleSelectBot}
            onClose={handleCloseMentions}
          />
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2">
              {/* Auto-respond bot indicator */}
              {threadBot && autoRespondEnabled && (
                <button
                  type="button"
                  onClick={() => setAutoRespondEnabled(false)}
                  className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono text-neutral-400 hover:text-neutral-300 hover:border-neutral-600 transition-colors shrink-0"
                  title="Click to disable auto-respond"
                >
                  <span className="text-blue-400">@{threadBot.mention}</span>
                  <span className="text-neutral-600">×</span>
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  threadBot && autoRespondEnabled
                    ? `Message @${threadBot.mention}...`
                    : `Message ${title}`
                }
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface CollapsibleContentProps {
  content: string;
  className?: string;
}

function CollapsibleContent({
  content,
  className = "",
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Simple heuristic: content with newlines or >150 chars is likely long
  const isLongContent = content.includes("\n") || content.length > 150;

  const markdownContent = (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className="block my-1">{children}</span>,
        strong: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-neutral-800 px-1 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-neutral-800 p-2 rounded my-1 overflow-x-auto text-sm">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-1">{children}</ol>
        ),
        li: ({ children }) => <li className="my-0.5">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-400 hover:underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              const webkit = (window as any).webkit;
              if (webkit?.messageHandlers?.webviewHandler) {
                webkit.messageHandlers.webviewHandler.postMessage({
                  type: 'openUrl',
                  url: href,
                  title: String(children)
                });
              } else {
                window.open(href, '_blank');
              }
            }}
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <span className="font-bold text-lg block my-1">{children}</span>
        ),
        h2: ({ children }) => (
          <span className="font-bold text-base block my-1">{children}</span>
        ),
        h3: ({ children }) => (
          <span className="font-semibold block my-1">{children}</span>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );

  if (!isLongContent) {
    return <span className={className}>{markdownContent}</span>;
  }

  return (
    <span className={className}>
      <span className={isExpanded ? "" : "line-clamp-3"}>
        {markdownContent}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="ml-1 text-neutral-500 hover:text-neutral-300 text-xs font-mono transition-colors"
      >
        {isExpanded ? "[less]" : "[more]"}
      </button>
    </span>
  );
}

interface MessageRowProps {
  message: Message;
  onOpenThread: (messageId: string) => void;
  onOpenEditor: (messageId: string) => void;
  getThreadsForMessage: (messageId: string) => Thread[];
  globalTags: string[];
  onAddTag: (messageId: string, tag: string) => void;
  onRemoveTag: (messageId: string, tag: string) => void;
  onCreateBot?: (botData: {
    mention: string;
    description: string;
    personalityLines: string[];
  }) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  doc?: Doc;
}

function MessageRow({
  message,
  onOpenThread,
  onOpenEditor,
  getThreadsForMessage,
  globalTags,
  onAddTag,
  onRemoveTag,
  onCreateBot,
  isExpanded,
  onToggleExpand,
  doc,
}: MessageRowProps) {
  const threads = getThreadsForMessage(message.id);
  const hasThreads = threads.length > 0;
  const totalReplies = threads.reduce(
    (sum, t) => sum + t.message_ids.length,
    0,
  );

  // Check if message has Y.js editor content
  const hasYjsContent = useMemo(() => {
    if (!doc || !message.id) return false;
    const fragment = doc.getXmlFragment(message.id);
    return fragment.length > 0;
  }, [doc, message.id]);

  // Message should be muted if it has no threads AND no Y.js content
  const isMuted = !hasThreads && !hasYjsContent;

  // Check if this is a thinking/reasoning message
  if (message.username.endsWith(":thinking")) {
    return <ThinkingMessage content={message.content} />;
  }

  // Check if this is a Bot Builder message
  const isBotBuilder = message.username === "Bot Builder";

  if (isBotBuilder) {
    return (
      <div className="group cursor-pointer" onClick={onToggleExpand}>
        <div className="font-mono px-2 py-1 text-neutral-500">
          <span className={`transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {message.timestamp}
          </span>
          <span className={`mx-2 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            &lt;{message.username}&gt;
          </span>
        </div>
        <div className="px-2" onClick={(e) => e.stopPropagation()}>
          <BotBuilderHandler
            botMessageId={message.id}
            onCreateBot={onCreateBot}
          />
        </div>

        {/* Thread indicator / reply button and tags */}
        <div className={`ml-2 mt-1 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="flex items-start gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(message.id); }}
              className={`flex items-center gap-1.5 ${hasThreads ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {hasThreads && <span className="text-xs">{totalReplies}</span>}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onOpenEditor(message.id); }}
              className={`flex items-center gap-1.5 ${hasYjsContent ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
              title="Edit in Lexical"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Tag editor */}
            <div onClick={(e) => e.stopPropagation()}>
              <InlinePillsVariant
                messageId={message.id}
                existingTags={globalTags}
                messageTags={message.tags || []}
                onAddTag={(tag) => onAddTag(message.id, tag)}
                onRemoveTag={(tag) => onRemoveTag(message.id, tag)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if this is a code variant message (from @code or @claude bots)
  const isCodeBot =
    message.username === "code" || message.username === "claude";
  const codeVariant = isCodeBot ? parseCodeVariant(message.content) : null;

  if (codeVariant) {
    // Render code variant with live preview
    return (
      <div className="group cursor-pointer" onClick={onToggleExpand}>
        <div className="font-mono px-2 py-1 text-neutral-500">
          <span className={`transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {message.timestamp}
          </span>
          <span className={`mx-2 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            &lt;{message.username}&gt;
          </span>
        </div>
        <div className="px-2" onClick={(e) => e.stopPropagation()}>
          <CodeRenderer variant={codeVariant} />
        </div>

        {/* Thread indicator / reply button and tags */}
        <div className={`ml-2 mt-1 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {/* Icon row with grid to allow tag selector to span full width below */}
          <div className="grid grid-cols-[auto_auto_auto_1fr] gap-3 items-start">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(message.id); }}
              className={`flex items-center gap-1.5 ${hasThreads ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onOpenEditor(message.id); }}
              className={`flex items-center gap-1.5 ${hasYjsContent ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
              title="Edit in Lexical"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Tag editor - button in row, expanded panel below */}
            <div onClick={(e) => e.stopPropagation()}>
              <InlinePillsVariant
                messageId={message.id}
                existingTags={globalTags}
                messageTags={message.tags || []}
                onAddTag={(tag) => onAddTag(message.id, tag)}
                onRemoveTag={(tag) => onRemoveTag(message.id, tag)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={onToggleExpand}>
      <div className="font-mono px-2 py-1 rounded transition-colors hover:bg-neutral-900">
        <span className={`text-neutral-500 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {message.timestamp}
        </span>
        <span className={`text-neutral-400 mx-2 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          &lt;{message.username}&gt;
        </span>
        <CollapsibleContent
          content={message.content}
          className={isMuted ? "text-neutral-500" : "text-neutral-300"}
        />
      </div>

      {/* Thread indicator / reply button and tags */}
      <div className={`ml-2 mt-1 transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        {/* Icon row with grid to allow tag selector to span full width below */}
        <div className="grid grid-cols-[auto_auto_auto_1fr] gap-3 items-start">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenThread(message.id); }}
            className={`flex items-center gap-1.5 ${hasThreads ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onOpenEditor(message.id); }}
            className={`flex items-center gap-1.5 ${hasYjsContent ? "text-neutral-300" : "text-neutral-500"} hover:text-neutral-300 transition-colors font-mono`}
            title="Edit in Lexical"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>

          {/* Tag editor - button in row, expanded panel below */}
          <div onClick={(e) => e.stopPropagation()}>
            <InlinePillsVariant
              messageId={message.id}
              existingTags={globalTags}
              messageTags={message.tags || []}
              onAddTag={(tag) => onAddTag(message.id, tag)}
              onRemoveTag={(tag) => onRemoveTag(message.id, tag)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a thinking/reasoning message with muted text in a small scrollable viewport
 */
function ThinkingMessage({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className="px-2 py-1">
      <div
        ref={containerRef}
        className="max-h-24 overflow-y-auto bg-neutral-900/50 rounded border border-neutral-800 px-3 py-2"
      >
        <p className="text-xs text-neutral-500 font-mono whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
