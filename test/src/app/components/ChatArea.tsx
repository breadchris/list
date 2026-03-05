import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Message, Persona, ChatSession } from '../types';
import { IPane, PaneContent } from '../types';
import { Send, User, Bot, Sparkles, Wrench, Music, Brain, Smile, HardHat, NotebookPen, PanelRightClose, PanelRightOpen, ChefHat, BookmarkPlus, MoreHorizontal, Settings, ListFilter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as Tooltip from '@radix-ui/react-tooltip';
import { StructuredQuestionCard } from './StructuredQuestionCard';
import { WikiActionCard } from './WikiActionCard';
import { RecipeCard } from './RecipeCard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatAreaProps {
  messages: Message[];
  currentPersona: Persona;
  personas: Persona[];
  session?: ChatSession;
  onSendMessage: (text: string) => void;
  onSwitchPersona: (persona: Persona) => void;
  isTyping: boolean;
  targetMessageId?: string | null;
  onRefine: (text: string) => Promise<string>;
  onToggleEditor: () => void;
  isEditorOpen: boolean;
  onWikiAction: (messageId: string, action: 'approve' | 'reject') => void;
  onAddToTimeline: (message: Message) => void;
  isFadingIn?: boolean;
  onAction?: (message: Message, event: React.MouseEvent) => void;
}

const getIcon = (role: string) => {
  switch (role.toLowerCase()) {
    case 'engineer': return Wrench;
    case 'principal engineer': return HardHat;
    case 'musician': return Music;
    case 'philosopher': return Brain;
    case 'friend': return Smile;
    case 'chef': return ChefHat;
    default: return Sparkles;
  }
};

export const ChatArea = forwardRef<IPane, ChatAreaProps>(({ 
  messages, 
  currentPersona, 
  personas,
  session,
  onSendMessage, 
  onSwitchPersona,
  isTyping, 
  targetMessageId,
  onRefine,
  onToggleEditor,
  isEditorOpen,
  onWikiAction,
  onAddToTimeline,
  isFadingIn = false,
  onAction
}, ref) => {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const inputRef = useRef<HTMLInputElement>(null);
  
  useImperativeHandle(ref, () => ({
      acceptContent: (content: PaneContent) => {
          if (content.text) {
              setInputText(prev => prev + (prev ? '\n' : '') + content.text);
              setTimeout(() => inputRef.current?.focus(), 100);
          }
      },
      toggleSettings: () => setShowSettings(prev => !prev)
  }));
  
  // Scroll State
  const lastMessageCount = useRef(messages.length);
  const hasScrolledToBottom = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle New Messages & Initial Load
  useEffect(() => {
    // If we are focused on a specific target message, don't auto-scroll to bottom
    if (targetMessageId) return;

    const isNewMessage = messages.length > lastMessageCount.current;
    const isInitialLoad = !hasScrolledToBottom.current && messages.length > 0;

    if (scrollContainerRef.current) {
        if (isInitialLoad) {
            // Instant scroll on first load
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            hasScrolledToBottom.current = true;
        } else if (isNewMessage || isTyping) {
            // Smooth scroll for new messages
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    lastMessageCount.current = messages.length;
  }, [messages, isTyping, targetMessageId]);

  // Focus input on mount with preventScroll
  useEffect(() => {
      inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Handle Target Message Navigation
  useEffect(() => {
    if (targetMessageId && messageRefs.current[targetMessageId]) {
      // If we are fading in (loading state), snap instantly so it's ready when visible
      const behavior = isFadingIn ? 'auto' : 'smooth';
      messageRefs.current[targetMessageId]?.scrollIntoView({ behavior, block: 'center' });
    }
  }, [targetMessageId, isFadingIn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Persona Header Banner - Subtle background indicator */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 z-10"
        style={{ color: currentPersona.color }}
      />

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && session && (
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute top-16 right-4 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden"
            >
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-500" />
                        Settings
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="mb-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <ListFilter className="w-3 h-3" />
                            Context Constraints
                        </h4>
                        
                        {session.constraints && Object.entries(session.constraints).length > 0 ? (
                            <div className="space-y-3">
                                {Object.entries(session.constraints).map(([key, value]) => (
                                    <div key={key} className="bg-slate-50 border border-slate-100 rounded-lg p-3 group hover:border-indigo-100 transition-colors">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{key}</span>
                                        </div>
                                        <div className="text-sm text-slate-700 leading-relaxed break-words pl-3.5 border-l-2 border-slate-200 group-hover:border-indigo-200 transition-colors">
                                            {value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic bg-slate-50 border border-slate-100 border-dashed rounded-lg p-4 text-center">
                                No active constraints.
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className={cn(
        "flex-1 overflow-y-auto p-4 md:p-6 space-y-6 transition-opacity duration-500",
        isFadingIn ? "opacity-0" : "opacity-100"
      )}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
            <Sparkles className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Start documenting your ideas</p>
            <p className="text-sm">Select a persona below to begin</p>
          </div>
        )}

        {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const msgPersona = !isUser && msg.personaId 
              ? personas.find(p => p.id === msg.personaId) || currentPersona 
              : currentPersona;
            
            const Icon = !isUser ? getIcon(msgPersona.role) : User;

            return (
                <motion.div
                    key={msg.id}
                    ref={el => { messageRefs.current[msg.id] = el }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'} ${targetMessageId === msg.id ? 'bg-indigo-50/50 -mx-4 px-4 py-2 rounded-lg transition-colors duration-1000' : ''}`}
                >
                    <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden
                        ${isUser ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                        style={!isUser && !msgPersona.avatarUrl ? { color: msgPersona.color, borderColor: msgPersona.color } : {}}
                    >
                        {!isUser && msgPersona.avatarUrl ? (
                            <img src={msgPersona.avatarUrl} alt={msgPersona.name} className="w-full h-full object-cover" />
                        ) : (
                            <Icon className="w-4 h-4" />
                        )}
                    </div>
                    
                    <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-500">
                                {isUser ? 'You' : msgPersona.name}
                            </span>
                            <span className="text-[10px] text-slate-300">
                                {format(msg.timestamp, 'h:mm a')}
                            </span>
                        </div>
                        
                        <div className="relative group/bubble">
                            <div 
                                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden
                                ${isUser 
                                    ? 'bg-slate-800 text-white rounded-tr-none' 
                                    : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'}`}
                            >
                                {isUser ? (
                                    msg.text
                                ) : (
                                    <ReactMarkdown
                                        components={{
                                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                                            a: ({node, ...props}) => (
                                                <a 
                                                    className="text-indigo-600 underline hover:text-indigo-800 cursor-pointer decoration-indigo-300 underline-offset-2 transition-colors" 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const text = e.currentTarget.textContent;
                                                        if (text) onSendMessage(`Tell me more about ${text}`);
                                                    }}
                                                    {...props} 
                                                />
                                            ),
                                            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                                            code: ({node, inline, className, children, ...props}: any) => {
                                                if (inline) {
                                                    return <code className="bg-slate-200 rounded px-1 py-0.5 text-xs font-mono text-slate-800" {...props}>{children}</code>;
                                                }
                                                return <code className="bg-transparent text-inherit font-mono text-xs" {...props}>{children}</code>;
                                            },
                                            pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-50 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2" {...props} />,
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                )}
                            </div>

                            {/* Action Button */}
                            <button 
                                onClick={(e) => onAction?.(msg, e)}
                                className={`absolute top-2 ${isUser ? '-left-10' : '-right-10'} p-2 text-slate-300 hover:text-indigo-600 bg-white rounded-full shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 z-10`}
                                title="Actions"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Structured Question UI */}
                        {!isUser && msg.structuredQuestion && (
                          <div className="w-full mt-2">
                             <StructuredQuestionCard 
                                data={msg.structuredQuestion}
                                onSelect={(id, text) => onSendMessage(text)}
                                onRefine={onRefine}
                             />
                          </div>
                        )}

                        {/* Wiki Action UI */}
                        {!isUser && msg.wikiAction && (
                           <div className="w-full mt-2">
                              <WikiActionCard
                                path={msg.wikiAction.path}
                                content={msg.wikiAction.content}
                                status={msg.wikiAction.status}
                                onApprove={() => onWikiAction(msg.id, 'approve')}
                                onReject={() => onWikiAction(msg.id, 'reject')}
                              />
                           </div>
                        )}

                        {/* Recipe UI */}
                        {!isUser && msg.recipe && (
                          <div className="w-full mt-2">
                             <RecipeCard recipe={msg.recipe} />
                          </div>
                        )}
                    </div>
                </motion.div>
            );
        })}

        {isTyping && (
           <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white border border-slate-200 overflow-hidden"
                style={!currentPersona.avatarUrl ? { color: currentPersona.color, borderColor: currentPersona.color } : {}}
            >
                {/* Use the specific icon for current persona */}
                {(() => {
                  if (currentPersona.avatarUrl) {
                      return <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="w-full h-full object-cover" />;
                  }
                  const Icon = getIcon(currentPersona.role);
                  return <Icon className="w-4 h-4" />;
                })()}
            </div>
            <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto w-full">
            
            {/* Persona Switcher - Closer to input */}
            <Tooltip.Provider delayDuration={300}>
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2 mask-linear-fade">
                {personas.map(p => {
                  const Icon = getIcon(p.role);
                  const isActive = currentPersona.id === p.id;
                  return (
                    <Tooltip.Root key={p.id}>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={() => onSwitchPersona(p)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border shrink-0",
                            isActive 
                              ? "bg-slate-800 text-white border-slate-800 shadow-sm ring-1 ring-slate-800 ring-offset-1" 
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover -ml-1" />
                          ) : (
                              <Icon className="w-3 h-3" />
                          )}
                          {p.name}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="z-50 overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                          sideOffset={5}
                          side="top"
                        >
                          <div className="font-semibold mb-0.5">{p.role}</div>
                          <div className="text-slate-500 max-w-[200px] leading-tight">{p.description}</div>
                          <Tooltip.Arrow className="fill-white" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  );
                })}
                
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => onSwitchPersona({ 
                        id: 'manage-personas', 
                        name: 'Manage', 
                        role: 'System', 
                        description: 'Configure custom personas', 
                        color: '#64748b', 
                        initialPrompt: '',
                        systemPrompt: '',
                        avatarUrl: '' 
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border border-dashed border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400 hover:bg-slate-50 shrink-0 ml-1"
                    >
                      <Settings className="w-3 h-3" />
                      Manage
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="z-50 overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                      sideOffset={5}
                      side="top"
                    >
                      <div className="font-semibold mb-0.5">Manage Personas</div>
                      <div className="text-slate-500 max-w-[200px] leading-tight">Create, edit, or remove custom AI personalities</div>
                      <Tooltip.Arrow className="fill-white" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            </Tooltip.Provider>

            <form 
                onSubmit={handleSubmit}
                className="relative flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-offset-1 focus-within:border-transparent transition-all"
                style={{ 
                    '--tw-ring-color': currentPersona.color,
                    '--tw-ring-opacity': '0.3'
                } as React.CSSProperties}
            >
            <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Tell ${currentPersona.name} what's on your mind...`}
                className="flex-1 bg-transparent border-none focus:ring-0 px-3 py-2 text-slate-800 placeholder:text-slate-400 outline-none"
                // autoFocus removed to prevent scroll jumping
            />
            <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className={`p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm`}
                style={{ backgroundColor: inputText.trim() ? currentPersona.color : '#94a3b8' }}
            >
                <Send className="w-4 h-4" />
            </button>
            </form>
        </div>
      </div>
    </div>
  );
});