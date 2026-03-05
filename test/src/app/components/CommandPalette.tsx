import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, FileText, MessageSquare, Layout, Plus, StickyNote, Book } from 'lucide-react';
import { Persona } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  personas: Persona[];
  onSwitchPersona: (persona: Persona) => void;
  onOpenSandbox: () => void;
  onOpenWiki: () => void;
  onAddToTimeline: (text: string) => void;
}

export function CommandPalette({
  isOpen,
  setIsOpen,
  personas,
  onSwitchPersona,
  onOpenSandbox,
  onOpenWiki,
  onAddToTimeline
}: CommandPaletteProps) {
  
  // Toggle with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setIsOpen]);

  // Actions
  const handleAction = (action: () => void) => {
      action();
      setIsOpen(false);
  };

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100]"
    >
      <div className="flex items-center border-b border-slate-100 px-3" cmdk-input-wrapper="">
        <Search className="w-5 h-5 text-slate-400 mr-2" />
        <Command.Input 
            placeholder="Type a command or search..." 
            className="w-full py-4 text-base outline-none text-slate-700 placeholder:text-slate-400"
        />
      </div>
      
      <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
        <Command.Empty className="py-6 text-center text-sm text-slate-500">No results found.</Command.Empty>

        <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Command.Item 
                onSelect={() => handleAction(() => {
                    const text = prompt("Quick Note:");
                    if(text) onAddToTimeline(text);
                })}
                className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors"
            >
                <StickyNote className="w-4 h-4" />
                <span>Quick Note</span>
            </Command.Item>
            <Command.Item 
                onSelect={() => handleAction(onOpenWiki)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors"
            >
                <Book className="w-4 h-4" />
                <span>Open Wiki</span>
            </Command.Item>
             <Command.Item 
                onSelect={() => handleAction(onOpenSandbox)}
                className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors"
            >
                <Layout className="w-4 h-4" />
                <span>Open Sandbox</span>
            </Command.Item>
        </Command.Group>

        <Command.Group heading="Chat with Persona" className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">
            {personas.map(p => (
                <Command.Item 
                    key={p.id}
                    onSelect={() => handleAction(() => onSwitchPersona(p))}
                    className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors"
                >
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]" style={{ color: p.color }}>
                        {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full rounded-full object-cover"/> : p.role[0]}
                    </div>
                    <span>Chat with {p.name}</span>
                </Command.Item>
            ))}
        </Command.Group>

        <Command.Group heading="Development" className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">
            <Command.Item 
                 onSelect={() => handleAction(onOpenSandbox)}
                 className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors"
            >
                <Layout className="w-4 h-4" />
                <span>Storybook: Open Sandbox</span>
            </Command.Item>
        </Command.Group>

      </Command.List>
      
      <div className="border-t border-slate-100 px-4 py-2 flex justify-between items-center text-[10px] text-slate-400 bg-slate-50/50">
          <div className="flex gap-2">
              <span><kbd className="font-sans bg-white border border-slate-200 rounded px-1">↵</kbd> to select</span>
              <span><kbd className="font-sans bg-white border border-slate-200 rounded px-1">↑↓</kbd> to navigate</span>
          </div>
          <span>v1.0</span>
      </div>
    </Command.Dialog>
  );
}
