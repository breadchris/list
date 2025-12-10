"use client";

import { Doc } from "yjs";
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type ListImperativeAPI,
} from "react-window";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
  type ReactElement,
} from "react";

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

interface VirtualizedMessageListProps {
  messages: Message[];
  height: number;
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
  doc?: Doc;
  MessageRowComponent: React.ComponentType<{
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
  }>;
}

interface RowProps {
  messages: Message[];
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
  doc?: Doc;
  MessageRowComponent: VirtualizedMessageListProps["MessageRowComponent"];
  dynamicRowHeight: ReturnType<typeof useDynamicRowHeight>;
  expandedMessageId: string | null;
  setExpandedMessageId: (id: string | null) => void;
}

function MessageRowWrapper({
  index,
  style,
  messages,
  MessageRowComponent,
  dynamicRowHeight,
  expandedMessageId,
  setExpandedMessageId,
  ...rowProps
}: {
  index: number;
  style: CSSProperties;
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
} & RowProps): ReactElement {
  const rowRef = useRef<HTMLDivElement>(null);
  const message = messages[index];
  const isExpanded = message?.id === expandedMessageId;

  useEffect(() => {
    if (rowRef.current) {
      const height = rowRef.current.getBoundingClientRect().height;
      dynamicRowHeight.setRowHeight(index, height);
    }
  }, [index, message?.content, message?.tags, dynamicRowHeight, isExpanded]);

  if (!message) {
    return <div style={style} />;
  }

  const handleToggleExpand = () => {
    setExpandedMessageId(isExpanded ? null : message.id);
  };

  return (
    <div style={{ ...style, paddingLeft: 16, paddingRight: 16 }}>
      <div ref={rowRef}>
        <MessageRowComponent
          message={message}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
          {...rowProps}
        />
      </div>
    </div>
  );
}

export function VirtualizedMessageList({
  messages,
  height,
  MessageRowComponent,
  ...rowProps
}: VirtualizedMessageListProps) {
  const listRef = useListRef(null);
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 60 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isAtBottom = useRef(true);
  const prevMessageCount = useRef(messages.length);
  const hasCompletedInitialScroll = useRef(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Scroll to bottom on initial load (first scroll - gets us close)
  const handleRowsRendered = useCallback(() => {
    if (isInitialLoad && messages.length > 0 && listRef.current) {
      // Use "instant" per GitHub issue #883 workaround
      listRef.current.scrollToRow({
        index: messages.length - 1,
        align: "end",
        behavior: "instant",
      });
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, messages.length, listRef]);

  // Iterative scroll to ensure we reach the actual bottom
  // scrollToRow uses estimated heights for unrendered rows, so we use raw DOM scroll instead
  useEffect(() => {
    if (!isInitialLoad && !hasCompletedInitialScroll.current && messages.length > 0) {
      let attempts = 0;
      const maxAttempts = 5;

      const scrollToBottom = () => {
        const element = listRef.current?.element;
        if (element) {
          // Use raw DOM scroll - this works regardless of row height estimates
          element.scrollTop = element.scrollHeight - element.clientHeight;

          // Check if we're at the actual bottom
          const isAtActualBottom =
            element.scrollTop + element.clientHeight >= element.scrollHeight - 5;

          if (!isAtActualBottom && attempts < maxAttempts) {
            attempts++;
            // Retry after allowing new rows to render and be measured
            requestAnimationFrame(scrollToBottom);
          } else {
            hasCompletedInitialScroll.current = true;
          }
        }
      };

      // Start after initial render settles
      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isInitialLoad, messages.length, listRef]);

  // Auto-follow new messages when at bottom
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (isAtBottom.current && listRef.current) {
        listRef.current.scrollToRow({
          index: messages.length - 1,
          align: "end",
        });
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, listRef]);

  // Reset when messages are cleared
  useEffect(() => {
    if (messages.length === 0) {
      setIsInitialLoad(true);
      hasCompletedInitialScroll.current = false;
    }
  }, [messages.length]);

  // Track scroll position to determine if at bottom
  const handleScroll = useCallback(() => {
    const element = listRef.current?.element;
    if (element) {
      const { scrollTop, scrollHeight, clientHeight } = element;
      isAtBottom.current = scrollTop + clientHeight >= scrollHeight - 50;
    }
  }, [listRef]);

  // Attach scroll listener
  useEffect(() => {
    const element = listRef.current?.element;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, listRef]);

  if (messages.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-neutral-500 font-mono text-sm"
        style={{ height }}
      >
        No messages yet
      </div>
    );
  }

  return (
    <List
      listRef={listRef}
      rowCount={messages.length}
      rowHeight={dynamicRowHeight}
      rowComponent={MessageRowWrapper}
      rowProps={{
        messages,
        MessageRowComponent,
        dynamicRowHeight,
        expandedMessageId,
        setExpandedMessageId,
        ...rowProps,
      }}
      onRowsRendered={handleRowsRendered}
      overscanCount={5}
      style={{ height, width: "100%" }}
    />
  );
}
