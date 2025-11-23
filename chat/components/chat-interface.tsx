"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, MessageSquare } from "lucide-react";
import { useArray, useYDoc } from "@y-sweet/react";
import { useUsername } from "./username-prompt";
import { useBotResponse } from "@/hooks/use-bot-response";
import { parseMentions, buildBotContext, type ChatMessage } from "@/lib/bot-utils";

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
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

export function ChatInterface() {
  const doc = useYDoc();
  const messages = useArray<Message>("messages");
  const threads = useArray<Thread>("threads");
  const username = useUsername();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevThreadCountRef = useRef(0);
  const { invokeBots } = useBotResponse(doc, messages, threads);

  // Local state for open threads - each user has their own view
  const [openThreadIds, setOpenThreadIds] = useState<OpenThread[]>([]);

  // Auto-scroll to the newest thread panel when a thread is opened
  useEffect(() => {
    if (
      openThreadIds.length > prevThreadCountRef.current &&
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
    prevThreadCountRef.current = openThreadIds.length;
  }, [openThreadIds.length]);

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

  const handleSendMessage = useCallback(
    (content: string, threadId?: string) => {
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

      // Check for bot mentions and invoke them
      const mentions = parseMentions(content);
      if (mentions.length > 0) {
        // Build context for each bot
        const invocations = mentions.map((mention) => {
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
              const parent = messages.toArray().find((m) => m.id === thread.parent_message_id);
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
            mention.bot,
            mentions
          );

          return {
            bot: mention.bot,
            triggerMessage: newMessage,
            threadId,
            contextMessages: botContext.context_messages.map((m) => ({
              username: m.username,
              content: m.content,
            })),
            cleanedContent: botContext.cleaned_content,
          };
        });

        // Invoke all mentioned bots in parallel
        invokeBots(invocations);
      }
    },
    [doc, messages, threads, username, invokeBots],
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

      // Update local open threads - truncate to depth and add new
      setOpenThreadIds((prev) => {
        const newOpenThreads = prev.slice(0, depth);
        newOpenThreads.push({
          thread_id: threadId,
          parent_message_id: messageId,
          available_thread_ids: availableThreadIds,
        });
        return newOpenThreads;
      });
    },
    [doc, threads, messages, getThreadsForMessage],
  );

  const handleCloseThread = useCallback((depth: number) => {
    setOpenThreadIds((prev) => prev.slice(0, depth));
  }, []);

  const handleSwitchThread = useCallback(
    (depth: number, threadIndex: number) => {
      setOpenThreadIds((prev) => {
        const updated = [...prev];
        const openThread = updated[depth];
        if (openThread && openThread.available_thread_ids[threadIndex]) {
          updated[depth] = {
            ...openThread,
            thread_id: openThread.available_thread_ids[threadIndex],
          };
        }
        return updated;
      });
    },
    [],
  );

  const handleCreateNewThread = useCallback(
    (depth: number) => {
      const openThread = openThreadIds[depth];
      if (!openThread) return;

      const newThread: Thread = {
        id: generateId(),
        parent_message_id: openThread.parent_message_id,
        message_ids: [],
      };

      doc.transact(() => {
        threads.push([newThread]);

        // Update parent message's thread_ids
        const msgArray = messages.toArray();
        const msgIndex = msgArray.findIndex(
          (m) => m.id === openThread.parent_message_id,
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
      setOpenThreadIds((prev) => {
        const updated = [...prev];
        updated[depth] = {
          ...openThread,
          thread_id: newThread.id,
          available_thread_ids: [...openThread.available_thread_ids, newThread.id],
        };
        return updated;
      });
    },
    [doc, threads, messages, openThreadIds],
  );

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

  return (
    <div className="h-[calc(100vh-64px)] bg-neutral-950 text-neutral-100 overflow-hidden">
      <div
        className="h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        ref={scrollContainerRef}
      >
        {/* Main chat panel */}
        <ChatPanel
          messages={mainMessages}
          title="let's chat!"
          onOpenThread={(messageId) => handleOpenThread(messageId, 0)}
          onSendMessage={(content) => handleSendMessage(content)}
          showClose={false}
          getThreadsForMessage={getThreadsForMessage}
        />

        {/* Thread panels */}
        {openThreadIds.map((openThread, index) => {
          const threadMessages = getMessagesForThread(openThread.thread_id);
          const parentMessage = getMessageById(openThread.parent_message_id);
          const currentThreadIndex = openThread.available_thread_ids.indexOf(
            openThread.thread_id,
          );

          return (
            <ChatPanel
              key={openThread.thread_id}
              messages={threadMessages}
              parentMessage={parentMessage}
              title="Thread"
              onOpenThread={(messageId) =>
                handleOpenThread(messageId, index + 1)
              }
              onSendMessage={(content) =>
                handleSendMessage(content, openThread.thread_id)
              }
              onClose={() => handleCloseThread(index)}
              showClose={true}
              getThreadsForMessage={getThreadsForMessage}
              currentThreadIndex={currentThreadIndex}
              totalThreads={openThread.available_thread_ids.length}
              onSwitchThread={(idx) => handleSwitchThread(index, idx)}
              onCreateNewThread={() => handleCreateNewThread(index)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  messages: Message[];
  title: string;
  parentMessage?: Message;
  onOpenThread: (messageId: string) => void;
  onSendMessage: (content: string) => void;
  onClose?: () => void;
  showClose: boolean;
  getThreadsForMessage: (messageId: string) => Thread[];
  currentThreadIndex?: number;
  totalThreads?: number;
  onSwitchThread?: (threadIndex: number) => void;
  onCreateNewThread?: () => void;
}

function ChatPanel({
  messages,
  title,
  parentMessage,
  onOpenThread,
  onSendMessage,
  onClose,
  showClose,
  getThreadsForMessage,
  currentThreadIndex,
  totalThreads,
  onSwitchThread,
  onCreateNewThread,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <div className="min-w-full sm:min-w-[400px] w-full sm:w-[400px] h-full flex flex-col border-r border-neutral-800 snap-start">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{title}</span>
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

      {/* Parent message context for threads */}
      {parentMessage && (
        <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-neutral-500 text-sm">Thread started by:</div>
            {onCreateNewThread && (
              <button
                onClick={onCreateNewThread}
                className="text-xs px-1 text-neutral-600 hover:text-neutral-400 font-mono transition-colors"
              >
                + new thread
              </button>
            )}
          </div>
          <div className="font-mono text-sm">
            <span className="text-neutral-400">{parentMessage.timestamp}</span>
            <span className="text-neutral-300 mx-2">
              &lt;{parentMessage.username}&gt;
            </span>
            <span className="text-neutral-400">{parentMessage.content}</span>
          </div>
          {/* Thread tabs - show if multiple threads */}
          {totalThreads !== undefined &&
            totalThreads > 1 &&
            onSwitchThread && (
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
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-1">
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              onOpenThread={onOpenThread}
              getThreadsForMessage={getThreadsForMessage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 px-4 py-3">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Message ${title}`}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </form>
      </div>
    </div>
  );
}

interface MessageRowProps {
  message: Message;
  onOpenThread: (messageId: string) => void;
  getThreadsForMessage: (messageId: string) => Thread[];
}

function MessageRow({
  message,
  onOpenThread,
  getThreadsForMessage,
}: MessageRowProps) {
  const threads = getThreadsForMessage(message.id);
  const hasThreads = threads.length > 0;
  const totalReplies = threads.reduce(
    (sum, t) => sum + t.message_ids.length,
    0,
  );

  return (
    <div className="group">
      <div className="font-mono px-2 py-1 rounded transition-colors hover:bg-neutral-900">
        <span className="text-neutral-500">{message.timestamp}</span>
        <span className="text-neutral-400 mx-2">
          &lt;{message.username}&gt;
        </span>
        <span className="text-neutral-300">{message.content}</span>
      </div>

      {/* Thread indicator / reply button */}
      <div className="ml-2 mt-1">
        <button
          onClick={() => onOpenThread(message.id)}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {hasThreads && (
            <span className="text-xs">
              {totalReplies} {totalReplies === 1 ? "reply" : "replies"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
