/**
 * API Route for Claude Code chat
 * Uses Server-Sent Events (SSE) for streaming responses
 *
 * This route uses the Claude Agent SDK to execute Claude Code.
 * Sessions are isolated in /tmp/claude-sessions/{sessionId}/ and persist locally.
 */

import { NextRequest } from "next/server";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "crypto";
import { writeFile, mkdir, readFile } from "fs/promises";
import { watch, type FSWatcher } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// CLAUDE.md content for TSX component generation
const CLAUDE_MD_CONTENT = `# Claude Code Instructions

## Primary Directive

**CRITICAL**: Your purpose is to create visual React TSX components. Every user prompt MUST result in you creating a \`Component.tsx\` file.

### Interpret All Prompts as Component Requests

- **Any prompt you receive is a request for a visual TSX component**
- "timeline of horses to cars" → Create an interactive timeline visualization component
- "calculator" → Create a calculator UI component
- "show the solar system" → Create a solar system visualization component
- Abstract concepts, data, timelines, stories → Turn them into visual, interactive components

### What You Must Do

1. **ALWAYS create a \`Component.tsx\` file** - This is your primary output
2. Interpret the user's prompt creatively as a visual component
3. Design an engaging, interactive UI for the concept
4. Use Tailwind CSS for beautiful styling
5. Add interactivity with React hooks when appropriate

### Do NOT

- Do NOT just respond with text explanations
- Do NOT ask clarifying questions - make creative decisions yourself
- Do NOT skip creating the Component.tsx file

### File Location

**CRITICAL**: Write \`Component.tsx\` to the CURRENT DIRECTORY.
- Use \`./Component.tsx\` as the file path
- Do NOT write to \`/tmp/\` or any other absolute path
- The current working directory is your workspace - create the file there

## Component File Convention

**CRITICAL**: The main component file MUST be named \`Component.tsx\` and export a named \`Component\` function.

### Required Pattern
\`\`\`tsx
// Component.tsx
export function Component() {
  return <div>Your component here</div>;
}
\`\`\`

### Rules
1. File MUST be named exactly \`Component.tsx\`
2. MUST export a named function called \`Component\`
3. Do NOT use default exports
4. The component will be automatically loaded when the file changes

### Component Structure
- Use functional components with hooks
- Include all imports at the top (React is available globally)
- Keep components self-contained when possible
- Use Tailwind CSS for styling

### Available Libraries
- React (hooks: useState, useEffect, useMemo, useCallback, etc.)
- Tailwind CSS classes for styling
- Standard browser APIs

### Example
\`\`\`tsx
// Component.tsx
import { useState } from "react";

export function Component() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-2">Counter: {count}</h2>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Increment
      </button>
    </div>
  );
}
\`\`\`
`;

// Force Node.js runtime (not Edge) since we need the SDK
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maximum time to wait for Claude (5 minutes)
const TIMEOUT_MS = 5 * 60 * 1000;

// Store active abort controllers for request cancellation
const activeRequests = new Map<string, AbortController>();

/**
 * Get isolated session directory paths
 */
function getSessionPaths(sessionId: string) {
  const baseDir = join(tmpdir(), "claude-sessions", sessionId);
  return {
    baseDir,
    workDir: join(baseDir, "workspace"),
    claudeConfigDir: join(baseDir, ".config"),
    claudeSessionDir: join(baseDir, ".config", "claude-code", "sessions", sessionId),
  };
}

/**
 * Set up isolated session directories (reuses existing if resuming)
 */
async function setupSessionDirs(
  sessionId: string
): Promise<ReturnType<typeof getSessionPaths>> {
  const paths = getSessionPaths(sessionId);

  // Create directories if they don't exist (preserves existing session data)
  await mkdir(paths.workDir, { recursive: true });
  await mkdir(paths.claudeSessionDir, { recursive: true });

  return paths;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const { prompt, image_ids, content_id, claude_session_id, request_id } = body;

    if (!prompt && (!image_ids || image_ids.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Prompt or images required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!content_id) {
      return new Response(
        JSON.stringify({ error: "content_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create abort controller for this request
    const abortController = new AbortController();
    const reqId = request_id || randomUUID();
    activeRequests.set(reqId, abortController);

    // Use content_id for directory paths (consistent across all requests)
    const sessionId = content_id;

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let capturedSessionId: string | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let fileWatcher: FSWatcher | null = null;
        let paths: ReturnType<typeof getSessionPaths> | null = null;

        try {
          // Send immediate connected event so client knows stream is working
          const connectedEvent = {
            type: "connected",
            data: { request_id: reqId, timestamp: new Date().toISOString() },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(connectedEvent)}\n\n`)
          );

          // Set up isolated session directories (preserves existing if resuming)
          paths = await setupSessionDirs(sessionId);
          console.log(`Session directories at: ${paths.baseDir}`);
          console.log(`Workspace: ${paths.workDir}`);
          if (claude_session_id) {
            console.log(`Resuming Claude session: ${claude_session_id}`);
          }

          // Create CLAUDE.md in workspace
          await writeFile(join(paths.workDir, "CLAUDE.md"), CLAUDE_MD_CONTENT);
          console.log("Created CLAUDE.md");

          // Download images from Supabase to workspace
          const imageInfo: Array<{ filename: string; url: string }> = [];
          if (image_ids && Array.isArray(image_ids) && image_ids.length > 0) {
            console.log(`Downloading ${image_ids.length} images to workspace...`);
            const supabase = createServerSupabaseClient();

            for (const imageId of image_ids) {
              try {
                // Fetch content record to get storage URL and metadata
                const { data: content, error: contentError } = await supabase
                  .from("content")
                  .select("data, metadata")
                  .eq("id", imageId)
                  .single();

                if (contentError || !content?.data) {
                  console.warn(`Failed to fetch image content ${imageId}:`, contentError);
                  continue;
                }

                // Download image from storage URL
                const imageUrl = content.data;
                const response = await fetch(imageUrl);
                if (!response.ok) {
                  console.warn(`Failed to download image from ${imageUrl}: ${response.status}`);
                  continue;
                }

                const buffer = Buffer.from(await response.arrayBuffer());

                // Determine filename - sanitize and use original or generate
                const originalFilename = (content.metadata as any)?.filename || `image-${imageId}.png`;
                const sanitizedFilename = originalFilename
                  .replace(/[^a-zA-Z0-9._-]/g, "_")
                  .substring(0, 100);

                // Save to workspace
                const imagePath = join(paths.workDir, sanitizedFilename);
                await writeFile(imagePath, buffer);
                imageInfo.push({ filename: sanitizedFilename, url: imageUrl });
                console.log(`Downloaded image: ${sanitizedFilename}`);
              } catch (err) {
                console.warn(`Error downloading image ${imageId}:`, err);
              }
            }
          }

          // Build enhanced prompt with image references (including URLs for code generation)
          let enhancedPrompt = prompt || "";
          if (imageInfo.length > 0) {
            const imageList = imageInfo
              .map((img) => `- ./${img.filename} (URL: ${img.url})`)
              .join("\n");
            enhancedPrompt = `[Images in workspace:\n${imageList}\n]\n\n${enhancedPrompt}`;
            console.log(`Enhanced prompt with ${imageInfo.length} images`);
          }

          // Set up file watcher for Component.tsx
          const componentPath = join(paths.workDir, "Component.tsx");
          const setupFileWatcher = () => {
            try {
              fileWatcher = watch(paths!.workDir, async (eventType, filename) => {
                if (filename === "Component.tsx") {
                  try {
                    const content = await readFile(componentPath, "utf-8");
                    console.log("Component.tsx changed, sending to client");
                    const fileEvent = {
                      type: "file_change",
                      data: {
                        filename: "Component.tsx",
                        content,
                        timestamp: new Date().toISOString(),
                      },
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(fileEvent)}\n\n`)
                    );
                  } catch (err) {
                    console.warn("Failed to read Component.tsx:", err);
                  }
                }
              });
              console.log("File watcher set up for", paths!.workDir);
            } catch (err) {
              console.warn("Failed to set up file watcher:", err);
            }
          };
          setupFileWatcher();

          // Execute Claude Code SDK
          console.log("Starting Claude Code SDK query...");
          console.log("Prompt:", enhancedPrompt.substring(0, 100));
          console.log("Content ID:", content_id);
          console.log("Claude Session ID:", claude_session_id || "new session");
          console.log("Working directory:", paths.workDir);

          const resultStream = query({
            prompt: enhancedPrompt,
            options: {
              model: "claude-sonnet-4-5-20250929",
              permissionMode: "bypassPermissions",
              pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH,
              cwd: paths.workDir,
              resume: claude_session_id || undefined, // Resume if Claude session exists
              abortController,
              systemPrompt: CLAUDE_MD_CONTENT, // Pass instructions directly to Claude Code
              env: {
                // Set HOME to our isolated config directory so Claude CLI uses our session data
                HOME: paths.baseDir,
                // Preserve PATH so the claude script can find node
                PATH: process.env.PATH,
                // Anthropic API key for Claude Code authentication
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
              },
              hooks: {
                SessionStart: [
                  {
                    hooks: [
                      async (input: { session_id: string; source?: string }) => {
                        capturedSessionId = input.session_id;
                        console.log(`Session ID captured: ${input.session_id}`);
                        return {};
                      },
                    ],
                  },
                ],
              },
            },
          });

          // Set up timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              abortController.abort();
              reject(new Error("Request timed out after 5 minutes"));
            }, TIMEOUT_MS);
          });

          // Process stream with timeout
          const streamPromise = (async () => {
            for await (const message of resultStream) {
              console.log(
                "Message received:",
                JSON.stringify(message).substring(0, 200)
              );

              // Extract session_id from init message if not captured by hook
              if (
                !capturedSessionId &&
                message.type === "system" &&
                (message as any).subtype === "init" &&
                (message as any).session_id
              ) {
                capturedSessionId = (message as any).session_id;
                console.log(`Session ID from init: ${capturedSessionId}`);
              }

              // Transform and send message
              const transformed = transformSDKMessage(message, capturedSessionId);
              if (transformed) {
                const sseData = `data: ${JSON.stringify(transformed)}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
            }
          })();

          await Promise.race([streamPromise, timeoutPromise]);

          // Clear timeout if stream completed successfully
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Send done event with session ID
          const doneEvent = {
            type: "done",
            data: {
              session_id: capturedSessionId || sessionId,
              exit_code: 0,
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`)
          );
        } catch (error) {
          // Clear timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Claude Code error:", errorMessage);

          const errorEvent = { type: "error", data: { error: errorMessage } };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
          );
        } finally {
          // Clean up file watcher
          if (fileWatcher !== null) {
            (fileWatcher as FSWatcher).close();
            console.log("File watcher closed");
          }
          activeRequests.delete(reqId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": reqId,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Abort a running request
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("request_id");

  if (!requestId) {
    return new Response(
      JSON.stringify({ error: "request_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const controller = activeRequests.get(requestId);
  if (controller) {
    controller.abort();
    activeRequests.delete(requestId);
    return new Response(JSON.stringify({ success: true }));
  }

  return new Response(JSON.stringify({ error: "Request not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Transform SDK message to our CodeMessage format for SSE
 */
function transformSDKMessage(
  message: SDKMessage,
  sessionId: string | null
): any | null {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  switch (message.type) {
    case "system":
      if ((message as any).subtype === "init") {
        return {
          type: "message",
          data: {
            id,
            timestamp,
            type: "system",
            content: `Session started: ${(message as any).session_id || sessionId}`,
          },
        };
      }
      return null;

    case "assistant":
      if ((message as any).message?.content) {
        const content = (message as any).message.content;
        const messages: any[] = [];

        for (const block of content) {
          if (block.type === "text") {
            messages.push({
              type: "message",
              data: {
                id: randomUUID(),
                timestamp,
                type: "assistant",
                content: block.text,
              },
            });
          } else if (block.type === "thinking") {
            messages.push({
              type: "thinking",
              data: {
                id: randomUUID(),
                timestamp,
                type: "thinking",
                content: block.thinking,
              },
            });
          } else if (block.type === "tool_use") {
            messages.push({
              type: "tool",
              data: {
                id: randomUUID(),
                timestamp,
                type: "tool",
                tool_name: block.name,
                input: block.input,
              },
            });
          }
        }

        return messages.length === 1
          ? messages[0]
          : { type: "batch", data: messages };
      }
      return null;

    case "user":
      if ((message as any).message?.content) {
        for (const block of (message as any).message.content) {
          if (block.type === "tool_result") {
            return {
              type: "tool_result",
              data: {
                id,
                timestamp,
                type: "tool_result",
                tool_name: block.tool_use_id,
                output:
                  typeof block.content === "string"
                    ? block.content
                    : JSON.stringify(block.content),
                is_error: block.is_error,
              },
            };
          }
        }
      }
      return null;

    case "result":
      if ((message as any).subtype === "success") {
        return {
          type: "message",
          data: {
            id,
            timestamp,
            type: "system",
            content: (message as any).result || "Task completed successfully",
          },
        };
      } else if ((message as any).subtype === "error") {
        return {
          type: "error",
          data: {
            id,
            timestamp,
            type: "error",
            content: (message as any).error || "An error occurred",
          },
        };
      }
      return null;

    default:
      console.log("Unknown SDK message type:", message.type, message);
      return null;
  }
}
