import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isRangeSelection, EditorState, FORMAT_TEXT_COMMAND, TextFormatType, $createParagraphNode, $createTextNode, DecoratorNode, DOMExportOutput, LexicalNode, NodeKey, SerializedLexicalNode, Spread, COMMAND_PRIORITY_HIGH, PASTE_COMMAND, $insertNodes } from 'lexical';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { $isLinkNode, AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';

import { SupabaseClient } from '@supabase/supabase-js';
import { IPane, PaneContent } from './types';
import { Bold, Italic, Underline, RotateCcw, RotateCw, History, Clock, ArrowLeft, Check, X, Save, MessageSquare, Workflow, Sparkles, Layout, Link as LinkIcon, ChevronRight, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

const theme = {
  paragraph: 'mb-2',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    code: 'bg-secondary text-red-500 font-mono px-1 rounded',
  },
  heading: {
    h1: 'text-3xl font-bold mb-4',
    h2: 'text-2xl font-bold mb-3',
    h3: 'text-xl font-bold mb-2',
  },
  list: {
    ul: 'list-disc ml-4 mb-2',
    ol: 'list-decimal ml-4 mb-2',
  },
  quote: 'border-l-4 border-border pl-4 italic text-muted-foreground my-2',
  code: 'bg-secondary p-2 rounded block font-mono text-sm my-2 overflow-x-auto',
  link: 'text-blue-600 hover:underline cursor-pointer',
};

// --- ImageNode ---

type SerializedImageNode = Spread<{
  src: string;
  altText: string;
  width?: number;
  height?: number;
}, SerializedLexicalNode>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: number | undefined;
  __height: number | undefined;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key);
  }

  constructor(src: string, altText: string, width?: number, height?: number, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode(serializedNode.src, serializedNode.altText, serializedNode.width, serializedNode.height);
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img');
    img.setAttribute('src', this.__src);
    img.setAttribute('alt', this.__altText);
    if (this.__width) img.setAttribute('width', String(this.__width));
    if (this.__height) img.setAttribute('height', String(this.__height));
    return { element: img };
  }

  decorate(): JSX.Element {
    if (!this.__src) {
      return (
        <div
          style={{
            maxWidth: '100%',
            borderRadius: '8px',
            margin: '8px 0',
            padding: '16px',
            background: 'var(--secondary, #f3f4f6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--muted-foreground, #9ca3af)',
            fontSize: '13px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Uploading image...
        </div>
      );
    }
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        style={{ maxWidth: '100%', borderRadius: '8px', margin: '8px 0' }}
        draggable={false}
      />
    );
  }
}

function $createImageNode(src: string, altText: string, width?: number, height?: number): ImageNode {
  return new ImageNode(src, altText, width, height);
}

// --- ImagePastePlugin ---

function ImagePastePlugin({ groupId }: { groupId: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const imageFiles: File[] = [];
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
          }
        }

        if (imageFiles.length === 0) return false;

        event.preventDefault();

        for (const file of imageFiles) {
          // Insert placeholder and capture its key via closure
          let placeholderKey: string | null = null;

          editor.update(() => {
            const placeholderNode = $createImageNode('', 'Uploading image...');
            const paragraph = $createParagraphNode();
            paragraph.append(placeholderNode);
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertNodes([paragraph]);
            } else {
              $getRoot().append(paragraph);
            }
            placeholderKey = placeholderNode.getKey();
          });

          // Upload in background
          const formData = new FormData();
          formData.append('file', file);
          const capturedKey = placeholderKey;

          fetch(`/api/context/upload?type=editor-image&groupId=${groupId}`, {
            method: 'POST',
            body: formData,
          })
            .then((res) => {
              if (!res.ok) throw new Error('Upload failed');
              return res.json();
            })
            .then(({ url }) => {
              editor.update(() => {
                if (!capturedKey) return;
                const existingNode = editor.getEditorState()._nodeMap.get(capturedKey);
                if (existingNode && existingNode instanceof ImageNode) {
                  const newNode = $createImageNode(url, file.name);
                  existingNode.replace(newNode);
                }
              });
            })
            .catch((err) => {
              console.error('Image upload failed:', err);
              editor.update(() => {
                if (!capturedKey) return;
                const existingNode = editor.getEditorState()._nodeMap.get(capturedKey);
                if (existingNode && existingNode instanceof ImageNode) {
                  existingNode.remove();
                }
              });
            });
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, groupId]);

  return null;
}

function ToolbarPlugin({
    onHistoryClick,
    sessionId,
    groupId,
    userId,
    supabase,
    isLoaded
}: {
    onHistoryClick: () => void;
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    isLoaded: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (selection && 'hasFormat' in selection) {
      setIsBold((selection as any).hasFormat('bold'));
      setIsItalic((selection as any).hasFormat('italic'));
      setIsUnderline((selection as any).hasFormat('underline'));
      
      const parent = selection.getNodes()[0]?.getParent();
      setIsLink($isLinkNode(parent));
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const format = (type: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  };
  
  const insertLink = useCallback(() => {
      if (!isLink) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      }
    }, [editor, isLink]);

  const handleSaveVersion = async () => {
      setSaveStatus('saving');
      try {
          const currentState = JSON.stringify(editor.getEditorState().toJSON());
          const timestamp = new Date().toISOString();
          
          const response = await fetch(`/api/context/state?type=editor-version&groupId=${groupId}&userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              value: { content: currentState, timestamp, type: 'manual' },
              timestamp
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to save version');
          }
          
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
          console.error("Failed to save version manually", e);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
      }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1">
        <button
            onClick={() => format('bold')}
            className={clsx(
            "p-1.5 rounded hover:bg-muted transition-colors",
            isBold && "bg-muted text-primary"
            )}
            title="Bold"
        >
            <Bold className="w-4 h-4" />
        </button>
        <button
            onClick={() => format('italic')}
            className={clsx(
            "p-1.5 rounded hover:bg-muted transition-colors",
            isItalic && "bg-muted text-primary"
            )}
            title="Italic"
        >
            <Italic className="w-4 h-4" />
        </button>
        <button
            onClick={() => format('underline')}
            className={clsx(
            "p-1.5 rounded hover:bg-muted transition-colors",
            isUnderline && "bg-muted text-primary"
            )}
            title="Underline"
        >
            <Underline className="w-4 h-4" />
        </button>
        <button
            onClick={insertLink}
            className={clsx(
            "p-1.5 rounded hover:bg-muted transition-colors",
            isLink && "bg-muted text-primary"
            )}
            title="Link"
        >
            <LinkIcon className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground mr-1">
            {isLoaded ? 'Synced' : 'Connecting...'}
        </span>

        <div className="w-px h-4 bg-border mx-1" />

        <button
            onClick={handleSaveVersion}
            disabled={saveStatus === 'saving' || !isLoaded}
            className={clsx(
                "p-1.5 rounded transition-all relative flex items-center justify-center gap-1.5",
                saveStatus === 'error' ? "text-red-500 hover:bg-red-50" : 
                saveStatus === 'saved' ? "text-green-600 bg-green-50" : 
                "text-muted-foreground hover:bg-muted hover:text-primary"
            )}
            title={saveStatus === 'saved' ? "Version Saved!" : "Save Version"}
        >
            {saveStatus === 'saving' ? (
                <div className="w-4 h-4 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                </div>
            ) : saveStatus === 'saved' ? (
                <>
                    <Check className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium hidden sm:inline">Saved</span>
                </>
            ) : saveStatus === 'error' ? (
                <X className="w-4 h-4" />
            ) : (
                <>
                    <Save className="w-4 h-4" />
                    <span className="text-[10px] font-medium hidden sm:inline">Save</span>
                </>
            )}
        </button>

        <button
            onClick={onHistoryClick}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            title="Version History"
        >
            <History className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Plugin to handle Realtime Sync
function RealtimePlugin({
    sessionId,
    groupId,
    userId,
    supabase,
    isLoaded,
    onChange
}: {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    isLoaded: boolean;
    onChange?: (state: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const isRemoteUpdate = useRef(false);
  const [channelStatus, setChannelStatus] = useState<'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING'>('CONNECTING');

  useEffect(() => {
    // Use a unique channel for the editor to avoid conflicts with global channels
    const channelName = `editor-${sessionId}`;
    const channel = supabase.channel(channelName, {
        config: {
            broadcast: { self: false }
        }
    });

    channel.on('broadcast', { event: 'editor-update' }, ({ payload }: { payload: any }) => {
      if (payload.sessionId === sessionId) {
        // Prevent loops by setting a flag
        isRemoteUpdate.current = true;
        try {
            const initialEditorState = editor.parseEditorState(payload.editorState);
            editor.setEditorState(initialEditorState);
        } catch (e) {
            console.error("Failed to parse remote editor state", e);
        }
        isRemoteUpdate.current = false;
      }
    });
    
    channel.subscribe((status) => {
        setChannelStatus(status);
        if (status === 'SUBSCRIBED') {
            // console.log("Editor connected to realtime");
        }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [editor, sessionId, supabase]);

  // OnChange: Broadcast and Save
  useEffect(() => {
    if (!isLoaded) return; // Critical: Don't save empty/loading state over existing data

    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (isRemoteUpdate.current) return;
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      const serializedState = JSON.stringify(editorState.toJSON());
      
      // Broadcast
      // We retrieve the same channel instance by name
      const channelName = `editor-${sessionId}`;
      const channel = supabase.channel(channelName);
      
      // Only send if we are subscribed to avoid fallback errors
      if (channelStatus === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'editor-update',
            payload: { sessionId, editorState: serializedState }
          }).catch(e => console.error("Broadcast error:", e));
      }

      saveToDb(supabase, sessionId, groupId, userId, serializedState);
      if (onChange) onChange(serializedState);
    });
  }, [editor, sessionId, supabase, isLoaded, channelStatus, onChange]);

  return null;
}

// Debounce helper
let saveTimeout: any;
const saveToDb = async (supabase: SupabaseClient, sessionId: string, groupId: string, userId: string, value: string) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await fetch(`/api/context/state?type=editor&groupId=${groupId}&userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          value: { content: value, updatedAt: new Date().toISOString() }
        })
      });
    } catch (e) {
      console.error("Failed to save editor", e);
    }
  }, 1000);
};

// Plugin to Load Initial State
function LoadInitialStatePlugin({
    sessionId,
    groupId,
    userId,
    supabase,
    onLoad
}: {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    onLoad: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/context/state?type=editor&groupId=${groupId}&sessionId=${sessionId}`);
        
        if (active && response.ok) {
            const data = await response.json();
            if (data?.value?.content) {
                try {
                    const initialEditorState = editor.parseEditorState(data.value.content);
                    editor.setEditorState(initialEditorState);
                } catch(e) {
                    console.error("Failed to parse initial state", e);
                }
            }
            onLoad();
        } else if (active) {
            // Even if 404/empty, we load
            onLoad();
        }
      } catch (e) {
        console.error("Error loading initial state", e);
        // Even on error, we mark as loaded so user can at least type
        if (active) onLoad();
      }
    }
    load();
    return () => { active = false; };
  }, [editor, sessionId, supabase]); // onLoad is stable ref

  return null;
}

// Plugin to handle Auto-Versioning
function AutoVersionPlugin({
    sessionId,
    groupId,
    userId,
    supabase,
    isLoaded
}: {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    isLoaded: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const lastSavedState = useRef<string>("");

  useEffect(() => {
    if (!isLoaded) return;

    // Check every 1 minute
    const intervalId = setInterval(async () => {
        const currentState = JSON.stringify(editor.getEditorState().toJSON());
        
        // If content changed since last version save
        if (currentState !== lastSavedState.current && currentState.length > 20) { // Minimal length check
            // Save version
            const timestamp = new Date().toISOString();
            
            try {
                const response = await fetch(`/api/context/state?type=editor-version&groupId=${groupId}&userId=${userId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        value: { content: currentState, timestamp },
                        timestamp
                    })
                });

                if (!response.ok) throw new Error('Failed to auto-save');
                
                lastSavedState.current = currentState;
                console.log("Auto-saved version:", timestamp);
            } catch (e) {
                console.error("Failed to auto-save version", e);
            }
        }
    }, 60 * 1000); // 1 minute

    return () => clearInterval(intervalId);
  }, [editor, sessionId, supabase, isLoaded]);

  return null;
}

function VersionHistoryDialog({
    sessionId,
    groupId,
    userId,
    supabase,
    onClose,
    onRestore
}: {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    onClose: () => void;
    onRestore: (content: string) => void;
}) {
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchVersions() {
            try {
                // console.log("Fetching versions for:", sessionId);
                const response = await fetch(`/api/context/state?type=editor-version&groupId=${groupId}&sessionId=${sessionId}`);

                if (!response.ok) throw new Error('Failed to fetch versions');
                const { data } = await response.json();
                
                // console.log("Fetched versions:", data);

                if (data) {
                    setVersions(data.map((d: any) => {
                        let val = d.value;
                        if (typeof val === 'string') {
                            try { val = JSON.parse(val); } catch(e) {}
                        }
                        return {
                            key: d.key,
                            ...val
                        };
                    }));
                }
            } catch (e) {
                console.error("Failed to load versions", e);
            } finally {
                setLoading(false);
            }
        }
        fetchVersions();
    }, [sessionId, supabase]);

    return (
        <div className="absolute top-10 right-2 w-64 bg-background rounded-lg shadow-xl border border-border z-50 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden flex flex-col max-h-[400px]">
            <div className="p-3 border-b border-border flex justify-between items-center bg-muted">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Version History
                </h3>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-1">
                {loading ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Loading history...</div>
                ) : versions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No previous versions found.</div>
                ) : (
                    <div className="space-y-0.5">
                        {versions.map((v) => (
                            <button
                                key={v.key}
                                onClick={() => onRestore(v.content)}
                                className="w-full text-left px-3 py-2 hover:bg-accent rounded flex items-center justify-between group transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-foreground">
                                        {format(new Date(v.timestamp), 'MMM d, h:mm a')}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Auto-save
                                    </span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 text-blue-600 text-[10px] font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                    Restore
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Plugin to prevent layout shifts on focus
function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Wait for editor root element to be available
    const remove = editor.registerUpdateListener(() => {
        const rootElement = editor.getRootElement();
        if (rootElement) {
            // Prevent scroll on focus
            rootElement.focus({ preventScroll: true });
            remove();
        }
    });
    // Trigger update to ensure listener runs? 
    // Or just check immediately?
    const rootElement = editor.getRootElement();
    if (rootElement) {
        rootElement.focus({ preventScroll: true });
        remove();
    }
    return remove;
  }, [editor]);

  return null;
}

function ContextMenuPlugin({ 
    parentRef, 
    onSendMessage, 
    onAddTimelineEntry, 
    onAddToGraph,
    availablePanes,
    onCreatePane
}: { 
    parentRef: React.RefObject<HTMLDivElement | null>;
    onSendMessage?: (text: string) => void;
    onAddTimelineEntry?: (text: string) => void;
    onAddToGraph?: (text: string) => void;
    availablePanes?: { id: string; title: string; type: string }[];
    onCreatePane?: (type: string, content?: string, callback?: (id: string) => void) => void;
}) {
    const [editor] = useLexicalComposerContext();
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; selectionRange?: Range } | null>(null);
    const [showPaneSelector, setShowPaneSelector] = useState(false);

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            if (!parentRef.current || !parentRef.current.contains(e.target as Node)) return;
            
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                e.preventDefault();
                const range = selection.getRangeAt(0).cloneRange();
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    text: selection.toString().trim(),
                    selectionRange: range
                });
                setShowPaneSelector(false); // Reset to main menu
            }
        };

        const handleClick = () => {
            if (contextMenu) setContextMenu(null);
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('click', handleClick);
        };
    }, [parentRef, contextMenu]);

    const handleCreateLink = (url: string) => {
        if (contextMenu?.selectionRange) {
             const selection = window.getSelection();
             if (selection) {
                 selection.removeAllRanges();
                 selection.addRange(contextMenu.selectionRange);
             }
             
             // Ensure focus before dispatching
             editor.getRootElement()?.focus();
             setTimeout(() => {
                 editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
             }, 0);
        }
        setContextMenu(null);
    };

    if (!contextMenu) return null;

    if (showPaneSelector) {
        return (
             <div 
                className="fixed z-[101] bg-background rounded-lg shadow-xl border border-border w-64 overflow-hidden py-1 flex flex-col"
                style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x + 10, window.innerWidth - 270) }}
                onClick={(e) => e.stopPropagation()}
             >
                <div className="px-3 py-2 border-b border-border bg-muted flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-2">
                        <button onClick={() => setShowPaneSelector(false)} className="hover:bg-secondary rounded p-0.5"><ArrowLeft className="w-3 h-3 text-muted-foreground" /></button>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Pane</div>
                     </div>
                     <button onClick={() => setContextMenu(null)}><X className="w-3 h-3 text-muted-foreground" /></button>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-1">
                    {onCreatePane && (
                        <button 
                            onClick={() => {
                                onCreatePane('wiki', contextMenu.text, (id) => handleCreateLink(`pane:${id}`));
                            }}
                            className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground truncate mb-1 border-b border-border"
                        >
                             <Plus className="w-3 h-3 shrink-0 text-indigo-500" />
                             <span className="truncate flex-1 font-medium text-indigo-600">New Wiki Pane</span>
                        </button>
                    )}
                    {availablePanes && availablePanes.length > 0 ? availablePanes.map(pane => (
                        <button 
                            key={pane.id}
                            onClick={() => handleCreateLink(`pane:${pane.id}`)}
                            className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground truncate"
                        >
                             <Layout className="w-3 h-3 shrink-0" />
                             <span className="truncate flex-1">{pane.title}</span>
                             <span className="text-[9px] text-muted-foreground shrink-0 uppercase border border-border px-1 rounded bg-muted">{pane.type}</span>
                        </button>
                    )) : (
                        <div className="p-2 text-center text-xs text-muted-foreground">No other panes available</div>
                    )}
                </div>
             </div>
        );
    }

    return (
        <div 
            className="fixed z-[100] bg-background rounded-lg shadow-xl border border-border w-56 overflow-hidden py-1"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 240) }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-3 py-2 border-b border-border bg-muted">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">With selection...</div>
            </div>
            <div className="p-1">
                {onSendMessage && (
                    <button onClick={() => { onSendMessage(contextMenu.text); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground">
                            <MessageSquare className="w-4 h-4" />
                            <span>Ask AI</span>
                    </button>
                )}
                {onAddTimelineEntry && (
                    <button onClick={() => { onAddTimelineEntry(contextMenu.text); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Add to Timeline</span>
                    </button>
                )}
                {onAddToGraph && (
                    <button onClick={() => { onAddToGraph(contextMenu.text); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground">
                            <Workflow className="w-4 h-4" />
                            <span>Add to Graph</span>
                    </button>
                )}
                {onSendMessage && (
                    <button onClick={() => { onSendMessage(`Please refine/rewrite this text: "${contextMenu.text}"`); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span>Refine Text</span>
                    </button>
                )}
                
                <div className="border-t border-border my-1 pt-1"></div>
                
                <button onClick={() => { 
                        const url = prompt("Enter URL:", "https://");
                        if (url) handleCreateLink(url);
                }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground">
                        <LinkIcon className="w-4 h-4" />
                        <span>Link to URL</span>
                </button>
                
                <button onClick={(e) => { 
                        e.stopPropagation();
                        setShowPaneSelector(true);
                }} className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded flex items-center gap-2 text-sm text-foreground justify-between group/pane">
                        <div className="flex items-center gap-2">
                            <Layout className="w-4 h-4" />
                            <span>Link to Pane</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover/pane:text-indigo-600" />
                </button>
            </div>
        </div>
    );
}

function LinkClickListenerPlugin({ onClick }: { onClick?: (url: string) => void }) {
    const [editor] = useLexicalComposerContext();
    
    useEffect(() => {
        const onClickWrapper = (event: MouseEvent) => {
             const target = event.target as HTMLElement;
             const link = target.closest('a');
             
             // Check if click is on a link inside the editor
             if (!link || !editor.getRootElement()?.contains(link)) return;
             
             const href = link.getAttribute('href');
             if (!href) return;
             
             // Handle pane links and external links with Meta/Ctrl key
             if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                event.stopPropagation();
                
                if (onClick) {
                    onClick(href);
                } else if (!href.startsWith('pane:')) {
                    window.open(href, '_blank');
                }
             }
        };
        
        // We need to attach listener to the root element after it's mounted
        const unregister = editor.registerRootListener((rootElement) => {
            if (rootElement) {
                rootElement.addEventListener('click', onClickWrapper);
            }
        });
        
        return () => {
            unregister();
        };
    }, [editor, onClick]);
    
    return null;
}

export const Editor = forwardRef<IPane, {
    sessionId: string;
    groupId: string;
    userId: string;
    supabase: SupabaseClient;
    pendingUpdate?: string | null;
    onUpdateApplied?: () => void;
    onChange?: (state: string) => void;
    onSendMessage?: (text: string) => void;
    onAddTimelineEntry?: (text: string) => void;
    onAddToGraph?: (text: string) => void;
    availablePanes?: { id: string; title: string; type: string }[];
    onCreatePane?: (type: string, content?: string, callback?: (id: string) => void) => void;
    onLinkClick?: (url: string) => void;
}>(({
    sessionId,
    groupId,
    userId,
    supabase,
    pendingUpdate,
    onUpdateApplied,
    onChange,
    onSendMessage,
    onAddTimelineEntry,
    onAddToGraph,
    availablePanes,
    onCreatePane,
    onLinkClick
}, ref) => {
  const initialConfig = {
    namespace: 'Editor',
    theme,
    onError: (error: Error) => console.error(error),
    nodes: [
        HeadingNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        ListNode,
        ListItemNode,
        AutoLinkNode,
        LinkNode,
        ImageNode
    ]
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);
  const [internalPendingUpdate, setInternalPendingUpdate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
      acceptContent: (content: PaneContent) => {
          if (content.text) {
              setInternalPendingUpdate(content.text);
          }
      }
  }));

  return (
    <div className="h-full flex flex-col bg-background relative group" ref={containerRef}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ToolbarPlugin
            onHistoryClick={() => setShowHistory(!showHistory)}
            sessionId={sessionId}
            groupId={groupId}
            userId={userId}
            supabase={supabase}
            isLoaded={isLoaded}
          />
          
          <ContextMenuPlugin 
             parentRef={containerRef}
             onSendMessage={onSendMessage}
             onAddTimelineEntry={onAddTimelineEntry}
             onAddToGraph={onAddToGraph}
             availablePanes={availablePanes}
             onCreatePane={onCreatePane}
          />

          {showHistory && (
             <VersionHistoryDialog
                sessionId={sessionId}
                groupId={groupId}
                userId={userId}
                supabase={supabase}
                onClose={() => setShowHistory(false)}
                onRestore={(content) => {
                    setPendingRestoreContent(content);
                    setShowHistory(false);
                }}
             />
          )}

          <div className="flex-1 relative min-h-0">
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  className={`h-full p-4 outline-none resize-none overflow-y-auto ${!isLoaded ? 'opacity-50' : ''}`}
                />
              }
              placeholder={<div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">Start typing...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <LinkPlugin validateUrl={(url) => {
                // Allow standard schemes and our custom pane: scheme
                return /^(https?:\/\/.+|mailto:.+|tel:.+|pane:.+)/.test(url);
            }} />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <HistoryPlugin />
            <RealtimePlugin
                sessionId={sessionId}
                groupId={groupId}
                userId={userId}
                supabase={supabase}
                isLoaded={isLoaded}
                onChange={onChange}
            />
            <LoadInitialStatePlugin
                sessionId={sessionId}
                groupId={groupId}
                userId={userId}
                supabase={supabase}
                onLoad={() => setIsLoaded(true)}
            />
            <AutoVersionPlugin
                sessionId={sessionId}
                groupId={groupId}
                userId={userId}
                supabase={supabase}
                isLoaded={isLoaded}
            />
            <AutoFocusPlugin />
            <ImagePastePlugin groupId={groupId} />
            <LinkClickListenerPlugin onClick={onLinkClick} />
            
            {/* Logic to handle external updates (e.g. from chat approval) */}
            <ExternalUpdatePlugin 
                content={pendingUpdate || internalPendingUpdate} 
                onApplied={() => {
                    if (pendingUpdate && onUpdateApplied) onUpdateApplied();
                    if (internalPendingUpdate) setInternalPendingUpdate(null);
                }} 
            />
            
            {/* Logic to handle history restoration */}
            <ExternalUpdatePlugin 
                content={pendingRestoreContent} 
                onApplied={() => setPendingRestoreContent(null)} 
            />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
});

// Helper to inject content from props
function ExternalUpdatePlugin({ content, onApplied }: { content: string | null; onApplied: () => void }) {
    const [editor] = useLexicalComposerContext();
    
    useEffect(() => {
        if (!content) return;
        
        editor.update(() => {
            // If content is a JSON state
            if (content.startsWith('{')) {
                try {
                    const editorState = editor.parseEditorState(content);
                    editor.setEditorState(editorState);
                } catch(e) {
                    console.error("Failed to parse state", e);
                }
            } else {
                // Append text
                const root = $getRoot();
                const p = $createParagraphNode();
                p.append($createTextNode(content));
                root.append(p);
            }
        });
        
        onApplied();
    }, [content, editor]); // onApplied stable ref

    return null;
}
