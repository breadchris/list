import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { Editor } from './Editor';
import { FlowEditor } from './FlowEditor';
import { Message, Persona, TimelineEntry, ChatSession } from '../types';
import { Menu, X, Settings, FileText, Workflow } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../supabaseClient';
import { DEFAULT_PERSONAS } from '../data/defaultPersonas';
import { PersonaManager } from './PersonaManager';
import { Sandbox } from './Sandbox';
import { CommandPalette } from './CommandPalette';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility for ID generation since uuid might not be installed
const generateId = () => Math.random().toString(36).substring(2, 9);

export function ClassicApp() {
  const [personas, setPersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [currentPersona, setCurrentPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // All messages from all sessions (filtered in UI)
  const [messages, setMessages] = useState<Message[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Right Panel State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<'editor' | 'flow'>('editor');
  
  const [pendingEditorUpdate, setPendingEditorUpdate] = useState<string | null>(null);
  const [pendingFlowActions, setPendingFlowActions] = useState<any[]>([]);
  const [sandboxFlowActions, setSandboxFlowActions] = useState<Record<string, any[]>>({});
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Manager State
  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isChatFadingIn, setIsChatFadingIn] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);

  // Keyboard shortcut for Sandbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setViewMode(prev => prev === 'sandbox' ? 'home' : 'sandbox');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wiki State
  const [wikiPaths, setWikiPaths] = useState<string[]>([]);
  const [currentWikiPath, setCurrentWikiPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'home' | 'chat' | 'wiki' | 'sandbox'>('home');

  // Computed: Messages for current session
  const currentSessionMessages = useMemo(() => {
    if (!currentSessionId) return [];
    return messages.filter(m => m.sessionId === currentSessionId);
  }, [messages, currentSessionId]);

  // Realtime Subscription (Broadcast + DB Changes)
  useEffect(() => {
    // specific channel for this app/project
    const channel = supabase.channel('room-1', {
        config: {
            broadcast: { self: false } // Don't receive our own messages
        }
    });

    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kv_store_61781242',
        },
        (payload) => {
          console.log('[Realtime] DB Change:', payload.eventType, payload.new);
          const { new: newRecord, eventType } = payload;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
             const key = newRecord.key as string;
             const value = newRecord.value;
             
             if (key.startsWith('msg:')) {
                 const msg = { ...value, timestamp: new Date(value.timestamp) };
                 setMessages(prev => {
                     const exists = prev.find(m => m.id === msg.id);
                     if (exists) {
                         if (JSON.stringify(exists) !== JSON.stringify(msg)) {
                             return prev.map(m => m.id === msg.id ? msg : m);
                         }
                         return prev;
                     }
                     return [...prev, msg];
                 });
             } else if (key.startsWith('thought:')) {
                 const entry = { ...value, timestamp: new Date(value.timestamp) };
                 setTimelineEntries(prev => {
                     const exists = prev.find(t => t.id === entry.id);
                     if (exists) {
                         if (JSON.stringify(exists) !== JSON.stringify(entry)) {
                             return prev.map(t => t.id === entry.id ? entry : t);
                         }
                         return prev;
                     }
                     
                     // Deduplicate: Check for content match within 10 seconds
                     const duplicate = prev.find(t => 
                         t.content.trim() === entry.content.trim() && 
                         Math.abs(t.timestamp.getTime() - entry.timestamp.getTime()) < 10000 
                     );
                     
                     if (duplicate) {
                         return prev.map(t => t.id === duplicate.id ? entry : t);
                     }
                     
                     return [...prev, entry];
                 });
             } else if (key.startsWith('session:')) {
                 const session = { 
                     ...value, 
                     createdAt: new Date(value.createdAt),
                     updatedAt: new Date(value.updatedAt)
                 };
                 setSessions(prev => {
                     const exists = prev.find(s => s.id === session.id);
                     if (exists) {
                         if (JSON.stringify(exists) !== JSON.stringify(session)) {
                             return prev.map(s => s.id === session.id ? session : s).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                         }
                         return prev;
                     }
                     return [session, ...prev].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                 });
             }
          }
        }
      )
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
          console.log('[Realtime] Broadcast: new-message', payload);
          const msg = { ...payload, timestamp: new Date(payload.timestamp) };
          setMessages(prev => {
               if (prev.find(m => m.id === msg.id)) return prev;
               return [...prev, msg];
          });
          // Update session preview if needed
          if (msg.sessionId) {
              setSessions(prev => prev.map(s => {
                  if (s.id === msg.sessionId) {
                       return { ...s, updatedAt: new Date(), preview: msg.text };
                  }
                  return s;
              }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
          }
      })
      .on('broadcast', { event: 'new-timeline' }, ({ payload }) => {
          console.log('[Realtime] Broadcast: new-timeline', payload);
          const entries = payload.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
          setTimelineEntries(prev => {
              // Merge and dedup
              const newIds = new Set(entries.map((e: any) => e.id));
              const filteredPrev = prev.filter(p => !newIds.has(p.id));
              return [...entries, ...filteredPrev];
          });
      })
      .on('broadcast', { event: 'new-session' }, ({ payload }) => {
           console.log('[Realtime] Broadcast: new-session', payload);
           const session = { 
               ...payload, 
               createdAt: new Date(payload.createdAt), 
               updatedAt: new Date(payload.updatedAt) 
           };
           setSessions(prev => {
               if (prev.find(s => s.id === session.id)) return prev;
               return [session, ...prev].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
           });
      })
      .on('broadcast', { event: 'update-session' }, ({ payload }) => {
           console.log('[Realtime] Broadcast: update-session', payload);
           const session = { 
               ...payload, 
               createdAt: new Date(payload.createdAt), 
               updatedAt: new Date(payload.updatedAt) 
           };
           setSessions(prev => {
               return prev.map(s => s.id === session.id ? session : s)
                   .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
           });
      })
      .subscribe((status) => {
          console.log('[Realtime] Status:', status);
          if (status !== 'SUBSCRIBED') {
              // console.warn("Realtime not connected", status);
          }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  // Sync: Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/sync`, {
           headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (!res.ok) {
           const errText = await res.text();
           console.error("Sync load failed:", res.status, errText);
           return; 
        }

        const data = await res.json();
        
        // 0. Load Personas
        if (data.personas && Array.isArray(data.personas) && data.personas.length > 0) {
            setPersonas(data.personas);
            const exists = data.personas.find((p: Persona) => p.id === currentPersona.id);
            if (!exists) setCurrentPersona(data.personas[0]);
        }

        // 1. Load Messages
        let loadedMessages: Message[] = [];
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          loadedMessages = data.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          setMessages(loadedMessages);
        }

        // 2. Load Timeline
        if (data.timelineEntries && Array.isArray(data.timelineEntries) && data.timelineEntries.length > 0) {
          setTimelineEntries(data.timelineEntries.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) })));
        }

        // 3. Load Sessions
        let loadedSessions: ChatSession[] = [];
        if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          loadedSessions = data.sessions.map((s: any) => ({ 
              ...s, 
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt)
          }));
          setSessions(loadedSessions);
        }

        // 3b. Load Wiki Pages
        try {
             const wikiRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/wiki/pages`, {
                 headers: { 'Authorization': `Bearer ${publicAnonKey}` }
             });
             if (wikiRes.ok) {
                 const { paths } = await wikiRes.json();
                 if (paths) setWikiPaths(paths);
             }
        } catch (e) {
            console.error("Failed to load wiki pages", e);
        }

        // 4. Initialize State
        if (loadedSessions.length > 0) {
            // Load most recent session
            setCurrentSessionId(loadedSessions[0].id);
        } else if (loadedMessages.length > 0) {
            // Migration: Create "Archive" session for orphan messages
            const archiveId = generateId();
            const archiveSession: ChatSession = {
                id: archiveId,
                title: 'Historical Chat',
                createdAt: new Date(),
                updatedAt: new Date(),
                preview: 'Legacy messages'
            };
            setSessions([archiveSession]);
            setCurrentSessionId(archiveId);
            
            // Assign ID to orphan messages
            setMessages(prev => prev.map(m => (!m.sessionId ? { ...m, sessionId: archiveId } : m)));
        } else {
            // Fresh Start
            createNewChat();
        }

      } catch (e) {
        console.error("Sync load error:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Sync: Save Data
  useEffect(() => {
    if (!isLoaded) return;

    const timeoutId = setTimeout(async () => {
        try {
            await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${publicAnonKey}`
                },
                body: JSON.stringify({ 
                    messages, 
                    timelineEntries,
                    sessions,
                    personas // Sync personas
                })
            });
        } catch (e) {
            console.error("Sync save error:", e);
        }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [messages, timelineEntries, sessions, personas, isLoaded]);

  const createNewChat = () => {
      const newId = generateId();
      const newSession: ChatSession = {
          id: newId,
          title: 'New Chat',
          createdAt: new Date(),
          updatedAt: new Date()
      };
      
      const welcomeMsg: Message = {
          id: generateId(),
          sender: 'ai',
          text: currentPersona.initialPrompt,
          timestamp: new Date(),
          personaId: currentPersona.id,
          sessionId: newId
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      setMessages(prev => [...prev, welcomeMsg]);

      // Broadcast
      channelRef.current?.send({
          type: 'broadcast',
          event: 'new-session',
          payload: newSession
      });
  };

  const handleSwitchPersona = (newPersona: Persona) => {
    // If user selected "Manage Personas" (we will add a fake entry for this in render, but handle it here)
    if (newPersona.id === 'manage-personas') {
        setIsPersonaManagerOpen(true);
        return;
    }

    setCurrentPersona(newPersona);
    
    if (!currentSessionId) return;

    // Add a system message indicating switch or just let the new persona greet
    const greeting: Message = {
      id: generateId(),
      sender: 'ai',
      text: newPersona.initialPrompt,
      timestamp: new Date(),
      personaId: newPersona.id,
      sessionId: currentSessionId
    };
    setMessages(prev => [...prev, greeting]);

    // Broadcast
    channelRef.current?.send({
        type: 'broadcast',
        event: 'new-message',
        payload: greeting
    });
  };

  const handleEntryClick = (entry: TimelineEntry) => {
    let targetSessionId = currentSessionId;
    
    if (entry.sessionId) {
        targetSessionId = entry.sessionId;
    }
    
    const entryTime = new Date(entry.timestamp).getTime();
    let bestMsgId = null;
    let minDiff = Infinity;

    const candidates = entry.sessionId 
        ? messages.filter(m => m.sessionId === entry.sessionId)
        : messages;

    for (const msg of candidates) {
       const msgTime = new Date(msg.timestamp).getTime();
       const diff = Math.abs(entryTime - msgTime);
       
       if (diff < 5000 && diff < minDiff) { 
         minDiff = diff;
         bestMsgId = msg.id;
       }
       
       if (msg.text === entry.content) {
           bestMsgId = msg.id;
           minDiff = 0; 
       }
    }
    
    if (!entry.sessionId && bestMsgId) {
        const foundMsg = messages.find(m => m.id === bestMsgId);
        if (foundMsg?.sessionId) targetSessionId = foundMsg.sessionId;
    }

    if (targetSessionId && targetSessionId !== currentSessionId) {
         setCurrentSessionId(targetSessionId);
         setTimeout(() => {
             if (bestMsgId) {
                 setTargetMessageId(bestMsgId);
                 setTimeout(() => setTargetMessageId(null), 2000);
             }
         }, 100);
    } else if (bestMsgId) {
         setTargetMessageId(bestMsgId);
         setTimeout(() => setTargetMessageId(null), 2000);
    }
    setIsMobileSidebarOpen(false);
  };

  const handleWikiAction = async (messageId: string, action: 'approve' | 'reject') => {
      const msg = messages.find(m => m.id === messageId);
      if (!msg || !msg.wikiAction) return;

      if (action === 'reject') {
          setMessages(prev => prev.map(m => m.id === messageId ? {
              ...m,
              wikiAction: { ...m.wikiAction!, status: 'rejected' }
          } : m));
          return;
      }

      const { path, content } = msg.wikiAction;
      
      try {
          const sessionId = `wiki/${path}`;
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/editor/state?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          });
          
          let newStateStr = '';
          
          if (response.ok) {
              const data = await response.json();
              if (data && data.value && data.value.content) {
                  try {
                      const state = JSON.parse(data.value.content);
                      if (state.root && state.root.children) {
                           const textNode = {
                               detail: 0,
                               format: 0,
                               mode: "normal",
                               style: "",
                               text: content,
                               type: "text",
                               version: 1
                           };
                           const pNode = {
                               children: [textNode],
                               direction: "ltr",
                               format: "",
                               indent: 0,
                               type: "paragraph",
                               version: 1
                           };
                           state.root.children.push(pNode);
                           newStateStr = JSON.stringify(state);
                      } else {
                          newStateStr = data.value.content; 
                      }
                  } catch(e) {
                      console.error("Error parsing existing wiki state", e);
                      alert("Failed to parse existing page structure.");
                      return;
                  }
              } else {
                   const textNode = {
                       detail: 0,
                       format: 0,
                       mode: "normal",
                       style: "",
                       text: content,
                       type: "text",
                       version: 1
                   };
                   const pNode = {
                       children: [textNode],
                       direction: "ltr",
                       format: "",
                       indent: 0,
                       type: "paragraph",
                       version: 1
                   };
                   const state = {
                       root: {
                           children: [pNode],
                           direction: "ltr",
                           format: "",
                           indent: 0,
                           type: "root",
                           version: 1
                       }
                   };
                   newStateStr = JSON.stringify(state);
              }
          }

          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/editor/state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${publicAnonKey}`
                },
                body: JSON.stringify({
                    sessionId,
                    value: { content: newStateStr, updatedAt: new Date().toISOString() }
                })
          });

          if (!wikiPaths.includes(path)) {
              setWikiPaths(prev => [...prev, path]);
          }

          setMessages(prev => prev.map(m => m.id === messageId ? {
              ...m,
              wikiAction: { ...m.wikiAction!, status: 'completed' }
          } : m));
          
      } catch (e) {
          console.error("Failed to execute wiki action", e);
          alert("Failed to save changes.");
      }
  };

  const handleAddToTimeline = async (msg: Message) => {
      let type: 'text' | 'recipe' | 'question' | 'wiki' = 'text';
      let metadata: any = null;
      let content = msg.text;

      if (msg.recipe) {
          type = 'recipe';
          metadata = msg.recipe;
          content = `Recipe: ${msg.recipe.title}`;
      } else if (msg.structuredQuestion) {
          type = 'question';
          metadata = msg.structuredQuestion;
          content = `Question: ${msg.structuredQuestion.title || msg.text}`;
      } else if (msg.wikiAction) {
          type = 'wiki';
          metadata = msg.wikiAction;
          content = `Wiki Update: ${msg.wikiAction.path}`;
      }

      const entry: TimelineEntry = {
          id: generateId(),
          content: content,
          timestamp: new Date(msg.timestamp),
          tags: ['saved'],
          personaId: msg.personaId,
          sessionId: msg.sessionId,
          type: type,
          metadata: metadata
      };

      setTimelineEntries(prev => [...prev, entry]);

      channelRef.current?.send({
          type: 'broadcast',
          event: 'new-timeline',
          payload: [entry]
      });

      try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${publicAnonKey}`
                },
                body: JSON.stringify({ 
                    timelineEntries: [entry]
                })
          });
      } catch (e) {
          console.error("Failed to persist manual timeline entry", e);
      }
  };

  const handleAddTimelineEntry = async (text: string, targetSessionId?: string) => {
      if (!text.trim()) return;
      
      const newEntry: TimelineEntry = {
          id: crypto.randomUUID(),
          content: text,
          timestamp: new Date(),
          type: 'thought',
          sessionId: targetSessionId || currentSessionId || undefined
      };
      
      setTimelineEntries(prev => [newEntry, ...prev]);
      
      try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/timeline`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({ entry: newEntry })
          });
      } catch (e) {
          console.error("Failed to save timeline entry", e);
      }
      
      channelRef.current?.send({
          type: 'broadcast',
          event: 'new-timeline',
          payload: [newEntry]
      });
  };

  const handleSendMessage = async (text: string) => {
    if (!currentSessionId) return;

    const userMsg: Message = {
      id: generateId(),
      sender: 'user',
      text: text,
      timestamp: new Date(),
      sessionId: currentSessionId
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    
    const updatedSession = sessions.find(s => s.id === currentSessionId);
    if (updatedSession) {
         const newSession = {
            ...updatedSession,
            updatedAt: new Date(),
            preview: text,
            title: updatedSession.title === 'New Chat' ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : updatedSession.title
         };
         
         setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) return newSession;
            return s;
        }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));

        channelRef.current?.send({
            type: 'broadcast',
            event: 'update-session',
            payload: newSession
        });
    }

    channelRef.current?.send({
        type: 'broadcast',
        event: 'new-message',
        payload: userMsg
    });

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          messages: [...currentSessionMessages, userMsg],
          sessionId: currentSessionId,
          persona: currentPersona
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error: ${response.status} ${errText}`);
      }

      const data = await response.json();

      if (data.wikiAction) {
          const wikiActionMsg: Message = {
              id: crypto.randomUUID(),
              sender: 'ai',
              text: "I've prepared an update for the wiki.",
              timestamp: new Date(),
              personaId: currentPersona.id,
              sessionId: currentSessionId,
              wikiAction: {
                  path: data.wikiAction.path,
                  content: data.wikiAction.content,
                  status: 'pending'
              }
          };
          
          setMessages(prev => [...prev, wikiActionMsg]);

          setSessions(prev => prev.map(s => {
              if (s.id === currentSessionId) {
                  return { ...s, updatedAt: new Date() };
              }
              return s;
          }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      }

      if (data.editorUpdate) {
          setPendingEditorUpdate(data.editorUpdate);
          if (!isEditorOpen) setIsEditorOpen(true);
          setActiveTool('editor');
      }

      if (data.flowActions && data.flowActions.length > 0) {
          setPendingFlowActions(data.flowActions);
          if (!isEditorOpen) setIsEditorOpen(true);
          setActiveTool('flow');
      }

      if (data.newEntries && data.newEntries.length > 0) {
        const newEntriesWithDate = data.newEntries.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
        }));
        setTimelineEntries(prev => [...newEntriesWithDate, ...prev]);

        channelRef.current?.send({
            type: 'broadcast',
            event: 'new-timeline',
            payload: newEntriesWithDate
        });
      }

      if (data.reply || data.structuredQuestion || data.recipe) {
        const aiMsg: Message = {
          id: generateId(),
          sender: 'ai',
          text: data.reply || (data.recipe ? "Here is the recipe you requested:" : "I have a question for you:"),
          timestamp: new Date(),
          personaId: currentPersona.id,
          structuredQuestion: data.structuredQuestion,
          recipe: data.recipe,
          sessionId: currentSessionId
        };
        setMessages(prev => [...prev, aiMsg]);
        
        channelRef.current?.send({
            type: 'broadcast',
            event: 'new-message',
            payload: aiMsg
        });
        
        const aiUpdateSess = sessions.find(s => s.id === currentSessionId);
        if (aiUpdateSess) {
             const newAiSession = {
                ...aiUpdateSess,
                updatedAt: new Date(),
                preview: aiMsg.text
             };
             setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) return newAiSession;
                return s;
            }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      // Optional: Add an error message to chat
    } finally {
      setIsTyping(false);
    }
  };

  const handleAddToGraph = async (text: string, sessionId: string) => {
      try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/chat`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({ 
                  messages: [{ 
                      sender: 'user', 
                      text: `Please analyze the following content and create a graph representation (nodes and connections) for it. Focus on key concepts and relationships. Do not include unrelated context. Content: "${text}"`,
                      sessionId: sessionId
                  }],
                  sessionId: sessionId,
                  persona: { ...currentPersona, role: 'Data Architect' } 
              })
          });

          if (!response.ok) throw new Error("Graph API Error");
          const data = await response.json();

          if (data.flowActions && data.flowActions.length > 0) {
              setSandboxFlowActions(prev => ({
                  ...prev,
                  [sessionId]: [...(prev[sessionId] || []), ...data.flowActions]
              }));
          }
      } catch (e) {
          console.error("Add to graph error:", e);
      }
  };

  const handleClearFlowActions = (sessionId: string) => {
      setSandboxFlowActions(prev => {
          const newState = { ...prev };
          delete newState[sessionId];
          return newState;
      });
  };

  const handleRefine = async (text: string): Promise<string> => {
      try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/refine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              text,
              persona: currentPersona
            })
          });
          
          if (!response.ok) throw new Error("Refine failed");
          const data = await response.json();
          return data.refinedText;
      } catch (e) {
          console.error("Refine error:", e);
          return text;
      }
  };

  const handleWikiSelect = (path: string) => {
      setCurrentWikiPath(path);
      setViewMode('wiki');
      setIsMobileSidebarOpen(false);
  };
  
  const handleCreateWikiPage = () => {
      const name = prompt("Enter new page name (e.g. 'projects/alpha'):");
      if (name) {
          if (!wikiPaths.includes(name)) {
              setWikiPaths(prev => [...prev, name]);
          }
          setCurrentWikiPath(name);
          setViewMode('wiki');
          setIsMobileSidebarOpen(false);
      }
  };
  
  const handleHomeSubmit = (text: string) => {
      // Just start a new chat with this text
      const newId = generateId();
      const newSession: ChatSession = {
           id: newId,
           title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
           createdAt: new Date(),
           updatedAt: new Date(),
           preview: text
      };
 
      const userMsg: Message = {
           id: generateId(),
           sender: 'user',
           text: text,
           timestamp: new Date(),
           sessionId: newId
      };
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      setMessages(prev => [...prev, userMsg]);
      setViewMode('chat');
      setIsMobileSidebarOpen(false);
 
      setIsTyping(true);
      
      (async () => {
        try {
            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({
                messages: [userMsg],
                sessionId: newId
              })
            });
     
            if (!response.ok) throw new Error("API Error");
            const data = await response.json();
            
            if (data.reply || data.structuredQuestion) {
              const aiMsg: Message = {
                id: generateId(),
                sender: 'ai',
                text: data.reply || "I have a question for you:",
                timestamp: new Date(),
                personaId: currentPersona.id,
                structuredQuestion: data.structuredQuestion,
                sessionId: newId
              };
              setMessages(prev => [...prev, aiMsg]);
            }
        } catch (e) {
            console.error("Home chat start error:", e);
        } finally {
            setIsTyping(false);
        }
      })();
  };

  const handleHomeEntryClick = async (entry: TimelineEntry) => {
    setIsChatFadingIn(true);
    let targetSessionId: string | null = null;
    let bestMsgId: string | null = null;

     if (entry.sessionId) {
         targetSessionId = entry.sessionId;
     } else {
         const entryTime = new Date(entry.timestamp).getTime();
         let minDiff = Infinity;
 
         for (const msg of messages) {
            const msgTime = new Date(msg.timestamp).getTime();
            const diff = Math.abs(entryTime - msgTime);
            
            if (diff < 5000 && diff < minDiff) { 
              minDiff = diff;
              bestMsgId = msg.id;
            }
            
            if (msg.text === entry.content) {
                bestMsgId = msg.id;
                minDiff = 0;
            }
         }

         if (bestMsgId) {
             const foundMsg = messages.find(m => m.id === bestMsgId);
             if (foundMsg?.sessionId) targetSessionId = foundMsg.sessionId;
         }
     }

     if (targetSessionId) {
         setCurrentSessionId(targetSessionId);
         setViewMode('chat');
         setIsMobileSidebarOpen(false);
         
         if (bestMsgId) {
              setTimeout(() => {
                  setTargetMessageId(bestMsgId);
                  
                  setTimeout(() => {
                      setIsChatFadingIn(false);
                  }, 400);

                  setTimeout(() => setTargetMessageId(null), 2000);
              }, 100);
         } else {
             setTimeout(() => setIsChatFadingIn(false), 300);
         }
     } else {
         const newId = generateId();
         const newSession: ChatSession = {
              id: newId,
              title: entry.content.slice(0, 30) + (entry.content.length > 30 ? '...' : ''),
              createdAt: new Date(),
              updatedAt: new Date(),
              preview: entry.content
         };
    
         const userMsg: Message = {
              id: generateId(),
              sender: 'user',
              text: entry.content,
              timestamp: new Date(),
              sessionId: newId
         };
         
         setSessions(prev => [newSession, ...prev]);
         setCurrentSessionId(newId);
         setMessages(prev => [...prev, userMsg]);
         setViewMode('chat');
         setIsMobileSidebarOpen(false);
         setTimeout(() => setIsChatFadingIn(false), 300);
    
         setIsTyping(true);
         try {
           const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/chat`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${publicAnonKey}`
             },
             body: JSON.stringify({
               messages: [userMsg],
               sessionId: newId
             })
           });
    
           if (!response.ok) throw new Error("API Error");
           const data = await response.json();
           
           if (data.reply || data.structuredQuestion) {
             const aiMsg: Message = {
               id: generateId(),
               sender: 'ai',
               text: data.reply || "I have a question for you:",
               timestamp: new Date(),
               personaId: currentPersona.id,
               structuredQuestion: data.structuredQuestion,
               sessionId: newId
             };
             setMessages(prev => [...prev, aiMsg]);
           }
         } catch (e) {
             console.error("Home chat start error:", e);
         } finally {
             setIsTyping(false);
         }
     }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {isPersonaManagerOpen && (
          <PersonaManager 
            personas={personas}
            projectId={projectId}
            publicAnonKey={publicAnonKey}
            onClose={() => setIsPersonaManagerOpen(false)}
            onSave={(updatedPersonas) => {
                setPersonas(updatedPersonas);
                const updatedCurrent = updatedPersonas.find(p => p.id === currentPersona.id);
                if (updatedCurrent) setCurrentPersona(updatedCurrent);
            }}
          />
      )}

      <CommandPalette 
        isOpen={isCmdPaletteOpen}
        setIsOpen={setIsCmdPaletteOpen}
        personas={personas}
        onSwitchPersona={(p) => {
            handleSwitchPersona(p);
            setViewMode('chat');
        }}
        onOpenSandbox={() => setViewMode('sandbox')}
        onOpenWiki={() => setViewMode('wiki')}
        onAddToTimeline={(text) => {
            const entry: TimelineEntry = {
                id: generateId(),
                content: text,
                timestamp: new Date(),
                tags: ['quick-note', 'user'],
                type: 'text'
            };
            setTimelineEntries(prev => [...prev, entry]);
        }}
      />

      {viewMode === 'sandbox' ? (
          <Sandbox 
             entries={timelineEntries}
             sessions={sessions}
             personas={personas}
             currentSessionId={currentSessionId}
             currentPersona={currentPersona}
             messages={currentSessionMessages}
             onSendMessage={handleSendMessage}
             onSwitchPersona={handleSwitchPersona}
             isTyping={isTyping}
             onEntryClick={handleEntryClick}
             onAddTimelineEntry={handleAddTimelineEntry}
             onAddToGraph={handleAddToGraph}
             flowActions={sandboxFlowActions}
             onClearFlowActions={handleClearFlowActions}
             supabase={supabase}
             onClose={() => setViewMode('home')}
          />
      ) : (
          isMobileSidebarOpen && viewMode !== 'home' && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 bg-white shadow-2xl z-50 animate-in slide-in-from-left duration-200">
             <div className="flex justify-end p-2 border-b border-slate-100">
                <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5" />
                </button>
             </div>
             <div className="h-full overflow-hidden pb-12">
                <Sidebar 
                    entries={timelineEntries} 
                    sessions={sessions}
                    personas={personas}
                    currentSessionId={currentSessionId}
                    onEntryClick={handleHomeEntryClick} 
                    onSessionSelect={(id) => {
                        setCurrentSessionId(id);
                        setViewMode('chat');
                        setIsMobileSidebarOpen(false);
                    }}
                    onNewChat={() => {
                        createNewChat();
                        setViewMode('chat');
                        setIsMobileSidebarOpen(false);
                    }}
                    wikiPaths={wikiPaths}
                    currentWikiPath={currentWikiPath}
                    onWikiSelect={handleWikiSelect}
                    onCreateWikiPage={handleCreateWikiPage}
                    onBackToHome={() => {
                        setViewMode('home');
                        setIsMobileSidebarOpen(false);
                    }}
                    onSubmit={handleHomeSubmit}
                    isExpanded={false}
                    onOpenSandbox={() => setViewMode('sandbox')}
                />
             </div>
          </div>
        </div>
      ))}

      {viewMode === 'sandbox' ? null : (
      <>
      <div className={cn(
          "h-full bg-slate-50 border-r border-slate-200 shadow-xl z-20 flex flex-col transition-all duration-500 ease-in-out origin-left",
          viewMode === 'home' ? "w-full" : "hidden md:flex md:w-80"
      )}>
          <Sidebar 
              entries={timelineEntries} 
              sessions={sessions}
              personas={personas}
              currentSessionId={currentSessionId}
              onEntryClick={handleHomeEntryClick}
              onSessionSelect={(id) => {
                  setCurrentSessionId(id);
                  setViewMode('chat');
              }}
              onNewChat={() => {
                  createNewChat();
                  setViewMode('chat');
              }}
              wikiPaths={wikiPaths}
              currentWikiPath={currentWikiPath}
              onWikiSelect={handleWikiSelect}
              onCreateWikiPage={handleCreateWikiPage}
              onBackToHome={() => setViewMode('home')}
              onSubmit={handleHomeSubmit}
              isExpanded={viewMode === 'home'}
              onOpenSandbox={() => setViewMode('sandbox')}
          />
      </div>

      <div className={cn(
          "flex-1 flex flex-col h-full transition-all duration-500",
          viewMode === 'home' ? "w-0 opacity-0 overflow-hidden" : "w-full opacity-100"
      )}>
        {viewMode === 'wiki' ? (
             <div className="h-full w-full">
                 <Editor 
                    sessionId={`wiki/${currentWikiPath}`}
                    supabase={supabase}
                    isLoaded={isLoaded}
                 />
             </div>
        ) : (
        <>
        <div className="flex-1 overflow-hidden relative flex">
             <div className="flex-1 flex flex-col relative">
                {/* Header for Mobile */}
                <div className="md:hidden h-14 border-b border-slate-100 flex items-center px-4 justify-between bg-white shrink-0">
                    <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-slate-500">
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                        {sessions.find(s => s.id === currentSessionId)?.title || 'Chat'}
                    </span>
                    <div className="w-8" />
                </div>

                <div className="flex-1 relative overflow-hidden">
                    {currentSessionId && (
                        <ChatArea 
                            messages={currentSessionMessages}
                            currentPersona={currentPersona}
                            personas={personas}
                            onSendMessage={handleSendMessage}
                            onSwitchPersona={handleSwitchPersona}
                            isTyping={isTyping}
                            targetMessageId={targetMessageId}
                            onRefine={handleRefine}
                            onToggleEditor={() => setIsEditorOpen(!isEditorOpen)}
                            isEditorOpen={isEditorOpen}
                            onWikiAction={handleWikiAction}
                            onAddToTimeline={handleAddToTimeline}
                            isFadingIn={isChatFadingIn}
                        />
                    )}
                </div>
             </div>

             {/* Right Sidebar Strip (Collapsed State) */}
             <div className="w-12 border-l border-slate-200 bg-slate-50 flex flex-col items-center py-4 gap-4 z-20 shrink-0">
                  <div className="flex flex-col gap-2 w-full px-2">
                       <button 
                           onClick={() => {
                               setActiveTool('editor');
                               setIsEditorOpen(true);
                           }}
                           className={cn(
                               "p-2 rounded-lg transition-all flex justify-center group relative",
                               isEditorOpen && activeTool === 'editor' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-indigo-600 hover:bg-white/50"
                           )}
                           title="Open Editor"
                       >
                           <FileText className="w-5 h-5" />
                           <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                               Editor
                           </span>
                       </button>
                       <button 
                           onClick={() => {
                               setActiveTool('flow');
                               setIsEditorOpen(true);
                           }}
                           className={cn(
                               "p-2 rounded-lg transition-all flex justify-center group relative",
                               isEditorOpen && activeTool === 'flow' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-indigo-600 hover:bg-white/50"
                           )}
                           title="Open Graph"
                       >
                           <Workflow className="w-5 h-5" />
                           <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                               Graph
                           </span>
                       </button>
                  </div>
             </div>

             {/* Right Panel (Editor/Flow) */}
             <div className={cn(
                 "border-l border-slate-200 bg-white transition-all duration-300 ease-in-out absolute md:relative right-0 h-full z-30 shadow-2xl md:shadow-none",
                 isEditorOpen ? "w-[85vw] md:w-[600px] translate-x-0" : "w-0 translate-x-full md:translate-x-0 overflow-hidden"
             )}>
                    <div className="h-full flex flex-col">
                        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg">
                                <button 
                                    onClick={() => setActiveTool('editor')}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                        activeTool === 'editor' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Editor
                                </button>
                                <button 
                                    onClick={() => setActiveTool('flow')}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                        activeTool === 'flow' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Workflow className="w-3.5 h-3.5" />
                                    Graph
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsEditorOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            {activeTool === 'editor' ? (
                                <Editor 
                                    sessionId={currentSessionId || 'default'} 
                                    supabase={supabase}
                                    isLoaded={isLoaded}
                                    pendingUpdate={pendingEditorUpdate}
                                    onUpdateApplied={() => setPendingEditorUpdate(null)}
                                />
                            ) : (
                                <FlowEditor 
                                    sessionId={currentSessionId || 'default'}
                                    supabase={supabase}
                                    pendingActions={pendingFlowActions}
                                    onActionsApplied={() => setPendingFlowActions([])}
                                />
                            )}
                        </div>
                    </div>
             </div>
        </div>
        </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
