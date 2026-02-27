import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { TimelineEntry, ChatSession, Persona } from '../types';
import { IPane, PaneContent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MessageSquare, Plus, History, Book, Home, ArrowRight, ArrowLeft, ChefHat, HelpCircle, FileText, MoreHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { WikiTree } from './WikiTree';

interface SidebarProps {
  entries: TimelineEntry[];
  sessions: ChatSession[];
  personas: Persona[];
  currentSessionId: string | null;
  onEntryClick?: (entry: TimelineEntry) => void;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  
  // Wiki Props
  wikiPaths?: string[];
  currentWikiPath?: string | null;
  onWikiSelect?: (path: string) => void;
  onCreateWikiPage?: (path: string) => void;
  onBackToHome?: () => void;
  onUpdateEntry?: (entry: TimelineEntry) => void;
  onDeleteEntry?: (id: string) => void;
  
  // New Props
  onSubmit?: (text: string) => void;
  isExpanded?: boolean;
  onOpenSandbox?: () => void;
  onAction?: (entry: TimelineEntry, event: React.MouseEvent) => void;
}

type Tab = 'timeline' | 'chats' | 'wiki';

export const Sidebar = forwardRef<IPane, SidebarProps>(({ 
  entries, 
  sessions, 
  personas,
  currentSessionId,
  onEntryClick,
  onSessionSelect,
  onNewChat,
  wikiPaths = [],
  currentWikiPath = null,
  onWikiSelect,
  onCreateWikiPage,
  onBackToHome,
  onUpdateEntry,
  onDeleteEntry,
  onSubmit,
  isExpanded = false,
  onOpenSandbox,
  onAction
}, ref) => {
  // const [activeTab, setActiveTab] = useState<Tab>('timeline'); // Tabs hidden for now
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useImperativeHandle(ref, () => ({
      acceptContent: (content: PaneContent) => {
          if (content.text) {
              setInput(prev => prev + (prev ? '\n' : '') + content.text);
              setTimeout(() => inputRef.current?.focus(), 100);
          }
      },
      startEditing: (entryId: string) => {
          const entry = entries.find(e => e.id === entryId);
          if (entry) {
              setEditingEntryId(entryId);
              setEditValue(entry.content);
          }
      }
  }));

  const saveEdit = () => {
      if (editingEntryId && onUpdateEntry) {
          const entry = entries.find(e => e.id === editingEntryId);
          if (entry) {
              onUpdateEntry({ ...entry, content: editValue });
          }
      }
      setEditingEntryId(null);
  };
  
  const cancelEdit = () => {
      setEditingEntryId(null);
  };

  // Timeline Logic
  // Filter entries if we have a sessionId context, assuming Sidebar can be used in filtered mode
  // But wait, the Sidebar component itself doesn't have a "filtered mode" prop yet, it relies on global entries.
  // The Sandbox filters entries before passing them? Or we should filter here?
  // User asked for "Every pane has its own state of context".
  // If we pass filtered entries from Sandbox, that satisfies it.
  // But we can also add internal filtering if we want.
  // For now, let's assume `entries` passed are already the "context" for this pane.
  
  const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const groupedEntries = sortedEntries.reduce((acc, entry) => {
    const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, TimelineEntry[]>);
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const getDateLabel = (dateStr: string) => {
    // dateStr is 'yyyy-MM-dd'. new Date(dateStr) parses as UTC, which can result in the previous day 
    // for timezones behind UTC. Appending 'T00:00:00' forces local time parsing.
    const date = new Date(dateStr + 'T00:00:00');
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleInputSubmit = () => {
      if (input.trim() && onSubmit) {
          onSubmit(input);
          setInput('');
      }
  };

  return (
    <div className={cn(
        "h-full flex flex-col bg-slate-50 overflow-hidden font-sans transition-all duration-500 ease-in-out",
        isExpanded ? "items-center pt-20 px-4" : "border-r border-slate-200 w-full"
    )}>
      
      {/* Input Section */}
      <div className={cn(
           "shrink-0 transition-all duration-500 ease-in-out w-full z-20",
           isExpanded ? "max-w-2xl mb-8" : "p-3 border-b border-slate-100 bg-white flex flex-col gap-2"
       )}>
           {isExpanded ? (
               <h1 className="text-3xl font-light text-slate-800 text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 {entries.length === 0 ? "What's on your mind?" : "just write"}
               </h1>
           ) : onBackToHome && (
               <button 
                   onClick={onBackToHome}
                   className="self-start flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors px-1 py-0.5"
               >
                   <ArrowLeft className="w-3.5 h-3.5" />
                   <span>Back to Home</span>
               </button>
           )}

           <div className="relative group">
                {isExpanded && <div className="absolute inset-0 bg-indigo-200 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none" />}
                
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleInputSubmit();
                        }
                    }}
                    placeholder={isExpanded ? "Type here..." : "Capture an idea..."}
                    className={cn(
                        "w-full bg-white text-slate-700 placeholder:text-slate-300 outline-none resize-none transition-all",
                        isExpanded 
                            ? "rounded-2xl p-6 text-xl shadow-xl border border-indigo-50 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 min-h-[120px] relative z-10"
                            : "rounded-xl p-3 text-sm shadow-sm border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[80px] pr-2"
                    )}
                />
                <button 
                    onClick={handleInputSubmit}
                    disabled={!input.trim()}
                    className={cn(
                        "absolute text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-0 disabled:scale-90 transition-all shadow-md z-20 flex items-center justify-center",
                        isExpanded
                             ? "bottom-4 right-4 p-2 rounded-xl"
                             : "bottom-2 right-2 p-1.5 rounded-lg w-8 h-8"
                    )}
                >
                    <ArrowRight className={isExpanded ? "w-5 h-5" : "w-4 h-4"} />
                </button>
           </div>
       </div>

      <div className={cn(
          "flex-1 overflow-hidden relative w-full flex flex-col",
          isExpanded ? "max-w-2xl" : ""
      )}>
            {/* Timeline Content */}
            <motion.div 
            layout
            className="h-full overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 w-full"
            >
                {sortedDates.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No ideas documented yet.</p>
                        {isExpanded && <p className="text-xs mt-2">Start typing above to begin.</p>}
                    </div>
                ) : (
                    sortedDates.map((dateKey) => (
                        <div key={dateKey} className="relative">
                            <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm pb-2 pt-2 border-b border-transparent">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">
                                    {getDateLabel(dateKey)}
                                </h3>
                            </div>
                            
                            <div className="space-y-4 pt-2 pb-2">
                                {groupedEntries[dateKey].map((entry) => {
                                    return (
                                    <motion.div
                                        key={entry.id}
                                        layoutId={entry.id}
                                        className="relative group"
                                    >
                                        <div 
                                            onClick={(e) => {
                                                if (editingEntryId !== entry.id) {
                                                    e.stopPropagation();
                                                    onAction?.(entry, e);
                                                }
                                            }}
                                            className={cn(
                                                "bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer hover:border-indigo-200 hover:translate-x-0.5",
                                                isExpanded ? "p-5" : "p-3",
                                                editingEntryId === entry.id ? "ring-2 ring-indigo-500 ring-offset-2" : ""
                                            )}
                                        >
                                            {/* Render Content Based on Type */}
                                            {editingEntryId === entry.id ? (
                                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                                    <textarea 
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-700 outline-none focus:border-indigo-400 resize-none min-h-[100px]"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={cancelEdit}
                                                            className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={saveEdit}
                                                            className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : entry.type === 'recipe' && entry.metadata ? (
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-orange-100 p-2 rounded-lg shrink-0 text-orange-600">
                                                        <ChefHat className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{entry.metadata.title}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {entry.metadata.cookTime} • {entry.metadata.difficulty}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : entry.type === 'question' && entry.metadata ? (
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-indigo-100 p-2 rounded-lg shrink-0 text-indigo-600">
                                                        <HelpCircle className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{entry.metadata.title || "Structured Question"}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                            {entry.metadata.questions?.[0]?.text || entry.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : entry.type === 'wiki' && entry.metadata ? (
                                                 <div className="flex items-start gap-3">
                                                    <div className="bg-emerald-100 p-2 rounded-lg shrink-0 text-emerald-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">Wiki Update</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                                            /{entry.metadata.path}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className={cn(
                                                    "text-slate-700 leading-relaxed line-clamp-3",
                                                    isExpanded ? "text-lg" : "text-sm"
                                                )}>
                                                    {entry.content}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap items-center justify-between mt-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        {format(entry.timestamp, 'h:mm a')}
                                                    </span>
                                                    <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                        {entry.tags && entry.tags.map(tag => (
                                                            <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onAction?.(entry, e); }}
                                                        className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded-full"
                                                        title="Actions"
                                                    >
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </motion.div>
      </div>
    </div>
  );
});
