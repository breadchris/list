import React, { useState, useEffect, useRef } from 'react';
import { Persona, Message } from './types';
import { DEFAULT_PERSONAS, PROMPT_ARCHITECT_PERSONA } from './data/defaultPersonas';
import { X, Save, Play, RefreshCw, GripVertical, Trash2, Plus, Edit2, Check, ArrowLeft, Bot } from 'lucide-react';
import { Editor } from './Editor';
import { ChatArea } from './ChatArea';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PersonaManagerProps {
  personas: Persona[];
  onSave: (personas: Persona[]) => void;
  onClose: () => void;
  supabase: any;
  groupId: string;
  userId: string;
}

export function PersonaManager({ personas, onSave, onClose, supabase, groupId, userId }: PersonaManagerProps) {
  const [localPersonas, setLocalPersonas] = useState<Persona[]>(personas);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  
  // Editor State
  const [editorSessionId, setEditorSessionId] = useState<string>('');
  const [architectMessages, setArchitectMessages] = useState<Message[]>([]);
  const [testMessages, setTestMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingPromptUpdate, setPendingPromptUpdate] = useState<string | null>(null);

  // Current Editing Fields
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [editInitialPrompt, setEditInitialPrompt] = useState('');
  const [editAvatarPath, setEditAvatarPath] = useState<string | undefined>(undefined);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPromptJson, setCurrentPromptJson] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Computed: The currently editing persona object (merged with live prompt)
  const currentEditingPersona = editingId ? localPersonas.find(p => p.id === editingId) : null;

  const startEditing = (persona: Persona) => {
    setEditingId(persona.id);
    setEditName(persona.name);
    setEditRole(persona.role);
    setEditDesc(persona.description);
    setEditColor(persona.color);
    setEditInitialPrompt(persona.initialPrompt);
    setEditAvatarPath(persona.avatarPath);
    setEditAvatarUrl(persona.avatarUrl);
    setCurrentPromptJson(null);
    setSaveStatus('idle');
    
    // Setup Architect Session
    const sessId = `persona-editor-${persona.id}`;
    setEditorSessionId(sessId);
    
    // Seed Architect Chat if empty
    setArchitectMessages([{
        id: 'welcome',
        sender: 'ai',
        text: PROMPT_ARCHITECT_PERSONA.initialPrompt,
        timestamp: new Date(),
        personaId: PROMPT_ARCHITECT_PERSONA.id,
        sessionId: sessId
    }]);

    // Load current system prompt into editor via state update (hacky but works if Editor listens to key)
    // Actually, we should force the editor to load the persona's current prompt.
    // We can do this by manually calling the save-state endpoint with the persona's prompt converted to simple lexical JSON?
    // Or just trust the Editor to load what's in the KV store?
    // Problem: The KV store might be empty or stale for this session ID.
    // Solution: We will inject the prompt into the editor on mount.
    
    const initialLexicalState = JSON.stringify({
        root: {
            children: [{
                children: [{
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: persona.systemPrompt || "",
                    type: "text",
                    version: 1
                }],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "paragraph",
                version: 1
            }],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "root",
            version: 1
        }
    });

    // Seed the editor state in backend so the Editor component loads it
    fetch(`/api/context/editor/state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sessionId: sessId,
            value: { content: initialLexicalState, updatedAt: new Date().toISOString() }
        })
    });
  };

  const processImage = (file: File): Promise<Blob> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const size = 256; 
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject('No context');

              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
              
              canvas.toBlob((blob) => {
                  if (blob) resolve(blob);
                  else reject('Canvas failed');
              }, 'image/jpeg', 0.9);
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
      });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsUploading(true);
      try {
          const processedBlob = await processImage(file);
          const formData = new FormData();
          formData.append('file', processedBlob, 'avatar.jpg');
          
          const res = await fetch(`/api/context/upload`, {
              method: 'POST',
              body: formData
          });
          
          if (!res.ok) throw new Error('Upload failed');
          
          const data = await res.json();
          setEditAvatarPath(data.path);
          setEditAvatarUrl(data.url);
      } catch (e) {
          console.error(e);
          alert("Failed to upload image");
      } finally {
          setIsUploading(false);
      }
  };

  const handleCreateNew = () => {
    const newId = crypto.randomUUID();
    const newPersona: Persona = {
        id: newId,
        name: 'New Persona',
        role: 'Assistant',
        description: 'A new custom assistant.',
        initialPrompt: 'How can I help you?',
        systemPrompt: 'You are a helpful assistant.',
        color: '#94a3b8'
    };
    setLocalPersonas([...localPersonas, newPersona]);
    startEditing(newPersona);
  };

  const handleDelete = (id: string) => {
      if (confirm('Are you sure you want to delete this persona?')) {
          setLocalPersonas(prev => prev.filter(p => p.id !== id));
          if (editingId === id) setEditingId(null);
      }
  };

  const handleSavePersona = async () => {
      // Manual save trigger (optional now, but good for forcing immediate save)
      if (!editingId) return;
      setSaveStatus('saving');
      performSave();
      setTimeout(() => setSaveStatus('saved'), 500);
      setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const performSave = () => {
      if (!editingId) return;

      let systemPrompt = "";
      // Prioritize the captured JSON from editor if available
      if (currentPromptJson) {
           try {
                const state = JSON.parse(currentPromptJson);
                const extractText = (node: any): string => {
                    if (node.text) return node.text;
                    if (node.children) return node.children.map(extractText).join(node.type === 'paragraph' ? '\n' : '');
                    return '';
                };
                if (state.root) systemPrompt = extractText(state.root);
             } catch(e) {
                 console.error("Failed to parse prompt", e);
             }
      } else {
          // Fallback to existing if editor hasn't reported changes
          systemPrompt = localPersonas.find(p => p.id === editingId)?.systemPrompt || "";
      }

      const updatedPersonas = localPersonas.map(p => {
            if (p.id === editingId) {
                return {
                    ...p,
                    name: editName,
                    role: editRole,
                    description: editDesc,
                    color: editColor,
                    initialPrompt: editInitialPrompt,
                    systemPrompt: systemPrompt,
                    avatarPath: editAvatarPath,
                    avatarUrl: editAvatarUrl
                };
            }
            return p;
      });

      setLocalPersonas(updatedPersonas);
      onSave(updatedPersonas);
  };

  // Auto-Save Effect
  useEffect(() => {
      if (!editingId) return;

      setSaveStatus('saving');
      const timer = setTimeout(() => {
          performSave();
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      }, 1000);

      return () => clearTimeout(timer);
  }, [editName, editRole, editDesc, editColor, editInitialPrompt, currentPromptJson, editAvatarPath, editAvatarUrl]);

  // Chat Handler for Architect
  const handleArchitectMessage = async (text: string) => {
      const userMsg: Message = {
          id: crypto.randomUUID(),
          sender: 'user',
          text,
          timestamp: new Date(),
          sessionId: editorSessionId
      };
      setArchitectMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const response = await fetch(`/api/context/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [...architectMessages, userMsg],
                sessionId: editorSessionId,
                persona: PROMPT_ARCHITECT_PERSONA
            })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Handle Editor Update
            if (data.editorUpdate) {
                setPendingPromptUpdate(data.editorUpdate);
            }

            const aiMsg: Message = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: data.reply,
                timestamp: new Date(),
                personaId: PROMPT_ARCHITECT_PERSONA.id,
                sessionId: editorSessionId
            };
            setArchitectMessages(prev => [...prev, aiMsg]);
        }
      } catch (e) {
          console.error(e);
      } finally {
          setIsTyping(false);
      }
  };

  // Test Mode Logic
  const toggleTestMode = async () => {
      if (!isTestMode) {
          // Entering Test Mode
          // 1. Fetch current prompt draft
          const res = await fetch(`/api/context/editor/state?sessionId=${editorSessionId}`);
          const data = await res.json();
          let draftPrompt = "";
           try {
                const state = JSON.parse(data.value.content);
                const extractText = (node: any): string => {
                    if (node.text) return node.text;
                    if (node.children) return node.children.map(extractText).join(node.type === 'paragraph' ? '\n' : '');
                    return '';
                };
                if (state.root) draftPrompt = extractText(state.root);
             } catch(e) {}

          // 2. Setup Test Session
          setTestMessages([{
              id: 'test-welcome',
              sender: 'ai',
              text: editInitialPrompt || "Ready to test.",
              timestamp: new Date(),
              personaId: editingId!,
              sessionId: 'test-session'
          }]);
      }
      setIsTestMode(!isTestMode);
  };

  const handleTestMessage = async (text: string) => {
      const userMsg: Message = {
          id: crypto.randomUUID(),
          sender: 'user',
          text,
          timestamp: new Date(),
          sessionId: 'test-session'
      };
      setTestMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      // Construct temporary persona object with current draft settings
      // We need to fetch the prompt again? Or just pass what we know? 
      // Ideally we should have the prompt in state, but it's in the editor.
      // Let's assume the editor saved it to backend for the architect session. 
      // Actually, we can just pass the systemPrompt if we fetched it earlier, 
      // but to be safe let's just use the fetch trick again inside the chat call? 
      // No, `ChatArea` calls the backend. 
      // We need to implement `onSendMessage` here manually for the test area so we can inject the custom persona.

      try {
          // Get draft prompt first
          const promptRes = await fetch(`/api/context/editor/state?sessionId=${editorSessionId}`);
          const promptData = await promptRes.json();
          let draftPrompt = "";
           try {
                const state = JSON.parse(promptData.value.content);
                const extractText = (node: any): string => {
                    if (node.text) return node.text;
                    if (node.children) return node.children.map(extractText).join(node.type === 'paragraph' ? '\n' : '');
                    return '';
                };
                if (state.root) draftPrompt = extractText(state.root);
             } catch(e) {}

          const testPersona: Persona = {
              id: editingId!,
              name: editName,
              role: editRole,
              description: editDesc,
              color: editColor,
              initialPrompt: editInitialPrompt,
              systemPrompt: draftPrompt
          };

          const response = await fetch(`/api/context/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [...testMessages, userMsg],
                sessionId: 'test-session',
                persona: testPersona
            })
        });

        if (response.ok) {
            const data = await response.json();
            const aiMsg: Message = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: data.reply,
                timestamp: new Date(),
                personaId: editingId!,
                sessionId: 'test-session',
                structuredQuestion: data.structuredQuestion,
                recipe: data.recipe,
                wikiAction: data.wikiAction
            };
            setTestMessages(prev => [...prev, aiMsg]);
        }

      } catch (e) {
          console.error(e);
      } finally {
          setIsTyping(false);
      }
  };


  return (
    <div className="fixed inset-0 bg-secondary z-[100] flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-background border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Bot className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-semibold text-foreground">Persona Manager</h2>
                <p className="text-sm text-muted-foreground">Design custom AI assistants</p>
            </div>
        </div>
        <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-accent rounded-full">
            <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar List */}
          <div className={cn(
              "w-80 bg-background border-r border-border flex flex-col overflow-hidden transition-all duration-300",
              editingId ? "w-0 opacity-0 md:w-80 md:opacity-100" : "w-full md:w-80"
          )}>
              <div className="p-4 border-b border-border">
                  <button 
                    onClick={handleCreateNew}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                  >
                      <Plus className="w-4 h-4" />
                      Create New Persona
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {localPersonas.map((p, idx) => (
                      <div 
                        key={p.id} 
                        draggable={!editingId}
                        onDragStart={(e) => {
                            if (editingId) { e.preventDefault(); return; }
                            e.dataTransfer.setData('text/plain', idx.toString());
                        }}
                        onDragOver={(e) => {
                            if (editingId) return;
                            e.preventDefault();
                        }}
                        onDrop={(e) => {
                            if (editingId) return;
                            e.preventDefault();
                            const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'));
                            const droppedIdx = idx;
                            if (draggedIdx === droppedIdx) return;
                            
                            const newPersonas = [...localPersonas];
                            const [reorderedItem] = newPersonas.splice(draggedIdx, 1);
                            newPersonas.splice(droppedIdx, 0, reorderedItem);
                            setLocalPersonas(newPersonas);
                            // Auto save order? 
                            // Maybe better to wait for explicit save, but for reorder usually instant is expected.
                            // We'll let the user hit "Save" on top right (if we move save button out of edit mode)
                            // or just wait until they edit something.
                            // Actually, onSave is only called from edit mode currently. 
                            // Let's add a global save or auto-save.
                            // For now, reordering only persists if you edit something and save.
                            // Let's call onSave immediately for reordering.
                            onSave(newPersonas);
                        }}
                        className={cn(
                            "group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                            editingId === p.id 
                                ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                                : "bg-background border-border hover:border-indigo-200 hover:bg-accent"
                        )}
                        onClick={() => startEditing(p)}
                      >
                           <div className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground">
                               <GripVertical className="w-4 h-4" />
                           </div>
                           <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden" style={{ backgroundColor: p.avatarUrl ? 'transparent' : p.color }}>
                               {p.avatarUrl ? (
                                   <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                               ) : (
                                   <span className="font-bold text-sm">{p.role[0]}</span>
                               )}
                           </div>
                           <div className="flex-1 min-w-0">
                               <h3 className="font-medium text-foreground truncate">{p.name}</h3>
                               <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                           </div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                             className="p-1.5 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                               <Trash2 className="w-4 h-4" />
                           </button>
                      </div>
                  ))}
              </div>
          </div>

          {/* Main Content Area */}
          <div className={cn(
              "flex-1 flex flex-col bg-muted transition-all duration-300",
              !editingId ? "opacity-50 pointer-events-none" : "opacity-100"
          )}>
              {editingId && (
                  <>
                    {/* Editor Header */}
                    <div className="bg-background border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <button className="md:hidden" onClick={() => setEditingId(null)}>
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </button>
                            
                            <div className="relative group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                />
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden bg-secondary border-2 border-transparent hover:border-indigo-300 transition-all",
                                    isUploading && "opacity-50"
                                )} style={{ backgroundColor: editAvatarUrl ? 'transparent' : editColor }}>
                                    {isUploading ? (
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    ) : editAvatarUrl ? (
                                        <img src={editAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-lg font-bold">{editRole[0] || editName[0]}</span>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                            </div>

                            <input 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-lg font-bold text-foreground bg-transparent border-none focus:ring-0 placeholder:text-muted-foreground w-48"
                                placeholder="Persona Name"
                            />
                            <div className="h-6 w-px bg-border" />
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">Role:</label>
                                <input 
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="text-sm text-foreground bg-muted border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-32"
                                    placeholder="e.g. Engineer"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">Color:</label>
                                <input 
                                    type="color"
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    className="w-8 h-8 p-0 border-none rounded-full cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={toggleTestMode}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                                    isTestMode 
                                        ? "bg-slate-800 text-white border-slate-800" 
                                        : "bg-background text-muted-foreground border-border hover:bg-accent"
                                )}
                            >
                                {isTestMode ? <Edit2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                {isTestMode ? "Edit Prompt" : "Test Persona"}
                            </button>
                            <button 
                                onClick={handleSavePersona} // Can serve as manual flush or close
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium shadow-sm transition-all min-w-[100px] justify-center"
                            >
                                {saveStatus === 'saving' ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                ) : saveStatus === 'saved' ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* Editor / Test Body */}
                    <div className="flex-1 overflow-hidden relative">
                        {isTestMode ? (
                            <div className="h-full bg-background flex flex-col max-w-3xl mx-auto border-x border-border shadow-sm">
                                <div className="p-3 bg-yellow-50 text-yellow-800 text-xs font-medium text-center border-b border-yellow-100">
                                    Testing Mode - Changes are temporary until saved.
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <ChatArea 
                                        messages={testMessages}
                                        currentPersona={{ 
                                            id: editingId, 
                                            name: editName, 
                                            role: editRole, 
                                            description: editDesc, 
                                            color: editColor,
                                            initialPrompt: editInitialPrompt,
                                            systemPrompt: ""
                                        } as Persona} // Mock
                                        personas={[]} 
                                        onSendMessage={handleTestMessage}
                                        onSwitchPersona={() => {}}
                                        isTyping={isTyping}
                                        onRefine={async (t) => t}
                                        onToggleEditor={() => {}}
                                        isEditorOpen={false}
                                        onWikiAction={() => {}}
                                        onAddToTimeline={() => {}}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full">
                                {/* Left: Architect Chat */}
                                <div className="w-1/3 border-r border-border flex flex-col bg-background">
                                    <div className="p-3 border-b border-border bg-muted/50">
                                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-white">
                                                <Bot className="w-3 h-3" />
                                            </div>
                                            Prompt Architect
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <ChatArea 
                                            messages={architectMessages}
                                            currentPersona={PROMPT_ARCHITECT_PERSONA}
                                            personas={[PROMPT_ARCHITECT_PERSONA]}
                                            onSendMessage={handleArchitectMessage}
                                            onSwitchPersona={() => {}}
                                            isTyping={isTyping}
                                            onRefine={async (t) => t}
                                            onToggleEditor={() => {}}
                                            isEditorOpen={false}
                                            onWikiAction={() => {}}
                                            onAddToTimeline={() => {}}
                                        />
                                    </div>
                                </div>

                                {/* Right: System Prompt Editor */}
                                <div className="flex-1 flex flex-col bg-muted h-full relative">
                                    <div className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
                                        <div className="bg-background rounded-xl shadow-sm border border-border flex flex-col h-full overflow-hidden">
                                            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-muted/50">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt Configuration</span>
                                            </div>
                                            <div className="flex-1 relative">
                                                <Editor
                                                    sessionId={editorSessionId}
                                                    groupId={groupId}
                                                    userId={userId}
                                                    supabase={supabase}
                                                    pendingUpdate={pendingPromptUpdate}
                                                    onUpdateApplied={() => setPendingPromptUpdate(null)}
                                                    onChange={(state) => setCurrentPromptJson(state)}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Meta Fields */}
                                        <div className="bg-background p-4 rounded-xl border border-border shadow-sm shrink-0 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                                                <input 
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    className="w-full text-sm border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="Short description..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Initial Greeting</label>
                                                <input 
                                                    value={editInitialPrompt}
                                                    onChange={(e) => setEditInitialPrompt(e.target.value)}
                                                    className="w-full text-sm border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="First message sent to user..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                  </>
              )}
          </div>
      </div>
    </div>
  );
}