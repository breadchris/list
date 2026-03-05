import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import OpenAI from "npm:openai";
import { Readability } from "npm:@mozilla/readability@0.5.0";
import { DOMParser } from "npm:linkedom@0.16.10";
import TurndownService from "npm:turndown@7.1.3";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Global Error Handler
app.onError((err, c) => {
  console.error("Global Error:", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

// Health check endpoint
app.get("/make-server-61781242/health", (c) => {
  return c.json({ status: "ok" });
});

// Sync endpoint (Get all data)
app.get("/make-server-61781242/sync", async (c) => {
  try {
    const messages = await kv.getByPrefix("msg:");
    const thoughts = await kv.getByPrefix("thought:");
    const sessions = await kv.getByPrefix("session:");
    const constraints = await kv.getByPrefix("constraints:");
    let personas = await kv.get("settings:personas"); // Load personas
    
    // Attach constraints to sessions
    const sessionsWithConstraints = sessions?.map((s: any) => {
        const c = constraints?.find((c: any) => c.sessionId === s.id);
        return {
            ...s,
            constraints: c || {}
        };
    }) || [];
    
    // Sign URLs for avatars
    if (personas && Array.isArray(personas)) {
        try {
            const supabase = getAdminClient();
            // We can't batch createSignedUrl easily, so we loop.
            // But checking bucket existence on every sync is expensive? 
            // We assume bucket exists if we have paths.
            
            // To be efficient, we only sign if there is a path
            let updated = false;
            for (const p of personas) {
                if (p.avatarPath) {
                    const { data } = await supabase.storage
                        .from('make-61781242')
                        .createSignedUrl(p.avatarPath, 60 * 60 * 24 * 7); // 7 days
                    
                    if (data?.signedUrl) {
                        p.avatarUrl = data.signedUrl;
                        updated = true;
                    }
                }
            }
            // Note: We don't save the signed URL back to DB (it's ephemeral), 
            // but we modify the response object.
        } catch(e) {
            console.error("Failed to sign avatar URLs", e);
        }
    }

    // Sort by timestamp
    const sortedMessages = (messages || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const sortedThoughts = (thoughts || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const sortedSessions = (sessionsWithConstraints || []).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    return c.json({ 
      messages: sortedMessages, 
      timelineEntries: sortedThoughts,
      sessions: sortedSessions,
      personas: personas || null // Return null if not set, client will use defaults
    });
  } catch (e) {
    console.error("Error syncing data:", e);
    return c.json({ error: e.message }, 500);
  }
});

// Sync endpoint (Save all data)
app.post("/make-server-61781242/sync", async (c) => {
  try {
    const body = await c.req.json();
    const messages = body.messages || [];
    const timelineEntries = body.timelineEntries || [];
    const sessions = body.sessions || [];
    const personas = body.personas; // Get personas list
    
    const allItems: { key: string; value: any }[] = [];

    if (personas && Array.isArray(personas)) {
        allItems.push({ key: "settings:personas", value: personas });
    }

    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg && msg.id && msg.timestamp) {
           allItems.push({ key: `msg:${msg.timestamp}:${msg.id}`, value: msg });
        }
      }
    }

    if (Array.isArray(timelineEntries)) {
      for (const entry of timelineEntries) {
        if (entry && entry.id && entry.timestamp) {
            allItems.push({ key: `thought:${entry.timestamp}:${entry.id}`, value: entry });
        }
      }
    }

    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        if (session && session.id) {
            allItems.push({ key: `session:${session.id}`, value: session });
        }
      }
    }

    // Batch process in chunks to avoid hitting limits or timeouts
    const CHUNK_SIZE = 50;
    for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
        const chunk = allItems.slice(i, i + CHUNK_SIZE);
        await kv.mset(chunk.map(i => i.key), chunk.map(i => i.value));
    }

    return c.json({ success: true });
  } catch (e) {
    console.error("Error saving sync data:", e);
    return c.json({ error: e.message }, 500);
  }
});

// Upload Endpoint
app.post("/make-server-61781242/upload", async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];
        
        if (!file || !(file instanceof File)) {
            return c.json({ error: "No file uploaded" }, 400);
        }

        const supabase = getAdminClient();
        const bucketName = "make-61781242";
        
        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets?.find(b => b.name === bucketName)) {
             await supabase.storage.createBucket(bucketName, {
              public: false,
              fileSizeLimit: 2097152, // 2MB
              allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
          });
        }

        const ext = file.name.split('.').pop();
        const path = `avatars/${crypto.randomUUID()}.${ext}`;
        
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(path, file, {
                contentType: file.type,
                upsert: true
            });
            
        if (error) throw error;
        
        // Return path and signed URL
        const { data: signedData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
            
        return c.json({ 
            path: path,
            url: signedData?.signedUrl 
        });

    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Chat endpoint with OpenAI
app.post("/make-server-61781242/chat", async (c) => {
  try {
    const { messages, persona, constraints, connectedSessionId } = await c.req.json();
    
    // Try both standard and user-specified env var names
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_TOKEN");

    if (!apiKey) {
      console.error("Missing OpenAI API Key");
      // Return a 200 with error message in chat to avoid crashing UI
      return c.json({ 
        reply: "I'm currently unable to connect to my brain (OpenAI API Key missing). Please check your secrets configuration.",
        newEntries: []
      });
    }

    const openai = new OpenAI({ apiKey });

    // Fetch recent thoughts to provide context and prevent duplicates
    const thoughts = await kv.getByPrefix("thought:");
    const recentThoughts = (thoughts || [])
       .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
       .slice(0, 15) // last 15 entries
       .map((t: any) => `- ${t.content}`);

    // Fetch editor context if sessionId is provided
    let editorContext = "";
    // Note: sessionId might need to be passed explicitly in body, but checking messages for now
    const sessionId = (messages && messages.length > 0) ? messages[messages.length - 1].sessionId : null;
    let currentConstraints = constraints || {}; // Use passed constraints or default

    if (sessionId && Object.keys(currentConstraints).length === 0) {
        try {
            // Fetch constraints from DB if not passed
            const constraintsData = await kv.get(`constraints:${sessionId}`);
            if (constraintsData) {
                currentConstraints = constraintsData;
            }
        } catch(e) {
            console.error("Error reading constraints", e);
        }
    }

    // Determine context for editor/wiki
    // If connectedSessionId is provided, use that for editor context. Otherwise use current session.
    const contextSessionId = connectedSessionId || sessionId;

    if (contextSessionId) {
        try {
            // Keep using 'scratchpad' key prefix for backward compatibility
            const spData = await kv.get(`scratchpad:${contextSessionId}`);
            if (spData && spData.content) {
                const extractText = (node: any): string => {
                    if (node.text) return node.text;
                    if (node.children && Array.isArray(node.children)) {
                        return node.children.map(extractText).join(node.type === 'paragraph' ? '\n' : '');
                    }
                    return '';
                };
                
                let parsed;
                if (typeof spData.content === 'string') {
                    parsed = JSON.parse(spData.content);
                } else {
                    parsed = spData.content;
                }
                
                if (parsed && parsed.root) {
                    editorContext = extractText(parsed.root);
                }
            }
        } catch(e) {
            console.error("Error reading editor context", e);
        }
    }

    const constraintsString = Object.entries(currentConstraints).length > 0 
        ? `CURRENT CONSTRAINTS (Session Context):\n${Object.entries(currentConstraints).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
        : "";

    const contextString = `
${recentThoughts.length > 0 ? `RECENT TIMELINE ENTRIES (Context):\n${recentThoughts.join('\n')}` : ""}
${editorContext ? `\nCURRENT EDITOR CONTENT:\n${editorContext}` : ""}
${constraintsString ? `\n${constraintsString}` : ""}
`;

    const baseSystemPrompt = persona?.systemPrompt || "You are a helpful assistant.";
    const systemPrompt = `${baseSystemPrompt}

IMPORTANT: You are a thinking partner. Your goal is to help the user build a timeline of their thoughts.
1. When the user expresses an idea, save it to the timeline.
2. CRITICAL: When the USER asks a question, you MUST save that question to the timeline using the 'add_idea_to_timeline' tool. This preserves the user's line of inquiry.
3. Do NOT save your own questions (AI questions) to the timeline. Only save user content (ideas and user questions).
4. NO DUPLICATES: Check 'RECENT TIMELINE ENTRIES' before adding new ideas.
5. UPDATE EDITOR: Use 'update_editor' only when explicitly asked to draft/write/summarize.
6. WIKI MANAGEMENT: Use 'write_wiki_page' only when explicitly asked.
7. CONSTRAINTS: Maintain the constraint specification using 'update_constraints'. Update whenever the context changes (e.g., topic, audience, tone).

${contextString}

*** CRITICAL RESPONSE FORMATTING RULES ***
YOU MUST USE MARKDOWN LINKS FOR KEY TERMS. This is the most important rule for your response style.
- Every time you mention a key concept, technical term, or sub-topic (like 'Melody', 'Rhythm', 'React', 'Supabase'), you MUST format it as a link: [Term](#).
- Do NOT just list terms. Linkify them.
- Example Correct Output: "In [Music Theory](#), [Harmony](#) is the process of..."
- Example Correct List:
  - [Rhythm](#): The placement of sounds in time.
  - [Timbre](#): The quality of a musical note.
- Your goal is to create a Wikipedia-style reading experience.
- AIM FOR 5-10 LINKS PER MESSAGE.
`;
    
    // Format messages for OpenAI
    // Take the last 20 messages to preserve context but limit tokens
    const recentMessages = (messages || []).slice(-20).map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text || "(empty)"
    }));

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "update_constraints",
          description: "Updates the constraint specification for the current session. Call this when the user mentions new constraints (e.g., topic, audience, tone) or when the context shifts.",
          parameters: {
            type: "object",
            properties: {
              updates: {
                type: "object",
                description: "Key-value pairs of constraints to update or add. Use empty string to remove a constraint.",
                additionalProperties: {
                    type: "string"
                }
              }
            },
            required: ["updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_idea_to_timeline",
          description: "Extracts an idea, thought, note, or USER QUESTION from the conversation and adds it to the daily timeline. Call this when the user mentions an idea or asks a question.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The content of the idea or the user's question."
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Relevant tags (e.g., 'technical', 'creative', 'question', 'inquiry')"
              }
            },
            required: ["content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_editor",
          description: "Appends text to the collaborative editor. Use this to draft notes, summaries, or content as requested by the user. CRITICAL: Only generate content for the CURRENT topic. Do NOT include unrelated context from memory.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The text content to append to the editor (Markdown supported). ONLY the new content."
              }
            },
            required: ["content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "write_wiki_page",
          description: "Propose a create or update action for a specific wiki page. This will show a confirmation UI to the user.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "The hierarchical path of the page (e.g., 'projects/marketing', 'notes/ideas')."
              },
              content: {
                type: "string",
                description: "The content to write to the page. If the page exists, this will be appended. If new, it will be the initial content."
              }
            },
            required: ["path", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_recipe",
          description: "Generate a structured recipe component. Use this whenever the user asks for a recipe or how to cook something.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              prepTime: { type: "string", description: "e.g. '15 mins'" },
              cookTime: { type: "string", description: "e.g. '45 mins'" },
              servings: { type: "number" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              calories: { type: "number" },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string" },
                    quantity: { type: "string" },
                    unit: { type: "string" }
                  },
                  required: ["item", "quantity"]
                }
              },
              instructions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    step: { type: "number" },
                    text: { type: "string" }
                  },
                  required: ["step", "text"]
                }
              }
            },
            required: ["title", "ingredients", "instructions", "prepTime", "cookTime"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ask_structured_question",
          description: "Present structured UI questions to the user. You can ask multiple related questions at once (e.g. gathering requirements for a feature).",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Optional title or context for this set of questions."
              },
              questions: {
                type: "array",
                description: "List of questions to ask.",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    text: { type: "string", description: "The question text." },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          description: { type: "string" }
                        },
                        required: ["id", "label"]
                      },
                      description: "List of options for this question."
                    },
                    allowCustomInput: {
                      type: "boolean",
                      description: "Whether to allow custom text input for this question (default true)."
                    }
                  },
                  required: ["id", "text", "options"]
                }
              }
            },
            required: ["questions"]
          }
        }
      },
      {
        type: "function",
        function: {
        name: "add_flow_node",
        description: "Add a node to the flow chart diagram.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "The label or text for the node" },
            type: { type: "string", enum: ["default", "input", "output"], description: "Node type (default if unsure)" }
          },
          required: ["label"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "connect_flow_nodes",
        description: "Connect two existing nodes in the flow chart. Use fuzzy matching for node labels if IDs are unknown.",
        parameters: {
          type: "object",
          properties: {
            sourceLabel: { type: "string", description: "The label of the source node" },
            targetLabel: { type: "string", description: "The label of the target node" },
            label: { type: "string", description: "Optional label for the edge/connection" }
          },
          required: ["sourceLabel", "targetLabel"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "layout_flow_nodes",
        description: "Automatically reorganize the flow chart nodes in a hierarchical layout.",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["TB", "LR"], description: "Direction of layout: 'TB' (Top-Bottom) or 'LR' (Left-Right)" }
          },
          required: ["direction"]
        }
      }
    }
  ];

  const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: apiMessages,
      tools: tools,
      tool_choice: "auto",
    });

    const responseMessage = completion.choices[0].message;
    const toolResults = [];
    let structuredQuestionResponse = null;
    let editorUpdate = null;
    let wikiAction = null;
    let constraintsUpdate = null;
    let recipeResponse = null;
    let flowActions = [];
    let hasClientInteraction = false;

    // Handle tool calls
    if (responseMessage.tool_calls) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === "update_constraints") {
            try {
                const args = JSON.parse(toolCall.function.arguments);
                const updates = args.updates;
                if (sessionId && updates) {
                    const current = await kv.get(`constraints:${sessionId}`) || {};
                    const newConstraints = { ...current };
                    
                    for (const [key, value] of Object.entries(updates)) {
                        if (value === "" || value === null) {
                            delete newConstraints[key];
                        } else {
                            newConstraints[key] = value;
                        }
                    }
                    // Ensure sessionId is stored in the value so we can map it back
                    newConstraints.sessionId = sessionId;
                    
                    await kv.set(`constraints:${sessionId}`, newConstraints);
                    constraintsUpdate = newConstraints;
                    hasClientInteraction = true;
                }
            } catch (e) {
                console.error("Error updating constraints", e);
            }
        } else if (toolCall.function.name === "add_idea_to_timeline") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            const entry = {
              id: crypto.randomUUID(),
              content: args.content,
              timestamp: new Date().toISOString(),
              tags: args.tags || [persona.role],
              personaId: persona?.id
            };

            // Persist immediately
            await kv.set(`thought:${entry.timestamp}:${entry.id}`, entry);
            toolResults.push(entry);
          } catch (e) {
            console.error("Error processing tool call:", e);
          }
        } else if (toolCall.function.name === "generate_recipe") {
             try {
                 recipeResponse = JSON.parse(toolCall.function.arguments);
                 hasClientInteraction = true;
             } catch(e) {
                 console.error("Error parsing recipe", e);
             }
        } else if (toolCall.function.name === "update_editor") {
             try {
                 const args = JSON.parse(toolCall.function.arguments);
                 editorUpdate = args.content;
                 hasClientInteraction = true; 
             } catch(e) {
                 console.error("Error parsing editor update", e);
             }
        } else if (toolCall.function.name === "write_wiki_page") {
             try {
                 const args = JSON.parse(toolCall.function.arguments);
                 wikiAction = { path: args.path, content: args.content };
                 hasClientInteraction = true;
             } catch(e) {
                 console.error("Error parsing wiki action", e);
             }
        } else if (toolCall.function.name === "ask_structured_question") {
           try {
             structuredQuestionResponse = JSON.parse(toolCall.function.arguments);
             // Assign an ID if not present, though usually not needed for pure UI
             structuredQuestionResponse.id = crypto.randomUUID();
             hasClientInteraction = true;
           } catch(e) {
             console.error("Error parsing structured question:", e);
           }
        } else if (toolCall.function.name === "add_flow_node" || toolCall.function.name === "connect_flow_nodes" || toolCall.function.name === "layout_flow_nodes") {
           try {
             const args = JSON.parse(toolCall.function.arguments);
             flowActions.push({
               type: toolCall.function.name,
               ...args
             });
             hasClientInteraction = true;
           } catch(e) {
             console.error("Error parsing flow action:", e);
           }
        }
      }
    }

    let finalContent = responseMessage.content;

    // If there were tool calls AND NO client interaction, do a second turn
    if (responseMessage.tool_calls && !hasClientInteraction) {
      apiMessages.push(responseMessage);
      
      // Add tool output messages
      for (const toolCall of responseMessage.tool_calls) {
         if (toolCall.function.name === "add_idea_to_timeline") {
            const resultStr = JSON.stringify({ success: true, added: true });
            apiMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: resultStr
            });
         } else if (toolCall.function.name === "update_editor") {
             apiMessages.push({
                 role: "tool",
                 tool_call_id: toolCall.id,
                 content: JSON.stringify({ success: true, message: "Editor update queued for client." })
             });
         } else if (toolCall.function.name === "write_wiki_page") {
             apiMessages.push({
                 role: "tool",
                 tool_call_id: toolCall.id,
                 content: JSON.stringify({ success: true, message: "Wiki action queued for approval." })
             });
         } else if (toolCall.function.name === "add_flow_node" || toolCall.function.name === "connect_flow_nodes" || toolCall.function.name === "layout_flow_nodes") {
             apiMessages.push({
                 role: "tool",
                 tool_call_id: toolCall.id,
                 content: JSON.stringify({ success: true, message: "Flow action queued for client execution." })
             });
         }
      }

      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: apiMessages,
      });

      finalContent = secondResponse.choices[0].message.content;
    }

    return c.json({
      reply: finalContent,
      newEntries: toolResults,
      structuredQuestion: structuredQuestionResponse,
      editorUpdate: editorUpdate,
      wikiAction: wikiAction,
      constraints: constraintsUpdate,
      recipe: recipeResponse,
      flowActions: flowActions.length > 0 ? flowActions : null
    });

  } catch (e) {
    console.error("Error in chat endpoint:", e);
    return c.json({ error: e.message }, 500);
  }
});

// Refine endpoint
app.post("/make-server-61781242/refine", async (c) => {
  try {
    const { text, persona } = await c.req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_TOKEN");
    
    if (!apiKey) {
        return c.json({ error: "Missing API Key" }, 500);
    }

    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are an expert editor and thinker acting as a ${persona?.role || "assistant"}. 
                Your task is to expand upon and refine the user's input text to make it more comprehensive, clear, and professional. 
                Keep the tone consistent with your persona. 
                Do not add conversational filler (like "Here is the refined text:"). Just return the refined text.`
            },
            {
                role: "user",
                content: text
            }
        ]
    });

    return c.json({ refinedText: response.choices[0].message.content });
  } catch (e) {
    console.error("Refine error:", e);
    return c.json({ error: e.message }, 500);
  }
});

// Flow Endpoints
app.get("/make-server-61781242/flow/state", async (c) => {
    try {
        const sessionId = c.req.query("sessionId");
        if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

        const data = await kv.get(`flow:${sessionId}`);
        return c.json({ value: data });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post("/make-server-61781242/flow/state", async (c) => {
    try {
        const { sessionId, value } = await c.req.json();
        if (!sessionId || !value) return c.json({ error: "Missing required fields" }, 400);

        await kv.set(`flow:${sessionId}`, value);
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post("/make-server-61781242/flow/version", async (c) => {
    try {
        const { sessionId, value, timestamp } = await c.req.json();
        if (!sessionId || !value || !timestamp) return c.json({ error: "Missing required fields" }, 400);

        const key = `flow-v:${sessionId}:${timestamp}`;
        const valueToStore = { ...value, timestamp };
        
        await kv.set(key, valueToStore);
        return c.json({ success: true, key });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.get("/make-server-61781242/flow/versions", async (c) => {
    try {
        const sessionId = c.req.query("sessionId");
        if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

        const supabase = getAdminClient();
        const { data, error } = await supabase
            .from('kv_store_61781242')
            .select('key, value')
            .like('key', `flow-v:${sessionId}:%`)
            .order('key', { ascending: false })
            .limit(20);

        if (error) throw error;
        
        return c.json({ data });
    } catch (e) {
        console.error("Error fetching versions:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Editor Endpoints to bypass RLS
import { createClient } from "npm:@supabase/supabase-js";

// Helper to get admin client
const getAdminClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
};

// Get editor state
app.get("/make-server-61781242/editor/state", async (c) => {
    try {
        const sessionId = c.req.query("sessionId");
        if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

        const data = await kv.get(`scratchpad:${sessionId}`);
        return c.json({ value: data });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Save editor state
app.post("/make-server-61781242/editor/state", async (c) => {
    try {
        const { sessionId, value } = await c.req.json();
        if (!sessionId || !value) return c.json({ error: "Missing required fields" }, 400);

        await kv.set(`scratchpad:${sessionId}`, value);
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Save editor version
app.post("/make-server-61781242/editor/version", async (c) => {
    try {
        const { sessionId, value, timestamp } = await c.req.json();
        if (!sessionId || !value || !timestamp) return c.json({ error: "Missing required fields" }, 400);

        // Keep key prefix for backward compatibility if needed, or just consistency
        const key = `scratchpad-v:${sessionId}:${timestamp}`;
        const valueToStore = { ...value, timestamp };
        
        await kv.set(key, valueToStore);
        return c.json({ success: true, key });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Get editor versions
app.get("/make-server-61781242/editor/versions", async (c) => {
    try {
        const sessionId = c.req.query("sessionId");
        if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

        // Use admin client to perform structured query with ordering and limit
        const supabase = getAdminClient();
        const { data, error } = await supabase
            .from('kv_store_61781242')
            .select('key, value')
            .like('key', `scratchpad-v:${sessionId}:%`)
            .order('key', { ascending: false })
            .limit(20);

        if (error) throw error;
        
        return c.json({ data });
    } catch (e) {
        console.error("Error fetching versions:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Get wiki pages (structure only)
app.get("/make-server-61781242/wiki/pages", async (c) => {
    try {
        const supabase = getAdminClient();
        // search for keys starting with scratchpad:wiki/
        const { data, error } = await supabase
            .from('kv_store_61781242')
            .select('key')
            .like('key', 'scratchpad:wiki/%');

        if (error) throw error;
        
        // Extract paths: "scratchpad:wiki/foo/bar" -> "foo/bar"
        const paths = data.map((d: any) => d.key.replace('scratchpad:wiki/', ''));
        return c.json({ paths });
    } catch (e) {
        console.error("Error fetching wiki pages:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Sandbox Layout Persistence
app.get("/make-server-61781242/sandbox/state", async (c) => {
    try {
        const data = await kv.get("sandbox:layout");
        return c.json({ value: data });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post("/make-server-61781242/sandbox/state", async (c) => {
    try {
        const { rows, activeRowId } = await c.req.json();
        if (!rows) {
            return c.json({ error: "Missing rows data" }, 400);
        }

        const data = {
            rows,
            activeRowId,
            updatedAt: new Date().toISOString()
        };

        await kv.set("sandbox:layout", data);
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Todo List Persistence
app.get("/make-server-61781242/todo/state", async (c) => {
    try {
        const sessionId = c.req.query("sessionId");
        if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

        const data = await kv.get(`todo:${sessionId}`);
        return c.json({ value: data });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

app.post("/make-server-61781242/todo/state", async (c) => {
    try {
        const { sessionId, value } = await c.req.json();
        if (!sessionId || !value) return c.json({ error: "Missing required fields" }, 400);

        await kv.set(`todo:${sessionId}`, value);
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Timeline endpoint (Add entry)
app.post("/make-server-61781242/timeline", async (c) => {
    try {
        const body = await c.req.json();
        const entry = body.entry;

        if (!entry || !entry.content) {
            return c.json({ error: "Missing entry content" }, 400);
        }

        const key = `thought:${entry.timestamp}:${entry.id}`;
        await kv.set(key, entry);
        
        return c.json({ success: true, entry });
    } catch (e) {
        console.error("Error saving timeline entry:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Update Timeline Entry
app.post("/make-server-61781242/timeline/update", async (c) => {
    try {
        const { entry } = await c.req.json();
        if (!entry || !entry.id) return c.json({ error: "Missing entry data" }, 400);

        // We assume timestamp didn't change for the key, or if it did, we need to handle key migration.
        // Assuming timestamp is stable for now.
        const key = `thought:${entry.timestamp}:${entry.id}`;
        await kv.set(key, entry);
        
        return c.json({ success: true, entry });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Delete Timeline Entry
app.post("/make-server-61781242/timeline/delete", async (c) => {
    try {
        const { id, timestamp } = await c.req.json();
        if (!id) return c.json({ error: "Missing id" }, 400);

        // Try deleting the standard key pattern
        if (timestamp) {
            await kv.del(`thought:${timestamp}:${id}`);
        }
        // Also try the fallback short key just in case
        await kv.del(`thought:${id}`);
        
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// Reader mode endpoint
app.post("/make-server-61781242/read", async (c) => {
    try {
        const { url } = await c.req.json();
        if (!url) return c.json({ error: "URL required" }, 400);

        const response = await fetch(url);
        if (!response.ok) return c.json({ error: "Failed to fetch URL" }, 400);
        
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const reader = new Readability(doc);
        const article = reader.parse();
        
        if (!article) return c.json({ error: "Failed to parse article" }, 400);

        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(article.content);
        
        return c.json({ 
            title: article.title,
            content: markdown,
            byline: article.byline
        });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

Deno.serve(app.fetch);