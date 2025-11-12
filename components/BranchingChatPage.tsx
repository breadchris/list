import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BranchingChatMessage } from './BranchingChatMessage';
import { BranchingChatInput } from './BranchingChatInput';
import { MessageCircle, MoreVertical, LayoutList } from 'lucide-react';
import { BranchTabs } from './BranchTabs';
import { BranchList } from './BranchList';
import { VariantSidebar } from './VariantSidebar';
import { HighlightsSidebar, Highlight } from './HighlightsSidebar';
import { BranchingChatSidebar } from './BranchingChatSidebar';
import { NotesArea } from './NotesArea';
import { BookmarksSidebar, BookmarkedMessage } from './BookmarksSidebar';
import { useBranchingChat } from '../hooks/useBranchingChat';
import { ContentRepository } from './ContentRepository';
import { supabase } from './SupabaseClient';

const BRANCH_COLORS = ['#E5E7EB', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#E9D5FF'];

export default function BranchingChatPage() {
  // Get groupId from URL params
  const { groupId } = useParams<{ groupId: string }>();

  // Chat root content ID - this will be the container for the branching chat
  const [chatRootId, setChatRootId] = useState<string | null>(null);
  const repository = new ContentRepository();

  // Initialize or load chat root
  useEffect(() => {
    const initChatRoot = async () => {
      if (!groupId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // IMPORTANT: Check for existing chat before creating to prevent duplicates
        // React StrictMode will execute this effect twice in development, so we must
        // query first and only create if no chat exists for this group/user combination
        const { data: existingChats, error: queryError } = await supabase
          .from("content")
          .select("id")
          .eq("type", "ai-chat")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .eq("metadata->>chat_type", "branching")
          .order("created_at", { ascending: false })
          .limit(1);

        if (queryError) {
          console.error("Failed to query existing chats:", queryError);
          return;
        }

        // If chat root already exists, reuse it (prevents duplicate creation)
        if (existingChats && existingChats.length > 0) {
          setChatRootId(existingChats[0].id);
          return;
        }

        // Only create a new chat root if none exists
        const { data: newChat, error } = await supabase
          .from("content")
          .insert({
            type: "ai-chat",
            data: "Branching Chat Session",
            group_id: groupId,
            user_id: user.id,
            metadata: {
              chat_type: "branching",
              created_at: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to create chat root:", error);
          return;
        }

        setChatRootId(newChat.id);
      } catch (error) {
        console.error("Failed to initialize chat:", error);
      }
    };

    initChatRoot();
  }, [groupId]);

  // Use branching chat hook with real streaming
  const {
    messages,
    currentPath,
    input,
    handleInputChange,
    handleSubmit,
    sendMessage,
    currentResponse,
    isLoading,
    isLoadingMessages,
    getSiblingsForMessage,
    switchToBranch,
    editMessage,
    setMessages,
  } = useBranchingChat({
    groupId: groupId || "",
    chatRootId,
    basePrompt: "",
  });

  // UI state (not from hook)
  const [userFocusedView, setUserFocusedView] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeVariant, setActiveVariant] = useState('default');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(false);

  const variants = [
    {
      id: 'default',
      name: 'Default Chat',
      description: 'Clean chat interface'
    },
    {
      id: 'highlights',
      name: 'Text Highlights',
      description: 'Select and save text snippets'
    },
    {
      id: 'bookmarks',
      name: 'Bookmarks',
      description: 'Bookmark and organize messages'
    },
    {
      id: 'notes-sidebar',
      name: 'Notes Sidebar',
      description: 'Chat with a sidebar for notes'
    },
  ];

  // Wrapper for handle send to work with existing UI
  const handleSendMessage = (text: string) => {
    // If editing, call editMessage instead
    if (editingMessage) {
      editMessage(editingMessage.id, text);
      setEditingMessage(null);
      return;
    }

    // Use sendMessage directly - no state race condition
    sendMessage(text);
  };

  // Handle follow-up question click
  const handleFollowUpClick = (question: string) => {
    handleSendMessage(question);
  };

  const toggleMessageExpansion = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isCollapsed: !msg.isCollapsed } : msg
      )
    );
  };

  const startEditingMessage = (messageId: string, messageText: string) => {
    setEditingMessage({ id: messageId, text: messageText });
  };

  // Get visible messages for current path
  const getVisibleMessages = () => {
    // Only show messages in the current path (not all siblings)
    // Branch tabs at each point allow switching between alternatives
    return currentPath
      .filter(id => id !== "root")
      .map(id => messages.find(m => m.id === id))
      .filter((m): m is BranchingMessage => m !== undefined);
  };

  const visibleMessages = getVisibleMessages();

  const addHighlight = (text: string) => {
    const newHighlight: Highlight = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleString(),
    };
    setHighlights((prev) => [...prev, newHighlight]);
  };

  const handleHighlight = (messageId: string, text: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const newHighlight: Highlight = {
      id: `highlight-${Date.now()}`,
      text,
      messageId: message.id,
      messageSender: message.sender,
      timestamp: message.timestamp,
    };

    setHighlights(prev => [...prev, newHighlight]);
  };

  const handleRemoveHighlight = (highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
  };

  const toggleBookmark = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    setBookmarks((prev) => {
      const exists = prev.some(b => b.messageId === messageId);
      if (exists) {
        return prev.filter(b => b.messageId !== messageId);
      } else {
        return [...prev, {
          id: `bookmark-${Date.now()}`,
          text: message.text,
          messageId: message.id,
          sender: message.sender,
          timestamp: message.timestamp,
          order: prev.length,
        }];
      }
    });
  };

  const handleBookmark = (messageId: string) => {
    toggleBookmark(messageId);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
  };

  const handleReorderBookmarks = (reordered: BookmarkedMessage[]) => {
    const updated = reordered.map((bookmark, index) => ({
      ...bookmark,
      order: index,
    }));
    setBookmarks(updated);
  };

  const handleClickBookmark = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.style.backgroundColor = '#DBEAFE'; // blue-100
      setTimeout(() => {
        messageElement.style.backgroundColor = '';
      }, 1000);
    }
  };

  const isMessageBookmarked = (messageId: string) => {
    return bookmarks.some(b => b.messageId === messageId);
  };

  const reorderBookmarks = (startIndex: number, endIndex: number) => {
    const result = Array.from(bookmarks);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setBookmarks(result);
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    // Small delay to allow layout to stabilize before scrolling
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timeout);
  }, [messages, currentResponse]);

  // Loading state
  if (isLoadingMessages) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-medium mb-2">Loading chat...</div>
          <div className="text-sm text-gray-600">Fetching messages from database</div>
        </div>
      </div>
    );
  }

  // Show notes sidebar layout
  if (activeVariant === 'notes-sidebar') {
    return (
      <div className="flex h-screen overflow-hidden">
        <BranchingChatSidebar
          messages={visibleMessages}
          onSendMessage={handleSendMessage}
          onToggleMessage={toggleMessageExpansion}
          onEditMessage={(messageId) => {
            const message = messages.find(m => m.id === messageId);
            if (message) {
              startEditingMessage(messageId, message.text);
            }
          }}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          isCollapsed={chatSidebarCollapsed}
          onToggleCollapse={() => setChatSidebarCollapsed(!chatSidebarCollapsed)}
          activeVariant={activeVariant}
          variants={variants}
          onSelectVariant={setActiveVariant}
        />
        <NotesArea
          activeVariant={activeVariant}
          variants={variants}
          onSelectVariant={setActiveVariant}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Main chat area with max width on large screens */}
      <div className="flex-1 flex justify-center">
        <div className="flex flex-col h-screen bg-white w-full max-w-5xl">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 shadow-sm p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <h1 className="text-sm sm:text-lg truncate">Branching Chat</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Variant selector */}
              <select
                value={activeVariant}
                onChange={(e) => setActiveVariant(e.target.value)}
                className="bg-white border border-gray-300 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {variants.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setUserFocusedView(!userFocusedView)}
                className={`hover:bg-gray-100 p-1.5 sm:p-2 transition-colors border ${
                  userFocusedView ? 'bg-gray-100 border-gray-300' : 'border-transparent'
                }`}
                title={userFocusedView ? 'Show all messages' : 'Focus on my messages'}
              >
                <LayoutList className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button className="p-1.5 sm:p-2 hover:bg-gray-100 transition-colors">
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            {visibleMessages.length === 0 && !isLoading ? (
              <div className="text-center text-gray-600 py-8">
                <p className="text-lg mb-2">Start a conversation</p>
                <p className="text-sm">Type a message below to begin</p>
              </div>
            ) : (
              <>
                {visibleMessages.map((message, index) => {
                  const siblings = getSiblingsForMessage(message.id);
                  const allVersions = [message, ...siblings].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                  return (
                    <div key={message.id} id={`message-${message.id}`}>
                      <BranchingChatMessage
                        message={message.text}
                        sender={message.sender}
                        timestamp={message.timestamp}
                        isStreaming={message.isStreaming}
                        isCollapsed={userFocusedView && message.sender === 'assistant' ? true : message.isCollapsed}
                        onToggle={() => toggleMessageExpansion(message.id)}
                        onEdit={message.sender === 'user' ? () => startEditingMessage(message.id, message.text) : undefined}
                        onHighlight={activeVariant === 'highlights' ? (text) => handleHighlight(message.id, text) : undefined}
                        onBookmark={activeVariant === 'bookmarks' ? () => handleBookmark(message.id) : undefined}
                        isBookmarked={activeVariant === 'bookmarks' ? isMessageBookmarked(message.id) : false}
                        disableAnimation={!message.isStreaming}
                      />

                      {/* Follow-up questions for assistant messages */}
                      {message.sender === 'assistant' && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                        <div className="flex justify-start mb-4">
                          <div className="max-w-[80%] space-y-2">
                            <div className="text-xs text-gray-600 px-2">Suggested questions:</div>
                            <div className="flex flex-wrap gap-2">
                              {message.followUpQuestions.map((question, qIdx) => (
                                <button
                                  key={qIdx}
                                  onClick={() => handleFollowUpClick(question)}
                                  className="text-xs px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full transition-colors border border-gray-200"
                                >
                                  {question}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {allVersions.length > 1 && (
                        <div className="hidden sm:block">
                          <BranchList
                            branches={allVersions.map((msg, i) => ({
                              id: msg.id,
                              label: msg.branchLabel || `Version ${i + 1}`,
                              color: BRANCH_COLORS[i % BRANCH_COLORS.length],
                            }))}
                            activeMessageId={allVersions.find(v => currentPath.includes(v.id))?.id || message.id}
                            onSelectBranch={(msgId) => switchToBranch(msgId)}
                          />
                        </div>
                      )}
                      {/* Mobile branch selector - simplified */}
                      {allVersions.length > 1 && (
                        <div className="block sm:hidden mb-4">
                          <select
                            value={allVersions.find(v => currentPath.includes(v.id))?.id || message.id}
                            onChange={(e) => switchToBranch(e.target.value)}
                            className="w-full p-2 border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {allVersions.map((msg, i) => (
                              <option key={msg.id} value={msg.id}>
                                {msg.branchLabel || `Version ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show streaming message if loading */}
                {isLoading && currentResponse?.answer && (
                  <div key="streaming-message" id="message-streaming">
                    <BranchingChatMessage
                      message={currentResponse.answer}
                      sender="assistant"
                      timestamp={new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      isStreaming={true}
                      isCollapsed={false}
                      onToggle={() => {}}
                      disableAnimation={false}
                    />

                    {/* Follow-up questions for streaming message */}
                    {currentResponse.follow_up_questions && currentResponse.follow_up_questions.length > 0 && (
                      <div className="flex justify-start mb-4">
                        <div className="max-w-[80%] space-y-2">
                          <div className="text-xs text-gray-600 px-2">Suggested questions:</div>
                          <div className="flex flex-wrap gap-2">
                            {currentResponse.follow_up_questions.map((question, qIdx) => (
                              <button
                                key={qIdx}
                                onClick={() => handleFollowUpClick(question)}
                                className="text-xs px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full transition-colors border border-gray-200"
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 flex-shrink-0">
            <BranchingChatInput
              onSend={handleSendMessage}
              initialValue={editingMessage?.text}
              isEditing={!!editingMessage}
              onCancelEdit={() => setEditingMessage(null)}
            />
          </div>
        </div>
      </div>

      {/* Highlights Sidebar - shown when highlights variant is active */}
      {activeVariant === 'highlights' && (
        <HighlightsSidebar
          highlights={highlights}
          onRemoveHighlight={handleRemoveHighlight}
        />
      )}

      {/* Bookmarks Sidebar - shown when bookmarks variant is active */}
      {activeVariant === 'bookmarks' && (
        <BookmarksSidebar
          bookmarks={bookmarks}
          onRemoveBookmark={handleRemoveBookmark}
          onReorderBookmarks={handleReorderBookmarks}
          onClickBookmark={handleClickBookmark}
        />
      )}
    </div>
  );
}
