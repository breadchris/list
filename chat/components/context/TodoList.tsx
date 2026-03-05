import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { IPane, PaneContent } from './types';
import { SupabaseClient } from '@supabase/supabase-js';
import { Plus, Check, X, GripVertical, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

const INDENT_PX = 24;
const DEPTH_DRAG_STEP = 30;
const MAX_DEPTH = 4;

interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
    depth: number;
}

interface DragInfo {
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    itemWidth: number;
    originalDepth: number;
    subtreeItems: TodoItem[];
    remainingItems: TodoItem[];
}

function getSubtreeEnd(items: TodoItem[], index: number): number {
    const base = items[index].depth;
    let end = index + 1;
    while (end < items.length && items[end].depth > base) end++;
    return end;
}

function fixDepths(items: TodoItem[]): TodoItem[] {
    return items.map((item, i) => {
        const maxD = i === 0 ? 0 : items[i - 1].depth + 1;
        return item.depth > maxD ? { ...item, depth: maxD } : item;
    });
}

export const TodoList = forwardRef<IPane, {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    initialContent?: string;
    onContentAdded?: () => void;
    onChange?: () => void;
}>(({ sessionId, groupId, userId, supabase, initialContent, onContentAdded, onChange }, ref) => {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [newItemText, setNewItemText] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [dragItemId, setDragItemId] = useState<string | null>(null);
    const [focusId, setFocusId] = useState<string | null>(null);

    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const listRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const indicatorSpacerRef = useRef<HTMLDivElement>(null);
    const dragInfoRef = useRef<DragInfo | null>(null);
    const dropTargetRef = useRef<{ insertIndex: number; depth: number } | null>(null);
    const lastMoveRef = useRef({ y: 0, time: 0, velocity: 0 });

    // Clear focusId after it's been used
    useEffect(() => {
        if (focusId) {
            const t = setTimeout(() => setFocusId(null), 300);
            return () => clearTimeout(t);
        }
    }, [focusId]);

    // Compute which items are in the dragged subtree (for dimming)
    const dragSubtreeIds = React.useMemo(() => {
        if (!dragItemId) return new Set<string>();
        const idx = items.findIndex(i => i.id === dragItemId);
        if (idx === -1) return new Set<string>();
        const end = getSubtreeEnd(items, idx);
        return new Set(items.slice(idx, end).map(i => i.id));
    }, [dragItemId, items]);

    // Handle initial content
    useEffect(() => {
        if (initialContent && isLoaded) {
            const lines = initialContent.split('\n').filter(l => l.trim().length > 0);
            const newItems = lines.map(line => ({
                id: crypto.randomUUID(),
                text: line.replace(/^[-*]\s/, '').trim(),
                completed: false,
                createdAt: Date.now(),
                depth: 0,
            }));
            setItems(prev => [...prev, ...newItems]);
            if (onContentAdded) onContentAdded();
            if (onChange) onChange();
        }
    }, [initialContent, isLoaded]);

    useImperativeHandle(ref, () => ({
        acceptContent: (content: PaneContent) => {
            if (content.text) {
                const lines = content.text.split('\n').filter(l => l.trim().length > 0);
                const newItems = lines.map(line => ({
                    id: crypto.randomUUID(),
                    text: line.replace(/^[-*]\s/, '').trim(),
                    completed: false,
                    createdAt: Date.now(),
                    depth: 0,
                }));
                setItems(prev => [...prev, ...newItems]);
                if (onChange) onChange();
            }
        }
    }));

    // Load
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const response = await fetch(`/api/context/state?type=todo&groupId=${groupId}&sessionId=${sessionId}`);
                if (active && response.ok) {
                    const data = await response.json();
                    if (data && data.value) {
                        setItems(data.value.map((item: any) => ({ ...item, depth: item.depth ?? 0 })));
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

    // Save (debounced)
    useEffect(() => {
        if (!isLoaded) return;
        const timeout = setTimeout(async () => {
            try {
                await fetch(`/api/context/state?type=todo&groupId=${groupId}&userId=${userId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            setItems(prev => [...prev, {
                id: crypto.randomUUID(),
                text: newItemText.trim(),
                completed: false,
                createdAt: Date.now(),
                depth: 0,
            }]);
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
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === id);
            if (idx === -1) return prev;
            const end = getSubtreeEnd(prev, idx);
            return [...prev.slice(0, idx), ...prev.slice(end)];
        });
        if (onChange) onChange();
    };

    const updateItemText = (id: string, text: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, text } : item
        ));
        if (onChange) onChange();
    };

    const addSubtask = useCallback((parentId: string) => {
        const id = crypto.randomUUID();
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === parentId);
            if (idx === -1) return prev;
            const parentDepth = prev[idx].depth;
            if (parentDepth >= MAX_DEPTH) return prev;
            const end = getSubtreeEnd(prev, idx);
            const newItem: TodoItem = {
                id,
                text: '',
                completed: false,
                createdAt: Date.now(),
                depth: parentDepth + 1,
            };
            return [...prev.slice(0, end), newItem, ...prev.slice(end)];
        });
        setFocusId(id);
        if (onChange) onChange();
    }, [onChange]);

    // Filter
    const filteredItems = items.filter(item => {
        if (filter === 'active') return !item.completed;
        if (filter === 'completed') return item.completed;
        return true;
    });

    const activeCount = items.filter(i => !i.completed).length;

    // --- Drag ---
    const handleDragStart = useCallback((itemId: string, e: React.PointerEvent) => {
        if (filter !== 'all') return;
        e.preventDefault();

        const index = items.findIndex(i => i.id === itemId);
        if (index === -1) return;

        const el = itemRefs.current.get(itemId);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const subtreeEnd = getSubtreeEnd(items, index);
        const subtreeItems = items.slice(index, subtreeEnd);
        const subtreeIdSet = new Set(subtreeItems.map(i => i.id));
        const remainingItems = items.filter(i => !subtreeIdSet.has(i.id));

        dragInfoRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            itemWidth: rect.width,
            originalDepth: items[index].depth,
            subtreeItems,
            remainingItems,
        };

        lastMoveRef.current = { y: e.clientY, time: performance.now(), velocity: 0 };
        dropTargetRef.current = null;
        setDragItemId(itemId);
    }, [items, filter]);

    // Pointer move/up during drag
    useEffect(() => {
        if (!dragItemId) return;

        // Show overlay at initial position
        const di = dragInfoRef.current;
        if (di && overlayRef.current) {
            overlayRef.current.style.display = 'block';
            overlayRef.current.style.width = `${di.itemWidth}px`;
            overlayRef.current.style.left = `${di.startX - di.offsetX}px`;
            overlayRef.current.style.top = `${di.startY - di.offsetY}px`;
            overlayRef.current.style.transform = 'rotate(0deg)';
        }

        const handleMove = (e: PointerEvent) => {
            const info = dragInfoRef.current;
            if (!info || !listRef.current) return;

            // Update overlay position
            if (overlayRef.current) {
                overlayRef.current.style.left = `${e.clientX - info.offsetX}px`;
                overlayRef.current.style.top = `${e.clientY - info.offsetY}px`;
            }

            // Velocity for inertia rotation
            const now = performance.now();
            const dt = now - lastMoveRef.current.time;
            if (dt > 0) {
                const v = ((e.clientY - lastMoveRef.current.y) / dt) * 1000;
                lastMoveRef.current.velocity = lastMoveRef.current.velocity * 0.7 + v * 0.3;
            }
            lastMoveRef.current.y = e.clientY;
            lastMoveRef.current.time = now;

            const maxR = 0.4;
            const rot = -Math.max(-maxR, Math.min(maxR, (lastMoveRef.current.velocity / 1500) * maxR));
            if (overlayRef.current) {
                overlayRef.current.style.transform = `rotate(${rot}deg)`;
            }

            // Find target insert index among remaining items
            const remaining = info.remainingItems;
            let insertIdx = 0;
            for (let i = 0; i < remaining.length; i++) {
                const el = itemRefs.current.get(remaining[i].id);
                if (el) {
                    const r = el.getBoundingClientRect();
                    if (e.clientY > r.top + r.height / 2) insertIdx = i + 1;
                }
            }

            // Target depth from horizontal offset
            const deltaX = e.clientX - info.startX;
            let depth = info.originalDepth + Math.round(deltaX / DEPTH_DRAG_STEP);
            const maxDepth = insertIdx > 0
                ? Math.min(remaining[insertIdx - 1].depth + 1, MAX_DEPTH)
                : 0;
            depth = Math.max(0, Math.min(maxDepth, depth));

            dropTargetRef.current = { insertIndex: insertIdx, depth };

            // Update indicator
            const listEl = listRef.current;
            if (indicatorRef.current && indicatorSpacerRef.current && listEl) {
                const listRect = listEl.getBoundingClientRect();
                const scroll = listEl.scrollTop;
                let y = 0;

                if (remaining.length === 0) {
                    y = scroll + 8;
                } else if (insertIdx === 0) {
                    const firstEl = itemRefs.current.get(remaining[0].id);
                    if (firstEl) y = firstEl.getBoundingClientRect().top - listRect.top + scroll - 5;
                } else {
                    const prevEl = itemRefs.current.get(remaining[insertIdx - 1].id);
                    if (prevEl) {
                        const r = prevEl.getBoundingClientRect();
                        y = r.bottom - listRect.top + scroll + 3;
                    }
                }

                indicatorRef.current.style.display = 'flex';
                indicatorRef.current.style.top = `${y}px`;
                indicatorSpacerRef.current.style.width = `${depth * INDENT_PX}px`;
            }

            // Auto-scroll near edges
            const listRect = listEl.getBoundingClientRect();
            const edgeThreshold = 40;
            const scrollSpeed = 8;
            if (e.clientY < listRect.top + edgeThreshold) {
                listEl.scrollTop -= scrollSpeed;
            } else if (e.clientY > listRect.bottom - edgeThreshold) {
                listEl.scrollTop += scrollSpeed;
            }
        };

        const handleUp = () => {
            const info = dragInfoRef.current;
            const target = dropTargetRef.current;

            if (info && target) {
                const depthShift = target.depth - info.subtreeItems[0].depth;
                const adjusted = info.subtreeItems.map(item => ({
                    ...item,
                    depth: Math.max(0, Math.min(MAX_DEPTH, item.depth + depthShift)),
                }));

                const newItems = [
                    ...info.remainingItems.slice(0, target.insertIndex),
                    ...adjusted,
                    ...info.remainingItems.slice(target.insertIndex),
                ];

                setItems(fixDepths(newItems));
                if (onChange) onChange();
            }

            dragInfoRef.current = null;
            dropTargetRef.current = null;
            lastMoveRef.current = { y: 0, time: 0, velocity: 0 };
            setDragItemId(null);

            if (overlayRef.current) overlayRef.current.style.display = 'none';
            if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        };
    }, [dragItemId, onChange]);

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{items.length}</span> items
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="font-semibold text-foreground">{activeCount}</span> remaining
                </div>
                <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg">
                    {(['all', 'active', 'completed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx(
                                "px-2 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                                filter === f
                                    ? "bg-background text-indigo-600 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 relative">
                <div className="space-y-1.5">
                    <AnimatePresence initial={false} mode="popLayout">
                        {filteredItems.map((item) => {
                            const isInSubtree = dragSubtreeIds.has(item.id);
                            return (
                                <motion.div
                                    key={item.id}
                                    ref={(el: HTMLDivElement | null) => {
                                        if (el) itemRefs.current.set(item.id, el);
                                        else itemRefs.current.delete(item.id);
                                    }}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: isInSubtree ? 0.25 : 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                    style={{ marginLeft: item.depth * INDENT_PX }}
                                    className={clsx(
                                        "group flex items-start gap-2 p-3 rounded-xl border",
                                        isInSubtree && "pointer-events-none",
                                        item.completed
                                            ? "bg-muted border-border"
                                            : "bg-background border-border hover:border-indigo-200 hover:shadow-sm"
                                    )}
                                >
                                    <div
                                        onPointerDown={(e) => handleDragStart(item.id, e)}
                                        className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none select-none"
                                    >
                                        <GripVertical className="w-4 h-4" />
                                    </div>

                                    <button
                                        onClick={() => toggleItem(item.id)}
                                        className={clsx(
                                            "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                            item.completed
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "border-border text-transparent hover:border-indigo-400"
                                        )}
                                    >
                                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                    </button>

                                    <textarea
                                        value={item.text}
                                        onChange={(e) => {
                                            updateItemText(item.id, e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        rows={1}
                                        ref={(el) => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                                if (focusId === item.id) el.focus();
                                            }
                                        }}
                                        placeholder={item.depth > 0 ? "Subtask..." : "Task..."}
                                        className={clsx(
                                            "flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none resize-none leading-relaxed break-words",
                                            item.completed
                                                ? "text-muted-foreground line-through decoration-muted-foreground"
                                                : "text-foreground"
                                        )}
                                    />

                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {item.depth < MAX_DEPTH && (
                                            <button
                                                onClick={() => addSubtask(item.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-indigo-500 rounded transition-all"
                                                title="Add subtask"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Drop indicator */}
                <div
                    ref={indicatorRef}
                    className="absolute left-4 right-4 flex items-center pointer-events-none z-40"
                    style={{ display: 'none', top: 0 }}
                >
                    <div ref={indicatorSpacerRef} className="shrink-0" style={{ width: 0 }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <div className="flex-1 h-0.5 bg-indigo-500 rounded-full ml-0.5" />
                </div>

                {items.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No items yet</p>
                    </div>
                )}
            </div>

            {/* Add item */}
            <div className="p-4 border-t border-border bg-background">
                <form onSubmit={handleAddItem} className="relative">
                    <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Add a new task..."
                        className="w-full pl-4 pr-12 py-3 bg-muted border border-border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-muted-foreground"
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

            {/* Drag overlay */}
            <div
                ref={overlayRef}
                className="fixed pointer-events-none z-[100]"
                style={{
                    display: 'none',
                    transformOrigin: 'left center',
                    transition: 'transform 60ms ease-out',
                }}
            >
                {dragItemId && (() => {
                    const item = items.find(i => i.id === dragItemId);
                    if (!item) return null;
                    return (
                        <div className="flex items-start gap-2 p-3 rounded-xl border border-indigo-300 bg-background shadow-lg shadow-indigo-500/10">
                            <GripVertical className="w-4 h-4 mt-0.5 text-indigo-400" />
                            <div className={clsx(
                                "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                                item.completed ? "bg-green-500 border-green-500 text-white" : "border-border text-transparent"
                            )}>
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            </div>
                            <span className={clsx(
                                "text-sm",
                                item.completed && "text-muted-foreground line-through"
                            )}>
                                {item.text || 'New task...'}
                            </span>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
});
