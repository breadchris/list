import React, { useState, useEffect, useRef } from 'react';
import { Resizable } from 're-resizable';
import { useDrag, useDrop } from 'react-dnd';
import { X, Plus, GripVertical, Layout, Search, Book, Database, FileText, Settings, CreditCard, Component, MessageSquare, Clock, Layers, ChevronRight, ChevronLeft, Workflow, MoreHorizontal, Edit2, CornerUpRight, ArrowRight, Link, CheckSquare, Trash2, PanelLeftClose, PanelLeftOpen, Globe, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { Command } from 'cmdk';
import { DialogTitle, DialogDescription } from './ui/dialog';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { Editor } from './Editor';
import { FlowEditor } from './FlowEditor';
import { TodoList } from './TodoList';
import { TimelineEntry, ChatSession, Persona, Message } from '../types';
import { ComponentRegistry } from '../data/componentRegistry';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DraggablePaneWrapper } from './DraggablePaneWrapper';
import ReactMarkdown from 'react-markdown';

import { IPane } from '../types';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-61781242`;

interface SandboxProps {
  entries: TimelineEntry[];
  sessions: ChatSession[];
  personas: Persona[];
  currentSessionId: string | null;
  currentPersona: Persona;
  messages: Message[];
  onSendMessage: (text: string, sessionId?: string, connectedSessionId?: string) => Promise<any>;
  onSwitchPersona: (persona: Persona) => void;
  typingSessionId: string | null;
  onEntryClick: (entry: TimelineEntry) => void;
  onAddTimelineEntry: (text: string, sessionId?: string) => void;
  onUpdateTimelineEntry: (entry: TimelineEntry) => void;
  onDeleteTimelineEntry: (id: string) => void;
  onAddToGraph: (text: string, sessionId: string) => void;
  flowActions: Record<string, any[]>;
  onClearFlowActions: (sessionId: string) => void;
  onUpdateMessage: (messageId: string, updates: Partial<Message>) => void;
  supabase: any;
  onClose: () => void;
}

type PaneType = 'timeline' | 'chat' | 'wiki' | 'component' | 'graph' | 'todo' | 'iframe';

interface Pane {
  id: string;
  type: PaneType;
  width: number;
  title?: string; // Custom title
  componentId?: string; // For 'component' type
  sessionId?: string; // For 'chat' type context
  pendingContent?: string; // Initial content for editors
  url?: string; // For 'iframe' type
  readerMode?: boolean; // For 'iframe' type - Reader Mode toggle
  readerContent?: string; // For 'iframe' type - Cached markdown content
  connectedPaneId?: string; // For connecting chat to wiki/graph
  isOpen?: boolean; // If false, the pane is hidden but still associated with the row
  lastActiveAt?: number; // Timestamp for MRU ordering
  hasContent?: boolean; // Track if user has modified content
}

interface PaneRow {
  id: string;
  panes: Pane[];
  title?: string; // e.g. Session Title or Date
  createdAt: Date;
}

interface ActionMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  item: any; // TimelineEntry or Message
  sourceRowId: string;
  sourcePaneId?: string;
}

interface RadialItem {
  id: string;
  icon: any;
  label: string;
  action: () => void;
}

const getPaneDefaultTitle = (pane: Pane) => {
    if (pane.title) return pane.title;
    if (pane.type === 'component' && pane.componentId) return ComponentRegistry[pane.componentId]?.label;
    if (pane.type === 'graph') return 'Graph';
    if (pane.type === 'todo') return 'To-Do';
    return pane.type.charAt(0).toUpperCase() + pane.type.slice(1);
};

interface SidebarPaneProps {
  pane: Pane;
  index: number;
  rowId: string;
  activeRowId: string;
  moveSidebarPane: (rowId: string, dragIndex: number, hoverIndex: number) => void;
  openPane: (rowId: string, paneId: string) => void;
  deletePane: (rowId: string, paneId: string) => void;
}

const SidebarPane = ({ pane, index, rowId, activeRowId, moveSidebarPane, openPane, deletePane }: SidebarPaneProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<
    { index: number; id: string; type: string; rowId: string },
    void,
    { handlerId: string | symbol | null }
  >({
    accept: 'SIDEBAR_PANE',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { index: number; id: string; type: string; rowId: string }, monitor) {
      if (!ref.current) return;
      if (item.rowId !== rowId) return; // Prevent cross-row dragging for now
      
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = (clientOffset as any).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveSidebarPane(rowId, dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'SIDEBAR_PANE',
    item: () => {
      return { id: pane.id, index, type: 'SIDEBAR_PANE', rowId };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div 
        ref={ref} 
        style={{ opacity: isDragging ? 0.5 : 1 }}
        data-handler-id={handlerId}
        className="relative group/pane-wrapper"
    >
        <button
            onClick={(e) => {
                e.stopPropagation();
                openPane(rowId, pane.id);
            }}
            className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors relative group/pane cursor-pointer
                ${pane.isOpen !== false 
                    ? 'text-slate-700 hover:bg-slate-100' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 italic'}
            `}
        >
            <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover/pane:opacity-100 cursor-grab active:cursor-grabbing" />
            
            {pane.type === 'timeline' && <Layout className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'chat' && <MessageSquare className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'wiki' && <FileText className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'todo' && <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'graph' && <Workflow className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'component' && <Component className="w-3.5 h-3.5 shrink-0" />}
            {pane.type === 'iframe' && <Globe className="w-3.5 h-3.5 shrink-0" />}
            
            <span className={`text-xs truncate flex-1 ${pane.isOpen === false ? 'line-through decoration-slate-300' : ''}`}>
                {pane.title || getPaneDefaultTitle(pane)}
            </span>

            {pane.isOpen === false && (
                <span className="text-[9px] uppercase font-bold text-slate-300 mr-1">Closed</span>
            )}

            <div 
                role="button"
                onClick={(e) => { e.stopPropagation(); deletePane(rowId, pane.id); }}
                className="opacity-0 group-hover/pane:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-500 rounded transition-all"
                title="Delete permanently"
            >
                <X className="w-3 h-3" />
            </div>
        </button>
    </div>
  );
};

interface SidebarRowProps {
  row: PaneRow;
  index: number;
  activeRowId: string;
  setActiveRowId: (id: string) => void;
  isRowSidebarOpen: boolean;
  editingRowId: string | null;
  renameValue: string;
  setRenameValue: (val: string) => void;
  saveRowTitle: () => void;
  startRenamingRow: (e: any, row: PaneRow) => void;
  handleDeleteRow: (e: any, id: string) => void;
  confirmDeleteRowId: string | null;
  setConfirmDeleteRowId: (id: string | null) => void;
  filteredPanes: Pane[];
  moveRow: (dragIndex: number, hoverIndex: number) => void;
  moveSidebarPane: (rowId: string, dragIndex: number, hoverIndex: number) => void;
  openPane: (rowId: string, paneId: string) => void;
  deletePane: (rowId: string, paneId: string) => void;
  rowCount: number;
}

const SidebarRow = ({ 
  row, index, activeRowId, setActiveRowId, isRowSidebarOpen, 
  editingRowId, renameValue, setRenameValue, saveRowTitle, startRenamingRow,
  handleDeleteRow, confirmDeleteRowId, setConfirmDeleteRowId, filteredPanes,
  moveRow, moveSidebarPane, openPane, deletePane, rowCount
}: SidebarRowProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingRowId === row.id && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [editingRowId, row.id]);

  const [{ handlerId }, drop] = useDrop<
    { index: number; id: string; type: string },
    void,
    { handlerId: string | symbol | null }
  >({
    accept: 'SIDEBAR_ROW',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { index: number; id: string; type: string }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = (clientOffset as any).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveRow(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'SIDEBAR_ROW',
    item: () => {
      return { id: row.id, index, type: 'SIDEBAR_ROW' };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }} data-handler-id={handlerId} className="mb-1">
         <button
            onClick={() => setActiveRowId(row.id)}
            onDoubleClick={(e) => startRenamingRow(e, row)}
            onMouseLeave={() => setConfirmDeleteRowId(null)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors relative group
                ${activeRowId === row.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}
            `}
         >
            {activeRowId === row.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
            )}
            
            <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded border text-xs font-medium cursor-grab active:cursor-grabbing
                 ${activeRowId === row.id ? 'border-indigo-200 bg-indigo-100' : 'border-slate-200 bg-slate-50'}
            `}>
                {index + 1}
            </div>

            {isRowSidebarOpen && (
                <>
                    <div className="min-w-0 flex-1">
                        {editingRowId === row.id ? (
                            <input 
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={saveRowTitle}
                                onKeyDown={(e) => e.key === 'Enter' && saveRowTitle()}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        ) : (
                            <>
                                <div className="text-sm font-medium truncate">{row.title}</div>
                                <div className="text-[10px] text-slate-400">{format(new Date(row.createdAt), 'h:mm a')}</div>
                            </>
                        )}
                    </div>
                    
                    {rowCount > 1 && !editingRowId && (
                        <div 
                            role="button"
                            onClick={(e) => handleDeleteRow(e, row.id)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all duration-200 flex items-center justify-center
                                ${confirmDeleteRowId === row.id 
                                    ? 'opacity-100 bg-red-100 text-red-600 hover:bg-red-200 w-auto px-2' 
                                    : 'opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-red-500'
                                }
                            `}
                        >
                            {confirmDeleteRowId === row.id ? (
                                <span className="text-[10px] font-bold">Delete?</span>
                            ) : (
                                <X className="w-3.5 h-3.5" />
                            )}
                        </div>
                    )}
                </>
            )}
         </button>

         {isRowSidebarOpen && (activeRowId === row.id || filteredPanes.length > 0) && (
            <div className="ml-9 mr-2 space-y-0.5 mt-1 border-l border-slate-100 pl-2">
                {filteredPanes.map((pane, i) => (
                    <SidebarPane 
                        key={pane.id} 
                        pane={pane} 
                        index={i} 
                        rowId={row.id} 
                        activeRowId={activeRowId}
                        moveSidebarPane={moveSidebarPane}
                        openPane={openPane}
                        deletePane={deletePane}
                    />
                ))}
            </div>
         )}
    </div>
  );
};

export function Sandbox({
  entries,
  sessions,
  personas,
  currentSessionId,
  currentPersona,
  messages,
  onSendMessage,
  onSwitchPersona,
  typingSessionId,
  onEntryClick,
  onAddTimelineEntry,
  onUpdateTimelineEntry,
  onDeleteTimelineEntry,
  onAddToGraph,
  flowActions,
  onClearFlowActions,
  onUpdateMessage,
  supabase,
  onClose
}: SandboxProps) {
  const [rows, setRows] = useState<PaneRow[]>([
    { 
      id: 'root', 
      panes: [{ id: '1', type: 'timeline', width: 500, title: 'Timeline', isOpen: true, hasContent: true }],
      createdAt: new Date(),
      title: 'Home'
    }
  ]);
  const [activeRowId, setActiveRowId] = useState<string>('root');
  const [isRowSidebarOpen, setIsRowSidebarOpen] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);
  
  // Renaming State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingPaneId, setEditingPaneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Action Menu State
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);

  // Connection Menu State
  const [connectMenu, setConnectMenu] = useState<{
      isOpen: boolean;
      x: number;
      y: number;
      sourcePaneId: string;
      rowId: string;
  } | null>(null);

  // Helper to find row index
  const activeRowIndex = rows.findIndex(r => r.id === activeRowId);

  // Mobile Navigation State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Sidebar Search State
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Pane Insertion State
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  // Scroll to Pane State
  const [scrollToPaneId, setScrollToPaneId] = useState<string | null>(null);

  // Focus Management State
  const [activePaneId, setActivePaneId] = useState<string | null>(null);

  // Keyboard Navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
              e.preventDefault();
              
              if (rows.length === 0) return;
              
              const currentRowIndex = rows.findIndex(r => r.id === activeRowId);
              if (currentRowIndex === -1) {
                  if (rows.length > 0) setActiveRowId(rows[0].id);
                  return;
              }
              
              const currentRow = rows[currentRowIndex];

              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  let nextRowIndex = currentRowIndex;
                  if (e.key === 'ArrowUp') nextRowIndex = Math.max(0, currentRowIndex - 1);
                  if (e.key === 'ArrowDown') nextRowIndex = Math.min(rows.length - 1, currentRowIndex + 1);
                  
                  if (nextRowIndex !== currentRowIndex) {
                      const nextRow = rows[nextRowIndex];
                      setActiveRowId(nextRow.id);
                      
                      // Activate most recently used pane in that row
                      const lastActive = [...nextRow.panes].sort((a,b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))[0];
                      if (lastActive) {
                          setActivePaneId(lastActive.id);
                          setScrollToPaneId(lastActive.id);
                      }
                  }
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  if (currentRow.panes.length === 0) return;
                  
                  const currentPaneIndex = currentRow.panes.findIndex(p => p.id === activePaneId);
                  const startIndex = currentPaneIndex === -1 ? 0 : currentPaneIndex;
                  
                  let nextPaneIndex = startIndex;
                  if (e.key === 'ArrowLeft') nextPaneIndex = Math.max(0, startIndex - 1);
                  if (e.key === 'ArrowRight') nextPaneIndex = Math.min(currentRow.panes.length - 1, startIndex + 1);
                  
                  if (nextPaneIndex !== currentPaneIndex || currentPaneIndex === -1) {
                      const nextPane = currentRow.panes[nextPaneIndex];
                      setActivePaneId(nextPane.id);
                      setScrollToPaneId(nextPane.id);
                  }
              }
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRowId, activePaneId, rows]);

  // Effect to handle scrolling to a pane when opened/requested
  useEffect(() => {
    if (scrollToPaneId) {
        // Wait for render cycle
        setTimeout(() => {
            const el = document.getElementById(`pane-${scrollToPaneId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            setScrollToPaneId(null);
        }, 100);
    }
  }, [scrollToPaneId, rows]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load state
  useEffect(() => {
      let active = true;
      async function load() {
          try {
              if (!publicAnonKey) {
                  console.error("Missing Supabase Anon Key");
                  return;
              }
              const response = await fetch(`${SERVER_URL}/sandbox/state`, {
                  headers: { 'Authorization': `Bearer ${publicAnonKey}` }
              });
              if (active && response.ok) {
                  const data = await response.json();
                  if (data && data.value) {
                      if (data.value.rows) {
                          // Restore Date objects from strings
                          const loadedRows = data.value.rows.map((r: any) => ({
                              ...r,
                              createdAt: new Date(r.createdAt)
                          }));
                          setRows(loadedRows);
                      }
                      if (data.value.activeRowId) setActiveRowId(data.value.activeRowId);
                  }
              }
          } catch (e) {
              console.error("Error loading sandbox state", e);
          } finally {
              if (active) setIsLoaded(true);
          }
      }
      load();
      return () => { active = false; };
  }, []);

  // Save state (debounced)
  useEffect(() => {
      if (!isLoaded) return;
      
      const timeout = setTimeout(async () => {
          try {
              if (!publicAnonKey) return;
              
              // Clean rows before saving (remove pendingContent)
              const cleanRows = rows.map(r => ({
                  ...r,
                  panes: r.panes.map(p => {
                      const { pendingContent, ...rest } = p;
                      return rest;
                  })
              }));

              await fetch(`${SERVER_URL}/sandbox/state`, {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${publicAnonKey}` 
                  },
                  body: JSON.stringify({ rows: cleanRows, activeRowId })
              });
          } catch (e) {
              console.error("Error saving sandbox state", e);
          }
      }, 1000);

      return () => clearTimeout(timeout);
  }, [rows, activeRowId, isLoaded]);

  // Refs for scrolling
  const rowContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  
  // Pane Refs Map
  const paneRefs = useRef<Record<string, IPane>>({});
  
  // Scroll Positions Map (to preserve scroll across re-renders)
  const scrollPositions = useRef<Record<string, number>>({});

  // Command Menu & Radial Menu State (Scoped to Sandbox, but could be per row? keeping global for now)
  const [isCmdMenuOpen, setIsCmdMenuOpen] = useState(false);
  const [isRadialOpen, setIsRadialOpen] = useState(false);
  const [radialOrigin, setRadialOrigin] = useState({ x: 0, y: 0 });
  const [menuDirection, setMenuDirection] = useState<'left' | 'right'>('right');
  const addButtonRef = useRef<HTMLButtonElement>(null); // Ref for current row's add button?

  useEffect(() => {
      if ((editingRowId || editingPaneId) && renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
      }
  }, [editingRowId, editingPaneId]);

  // Click outside to close action menu and connect menu
  useEffect(() => {
    const clickHandler = () => {
        setActionMenu(null);
        setConnectMenu(null);
        setIsRadialOpen(false);
    };
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, []);

  // Close mobile nav when clicking a row
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeRowId]);

  const addRow = (initialPanes: { type: PaneType, sessionId?: string }[] = [], title: string = 'New Context') => {
    const newId = crypto.randomUUID();
    
    const newRow: PaneRow = {
        id: newId,
        panes: [],
        createdAt: new Date(),
        title: title
    };

    if (initialPanes.length > 0) {
        initialPanes.forEach(p => {
             newRow.panes.push({
                 id: crypto.randomUUID(),
                 type: p.type,
                 width: p.type === 'chat' ? 600 : 400,
                 title: p.type.charAt(0).toUpperCase() + p.type.slice(1),
                 sessionId: p.sessionId || crypto.randomUUID(),
                 isOpen: true,
                 lastActiveAt: Date.now(),
                 hasContent: false // Initially false
             });
        });
    } else {
        // Default to a single chat pane for a new context
        const newSessionId = crypto.randomUUID();
        newRow.panes.push({ 
            id: crypto.randomUUID(), 
            type: 'chat', 
            width: 600, 
            title: 'Chat', 
            sessionId: newSessionId,
            isOpen: true,
            lastActiveAt: Date.now(),
            hasContent: false
        });
    }

    // Insert after current row or at end? Let's do after current row for context continuity
    const currentIndex = rows.findIndex(r => r.id === activeRowId);
    const insertIndex = currentIndex !== -1 ? currentIndex + 1 : rows.length;
    const newRows = [...rows];
    newRows.splice(insertIndex, 0, newRow);
    
    setRows(newRows);
    setActiveRowId(newId);
  };

  const handleEntryClickInternal = (entry: TimelineEntry) => {
      if (!entry.sessionId) return;
      
      const activeRow = rows.find(r => r.id === activeRowId);
      if (!activeRow) return;

      const existingPane = activeRow.panes.find(p => p.type === 'chat' && p.sessionId === entry.sessionId);
      if (!existingPane) {
          addPaneToActiveRow('chat', undefined, entry.sessionId);
      } else {
          openPane(activeRowId, existingPane.id);
      }
  };

  const handleActionTrigger = (e: React.MouseEvent, item: any, sourcePaneId?: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActionMenu({
          isOpen: true,
          x: rect.right + 10,
          y: rect.top,
          item,
          sourceRowId: activeRowId,
          sourcePaneId
      });
  };

  const executeAction = (action: string, target?: string) => {
      if (!actionMenu) return;

      if (action === 'edit_entry') {
          if (actionMenu.sourcePaneId && paneRefs.current[actionMenu.sourcePaneId]) {
              // Check if the pane supports startEditing (Sidebar does)
              const pane = paneRefs.current[actionMenu.sourcePaneId] as any;
              if (pane.startEditing) {
                  pane.startEditing(actionMenu.item.id);
              }
          }
      } else if (action === 'delete_entry') {
          if (onDeleteTimelineEntry) {
              // Optimistically remove from UI via props if provided, or just let App handle it
              // We passed onDeleteTimelineEntry to Sandbox props
              onDeleteTimelineEntry(actionMenu.item.id); // This comes from props
          }
      } else if (action === 'new_row') {
          // Create new row seeded with content
          let title = '';
          const text = actionMenu.item.content || actionMenu.item.text || '';
          if (text) title = text;
          
          // Generate new session for this new context
          const newSessionId = crypto.randomUUID();

          // Create new row with a timeline pane
          addRow([{ type: 'timeline', sessionId: newSessionId }], title);
          
          // Add the content item to this new timeline
          if (text) {
              onAddTimelineEntry(text, newSessionId);
          }
      } else if (action === 'send_to_row') {
          if (target) {
              const targetRow = rows.find(r => r.id === target);
              if (targetRow) {
                  let timelinePane = targetRow.panes.find(p => p.type === 'timeline');
                  let sessionId = timelinePane?.sessionId;
                  let paneCreated = false;
                  
                  if (!timelinePane) {
                       // Determine session ID
                       const chatPane = targetRow.panes.find(p => p.type === 'chat');
                       sessionId = chatPane?.sessionId || crypto.randomUUID();
                       
                       // Create pane
                       timelinePane = {
                           id: crypto.randomUUID(),
                           type: 'timeline',
                           width: 400,
                           title: 'Timeline',
                           sessionId: sessionId,
                           isOpen: true,
                           lastActiveAt: Date.now(),
                           hasContent: true // Created with content
                       };
                       paneCreated = true;
                  }
                  
                  if (sessionId) {
                      const text = actionMenu.item.content || actionMenu.item.text;
                      if (text) {
                          onAddTimelineEntry(text, sessionId);
                      }
                  }
                  
                  if (paneCreated) {
                       setRows(prev => prev.map(r => {
                           if (r.id === target) {
                               return { ...r, panes: [timelinePane!, ...r.panes] };
                           }
                           return r;
                       }));
                  }
                  
                  setActiveRowId(target);
              }
          }
      } else if (action === 'open_in_pane') {
          if (target === 'new_chat') {
             const newSessionId = crypto.randomUUID();
             addPaneToActiveRow('chat', undefined, newSessionId);
             const text = actionMenu.item.content || actionMenu.item.text;
             if (text) {
                 onSendMessage(text, newSessionId);
             }
          } else if (target === 'new_wiki') {
             const text = actionMenu.item.content || actionMenu.item.text;
             addPaneToActiveRow('wiki', undefined, undefined, text);
          } else if (target === 'new_todo') {
             const text = actionMenu.item.content || actionMenu.item.text;
             addPaneToActiveRow('todo', undefined, undefined, text);
          } else if (target === 'new_iframe') {
             const text = actionMenu.item.content || actionMenu.item.text;
             const isUrl = /^(http|https):\/\/[^ "]+$/.test(text);
             const url = isUrl ? text : `https://www.google.com/search?q=${encodeURIComponent(text)}`;
             
             const newId = crypto.randomUUID();
             const newPane: Pane = {
                 id: newId,
                 type: 'iframe',
                 width: 600,
                 title: isUrl ? new URL(url).hostname : 'Search',
                 url: url,
                 isOpen: true,
                 hasContent: true
             };
             
             setRows(prev => prev.map(r => {
                 if (r.id === activeRowId) {
                     return { ...r, panes: [newPane, ...r.panes] };
                 }
                 return r;
             }));
             setActivePaneId(newId);
          }
      } else if (action === 'add_to_pane') {
           // Target is a pane ID
           if (target && paneRefs.current[target]) {
               const text = actionMenu.item.text || actionMenu.item.content;
               paneRefs.current[target].acceptContent({ text });
           }
      }

      setActionMenu(null);
  };

  // Renaming Logic
  const startRenamingRow = (e: React.MouseEvent, row: PaneRow) => {
      e.stopPropagation();
      setEditingRowId(row.id);
      setRenameValue(row.title || '');
  };

  const saveRowTitle = () => {
      if (editingRowId) {
          setRows(rows.map(r => r.id === editingRowId ? { ...r, title: renameValue } : r));
          setEditingRowId(null);
      }
  };

  const startRenamingPane = (e: React.MouseEvent, pane: Pane) => {
      e.stopPropagation();
      setEditingPaneId(pane.id);
      setRenameValue(pane.title || getPaneDefaultTitle(pane));
  };

  const savePaneTitle = () => {
      if (editingPaneId) {
          setRows(rows.map(r => ({
              ...r,
              panes: r.panes.map(p => p.id === editingPaneId ? { ...p, title: renameValue } : p)
          })));
          setEditingPaneId(null);
      }
  };

  /* getPaneDefaultTitle removed - using external definition */

  // Pane Management for ACTIVE Row
  const addPaneToActiveRow = (type: PaneType, componentId?: string, targetSessionId?: string, initialContent?: string, onComplete?: (id: string) => void) => {
    const newPaneId = crypto.randomUUID();
    const uniqueSessionId = targetSessionId || crypto.randomUUID();
    setActivePaneId(newPaneId);

    setRows(prev => prev.map(row => {
        if (row.id === activeRowId) {
            // Calculate unique title
            const count = row.panes.filter(p => p.type === type).length + 1;
            const defaultTitle = type === 'component' && componentId 
                ? ComponentRegistry[componentId]?.label 
                : `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;
            
            const newPane: Pane = { 
                id: newPaneId, 
                type, 
                width: 400, 
                componentId,
                title: defaultTitle,
                sessionId: uniqueSessionId,
                pendingContent: initialContent,
                isOpen: true,
                lastActiveAt: Date.now(),
                hasContent: !!initialContent // Initialize based on content
            };

            const newPanes = [...row.panes];
            if (insertIndex !== null) {
                newPanes.splice(insertIndex, 0, newPane);
            } else {
                newPanes.push(newPane);
            }

            return {
                ...row,
                panes: newPanes
            };
        }
        return row;
    }));
    setIsRadialOpen(false);
    setInsertIndex(null);
    if (onComplete) {
        onComplete(newPaneId);
    }
  };

  const openPane = (rowId: string, paneId: string) => {
    setActivePaneId(paneId);
    setRows(prev => prev.map(row => {
        if (row.id === rowId) {
            return { ...row, panes: row.panes.map(p => p.id === paneId ? { ...p, isOpen: true, lastActiveAt: Date.now() } : p) };
        }
        return row;
    }));
  };

  const deletePane = (rowId: string, paneId: string) => {
    setRows(prev => prev.map(row => {
        if (row.id === rowId) {
            return { ...row, panes: row.panes.filter(p => p.id !== paneId) };
        }
        return row;
    }));
  };

  const removePane = (rowId: string, paneId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const pane = row.panes.find(p => p.id === paneId);
    if (!pane) return;

    // Check for content
    let hasContent = pane.hasContent;

    // Dynamic checks for specific types
    if (pane.type === 'chat') {
        hasContent = messages.some(m => m.sessionId === pane.sessionId);
    } else if (pane.type === 'timeline') {
        hasContent = entries.some(e => e.sessionId === pane.sessionId);
    }
    // Wiki and Graph rely on pane.hasContent tracked via updates

    if (!hasContent) {
        // Delete permanently
        deletePane(rowId, paneId);
    } else {
        // Just close
        setRows(prev => prev.map(r => {
            if (r.id === rowId) {
                return { ...r, panes: r.panes.map(p => p.id === paneId ? { ...p, isOpen: false } : p) };
            }
            return r;
        }));
    }
  };

  const updatePaneWidth = (rowId: string, paneId: string, newWidth: number) => {
    setRows(prev => prev.map(row => {
        if (row.id === rowId) {
            return { 
                ...row, 
                panes: row.panes.map(p => p.id === paneId ? { ...p, width: newWidth } : p) 
            };
        }
        return row;
    }));
  };

  const movePane = (rowId: string, dragIndex: number, hoverIndex: number) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.id !== rowId) return row;
      
      const visiblePanes = row.panes.filter(p => p.isOpen !== false);
      const hiddenPanes = row.panes.filter(p => p.isOpen === false);
      
      const draggedPane = visiblePanes[dragIndex];
      const newVisiblePanes = [...visiblePanes];
      newVisiblePanes.splice(dragIndex, 1);
      newVisiblePanes.splice(hoverIndex, 0, draggedPane);
      
      return {
          ...row,
          panes: [...newVisiblePanes, ...hiddenPanes]
      };
    }));
  };

  const moveRow = (dragIndex: number, hoverIndex: number) => {
    const draggedRow = rows[dragIndex];
    const newRows = [...rows];
    newRows.splice(dragIndex, 1);
    newRows.splice(hoverIndex, 0, draggedRow);
    setRows(newRows);
  };

  const moveSidebarPane = (rowId: string, dragIndex: number, hoverIndex: number) => {
      setRows(prevRows => prevRows.map(row => {
          if (row.id !== rowId) return row;
          const newPanes = [...row.panes];
          const [reorderedItem] = newPanes.splice(dragIndex, 1);
          newPanes.splice(hoverIndex, 0, reorderedItem);
          return { ...row, panes: newPanes };
      }));
  };

  const createDemoRow = () => {
    const newId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    
    // Create demo data
    const demoPanes: Pane[] = [
        { id: crypto.randomUUID(), type: 'chat', width: 30, isOpen: true, sessionId, title: 'Project Chat' },
        { id: crypto.randomUUID(), type: 'timeline', width: 25, isOpen: true, title: 'Project Timeline' },
        { id: crypto.randomUUID(), type: 'wiki', width: 45, isOpen: true, title: 'Documentation', pendingContent: '# Project Overview\n\nThis is a demo project.\n\n## Features\n- Real-time chat\n- Timeline tracking\n- Wiki documentation' },
        { id: crypto.randomUUID(), type: 'todo', width: 30, isOpen: true, title: 'Tasks', pendingContent: JSON.stringify({ items: [{id: '1', text: 'Review demo', completed: false}, {id: '2', text: 'Test drag and drop', completed: true}] }) },
        { id: crypto.randomUUID(), type: 'graph', width: 40, isOpen: true, title: 'Architecture' },
        { id: crypto.randomUUID(), type: 'iframe', width: 40, isOpen: true, title: 'External Ref', url: 'https://example.com' }
    ];

    const newRow: PaneRow = {
        id: newId,
        panes: demoPanes,
        title: 'Demo Project',
        createdAt: new Date()
    };

    setRows([newRow, ...rows]);
    setActiveRowId(newId);
  };

  // Keyboard shortcut for Command Menu
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '.' || e.key === 'k')) {
        e.preventDefault();
        setIsCmdMenuOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleRadialToggle = (e: React.MouseEvent, buttonRect: DOMRect) => {
    e.stopPropagation();
    // Check available space on the right (150px safety margin for menu items + labels)
    const direction = (window.innerWidth - buttonRect.right) < 150 ? 'left' : 'right';
    setMenuDirection(direction);
    setRadialOrigin({
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2
    });
    setInsertIndex(null);
    setIsRadialOpen(!isRadialOpen);
  };

  const handleDeleteRow = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (rows.length <= 1) return; // Prevent deleting the last row

      if (confirmDeleteRowId === id) {
          // Perform delete
          const index = rows.findIndex(r => r.id === id);
          const newRows = rows.filter(r => r.id !== id);
          setRows(newRows);
          
          if (activeRowId === id) {
              // Switch to nearest row
              const newActiveIndex = Math.min(index, newRows.length - 1);
              setActiveRowId(newRows[newActiveIndex].id);
          }
          setConfirmDeleteRowId(null);
      } else {
          setConfirmDeleteRowId(id);
      }
  };

  const radialItems: RadialItem[] = [
    { id: 'chat', icon: MessageSquare, label: 'Chat', action: () => addPaneToActiveRow('chat') },
    { id: 'timeline', icon: Clock, label: 'Timeline', action: () => addPaneToActiveRow('timeline') },
    { id: 'wiki', icon: FileText, label: 'Wiki', action: () => addPaneToActiveRow('wiki') },
    { id: 'todo', icon: CheckSquare, label: 'To-Do', action: () => addPaneToActiveRow('todo') },
    { id: 'graph', icon: Workflow, label: 'Graph', action: () => addPaneToActiveRow('graph') },
    { id: 'iframe', icon: Globe, label: 'Iframe', action: () => addPaneToActiveRow('iframe') },
    { id: 'component', icon: Component, label: 'More...', action: () => { setIsRadialOpen(false); setIsCmdMenuOpen(true); } },
  ];

  return (
    <DndProvider backend={HTML5Backend}>
    <div className="fixed inset-0 z-50 bg-slate-100 flex overflow-hidden font-sans">
        
        {/* Component Picker Command Menu */}
        <Command.Dialog
            open={isCmdMenuOpen}
            onOpenChange={setIsCmdMenuOpen}
            label="Go to Pane"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100]"
        >
             <div className="sr-only">
                 <DialogTitle>Go to Pane</DialogTitle>
                 <DialogDescription>Search for existing panes to navigate to</DialogDescription>
             </div>
             <div className="flex items-center border-b border-slate-100 px-3" cmdk-input-wrapper="">
                <Search className="w-5 h-5 text-slate-400 mr-2" />
                <Command.Input 
                    placeholder="Search existing panes..." 
                    className="w-full py-4 text-base outline-none text-slate-700 placeholder:text-slate-400"
                />
             </div>
             <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
                <Command.Empty className="py-6 text-center text-sm text-slate-500">No results found.</Command.Empty>
                
                <Command.Group heading="Create New" className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <Command.Item onSelect={() => { addPaneToActiveRow('chat'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">Chat</span>
                    </Command.Item>
                    <Command.Item onSelect={() => { addPaneToActiveRow('timeline'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">Timeline</span>
                    </Command.Item>
                    <Command.Item onSelect={() => { addPaneToActiveRow('wiki'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">Wiki</span>
                    </Command.Item>
                    <Command.Item onSelect={() => { addPaneToActiveRow('todo'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <CheckSquare className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">To-Do</span>
                    </Command.Item>
                    <Command.Item onSelect={() => { addPaneToActiveRow('graph'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <Workflow className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">Graph</span>
                    </Command.Item>
                    <Command.Item onSelect={() => { addPaneToActiveRow('iframe'); setIsCmdMenuOpen(false); }} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">Iframe</span>
                    </Command.Item>
                </Command.Group>

                {[...rows]
                    .sort((a, b) => {
                        if (a.id === activeRowId) return -1;
                        if (b.id === activeRowId) return 1;
                        return 0;
                    })
                    .map(row => (
                    <Command.Group key={row.id} heading={row.title} className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        {row.panes.map(pane => (
                            <Command.Item 
                                key={pane.id}
                                onSelect={() => { 
                                    setActiveRowId(row.id); 
                                    openPane(row.id, pane.id);
                                    setIsCmdMenuOpen(false); 
                                }}
                                className={`flex items-center gap-2 px-2 py-2 text-sm text-slate-700 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 transition-colors ${pane.isOpen === false ? 'opacity-50' : ''}`}
                            >
                                {pane.type === 'timeline' && <Layout className="w-4 h-4 text-slate-500" />}
                                {pane.type === 'chat' && <MessageSquare className="w-4 h-4 text-slate-500" />}
                                {pane.type === 'wiki' && <FileText className="w-4 h-4 text-slate-500" />}
                                {pane.type === 'todo' && <CheckSquare className="w-4 h-4 text-slate-500" />}
                                {pane.type === 'graph' && <Workflow className="w-4 h-4 text-slate-500" />}
                                {pane.type === 'component' && <Component className="w-4 h-4 text-slate-500" />}
                                
                                <div className="flex flex-col">
                                    <span className="font-medium">{pane.title || getPaneDefaultTitle(pane)}</span>
                                    {pane.title !== getPaneDefaultTitle(pane) && (
                                        <span className="text-[10px] text-slate-400">{getPaneDefaultTitle(pane)}</span>
                                    )}
                                </div>
                                
                                {pane.connectedPaneId && (
                                    <div className="ml-auto w-1.5 h-1.5 bg-indigo-400 rounded-full" title="Connected" />
                                )}
                            </Command.Item>
                        ))}
                    </Command.Group>
                ))}
             </Command.List>
        </Command.Dialog>

        {/* Global Row Navigation Sidebar (Desktop) */}
        <div 
            className={`hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-40 ${isRowSidebarOpen ? 'w-64' : 'w-12'}`}
        >
            <div className="p-3 border-b border-slate-100 flex items-center justify-between h-14">
                {isRowSidebarOpen && <span className="text-sm font-semibold text-slate-700 ml-1">Contexts</span>}
                <button 
                    onClick={() => setIsRowSidebarOpen(!isRowSidebarOpen)}
                    className={`p-1.5 rounded-md transition-all duration-200 ${isRowSidebarOpen ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'w-full flex justify-center hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                    title={isRowSidebarOpen ? "Collapse Sidebar" : "Expand Contexts"}
                >
                    {isRowSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-5 h-5" />}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-2">
                {isRowSidebarOpen && (
                    <div className="px-3 mb-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                value={sidebarSearch}
                                onChange={(e) => setSidebarSearch(e.target.value)}
                                placeholder="Search panes..." 
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 transition-colors"
                            />
                        </div>
                    </div>
                )}
                {rows.map((row, index) => {
                    // Remove auto-sort to allow drag-and-drop reordering
                    const visiblePanes = [...row.panes]; 
                    
                    const filteredPanes = sidebarSearch 
                        ? visiblePanes.filter(p => (p.title || getPaneDefaultTitle(p)).toLowerCase().includes(sidebarSearch.toLowerCase())) 
                        : visiblePanes;
                    const rowMatches = row.title!.toLowerCase().includes(sidebarSearch.toLowerCase());
                    
                    if (sidebarSearch && !rowMatches && filteredPanes.length === 0) return null;

                    return (
                        <SidebarRow 
                            key={row.id} 
                            row={row} 
                            index={index} 
                            activeRowId={activeRowId}
                            setActiveRowId={setActiveRowId}
                            isRowSidebarOpen={isRowSidebarOpen}
                            editingRowId={editingRowId}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                            saveRowTitle={saveRowTitle}
                            startRenamingRow={startRenamingRow}
                            handleDeleteRow={handleDeleteRow}
                            confirmDeleteRowId={confirmDeleteRowId}
                            setConfirmDeleteRowId={setConfirmDeleteRowId}
                            filteredPanes={filteredPanes}
                            moveRow={moveRow}
                            moveSidebarPane={moveSidebarPane}
                            openPane={openPane}
                            deletePane={deletePane}
                            rowCount={rows.length}
                        />
                    );
                })}

                {/* Create Demo Context Button */}
                <button
                    onClick={() => createDemoRow()}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors group mt-2
                        hover:bg-indigo-50 text-indigo-500 hover:text-indigo-600
                    `}
                    title="Create Demo Context"
                >
                    <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded border border-indigo-200 bg-indigo-50 text-xs font-medium">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    {isRowSidebarOpen && <span className="text-sm font-medium">Create Demo</span>}
                </button>

                {/* Create New Context Button */}
                <button
                    onClick={() => addRow()}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors group mt-2 mb-4
                        hover:bg-slate-50 text-slate-500 hover:text-indigo-600
                    `}
                    title="Create New Context"
                >
                     <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded border border-dashed border-slate-300 text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-600 transition-colors bg-slate-50">
                        <Plus className="w-3.5 h-3.5" />
                     </div>
                     
                     {isRowSidebarOpen && (
                         <span className="text-sm font-medium">New Context</span>
                     )}
                </button>
            </div>


        </div>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
             <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}>
                 <Layers className="w-5 h-5 text-slate-600" />
             </button>
             <span className="font-semibold text-slate-800">Contexts</span>
             <div className="w-5" /> {/* Spacer */}
        </div>

        {/* Mobile Nav Overlay */}
        {isMobileNavOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setIsMobileNavOpen(false)}>
                <div className="w-64 bg-white h-full shadow-xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-lg">Contexts</h2>
                        <button onClick={() => setIsMobileNavOpen(false)}><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {rows.map((row, index) => (
                            <button
                                key={row.id}
                                onClick={() => setActiveRowId(row.id)}
                                className={`w-full p-3 rounded-lg text-left flex items-center justify-between ${activeRowId === row.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}
                            >
                                <span>{row.title}</span>
                                {activeRowId === row.id && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                            </button>
                        ))}
                        <button 
                            onClick={() => { addRow(); setIsMobileNavOpen(false); }}
                            className="w-full p-3 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Context</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Main Content Area - Horizontal Scrolling Rows */}
        <div 
            ref={rowContainerRef}
            className={`flex-1 relative h-full transition-all duration-300 ${isRowSidebarOpen ? 'ml-0' : 'ml-0'} md:ml-0 pt-14 md:pt-0`}
        >
             <div className="absolute inset-0 overflow-hidden bg-slate-100">
                 {rows.map((row, index) => (
                     <div 
                        key={row.id} 
                        className={`absolute inset-0 w-full h-full p-4 md:p-8 flex overflow-x-auto overflow-y-hidden items-start box-border transition-transform duration-500 ease-in-out will-change-transform ${isMobile ? 'snap-x snap-mandatory gap-4' : ''}`}
                        style={{ transform: `translateY(${(index - activeRowIndex) * 100}%)` }}
                        onScroll={(e) => {
                            scrollPositions.current[row.id] = e.currentTarget.scrollLeft;
                        }}
                        ref={(el) => {
                            if (el && scrollPositions.current[row.id] !== undefined && el.scrollLeft !== scrollPositions.current[row.id]) {
                                el.scrollLeft = scrollPositions.current[row.id];
                            }
                        }}
                     >
                         {row.panes.filter(p => p.isOpen !== false).flatMap((pane, i, arr) => {
                             const isLast = i === arr.length - 1;
                             return [
                             <DraggablePaneWrapper
                                 key={pane.id}
                                 id={pane.id}
                                 index={i}
                                 type={`pane-${row.id}`}
                                 movePane={(dragIndex, hoverIndex) => movePane(row.id, dragIndex, hoverIndex)}
                                 className={`h-full shrink-0 relative z-40 ${isMobile ? 'snap-center' : ''}`}
                                 isMobile={isMobile}
                             >
                             {(dragHandle) => (
                             <Resizable
                                 size={isMobile ? { width: 'calc(100vw - 32px)', height: '100%' } : { width: pane.width, height: '100%' }}
                                 minWidth={isMobile ? 'calc(100vw - 32px)' : 320}
                                 maxWidth={isMobile ? 'calc(100vw - 32px)' : 800}
                                 onResizeStop={(e, direction, ref, d) => {
                                     updatePaneWidth(row.id, pane.id, pane.width + d.width);
                                 }}
                                 onClickCapture={() => setActivePaneId(pane.id)}
                                 enable={{ right: !isMobile }}
                                 handleComponent={{
                                     right: <div 
                                         onMouseDown={(e) => e.stopPropagation()} 
                                         className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-12 bg-white shadow-md border border-slate-200 rounded-full flex items-center justify-center cursor-col-resize z-20 hover:scale-110 transition-transform"
                                     >
                                         <GripVertical className="w-3 h-3 text-slate-400" />
                                     </div>
                                 }}
                                 className="flex flex-col bg-white rounded-xl shadow-xl border border-slate-200/60 overflow-hidden relative group h-full"
                             >
                                 {/* Pane Header */}
                                 <div 
                                    ref={dragHandle}
                                    className="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 shrink-0 handle cursor-grab active:cursor-grabbing"
                                    onDoubleClick={(e) => startRenamingPane(e, pane)}
                                 >
                                     <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-0 flex-1">
                                         {pane.type === 'timeline' && <Clock className="w-3.5 h-3.5 shrink-0" />}
                                         {pane.type === 'chat' && <MessageSquare className="w-3.5 h-3.5 shrink-0" />}
                                         {pane.type === 'wiki' && <FileText className="w-3.5 h-3.5 shrink-0" />}
                                         {pane.type === 'todo' && <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
                                         {pane.type === 'graph' && <Workflow className="w-3.5 h-3.5 shrink-0" />}
                                         {pane.type === 'component' && <Component className="w-3.5 h-3.5 shrink-0" />}
                                         
                                         {editingPaneId === pane.id ? (
                                             <input 
                                                ref={renameInputRef}
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onBlur={savePaneTitle}
                                                onKeyDown={(e) => e.key === 'Enter' && savePaneTitle()}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 normal-case tracking-normal font-normal text-slate-800"
                                             />
                                         ) : (
                                            <span className="truncate" title={getPaneDefaultTitle(pane)}>
                                                {getPaneDefaultTitle(pane)}
                                            </span>
                                         )}

                                         {pane.sessionId && pane.type !== 'graph' && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] shrink-0 truncate max-w-[100px]">
                                                {sessions.find(s => s.id === pane.sessionId)?.title || 'Chat'}
                                            </span>
                                         )}

                                         {pane.type === 'chat' && (
                                             <div className="relative ml-2 flex items-center gap-1">
                                                 <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (paneRefs.current[pane.id]?.toggleSettings) {
                                                            paneRefs.current[pane.id].toggleSettings!();
                                                        }
                                                    }}
                                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Chat Settings"
                                                 >
                                                     <Settings className="w-3.5 h-3.5" />
                                                 </button>
                                                 <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Toggle menu for connecting
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setConnectMenu({
                                                            isOpen: true,
                                                            x: rect.right,
                                                            y: rect.bottom + 5,
                                                            sourcePaneId: pane.id,
                                                            rowId: row.id
                                                        });
                                                    }}
                                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${pane.connectedPaneId ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
                                                    title={pane.connectedPaneId ? "Connected (Click to change)" : "Connect to Wiki/Graph"}
                                                 >
                                                     <Link className="w-3.5 h-3.5" />
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                     <button onClick={() => removePane(row.id, pane.id)} className="text-slate-400 hover:text-red-500 ml-2">
                                         <X className="w-3.5 h-3.5" />
                                     </button>
                                 </div>

                                 {/* Pane Content */}
                                 <div className="flex-1 overflow-hidden relative">
                                      {pane.type === 'timeline' && (
                                          <div className="h-full overflow-y-auto">
                                              <Sidebar 
                                                 ref={(el) => { if (el) paneRefs.current[pane.id] = el; }}
                                                 entries={pane.sessionId ? entries.filter(e => e.sessionId === pane.sessionId) : entries}
                                                 sessions={sessions}
                                                 personas={personas}
                                                 currentSessionId={pane.sessionId || currentSessionId}
                                                 onEntryClick={handleEntryClickInternal}
                                                 onSessionSelect={() => {}}
                                                 onNewChat={() => {}}
                                                 isExpanded={true}
                                                 onBackToHome={() => {}}
                                                 onUpdateEntry={onUpdateTimelineEntry}
                                                 onDeleteEntry={onDeleteTimelineEntry}
                                                 onSubmit={(text) => onAddTimelineEntry(text, pane.sessionId)}
                                                 // @ts-ignore
                                                 onAction={(entry, e) => handleActionTrigger(e, entry, pane.id)}
                                              />
                                          </div>
                                      )}
                                      {pane.type === 'chat' && (
                                          <ChatArea 
                                             ref={(el) => { if (el) paneRefs.current[pane.id] = el; }}
                                             messages={messages.filter(m => m.sessionId === (pane.sessionId || currentSessionId))}
                                             currentPersona={currentPersona}
                                             personas={personas}
                                             session={sessions.find(s => s.id === (pane.sessionId || currentSessionId))}
                                             onSendMessage={(text) => {
                                                 const connectedPane = row.panes.find(p => p.id === pane.connectedPaneId);
                                                 const connectedSessionId = connectedPane?.sessionId;
                                                 onSendMessage(text, pane.sessionId, connectedSessionId);
                                             }}
                                             onSwitchPersona={onSwitchPersona}
                                             isTyping={typingSessionId === (pane.sessionId || currentSessionId)}
                                             onRefine={async (t) => t}
                                             onToggleEditor={() => {}}
                                             isEditorOpen={false}
                                             onWikiAction={(messageId, action) => {
                                                  if (action === 'approve') {
                                                      const message = messages.find(m => m.id === messageId);
                                                      
                                                      // Determine target pane: explicitly connected pane OR first wiki pane in the current row
                                                      let targetPaneId = pane.connectedPaneId;
                                                      if (!targetPaneId) {
                                                          const wikiPane = row.panes.find(p => p.type === 'wiki');
                                                          if (wikiPane) targetPaneId = wikiPane.id;
                                                      }

                                                      if (message && message.wikiAction && targetPaneId) {
                                                          setRows(prev => prev.map(r => {
                                                              // Check if this row contains the target pane
                                                              const targetPaneInRow = r.panes.find(p => p.id === targetPaneId);
                                                              
                                                              if (targetPaneInRow) {
                                                                  return {
                                                                      ...r,
                                                                      panes: r.panes.map(p => {
                                                                          if (p.id === targetPaneId) {
                                                                              // Append content to the pendingContent of the target pane
                                                                              return { ...p, pendingContent: message.wikiAction!.content };
                                                                          }
                                                                          return p;
                                                                      })
                                                                  };
                                                              }
                                                              return r;
                                                          }));
                                                          
                                                          // Update message status to persist approval
                                                          onUpdateMessage(messageId, { 
                                                              wikiAction: { 
                                                                  ...message.wikiAction, 
                                                                  status: 'approved' 
                                                              } 
                                                          });
                                                      }
                                                  } else if (action === 'reject') {
                                                      const message = messages.find(m => m.id === messageId);
                                                      if (message && message.wikiAction) {
                                                           onUpdateMessage(messageId, { 
                                                              wikiAction: { 
                                                                  ...message.wikiAction, 
                                                                  status: 'rejected' 
                                                              } 
                                                          });
                                                      }
                                                  }
                                             }}
                                             onAddToTimeline={() => {}}
                                             // @ts-ignore
                                             onAction={(msg, e) => handleActionTrigger(e, msg, pane.id)}
                                          />
                                      )}
                                      {pane.type === 'wiki' && (
                                          <Editor 
                                             ref={(el) => { if (el) paneRefs.current[pane.id] = el; }}
                                             sessionId={pane.sessionId || "wiki-default"} 
                                             supabase={supabase} 
                                             pendingUpdate={pane.pendingContent}
                                             onUpdateApplied={() => {
                                                  setRows(prev => prev.map(r => ({
                                                      ...r,
                                                      panes: r.panes.map(p => p.id === pane.id ? { ...p, pendingContent: undefined } : p)
                                                  })));
                                             }}
                                             onSendMessage={(text) => {
                                                  // Try to find a connected chat, or any chat in the row
                                                  const connectedPane = row.panes.find(p => p.id === pane.connectedPaneId);
                                                  const targetSessionId = connectedPane?.sessionId || row.panes.find(p => p.type === 'chat')?.sessionId;
                                                  onSendMessage(text, targetSessionId);
                                             }}
                                             onAddTimelineEntry={(text) => onAddTimelineEntry(text, pane.sessionId)}
                                             onAddToGraph={(text) => onAddToGraph(text, pane.sessionId || 'graph-default')}
                                             onLinkClick={(url) => {
                                                  if (url.startsWith('pane:')) {
                                                      const targetPaneId = url.replace('pane:', '');
                                                      // Find row and pane
                                                      for (const r of rows) {
                                                          const p = r.panes.find(p => p.id === targetPaneId);
                                                          if (p) {
                                                              setActiveRowId(r.id);
                                                              openPane(r.id, p.id);
                                                              setScrollToPaneId(p.id);
                                                              return;
                                                          }
                                                      }
                                                  } else {
                                                      window.open(url, '_blank');
                                                  }
                                             }}
                                             availablePanes={rows.flatMap(r => r.panes).filter(p => p.id !== pane.id).map(p => ({
                                                 id: p.id,
                                                 title: p.title || p.type.charAt(0).toUpperCase() + p.type.slice(1),
                                                 type: p.type
                                             }))}
                                             onCreatePane={(type, content, callback) => addPaneToActiveRow(type as PaneType, undefined, undefined, content, callback)}
                                             onChange={(state) => {
                                                  if (!pane.hasContent) {
                                                      setRows(prev => prev.map(r => ({
                                                          ...r,
                                                          panes: r.panes.map(p => p.id === pane.id ? { ...p, hasContent: true } : p)
                                                      })));
                                                  }
                                             }}
                                          />
                                      )}
                                      {pane.type === 'todo' && (
                                          <TodoList 
                                             ref={(el) => { if (el) paneRefs.current[pane.id] = el; }}
                                             sessionId={pane.sessionId || 'todo-default'} 
                                             supabase={supabase}
                                             initialContent={pane.pendingContent}
                                             onContentAdded={() => {
                                                  setRows(prev => prev.map(r => ({
                                                      ...r,
                                                      panes: r.panes.map(p => p.id === pane.id ? { ...p, pendingContent: undefined } : p)
                                                  })));
                                             }}
                                             onChange={() => {
                                                  if (!pane.hasContent) {
                                                      setRows(prev => prev.map(r => ({
                                                          ...r,
                                                          panes: r.panes.map(p => p.id === pane.id ? { ...p, hasContent: true } : p)
                                                      })));
                                                  }
                                             }}
                                          />
                                      )}
                                      {pane.type === 'graph' && (
                                          <FlowEditor 
                                            ref={(el) => { if (el) paneRefs.current[pane.id] = el; }}
                                            sessionId={pane.sessionId || 'graph-default'} 
                                            supabase={supabase} 
                                            pendingActions={flowActions[pane.sessionId || 'graph-default'] || []}
                                            onActionsApplied={() => onClearFlowActions(pane.sessionId || 'graph-default')}
                                            onChange={() => {
                                                  if (!pane.hasContent) {
                                                      setRows(prev => prev.map(r => ({
                                                          ...r,
                                                          panes: r.panes.map(p => p.id === pane.id ? { ...p, hasContent: true } : p)
                                                      })));
                                                  }
                                            }}
                                          />
                                      )}
                                      {pane.type === 'iframe' && (
                                          <div className="flex flex-col h-full bg-slate-50">
                                              <div className="p-2 border-b border-slate-200 bg-white flex gap-2 shrink-0 items-center">
                                                  <input 
                                                      className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-indigo-400"
                                                      placeholder="https://example.com"
                                                      defaultValue={pane.url || ''}
                                                      onKeyDown={(e) => {
                                                          if (e.key === 'Enter') {
                                                              const val = e.currentTarget.value;
                                                              setRows(prev => prev.map(r => ({
                                                                  ...r,
                                                                  panes: r.panes.map(p => p.id === pane.id ? { ...p, url: val, hasContent: !!val, readerContent: undefined, readerMode: false } : p)
                                                              })));
                                                          }
                                                      }}
                                                      onBlur={(e) => {
                                                          const val = e.target.value;
                                                          if (val !== pane.url) {
                                                              setRows(prev => prev.map(r => ({
                                                                  ...r,
                                                                  panes: r.panes.map(p => p.id === pane.id ? { ...p, url: val, hasContent: !!val, readerContent: undefined, readerMode: false } : p)
                                                              })));
                                                          }
                                                      }}
                                                  />
                                                  {pane.url && (
                                                      <button
                                                         onClick={async () => {
                                                             const newMode = !pane.readerMode;
                                                             if (newMode && !pane.readerContent) {
                                                                 setRows(prev => prev.map(r => ({
                                                                     ...r,
                                                                     panes: r.panes.map(p => p.id === pane.id ? { ...p, readerMode: true, readerContent: 'Loading...' } : p)
                                                                 })));
                                                                 
                                                                 try {
                                                                     const res = await fetch(`${SERVER_URL}/read`, {
                                                                         method: 'POST',
                                                                         headers: { 
                                                                             'Content-Type': 'application/json',
                                                                             'Authorization': `Bearer ${publicAnonKey}`
                                                                         },
                                                                         body: JSON.stringify({ url: pane.url })
                                                                     });
                                                                     const data = await res.json();
                                                                     
                                                                     setRows(prev => prev.map(r => ({
                                                                         ...r,
                                                                         panes: r.panes.map(p => p.id === pane.id ? { 
                                                                             ...p, 
                                                                             readerContent: data.error ? `# Error\n${data.error}` : `# ${data.title || 'Untitled'}\n\n${data.byline ? `*${data.byline}*\n\n` : ''}${data.content || ''}`
                                                                         } : p)
                                                                     })));
                                                                 } catch (e: any) {
                                                                     setRows(prev => prev.map(r => ({
                                                                         ...r,
                                                                         panes: r.panes.map(p => p.id === pane.id ? { ...p, readerContent: `# Error\n${e.message}` } : p)
                                                                     })));
                                                                 }
                                                             } else {
                                                                 setRows(prev => prev.map(r => ({
                                                                     ...r,
                                                                     panes: r.panes.map(p => p.id === pane.id ? { ...p, readerMode: newMode } : p)
                                                                 })));
                                                             }
                                                         }}
                                                         className={`p-1.5 rounded transition-colors ${pane.readerMode ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                                         title={pane.readerMode ? "Switch to Web View" : "Switch to Reader Mode"}
                                                      >
                                                          <BookOpen className="w-4 h-4" />
                                                      </button>
                                                  )}
                                              </div>
                                              <div className="flex-1 relative bg-slate-100 overflow-hidden">
                                                  {pane.readerMode ? (
                                                      <div 
                                                          className="w-full h-full bg-white overflow-y-auto p-8"
                                                          onContextMenu={(e) => {
                                                              e.preventDefault();
                                                              const selection = window.getSelection()?.toString();
                                                              if (selection) {
                                                                  setActionMenu({
                                                                      isOpen: true,
                                                                      x: e.clientX,
                                                                      y: e.clientY,
                                                                      item: { content: selection, type: 'selection' },
                                                                      sourceRowId: row.id,
                                                                      sourcePaneId: pane.id
                                                                  });
                                                              }
                                                          }}
                                                      >
                                                          {pane.readerContent === 'Loading...' ? (
                                                              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                                                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                                                  <span className="text-sm">Generating Reader View...</span>
                                                              </div>
                                                          ) : (
                                                              <div className="prose prose-slate prose-sm max-w-none">
                                                                  <ReactMarkdown>{pane.readerContent || ''}</ReactMarkdown>
                                                              </div>
                                                          )}
                                                      </div>
                                                  ) : pane.url ? (
                                                      <iframe 
                                                          src={pane.url} 
                                                          className="w-full h-full border-0 bg-white" 
                                                          title={pane.title} 
                                                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                                      />
                                                  ) : (
                                                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                          <Globe className="w-8 h-8 mb-2 opacity-20" />
                                                          <span className="text-xs">Enter a URL above</span>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      )}
                                      {pane.type === 'component' && pane.componentId && ComponentRegistry[pane.componentId] && (
                                          <React.Suspense fallback={<div className="p-4 text-slate-400">Loading...</div>}>
                                              <div className="p-8 flex items-center justify-center min-h-full bg-slate-50/50">
                                                 {React.createElement(ComponentRegistry[pane.componentId].component)}
                                              </div>
                                          </React.Suspense>
                                      )}
                                 </div>
                             </Resizable>
                             )}
                             </DraggablePaneWrapper>,
                             !isLast && !isMobile && (
                                 <div key={`divider-${pane.id}`} className="w-4 shrink-0 relative group/divider flex items-center justify-center z-30 self-stretch">
                                     <div 
                                         className="absolute inset-y-0 -left-2 -right-2 cursor-pointer z-10"
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             const rect = e.currentTarget.getBoundingClientRect();
                                             const direction = (window.innerWidth - rect.right) < 150 ? 'left' : 'right';
                                             setMenuDirection(direction);
                                             setRadialOrigin({
                                                 x: rect.left + rect.width / 2,
                                                 y: rect.top + rect.height / 2
                                             });
                                             setIsRadialOpen(true);
                                             setActiveRowId(row.id);
                                             const currentPaneIndex = row.panes.findIndex(p => p.id === pane.id);
                                             setInsertIndex(currentPaneIndex + 1);
                                         }}
                                     >
                                         {/* Hover Hint Line */}
                                         <div className="absolute inset-x-[7px] inset-y-4 bg-slate-200/50 rounded-full opacity-0 group-hover/divider:opacity-100 transition-opacity duration-200" />
                                         
                                         {/* Plus Button */}
                                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 opacity-0 group-hover/divider:opacity-100 transition-all transform scale-75 group-hover/divider:scale-100 hover:scale-110">
                                             <Plus className="w-3 h-3" />
                                         </div>
                                     </div>
                                 </div>
                             )
                             ];
                         })}

                         {/* Add New Button (Per Row) */}
                         <div className={`h-full w-20 shrink-0 flex items-center justify-center relative ${isMobile ? '' : 'ml-4'}`}>
                             <button 
                                 onClick={(e) => handleRadialToggle(e, e.currentTarget.getBoundingClientRect())}
                                 className={`w-12 h-12 rounded-full border shadow-sm flex items-center justify-center transition-all duration-300 z-[30] ${isRadialOpen && activeRowId === row.id ? 'bg-indigo-600 border-indigo-600 text-white rotate-45' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
                             >
                                 <Plus className="w-6 h-6" />
                             </button>
                         </div>
                     </div>
                 ))}
                 
                 {/* Radial Menu (Floating) */}
                 <AnimatePresence>
                    {isRadialOpen && (
                        <div 
                            className="fixed z-[60]"
                            style={{ 
                                top: radialOrigin.y - 180, // Centered vertically relative to 360px height
                                left: menuDirection === 'right' ? radialOrigin.x + 30 : radialOrigin.x - 270, // Offset to right or left
                                width: 240,
                                height: 360,
                                pointerEvents: 'none' // Let clicks pass through container
                            }}
                        >
                            <div className="relative w-full h-full pointer-events-auto">
                                {radialItems.map((item, i) => {
                                    // Calculate positions in a semi-circle or arc
                                    // Let's do a vertical stack or fan out
                                    // Simple vertical stack with stagger
                                    return (
                                        <motion.button
                                            key={item.id}
                                            initial={{ opacity: 0, x: menuDirection === 'right' ? -20 : 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: menuDirection === 'right' ? -20 : 20 }}
                                            transition={{ delay: i * 0.05 }}
                                            onClick={(e) => { e.stopPropagation(); item.action(); }}
                                            className={`absolute flex items-center gap-3 bg-white p-2 pr-4 rounded-full shadow-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors group
                                                ${menuDirection === 'right' ? 'flex-row' : 'flex-row-reverse right-0'}
                                            `}
                                            style={{ top: i * 50 }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-white text-slate-500 group-hover:text-indigo-600">
                                                <item.icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">{item.label}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                 </AnimatePresence>

                 {/* Action Menu */}
                 <AnimatePresence>
                     {actionMenu && (
                         <div 
                            className="fixed z-[70] bg-white rounded-lg shadow-xl border border-slate-200 w-56 overflow-hidden py-1"
                            style={{ top: actionMenu.y, left: Math.min(actionMenu.x, window.innerWidth - 240) }}
                         >
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</div>
                            </div>
                            <div className="p-1">
                                {actionMenu.item.content && actionMenu.sourcePaneId && paneRefs.current[actionMenu.sourcePaneId]?.startEditing && (
                                    <>
                                        <button onClick={() => {
                                            if (actionMenu.sourcePaneId && paneRefs.current[actionMenu.sourcePaneId]?.startEditing) {
                                                paneRefs.current[actionMenu.sourcePaneId].startEditing!(actionMenu.item.id);
                                            }
                                            setActionMenu(null);
                                        }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                            <Edit2 className="w-4 h-4" />
                                            <span>Edit Entry</span>
                                        </button>
                                        <button onClick={() => {
                                            if (onDeleteTimelineEntry) onDeleteTimelineEntry(actionMenu.item.id);
                                            setActionMenu(null);
                                        }} className="w-full text-left px-2 py-1.5 hover:bg-red-50 hover:text-red-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                            <Trash2 className="w-4 h-4" />
                                            <span>Delete Entry</span>
                                        </button>
                                        <div className="border-t border-slate-100 my-1 pt-1"></div>
                                    </>
                                )}
                                <button onClick={() => executeAction('new_row')} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <Layout className="w-4 h-4" />
                                     <span>New Context with this...</span>
                                </button>
                                <button onClick={() => executeAction('send_to_row', activeRowId)} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <CornerUpRight className="w-4 h-4" />
                                     <span>Send to Timeline</span>
                                </button>
                                
                                <div className="border-t border-slate-100 my-1 pt-1"></div>
                                
                                <button onClick={() => executeAction('open_in_pane', 'new_chat')} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <MessageSquare className="w-4 h-4" />
                                     <span>Discuss in New Chat</span>
                                </button>
                                <button onClick={() => executeAction('open_in_pane', 'new_wiki')} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <FileText className="w-4 h-4" />
                                     <span>Create Wiki Page</span>
                                </button>
                                <button onClick={() => executeAction('open_in_pane', 'new_todo')} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <CheckSquare className="w-4 h-4" />
                                     <span>Add to New Todo List</span>
                                </button>
                                <button onClick={() => executeAction('open_in_pane', 'new_iframe')} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700">
                                     <Globe className="w-4 h-4" />
                                     <span>Open in New Iframe</span>
                                </button>
                                
                                {/* List other open panes to add to */}
                                {rows.find(r => r.id === activeRowId)?.panes.filter(p => (p.type === 'wiki' || p.type === 'chat' || p.type === 'todo') && p.isOpen !== false).map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => executeAction('add_to_pane', p.id)} 
                                        className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                        <span>Add to {p.title || p.type}</span>
                                    </button>
                                ))}
                            </div>
                         </div>
                     )}
                 </AnimatePresence>

                 {/* Connection Menu */}
                 <AnimatePresence>
                     {connectMenu && (
                         <div 
                            className="fixed z-[70] bg-white rounded-lg shadow-xl border border-slate-200 w-64 overflow-hidden py-1"
                            style={{ top: connectMenu.y, left: Math.min(connectMenu.x, window.innerWidth - 270) }}
                         >
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connect to...</div>
                            </div>
                            <div className="p-1 max-h-[200px] overflow-y-auto">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRows(prev => prev.map(r => {
                                            if (r.id === connectMenu.rowId) {
                                                return {
                                                    ...r,
                                                    panes: r.panes.map(p => p.id === connectMenu.sourcePaneId ? { ...p, connectedPaneId: undefined } : p)
                                                };
                                            }
                                            return r;
                                        }));
                                        setConnectMenu(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 hover:bg-red-50 hover:text-red-600 rounded flex items-center gap-2 text-sm text-slate-500 italic mb-1"
                                >
                                     <X className="w-4 h-4" />
                                     <span>Disconnect</span>
                                </button>

                                {rows.find(r => r.id === connectMenu.rowId)?.panes
                                    .filter(p => p.id !== connectMenu.sourcePaneId && (p.type === 'wiki' || p.type === 'graph') && p.isOpen !== false)
                                    .map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRows(prev => prev.map(r => {
                                                if (r.id === connectMenu.rowId) {
                                                    return {
                                                        ...r,
                                                        panes: r.panes.map(pane => pane.id === connectMenu.sourcePaneId ? { ...pane, connectedPaneId: p.id } : pane)
                                                    };
                                                }
                                                return r;
                                            }));
                                            setConnectMenu(null);
                                        }}
                                        className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-slate-700"
                                    >
                                        {p.type === 'wiki' && <FileText className="w-4 h-4 text-slate-400" />}
                                        {p.type === 'graph' && <Workflow className="w-4 h-4 text-slate-400" />}
                                        <span>{p.title || p.type}</span>
                                        {rows.find(r => r.id === connectMenu.rowId)?.panes.find(sp => sp.id === connectMenu.sourcePaneId)?.connectedPaneId === p.id && (
                                            <div className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                        )}
                                    </button>
                                ))}
                            </div>
                         </div>
                     )}
                 </AnimatePresence>
             </div>
        </div>
    </div>
    </DndProvider>
  );
}
