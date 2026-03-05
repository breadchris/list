import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { IPane, PaneContent } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Plus, Trash2, Check, X, GripVertical, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-61781242`;

interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
}

export const TodoList = forwardRef<IPane, { 
    sessionId: string; 
    supabase: SupabaseClient; 
    initialContent?: string;
    onContentAdded?: () => void;
    onChange?: () => void;
}>(({ sessionId, supabase, initialContent, onContentAdded, onChange }, ref) => {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [newItemText, setNewItemText] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

    // Handle initial content
    useEffect(() => {
        if (initialContent && isLoaded) {
            const lines = initialContent.split('\n').filter(l => l.trim().length > 0);
            const newItems = lines.map(line => ({
                id: crypto.randomUUID(),
                text: line.replace(/^[-*]\s/, '').trim(),
                completed: false,
                createdAt: Date.now()
            }));
            setItems(prev => [...prev, ...newItems]);
            if (onContentAdded) onContentAdded();
            if (onChange) onChange();
        }
    }, [initialContent, isLoaded]); // Depend on isLoaded to ensure we append to loaded state, not overwrite or get overwritten

    // Expose method to accept content from outside (e.g. from Chat)
    useImperativeHandle(ref, () => ({
        acceptContent: (content: PaneContent) => {
            if (content.text) {
                // Split by newlines to handle multiple items
                const lines = content.text.split('\n').filter(l => l.trim().length > 0);
                const newItems = lines.map(line => ({
                    id: crypto.randomUUID(),
                    text: line.replace(/^[-*]\s/, '').trim(), // Remove bullet points if present
                    completed: false,
                    createdAt: Date.now()
                }));
                
                setItems(prev => [...prev, ...newItems]);
                if (onChange) onChange();
            }
        }
    }));

    // Load initial state
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const response = await fetch(`${SERVER_URL}/todo/state?sessionId=${sessionId}`, {
                    headers: { 'Authorization': `Bearer ${publicAnonKey}` }
                });
                
                if (active && response.ok) {
                    const data = await response.json();
                    if (data && data.value) {
                        setItems(data.value);
                    }
                }
            } catch (e) {
                console.error("Error loading todo list", e);
            } finally {
                if (active) setIsLoaded(true);
            }
        }
        load();
        return () => { active = false; };
    }, [sessionId]);

    // Save state on change (debounced)
    useEffect(() => {
        if (!isLoaded) return;
        
        const timeout = setTimeout(async () => {
            try {
                await fetch(`${SERVER_URL}/todo/state`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${publicAnonKey}` 
                    },
                    body: JSON.stringify({ sessionId, value: items })
                });
            } catch (e) {
                console.error("Error saving todo list", e);
            }
        }, 1000);

        return () => clearTimeout(timeout);
    }, [items, sessionId, isLoaded]);

    const handleAddItem = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newItemText.trim()) {
            setItems(prev => [
                ...prev, 
                { 
                    id: crypto.randomUUID(), 
                    text: newItemText.trim(), 
                    completed: false, 
                    createdAt: Date.now() 
                }
            ]);
            setNewItemText('');
            if (onChange) onChange();
        }
    };

    const toggleItem = (id: string) => {
        setItems(prev => prev.map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
        if (onChange) onChange();
    };

    const deleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
        if (onChange) onChange();
    };

    const updateItemText = (id: string, text: string) => {
         setItems(prev => prev.map(item => 
            item.id === id ? { ...item, text } : item
        ));
         if (onChange) onChange();
    };

    const filteredItems = items.filter(item => {
        if (filter === 'active') return !item.completed;
        if (filter === 'completed') return item.completed;
        return true;
    });

    const activeCount = items.filter(i => !i.completed).length;

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{items.length}</span> items
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="font-semibold text-slate-700">{activeCount}</span> remaining
                </div>
                
                <div className="flex items-center gap-1 bg-slate-100/50 p-0.5 rounded-lg">
                    {(['all', 'active', 'completed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx(
                                "px-2 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                                filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                    {filteredItems.map(item => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={clsx(
                                "group flex items-start gap-3 p-3 rounded-xl border transition-all",
                                item.completed ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm"
                            )}
                        >
                            <button
                                onClick={() => toggleItem(item.id)}
                                className={clsx(
                                    "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                    item.completed ? "bg-green-500 border-green-500 text-white" : "border-slate-300 text-transparent hover:border-indigo-400"
                                )}
                            >
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                            
                            <input 
                                value={item.text}
                                onChange={(e) => updateItemText(item.id, e.target.value)}
                                className={clsx(
                                    "flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none resize-none leading-relaxed",
                                    item.completed ? "text-slate-400 line-through decoration-slate-300" : "text-slate-700"
                                )}
                            />

                            <button
                                onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {items.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No items yet</p>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
                <form onSubmit={handleAddItem} className="relative">
                    <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Add a new task..."
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={!newItemText.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
});
