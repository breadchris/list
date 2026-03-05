"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Message, Persona, TimelineEntry, ChatSession } from "./types";
import { DEFAULT_PERSONAS } from "./data/defaultPersonas";
import { PersonaManager } from "./PersonaManager";
import { Sandbox } from "./Sandbox";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import {
  contentRepository,
  Content,
} from "@/lib/list/ContentRepository";
import { supabase } from "@/lib/list/SupabaseClient";

// Content type constants for the context app
const CONTENT_TYPES = {
  SESSION: "context-session",
  MESSAGE: "context-message",
  TIMELINE: "context-timeline",
  EDITOR: "context-editor",
  WIKI: "context-wiki",
  FLOW: "context-flow",
  TODO: "context-todo",
  LAYOUT: "context-layout",
  PERSONA: "context-persona",
} as const;

const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to convert a Content item back to a ChatSession
function contentToSession(c: Content): ChatSession {
  const meta = c.metadata || {};
  return {
    id: c.id,
    title: c.data || "New Chat",
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
    preview: meta.preview,
    constraints: meta.constraints,
  };
}

// Helper to convert a Content item back to a Message
function contentToMessage(c: Content): Message {
  const meta = c.metadata || {};
  return {
    id: c.id,
    sender: meta.sender || "user",
    text: c.data || "",
    timestamp: new Date(c.created_at),
    personaId: meta.persona_id,
    structuredQuestion: meta.structured_question,
    sessionId: meta.session_content_id,
    wikiAction: meta.wiki_action,
    recipe: meta.recipe,
  };
}

// Helper to convert a Content item back to a TimelineEntry
function contentToTimelineEntry(c: Content): TimelineEntry {
  const meta = c.metadata || {};
  return {
    id: c.id,
    content: c.data || "",
    timestamp: new Date(c.created_at),
    tags: meta.tags,
    personaId: meta.persona_id,
    sessionId: meta.session_content_id,
    type: meta.entry_type,
    metadata: meta.entry_metadata,
  };
}

export function ContextInterface() {
  const { selectedGroup } = useGlobalGroup();
  const groupId = selectedGroup?.id || "";
  const [userId, setUserId] = useState<string>("");

  // Get current user ID for state persistence
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const [personas, setPersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [currentPersona, setCurrentPersona] =
    useState<Persona>(DEFAULT_PERSONAS[0]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [flowActions, setFlowActions] = useState<Record<string, any[]>>({});
  const [typingSessionId, setTypingSessionId] = useState<string | null>(null);
  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [wikiPaths, setWikiPaths] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track content ID mappings (original session ID -> content ID for messages)
  const sessionContentIdMapRef = useRef<Map<string, string>>(new Map());

  const currentSessionMessages = useMemo(() => {
    if (!currentSessionId) return [];
    return messages.filter((m) => m.sessionId === currentSessionId);
  }, [messages, currentSessionId]);

  // Load all context data from ContentRepository on mount / group change
  useEffect(() => {
    if (!groupId) return;

    const loadData = async () => {
      try {
        // Load sessions
        const sessionsResult = await contentRepository.getContentByType(
          groupId,
          CONTENT_TYPES.SESSION,
          100
        );
        const loadedSessions = (sessionsResult.data || [])
          .map(contentToSession)
          .sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );

        // Load messages
        const messagesResult = await contentRepository.getContentByType(
          groupId,
          CONTENT_TYPES.MESSAGE,
          500
        );
        const loadedMessages = (messagesResult.data || [])
          .map(contentToMessage)
          .sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );

        // Load timeline entries
        const timelineResult = await contentRepository.getContentByType(
          groupId,
          CONTENT_TYPES.TIMELINE,
          200
        );
        const loadedTimeline = (timelineResult.data || [])
          .map(contentToTimelineEntry)
          .sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

        // Load personas
        const personasResult = await contentRepository.getContentByType(
          groupId,
          CONTENT_TYPES.PERSONA,
          1
        );
        if (personasResult.data && personasResult.data.length > 0) {
          try {
            const savedPersonas = JSON.parse(
              personasResult.data[0].data || "[]"
            );
            if (Array.isArray(savedPersonas) && savedPersonas.length > 0) {
              setPersonas(savedPersonas);
              const exists = savedPersonas.find(
                (p: Persona) => p.id === currentPersona.id
              );
              if (!exists) setCurrentPersona(savedPersonas[0]);
            }
          } catch {
            // Use defaults
          }
        }

        // Load wiki paths
        const wikiResult = await contentRepository.getContentByType(
          groupId,
          CONTENT_TYPES.WIKI,
          100
        );
        if (wikiResult.data) {
          const paths = wikiResult.data
            .map((c) => (c.metadata as any)?.path)
            .filter(Boolean) as string[];
          setWikiPaths(paths);
        }

        setSessions(loadedSessions);
        setMessages(loadedMessages);
        setTimelineEntries(loadedTimeline);

        // Set current session
        if (loadedSessions.length > 0) {
          setCurrentSessionId(loadedSessions[0].id);
        } else {
          // Create initial session
          await createNewChatInternal(loadedSessions);
        }

        setIsLoaded(true);
      } catch (e) {
        console.error("Context: Failed to load data", e);
        setIsLoaded(true);
      }
    };

    loadData();
  }, [groupId]);

  // Realtime subscription for content changes
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`context-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const { new: newRecord, eventType } = payload;
          if (
            eventType !== "INSERT" &&
            eventType !== "UPDATE"
          )
            return;

          const content = newRecord as Content;
          if (!content.type?.startsWith("context-")) return;

          switch (content.type) {
            case CONTENT_TYPES.MESSAGE: {
              const msg = contentToMessage(content);
              setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) {
                  return prev.map((m) =>
                    m.id === msg.id ? msg : m
                  );
                }
                return [...prev, msg];
              });
              break;
            }
            case CONTENT_TYPES.SESSION: {
              const session = contentToSession(content);
              setSessions((prev) => {
                const exists = prev.find(
                  (s) => s.id === session.id
                );
                if (exists) {
                  return prev
                    .map((s) =>
                      s.id === session.id ? session : s
                    )
                    .sort(
                      (a, b) =>
                        b.updatedAt.getTime() -
                        a.updatedAt.getTime()
                    );
                }
                return [session, ...prev].sort(
                  (a, b) =>
                    b.updatedAt.getTime() -
                    a.updatedAt.getTime()
                );
              });
              break;
            }
            case CONTENT_TYPES.TIMELINE: {
              const entry = contentToTimelineEntry(content);
              setTimelineEntries((prev) => {
                if (prev.find((t) => t.id === entry.id)) {
                  return prev.map((t) =>
                    t.id === entry.id ? entry : t
                  );
                }
                return [entry, ...prev];
              });
              break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const createNewChatInternal = async (
    existingSessions?: ChatSession[]
  ) => {
    if (!groupId) return;

    try {
      const sessionContent = await contentRepository.createContent({
        type: CONTENT_TYPES.SESSION,
        data: "New Chat",
        group_id: groupId,
        metadata: {},
      });

      const newSession = contentToSession(sessionContent);

      // Create welcome message
      const welcomeContent = await contentRepository.createContent({
        type: CONTENT_TYPES.MESSAGE,
        data: currentPersona.initialPrompt,
        group_id: groupId,
        parent_content_id: sessionContent.id,
        metadata: {
          sender: "ai",
          persona_id: currentPersona.id,
          session_content_id: sessionContent.id,
        },
      });

      const welcomeMsg = contentToMessage(welcomeContent);

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages((prev) => [...prev, welcomeMsg]);
    } catch (e) {
      console.error("Failed to create new chat", e);
    }
  };

  const createNewChat = useCallback(() => {
    createNewChatInternal();
  }, [groupId, currentPersona]);

  const handleSwitchPersona = useCallback(
    (newPersona: Persona) => {
      if (newPersona.id === "manage-personas") {
        setIsPersonaManagerOpen(true);
        return;
      }

      setCurrentPersona(newPersona);

      if (!currentSessionId || !groupId) return;

      // Add greeting from new persona
      contentRepository
        .createContent({
          type: CONTENT_TYPES.MESSAGE,
          data: newPersona.initialPrompt,
          group_id: groupId,
          parent_content_id: currentSessionId,
          metadata: {
            sender: "ai",
            persona_id: newPersona.id,
            session_content_id: currentSessionId,
          },
        })
        .then((content) => {
          setMessages((prev) => [...prev, contentToMessage(content)]);
        })
        .catch((e) =>
          console.error("Failed to save persona switch greeting", e)
        );
    },
    [currentSessionId, groupId]
  );

  const handleSendMessage = useCallback(
    async (
      text: string,
      targetSessionId?: string,
      connectedSessionId?: string
    ) => {
      let sessionId = targetSessionId || currentSessionId;
      if (!sessionId || !groupId) return;

      // Ensure the session exists in the content table
      const existingSession = sessions.find((s) => s.id === sessionId);
      if (!existingSession) {
        try {
          const sessionContent = await contentRepository.createContent({
            id: sessionId,
            type: CONTENT_TYPES.SESSION,
            data: "New Chat",
            group_id: groupId,
            metadata: {},
          });
          const newSession = contentToSession(sessionContent);
          setSessions((prev) => [newSession, ...prev]);
          setCurrentSessionId(sessionId);
        } catch (e) {
          console.error("Failed to create session for message", e);
          return;
        }
      }

      // Create user message content
      let userMsgContent: Content;
      try {
        userMsgContent = await contentRepository.createContent({
          type: CONTENT_TYPES.MESSAGE,
          data: text,
          group_id: groupId,
          parent_content_id: sessionId,
          metadata: {
            sender: "user",
            session_content_id: sessionId,
          },
        });
      } catch (e) {
        console.error("Failed to save user message", e);
        return;
      }

      const userMsg = contentToMessage(userMsgContent);
      setMessages((prev) => [...prev, userMsg]);
      setTypingSessionId(sessionId);

      // Update session title/preview
      const currentSession = sessions.find((s) => s.id === sessionId);
      if (currentSession) {
        const newTitle =
          currentSession.title === "New Chat"
            ? text.slice(0, 30) + (text.length > 30 ? "..." : "")
            : currentSession.title;

        contentRepository
          .updateContent(sessionId, {
            data: newTitle,
            metadata: {
              ...(currentSession.constraints
                ? { constraints: currentSession.constraints }
                : {}),
              preview: text,
            },
          })
          .then(() => {
            setSessions((prev) =>
              prev
                .map((s) =>
                  s.id === sessionId
                    ? { ...s, title: newTitle, updatedAt: new Date(), preview: text }
                    : s
                )
                .sort(
                  (a, b) =>
                    b.updatedAt.getTime() -
                    a.updatedAt.getTime()
                )
            );
          })
          .catch((e) =>
            console.error("Failed to update session", e)
          );
      }

      // Call AI chat API
      try {
        const contextMessages = messages.filter(
          (m) => m.sessionId === sessionId
        );
        const constraints = currentSession?.constraints || {};

        // Get recent timeline entries for context
        const recentTimeline = timelineEntries
          .slice(0, 15)
          .map((e) => ({
            content: e.content,
            timestamp: e.timestamp.toISOString(),
            tags: e.tags,
          }));

        const response = await fetch("/api/context/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...contextMessages, userMsg],
            sessionId,
            persona: currentPersona,
            constraints,
            connectedSessionId,
            recentTimeline,
          }),
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        // Handle constraints update
        if (data.constraints) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? { ...s, constraints: data.constraints }
                : s
            )
          );
        }

        // Handle wiki action
        if (data.wikiAction) {
          const wikiMsgContent =
            await contentRepository.createContent({
              type: CONTENT_TYPES.MESSAGE,
              data: "I've prepared an update for the wiki.",
              group_id: groupId,
              parent_content_id: sessionId,
              metadata: {
                sender: "ai",
                persona_id: currentPersona.id,
                session_content_id: sessionId,
                wiki_action: {
                  path: data.wikiAction.path,
                  content: data.wikiAction.content,
                  status: "pending",
                },
              },
            });
          setMessages((prev) => [
            ...prev,
            contentToMessage(wikiMsgContent),
          ]);
        }

        // Handle new timeline entries
        if (data.newEntries && data.newEntries.length > 0) {
          for (const entry of data.newEntries) {
            try {
              const entryContent =
                await contentRepository.createContent({
                  type: CONTENT_TYPES.TIMELINE,
                  data: entry.content,
                  group_id: groupId,
                  metadata: {
                    tags: entry.tags,
                    persona_id: entry.personaId,
                    session_content_id: sessionId,
                    entry_type: entry.type || "text",
                  },
                });
              setTimelineEntries((prev) => [
                contentToTimelineEntry(entryContent),
                ...prev,
              ]);
            } catch (e) {
              console.error(
                "Failed to save timeline entry",
                e
              );
            }
          }
        }

        // Handle AI reply
        if (
          data.reply ||
          data.structuredQuestion ||
          data.recipe
        ) {
          const aiMsgContent =
            await contentRepository.createContent({
              type: CONTENT_TYPES.MESSAGE,
              data:
                data.reply ||
                (data.recipe
                  ? "Here is the recipe:"
                  : "I have a question for you:"),
              group_id: groupId,
              parent_content_id: sessionId,
              metadata: {
                sender: "ai",
                persona_id: currentPersona.id,
                session_content_id: sessionId,
                structured_question:
                  data.structuredQuestion || undefined,
                recipe: data.recipe || undefined,
              },
            });

          setMessages((prev) => [
            ...prev,
            contentToMessage(aiMsgContent),
          ]);

          // Update session preview
          setSessions((prev) =>
            prev
              .map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      updatedAt: new Date(),
                      preview:
                        data.reply || "AI response",
                    }
                  : s
              )
              .sort(
                (a, b) =>
                  b.updatedAt.getTime() -
                  a.updatedAt.getTime()
              )
          );
        }

        return data;
      } catch (e) {
        console.error("Chat error:", e);
      } finally {
        setTypingSessionId(null);
      }
    },
    [
      currentSessionId,
      groupId,
      messages,
      sessions,
      currentPersona,
      timelineEntries,
    ]
  );

  const handleAddTimelineEntry = useCallback(
    async (text: string, targetSessionId?: string) => {
      if (!text.trim() || !groupId) return;

      try {
        const entryContent = await contentRepository.createContent({
          type: CONTENT_TYPES.TIMELINE,
          data: text,
          group_id: groupId,
          metadata: {
            entry_type: "thought",
            session_content_id:
              targetSessionId || currentSessionId || undefined,
          },
        });

        setTimelineEntries((prev) => [
          contentToTimelineEntry(entryContent),
          ...prev,
        ]);
      } catch (e) {
        console.error("Failed to save timeline entry", e);
      }
    },
    [groupId, currentSessionId]
  );

  const handleUpdateTimelineEntry = useCallback(
    async (updatedEntry: TimelineEntry) => {
      if (!groupId) return;

      setTimelineEntries((prev) =>
        prev.map((e) =>
          e.id === updatedEntry.id ? updatedEntry : e
        )
      );

      try {
        await contentRepository.updateContent(updatedEntry.id, {
          data: updatedEntry.content,
          metadata: {
            tags: updatedEntry.tags,
            persona_id: updatedEntry.personaId,
            session_content_id: updatedEntry.sessionId,
            entry_type: updatedEntry.type || "text",
            entry_metadata: updatedEntry.metadata,
          },
        });
      } catch (e) {
        console.error("Failed to update timeline entry", e);
      }
    },
    [groupId]
  );

  const handleDeleteTimelineEntry = useCallback(
    async (entryId: string) => {
      setTimelineEntries((prev) =>
        prev.filter((e) => e.id !== entryId)
      );

      try {
        await contentRepository.deleteContent(entryId);
      } catch (e) {
        console.error("Failed to delete timeline entry", e);
      }
    },
    []
  );

  const handleAddToGraph = useCallback(
    async (text: string, sessionId: string) => {
      if (!groupId) return;

      try {
        const response = await fetch("/api/context/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                sender: "user",
                text: `Please analyze the following content and create a graph representation (nodes and connections) for it. Focus on key concepts and relationships. Content: "${text}"`,
                sessionId,
              },
            ],
            sessionId,
            persona: {
              ...currentPersona,
              role: "Data Architect",
            },
          }),
        });

        if (!response.ok) throw new Error("Graph API Error");
        const data = await response.json();

        if (data.flowActions && data.flowActions.length > 0) {
          setFlowActions((prev) => ({
            ...prev,
            [sessionId]: [
              ...(prev[sessionId] || []),
              ...data.flowActions,
            ],
          }));
        }
      } catch (e) {
        console.error("Add to graph error:", e);
      }
    },
    [groupId, currentPersona]
  );

  const handleClearFlowActions = useCallback(
    (sessionId: string) => {
      setFlowActions((prev) => {
        const newState = { ...prev };
        delete newState[sessionId];
        return newState;
      });
    },
    []
  );

  const handleUpdateMessage = useCallback(
    async (messageId: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        )
      );

      const message = messages.find((m) => m.id === messageId);
      if (message) {
        const updatedMessage = { ...message, ...updates };
        try {
          await contentRepository.updateContent(messageId, {
            data: updatedMessage.text,
            metadata: {
              sender: updatedMessage.sender,
              persona_id: updatedMessage.personaId,
              session_content_id: updatedMessage.sessionId,
              structured_question:
                updatedMessage.structuredQuestion,
              wiki_action: updatedMessage.wikiAction,
              recipe: updatedMessage.recipe,
            },
          });
        } catch (e) {
          console.error("Failed to update message", e);
        }
      }
    },
    [messages]
  );

  const handleEntryClick = useCallback(
    (entry: TimelineEntry) => {
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
          const m = messages.find(
            (msg) => msg.id === bestMsgId
          );
          if (m) targetSessionId = m.sessionId;
        }
      }

      if (
        targetSessionId &&
        targetSessionId !== currentSessionId
      ) {
        setCurrentSessionId(targetSessionId);
      }
    },
    [messages, currentSessionId]
  );

  if (!groupId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        Select a group to get started
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full bg-muted overflow-hidden font-sans text-foreground">
      {isPersonaManagerOpen && (
        <PersonaManager
          personas={personas}
          supabase={supabase}
          groupId={groupId}
          userId={userId}
          onClose={() => setIsPersonaManagerOpen(false)}
          onSave={(updatedPersonas) => {
            setPersonas(updatedPersonas);
            const updatedCurrent = updatedPersonas.find(
              (p) => p.id === currentPersona.id
            );
            if (updatedCurrent)
              setCurrentPersona(updatedCurrent);

            // Save personas as content
            if (groupId) {
              contentRepository
                .getContentByType(
                  groupId,
                  CONTENT_TYPES.PERSONA,
                  1
                )
                .then(async (result) => {
                  if (
                    result.data &&
                    result.data.length > 0
                  ) {
                    await contentRepository.updateContent(
                      result.data[0].id,
                      {
                        data: JSON.stringify(
                          updatedPersonas
                        ),
                      }
                    );
                  } else {
                    await contentRepository.createContent({
                      type: CONTENT_TYPES.PERSONA,
                      data: JSON.stringify(
                        updatedPersonas
                      ),
                      group_id: groupId,
                    });
                  }
                })
                .catch((e) =>
                  console.error(
                    "Failed to save personas",
                    e
                  )
                );
            }
          }}
        />
      )}

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
        onAddToGraph={(text, sessionId) =>
          handleAddToGraph(text, sessionId)
        }
        onUpdateMessage={handleUpdateMessage}
        flowActions={flowActions}
        onClearFlowActions={handleClearFlowActions}
        supabase={supabase}
        groupId={groupId}
        userId={userId}
        onClose={() => {}}
      />
    </div>
  );
}
