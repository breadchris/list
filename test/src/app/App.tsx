import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Message, Persona, TimelineEntry, ChatSession } from './types';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from './supabaseClient';
import { DEFAULT_PERSONAS } from './data/defaultPersonas';
import { PersonaManager } from './components/PersonaManager';
import { Sandbox } from './components/Sandbox';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for ID generation since uuid might not be installed
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [currentPersona, setCurrentPersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // All messages from all sessions (filtered in UI)
  const [messages, setMessages] = useState<Message[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [flowActions, setFlowActions] = useState<Record<string, any[]>>({});
  
  const [typingSessionId, setTypingSessionId] = useState<string | null>(null);
  
  // Manager State
  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);

  // Wiki State
  const [wikiPaths, setWikiPaths] = useState<string[]>([]);

  // Computed: Messages for current session
  const currentSessionMessages = useMemo(() => {
    if (!currentSessionId) return [];
    return messages.filter(m => m.sessionId === currentSessionId);
  }, [messages, currentSessionId]);

  // Realtime Subscription (Broadcast + DB Changes)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      }
    };
    loadData();
  }, []);

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

      // Persist Session & Message
      try {
          // Save Session
          supabase.from('kv_store_61781242').upsert({
              key: `session:${newSession.id}`,
              value: newSession,
              timestamp: newSession.updatedAt
          }).then(({ error }) => {
              if (error) console.error("Failed to save new session", error);
          });

          // Save Welcome Message
          supabase.from('kv_store_61781242').upsert({
              key: `msg:${welcomeMsg.timestamp.toISOString()}:${welcomeMsg.id}`,
              value: welcomeMsg,
              timestamp: welcomeMsg.timestamp
          }).then(({ error }) => {
              if (error) console.error("Failed to save welcome message", error);
          });
      } catch (e) {
          console.error("Persistence error", e);
      }
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

    // Save Greeting Message
    supabase.from('kv_store_61781242').upsert({
        key: `msg:${greeting.timestamp.toISOString()}:${greeting.id}`,
        value: greeting,
        timestamp: greeting.timestamp
    }).then(({ error }) => {
        if (error) console.error("Failed to save persona switch greeting", error);
    });
  };

  const handleSendMessage = async (text: string, targetSessionId?: string, connectedSessionId?: string) => {
    const sessionId = targetSessionId || currentSessionId;
    if (!sessionId) return;

    const userMsg: Message = {
      id: generateId(),
      sender: 'user',
      text: text,
      timestamp: new Date(),
      sessionId: sessionId
    };
    
    setMessages(prev => [...prev, userMsg]);
    setTypingSessionId(sessionId);
    
    // Save User Message to DB
    try {
        await supabase
          .from('kv_store_61781242')
          .upsert({ 
              key: `msg:${userMsg.timestamp.toISOString()}:${userMsg.id}`, 
              value: userMsg,
              timestamp: userMsg.timestamp
          });
    } catch (e) {
        console.error("Failed to save user message", e);
    }
    
    const updatedSession = sessions.find(s => s.id === sessionId);
    if (updatedSession) {
         const newSession = {
            ...updatedSession,
            updatedAt: new Date(),
            preview: text,
            title: updatedSession.title === 'New Chat' ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : updatedSession.title
         };
         
         setSessions(prev => prev.map(s => {
            if (s.id === sessionId) return newSession;
            return s;
        }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));

        channelRef.current?.send({
            type: 'broadcast',
            event: 'update-session',
            payload: newSession
        });

        // Persist Updated Session
        supabase.from('kv_store_61781242').upsert({
            key: `session:${newSession.id}`,
            value: newSession,
            timestamp: newSession.updatedAt
        }).then(({ error }) => {
            if (error) console.error("Failed to update session", error);
        });
    }

    channelRef.current?.send({
        type: 'broadcast',
        event: 'new-message',
        payload: userMsg
    });

    try {
      // Filter messages for this session context
      const contextMessages = messages.filter(m => m.sessionId === sessionId);

      // Find session to get constraints
      const currentSession = sessions.find(s => s.id === sessionId);
      const constraints = currentSession?.constraints || {};

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          messages: [...contextMessages, userMsg],
          sessionId: sessionId,
          persona: currentPersona,
          constraints,
          connectedSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.constraints) {
          // Update constraints in state
          setSessions(prev => prev.map(s => {
              if (s.id === sessionId) {
                  return { ...s, constraints: data.constraints };
              }
              return s;
          }));
      }

      if (data.wikiAction) {
          const wikiActionMsg: Message = {
              id: crypto.randomUUID(),
              sender: 'ai',
              text: "I've prepared an update for the wiki.",
              timestamp: new Date(),
              personaId: currentPersona.id,
              sessionId: sessionId,
              wikiAction: {
                  path: data.wikiAction.path,
                  content: data.wikiAction.content,
                  status: 'pending'
              }
          };
          setMessages(prev => [...prev, wikiActionMsg]);
          
          // Save Wiki Action Message
          try {
              await supabase
                  .from('kv_store_61781242')
                  .upsert({ 
                      key: `msg:${wikiActionMsg.timestamp.toISOString()}:${wikiActionMsg.id}`, 
                      value: wikiActionMsg,
                      timestamp: wikiActionMsg.timestamp
                  });
          } catch (e) {
              console.error("Failed to save wiki action message", e);
          }
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
          text: data.reply || (data.recipe ? "Here is the recipe:" : "I have a question for you:"),
          timestamp: new Date(),
          personaId: currentPersona.id,
          structuredQuestion: data.structuredQuestion,
          recipe: data.recipe,
          sessionId: sessionId
        };
        setMessages(prev => [...prev, aiMsg]);

        // Save AI Message
        try {
            await supabase
                .from('kv_store_61781242')
                .upsert({ 
                    key: `msg:${aiMsg.timestamp.toISOString()}:${aiMsg.id}`, 
                    value: aiMsg,
                    timestamp: aiMsg.timestamp
                });
        } catch (e) {
            console.error("Failed to save AI message", e);
        }
        
        channelRef.current?.send({
            type: 'broadcast',
            event: 'new-message',
            payload: aiMsg
        });
        
        // Update session preview
        const aiUpdateSess = sessions.find(s => s.id === sessionId);
        if (aiUpdateSess) {
             const newAiSession = {
                ...aiUpdateSess,
                updatedAt: new Date(),
                preview: aiMsg.text
             };
             setSessions(prev => prev.map(s => {
                if (s.id === sessionId) return newAiSession;
                return s;
            }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
        }
      }

      return data;

    } catch (e) {
      console.error("Chat error:", e);
    } finally {
      setTypingSessionId(null);
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
          // Use server endpoint to ensure consistency/permissions
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
      
      // Broadcast for immediate UI update on other clients
      channelRef.current?.send({
          type: 'broadcast',
          event: 'new-timeline',
          payload: [newEntry]
      });
  };

  const handleUpdateTimelineEntry = async (updatedEntry: TimelineEntry) => {
      setTimelineEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
      
      try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/timeline/update`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({ entry: updatedEntry })
          });
          
          // Broadcast update
          channelRef.current?.send({
              type: 'broadcast',
              event: 'new-timeline', // We can reuse this or create 'update-timeline'
              payload: [updatedEntry]
          });
      } catch (e) {
          console.error("Failed to update timeline entry", e);
      }
  };

  const handleDeleteTimelineEntry = async (entryId: string) => {
      const entry = timelineEntries.find(e => e.id === entryId);
      setTimelineEntries(prev => prev.filter(e => e.id !== entryId));
      
      try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-61781242/timeline/delete`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({ 
                  id: entryId, 
                  timestamp: entry ? entry.timestamp.toISOString() : undefined 
              })
          });
          
          // Broadcast delete (Need a new event or handle via full sync if critical, but let's assume local optimistic first)
          // Ideally we should have a 'delete-timeline' event
      } catch (e) {
          console.error("Failed to delete timeline entry", e);
      }
  };

  const handleAddToGraph = async (text: string, sessionId: string) => {
      try {
          // Construct a system-like message to prompt for graph generation
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
              setFlowActions(prev => ({
                  ...prev,
                  [sessionId]: [...(prev[sessionId] || []), ...data.flowActions]
              }));
          }
      } catch (e) {
          console.error("Add to graph error:", e);
      }
  };

  const handleClearFlowActions = (sessionId: string) => {
      setFlowActions(prev => {
          const newState = { ...prev };
          delete newState[sessionId];
          return newState;
      });
  };

  const handleUpdateMessage = async (messageId: string, updates: Partial<Message>) => {
      setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
              return { ...m, ...updates };
          }
          return m;
      }));

      // Find the full message to save
      const message = messages.find(m => m.id === messageId);
      if (message) {
          const updatedMessage = { ...message, ...updates };
          
          try {
              // Save to DB
              const { error } = await supabase
                  .from('kv_store_61781242')
                  .upsert({ 
                      key: `msg:${updatedMessage.timestamp.toISOString()}:${messageId}`, 
                      value: updatedMessage,
                      timestamp: updatedMessage.timestamp
                  });
              
              if (error) throw error;
              
              // Broadcast update
              channelRef.current?.send({
                  type: 'broadcast',
                  event: 'update-message',
                  payload: updatedMessage
              });
          } catch (e) {
              console.error("Failed to update message", e);
          }
      }
  };

  const handleEntryClick = (entry: TimelineEntry) => {
      // Find session related to entry or message
      let targetSessionId = entry.sessionId;
      
      if (!targetSessionId) {
          const entryTime = new Date(entry.timestamp).getTime();
          let bestMsgId = null;
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
              const m = messages.find(msg => msg.id === bestMsgId);
              if (m) targetSessionId = m.sessionId;
          }
      }

      if (targetSessionId && targetSessionId !== currentSessionId) {
          setCurrentSessionId(targetSessionId);
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

      {/* Render Sandbox as main view */}
      <Sandbox 
         entries={timelineEntries}
         sessions={sessions}
         personas={personas}
         currentSessionId={currentSessionId}
         currentPersona={currentPersona}
         messages={messages}
         onSendMessage={handleSendMessage}
         onSwitchPersona={handleSwitchPersona}
         typingSessionId={typingSessionId}
         onEntryClick={handleEntryClick}
         onAddTimelineEntry={handleAddTimelineEntry}
         onUpdateTimelineEntry={handleUpdateTimelineEntry}
         onDeleteTimelineEntry={handleDeleteTimelineEntry}
         onAddToGraph={(text, sessionId) => handleAddToGraph(text, sessionId)}
         onUpdateMessage={handleUpdateMessage}
         flowActions={flowActions}
         onClearFlowActions={handleClearFlowActions}
         supabase={supabase}
         onClose={() => {}} // No close action as it's main view
      />
    </div>
  );
}
