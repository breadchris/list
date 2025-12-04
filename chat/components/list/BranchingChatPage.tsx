import { useState, useEffect, useRef } from 'react';
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

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  isStreaming?: boolean;
  isCollapsed?: boolean;
  parentId: string | null;
  branchLabel?: string;
  createdAt: number; // Track when this branch was created
}

const BRANCH_COLORS = ['#D4C4A8', '#C9B99A', '#BEAE8C', '#D9CDB8', '#CFC0A4'];

export default function BranchingChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'root',
      text: 'Hello! How can I assist you today?',
      sender: 'assistant',
      timestamp: '9:41 AM',
      isCollapsed: false,
      parentId: null,
      createdAt: 0,
    },
    {
      id: 'user-1',
      text: 'I want to plan a vacation for next month',
      sender: 'user',
      timestamp: '9:42 AM',
      isCollapsed: false,
      parentId: 'root',
      branchLabel: 'Original',
      createdAt: 1,
    },
    {
      id: 'assistant-1',
      text: "Great! I'd love to help you plan a vacation. What type of destination are you interested in? Beach, mountains, city, or something else?",
      sender: 'assistant',
      timestamp: '9:42 AM',
      isCollapsed: true,
      parentId: 'user-1',
      createdAt: 2,
    },
    {
      id: 'user-2a',
      text: "I'm thinking about a beach vacation in Mexico",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Original',
      createdAt: 3,
    },
    {
      id: 'assistant-2a',
      text: "Excellent choice! Mexico has beautiful beaches. Some popular options are Cancun, Playa del Carmen, and Tulum. Cancun offers great resorts and nightlife, while Tulum has stunning Mayan ruins right by the beach. What's your budget range?",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2a',
      createdAt: 4,
    },
    {
      id: 'user-2b',
      text: "Actually, I'm more interested in a mountain retreat",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 1',
      createdAt: 5,
    },
    {
      id: 'assistant-2b',
      text: "Mountain retreats are wonderful for relaxation! Consider destinations like Banff in Canada, the Swiss Alps, or Aspen in Colorado. Are you interested in skiing, hiking, or just enjoying the scenery?",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2b',
      createdAt: 6,
    },
    {
      id: 'user-2c',
      text: "What about a cultural city experience in Europe?",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 2',
      createdAt: 7,
    },
    {
      id: 'assistant-2c',
      text: "Europe is perfect for cultural exploration! Top cities include Paris for art and cuisine, Rome for ancient history, Barcelona for unique architecture, and Prague for medieval charm. How many days are you planning to spend?",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2c',
      createdAt: 8,
    },
    {
      id: 'user-2d',
      text: "I'd prefer an exotic island getaway somewhere tropical",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 3',
      createdAt: 9,
    },
    {
      id: 'assistant-2d',
      text: "Tropical islands are amazing! Consider the Maldives for luxury, Bali for culture and beaches, or Fiji for pristine nature. Each offers crystal-clear waters and unique experiences.",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2d',
      createdAt: 10,
    },
    {
      id: 'user-2e',
      text: "Maybe an adventure trip like safari in Africa?",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 4',
      createdAt: 11,
    },
    {
      id: 'assistant-2e',
      text: "A safari is an unforgettable experience! Kenya and Tanzania offer the classic Serengeti migration, while South Africa combines safari with wine country and coastal cities. Botswana is great for a more exclusive, intimate experience.",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2e',
      createdAt: 12,
    },
    {
      id: 'user-2f',
      text: "What about a cruise vacation?",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 5',
      createdAt: 13,
    },
    {
      id: 'assistant-2f',
      text: "Cruises are a fantastic all-in-one option! Caribbean cruises are popular and affordable, Mediterranean cruises offer multiple European cities, and Alaskan cruises provide stunning glaciers and wildlife. You can visit multiple destinations without packing and unpacking!",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2f',
      createdAt: 14,
    },
    {
      id: 'user-2g',
      text: "How about a road trip across the USA?",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 6',
      createdAt: 15,
    },
    {
      id: 'assistant-2g',
      text: "Road trips offer incredible freedom! Classic routes include Route 66, the Pacific Coast Highway, or a tour of National Parks. You could also explore the Southwest deserts, New England in fall, or the Deep South for music and cuisine.",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2g',
      createdAt: 16,
    },
    {
      id: 'user-2h',
      text: "I'm interested in visiting Japan",
      sender: 'user',
      timestamp: '9:43 AM',
      isCollapsed: false,
      parentId: 'assistant-1',
      branchLabel: 'Branch 7',
      createdAt: 17,
    },
    {
      id: 'assistant-2h',
      text: "Japan is extraordinary! Tokyo offers modern city life and incredible food, Kyoto has beautiful temples and traditional culture, and you can experience Mt. Fuji, hot springs, and cherry blossoms depending on the season. Spring and fall are particularly beautiful!",
      sender: 'assistant',
      timestamp: '9:43 AM',
      isCollapsed: true,
      parentId: 'user-2h',
      createdAt: 18,
    },
    {
      id: 'user-3a',
      text: 'Around $2000 per person for a week',
      sender: 'user',
      timestamp: '9:44 AM',
      isCollapsed: false,
      parentId: 'assistant-2a',
      branchLabel: 'Original',
      createdAt: 19,
    },
    {
      id: 'assistant-3a',
      text: "Perfect! With $2000 per person for a week in Mexico, you can stay at a nice all-inclusive resort in Playa del Carmen. This typically covers accommodation, meals, drinks, and some activities. You'll have money left over for excursions like snorkeling or visiting cenotes!",
      sender: 'assistant',
      timestamp: '9:44 AM',
      isCollapsed: false,
      parentId: 'user-3a',
      createdAt: 20,
    },
  ]);
  
  // Track the current path through the conversation tree (list of message IDs)
  const [currentPath, setCurrentPath] = useState<string[]>(['root', 'user-1', 'assistant-1', 'user-2a', 'assistant-2a', 'user-3a', 'assistant-3a']);
  
  const [userFocusedView, setUserFocusedView] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const branchCounterRef = useRef(1);
  const [hasSeenDemo, setHasSeenDemo] = useState(false);
  const [activeVariant, setActiveVariant] = useState('branch-list');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);

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

  useEffect(() => {
    if (!hasSeenDemo) {
      branchCounterRef.current = 8; // Set to 8 since we have Branch 1 through Branch 7
      setHasSeenDemo(true);
    }
  }, [hasSeenDemo]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentPath]);

  // Get the linear conversation following the current path
  const getVisibleMessages = () => {
    return currentPath.map(id => messages.find(m => m.id === id)!).filter(Boolean);
  };

  // Get all sibling messages (alternative branches) at a given point
  const getSiblingsForMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return [];
    
    return messages.filter(m => 
      m.parentId === message.parentId && m.id !== messageId
    );
  };

  // Get children of a message
  const getChildrenOfMessage = (messageId: string) => {
    return messages.filter(m => m.parentId === messageId);
  };

  // Switch to a different branch at a specific point in the conversation
  const switchToBranch = (newMessageId: string, positionInPath: number) => {
    // Keep the path up to this position, then follow the new branch
    const newPath = [...currentPath.slice(0, positionInPath), newMessageId];
    
    // Continue the path by following the first child at each level
    let currentId = newMessageId;
    while (true) {
      const children = getChildrenOfMessage(currentId);
      if (children.length === 0) break;
      currentId = children[0].id;
      newPath.push(currentId);
    }
    
    setCurrentPath(newPath);
  };

  const streamMessage = (messageId: string, fullText: string, timestamp: string) => {
    const words = fullText.split(' ');
    let currentWordIndex = 0;

    const streamInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        const wordsToShow = words.slice(0, currentWordIndex + 1).join(' ');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, text: wordsToShow, timestamp }
              : msg
          )
        );
        currentWordIndex++;
      } else {
        clearInterval(streamInterval);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          )
        );
      }
    }, 80);

    streamingTimeoutRef.current = streamInterval as unknown as NodeJS.Timeout;
  };

  const handleSendMessage = (text: string) => {
    // If editing a message, handle the edit
    if (editingMessage) {
      handleEditMessage(editingMessage.id, text);
      setEditingMessage(null);
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Collapse only assistant messages in the current path
    setMessages((prev) =>
      prev.map((msg) => ({ 
        ...msg, 
        isCollapsed: msg.sender === 'assistant' && currentPath.includes(msg.id) ? true : msg.isCollapsed 
      }))
    );

    // Get the last message in the current path
    const lastMessageId = currentPath[currentPath.length - 1];

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: timeString,
      isCollapsed: false,
      parentId: lastMessageId,
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentPath((prev) => [...prev, userMessage.id]);

    // Simulate streaming response
    setTimeout(() => {
      const assistantMessageId = (Date.now() + 1).toString();
      const fullResponse = "This is a simulated response to your message. In a real application, this would connect to an AI service.";
      
      const assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        sender: 'assistant',
        timestamp: timeString,
        isStreaming: true,
        isCollapsed: false,
        parentId: userMessage.id,
        createdAt: Date.now(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentPath((prev) => [...prev, assistantMessageId]);
      
      setTimeout(() => {
        streamMessage(assistantMessageId, fullResponse, timeString);
      }, 100);
    }, 800);
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

  const handleEditMessage = (originalMessageId: string, newText: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const originalMessage = messages.find(m => m.id === originalMessageId);
    if (!originalMessage) return;

    // Create a new message as a sibling to the original
    const branchNumber = branchCounterRef.current++;
    const colorIndex = (branchNumber - 1) % BRANCH_COLORS.length;
    
    const newMessage: Message = {
      id: `${Date.now()}-edit`,
      text: newText,
      sender: 'user',
      timestamp: timeString,
      isCollapsed: false,
      parentId: originalMessage.parentId,
      branchLabel: `Branch ${branchNumber}`,
      createdAt: Date.now(),
    };

    // Add label to original if it doesn't have one
    if (!originalMessage.branchLabel) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === originalMessageId ? { ...msg, branchLabel: 'Original', createdAt: originalMessage.createdAt || 0 } : msg
        )
      );
    }

    setMessages((prev) => [...prev, newMessage]);

    // Update the path to include this new message
    const positionInPath = currentPath.indexOf(originalMessageId);
    const newPath = [...currentPath.slice(0, positionInPath), newMessage.id];
    setCurrentPath(newPath);

    // Generate a response to the edited message
    setTimeout(() => {
      const assistantMessageId = `${Date.now()}-response`;
      const fullResponse = `I see you've edited your message to: "${newText}". This is a new branch in the conversation!`;
      
      const assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        sender: 'assistant',
        timestamp: timeString,
        isStreaming: true,
        isCollapsed: false,
        parentId: newMessage.id,
        createdAt: Date.now(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentPath((prev) => [...prev, assistantMessageId]);
      
      setTimeout(() => {
        streamMessage(assistantMessageId, fullResponse, timeString);
      }, 100);
    }, 800);
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

  const handleBookmark = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    // Check if already bookmarked
    const existingBookmark = bookmarks.find(b => b.messageId === messageId);
    if (existingBookmark) {
      // Remove bookmark
      handleRemoveBookmark(existingBookmark.id);
      return;
    }

    const newBookmark: BookmarkedMessage = {
      id: `bookmark-${Date.now()}`,
      text: message.text,
      messageId: message.id,
      sender: message.sender,
      timestamp: message.timestamp,
      order: bookmarks.length,
    };

    setBookmarks(prev => [...prev, newBookmark]);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
  };

  const handleReorderBookmarks = (reordered: BookmarkedMessage[]) => {
    // Update order property
    const updated = reordered.map((bookmark, index) => ({
      ...bookmark,
      order: index,
    }));
    setBookmarks(updated);
  };

  const handleClickBookmark = (messageId: string) => {
    // Find the message element and scroll to it
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      messageElement.style.backgroundColor = '#F4D03F';
      setTimeout(() => {
        messageElement.style.backgroundColor = '';
      }, 1000);
    }
  };

  const isMessageBookmarked = (messageId: string) => {
    return bookmarks.some(b => b.messageId === messageId);
  };

  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(false);

  const visibleMessages = getVisibleMessages();

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
    <div className="flex h-screen overflow-hidden bg-[#E8DCC8]">
      {/* Main chat area with max width on large screens */}
      <div className="flex-1 flex justify-center">
        <div className="flex flex-col h-screen bg-[#E8DCC8] w-full max-w-5xl">
          {/* Header */}
          <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <h1 className="text-sm sm:text-lg truncate">Retro Chat Interface</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Variant selector */}
              <select
                value={activeVariant}
                onChange={(e) => setActiveVariant(e.target.value)}
                className="bg-[#F5EFE3] border-2 border-[#9a8a6a] px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:border-[#E67E50]"
              >
                {variants.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setUserFocusedView(!userFocusedView)}
                className={`hover:bg-[#e4c02f] p-1.5 sm:p-2 transition-colors border ${ 
                  userFocusedView ? 'bg-[#e4c02f] border-[#9a8a6a]' : 'border-transparent'
                }`}
                title={userFocusedView ? 'Show all messages' : 'Focus on my messages'}
              >
                <LayoutList className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button className="p-1.5 sm:p-2 hover:bg-[#e4c02f] transition-colors">
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
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
                  {allVersions.length > 1 && (
                    <div className="hidden sm:block">
                      <BranchList
                        branches={allVersions.map((msg, i) => ({
                          id: msg.id,
                          label: msg.branchLabel || `Version ${i + 1}`,
                          color: BRANCH_COLORS[i % BRANCH_COLORS.length],
                        }))}
                        activeMessageId={message.id}
                        onSelectBranch={(msgId) => switchToBranch(msgId, index)}
                      />
                    </div>
                  )}
                  {/* Mobile branch selector - simplified */}
                  {allVersions.length > 1 && (
                    <div className="block sm:hidden mb-4">
                      <select
                        value={message.id}
                        onChange={(e) => switchToBranch(e.target.value, index)}
                        className="w-full p-2 border-2 border-[#9a8a6a] bg-[#F5EFE3] text-sm"
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t-2 border-[#9a8a6a] flex-shrink-0">
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