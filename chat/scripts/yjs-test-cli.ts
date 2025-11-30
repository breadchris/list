#!/usr/bin/env node
/**
 * Yjs Test CLI - Command-line interface for testing Yjs document interactions
 * Designed for AI development tools like Claude to drive interactions and observe functionality
 *
 * Usage:
 *   node scripts/yjs-test-cli.ts <command> [options]
 *
 * Environment Variables:
 *   AUTH_ENDPOINT - Y-Sweet auth endpoint URL (default: http://localhost:3000/api/y-sweet-auth)
 *   DOC_ID - Document ID to connect to (default: test-session)
 */

import { connectToYSweet, waitForSync } from "../lib/test-utils/yjs/client";
import { DocumentManager } from "../lib/test-utils/yjs/document-manager";
import { Observer } from "../lib/test-utils/yjs/observer";
import {
  sendMessage,
  createThreadForMessage,
  addTagToMessage,
  removeTagFromMessage,
  getDocumentState,
  queryMessages,
  getThreadWithMessages,
} from "../lib/test-utils/yjs/operations";
import type { CommandResult, EventType } from "../lib/test-utils/types";

// Polyfill WebSocket for Node.js
(globalThis as any).WebSocket = require("ws");

/**
 * Parse command-line arguments
 */
function parseArgs(): {
  command: string;
  args: Record<string, any>;
} {
  const [, , command, ...rest] = process.argv;

  const args: Record<string, any> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, "");
    const value = rest[i + 1];

    // Try to parse as JSON, fallback to string
    try {
      args[key] = JSON.parse(value);
    } catch {
      args[key] = value;
    }
  }

  return { command: command || "help", args };
}

/**
 * Print JSON result to stdout
 */
function printResult(result: CommandResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Print error to stderr and exit
 */
function printError(error: string): void {
  console.error(
    JSON.stringify({
      success: false,
      error,
    })
  );
  process.exit(1);
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  const { command, args } = parseArgs();

  // Get environment variables
  const authEndpoint =
    args.authEndpoint ||
    process.env.AUTH_ENDPOINT ||
    "http://localhost:3000/api/y-sweet-auth";
  const docId = args.docId || process.env.DOC_ID || "test-session";

  // Help command doesn't need connection
  if (command === "help") {
    printHelp();
    return;
  }

  // Connect to Y-Sweet
  console.error(
    JSON.stringify({
      type: "connecting",
      auth_endpoint: authEndpoint,
      doc_id: docId,
    })
  );

  const { doc, disconnect } = await connectToYSweet({
    auth_endpoint: authEndpoint,
    doc_id: docId,
  });

  // Wait for initial sync
  await waitForSync(doc, 10000).catch(() => {
    // Ignore timeout - doc might be empty
  });

  const docManager = new DocumentManager(doc);
  const observer = new Observer(docManager);

  // Subscribe to events and log them to stderr
  observer.subscribe((event) => {
    console.error(JSON.stringify(event));
  });

  try {
    await executeCommand(command, args, docManager, observer);
  } finally {
    // Wait a bit for any pending sync before disconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    disconnect();
  }
}

/**
 * Execute a command
 */
async function executeCommand(
  command: string,
  args: Record<string, any>,
  docManager: DocumentManager,
  observer: Observer
): Promise<void> {
  switch (command) {
    case "send-message": {
      const { username, content, threadId, tags } = args;

      if (!username || !content) {
        printError("send-message requires --username and --content");
        return;
      }

      const result = sendMessage(docManager, username, content, {
        threadId,
        tags,
      });

      printResult({
        success: true,
        data: {
          message: result.message,
          bot_invocations: result.botInvocations,
        },
      });
      break;
    }

    case "create-thread": {
      const { messageId } = args;

      if (!messageId) {
        printError("create-thread requires --messageId");
        return;
      }

      const thread = createThreadForMessage(docManager, messageId);

      if (!thread) {
        printResult({
          success: false,
          error: "Message not found",
        });
      } else {
        printResult({
          success: true,
          data: { thread },
        });
      }
      break;
    }

    case "add-tag": {
      const { messageId, tag } = args;

      if (!messageId || !tag) {
        printError("add-tag requires --messageId and --tag");
        return;
      }

      const success = addTagToMessage(docManager, messageId, tag);

      printResult({
        success,
        data: success ? { message_id: messageId, tag } : undefined,
        error: success ? undefined : "Message not found or tag already exists",
      });
      break;
    }

    case "remove-tag": {
      const { messageId, tag } = args;

      if (!messageId || !tag) {
        printError("remove-tag requires --messageId and --tag");
        return;
      }

      const success = removeTagFromMessage(docManager, messageId, tag);

      printResult({
        success,
        data: success ? { message_id: messageId, tag } : undefined,
        error: success ? undefined : "Message not found or tag doesn't exist",
      });
      break;
    }

    case "query": {
      const { username, contentContains, hasTag, inThread } = args;

      const results = queryMessages(docManager, {
        username,
        contentContains,
        hasTag,
        inThread,
      });

      printResult({
        success: true,
        data: {
          count: results.length,
          messages: results,
        },
      });
      break;
    }

    case "get-state": {
      const state = getDocumentState(docManager);

      printResult({
        success: true,
        data: state,
      });
      break;
    }

    case "get-thread": {
      const { threadId } = args;

      if (!threadId) {
        printError("get-thread requires --threadId");
        return;
      }

      const result = getThreadWithMessages(docManager, threadId);

      if (!result) {
        printResult({
          success: false,
          error: "Thread not found",
        });
      } else {
        printResult({
          success: true,
          data: result,
        });
      }
      break;
    }

    case "observe": {
      const { duration = 10000 } = args;

      console.error(
        JSON.stringify({
          type: "observing",
          duration_ms: duration,
        })
      );

      // Wait for specified duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      printResult({
        success: true,
        data: {
          events: observer.getEvents(),
        },
      });
      break;
    }

    case "wait-for-event": {
      const { eventType, timeout = 5000 } = args;

      if (!eventType) {
        printError("wait-for-event requires --eventType");
        return;
      }

      try {
        const event = await observer.waitForEvent(eventType as EventType, timeout);

        printResult({
          success: true,
          data: { event },
        });
      } catch (error) {
        printResult({
          success: false,
          error: (error as Error).message,
        });
      }
      break;
    }

    case "get-events": {
      const { eventType } = args;

      const events = eventType
        ? observer.getEventsByType(eventType as EventType)
        : observer.getEvents();

      printResult({
        success: true,
        data: {
          count: events.length,
          events,
        },
      });
      break;
    }

    default:
      printError(`Unknown command: ${command}. Use 'help' to see available commands.`);
  }
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Yjs Test CLI - Command-line interface for testing Yjs document interactions

USAGE:
  node scripts/yjs-test-cli.ts <command> [options]

ENVIRONMENT VARIABLES:
  AUTH_ENDPOINT  Y-Sweet auth endpoint URL (default: http://localhost:3000/api/y-sweet-auth)
  DOC_ID         Document ID to connect to (default: test-session)

COMMANDS:
  send-message      Send a message to the chat
    --username <string>      Username sending the message
    --content <string>       Message content
    --threadId <string>      Optional thread ID to send message in
    --tags <json-array>      Optional tags for the message

  create-thread     Create a new thread for a message
    --messageId <string>     Message ID to create thread for

  add-tag           Add a tag to a message
    --messageId <string>     Message ID
    --tag <string>           Tag to add

  remove-tag        Remove a tag from a message
    --messageId <string>     Message ID
    --tag <string>           Tag to remove

  query             Query messages by criteria
    --username <string>      Filter by username
    --contentContains <str>  Filter by content substring
    --hasTag <string>        Filter by tag
    --inThread <string>      Filter by thread ID

  get-state         Get current document state (all messages, threads, tags, bots)

  get-thread        Get thread with all its messages
    --threadId <string>      Thread ID

  observe           Observe events for a duration
    --duration <number>      Duration in milliseconds (default: 10000)

  wait-for-event    Wait for a specific event type
    --eventType <string>     Event type to wait for
    --timeout <number>       Timeout in milliseconds (default: 5000)

  get-events        Get recorded events
    --eventType <string>     Optional filter by event type

  help              Show this help message

OUTPUT FORMAT:
  All commands output JSON to stdout with structure:
  {
    "success": boolean,
    "data": any,      // Command result data
    "error": string   // Error message if success=false
  }

  Events are logged to stderr as JSON objects.

EXAMPLES:
  # Send a message
  node scripts/yjs-test-cli.ts send-message --username "alice" --content "Hello world"

  # Send a message with @bot mention
  node scripts/yjs-test-cli.ts send-message --username "bob" --content "@ai What is 2+2?"

  # Query messages by username
  node scripts/yjs-test-cli.ts query --username "alice"

  # Get current state
  node scripts/yjs-test-cli.ts get-state

  # Observe events for 30 seconds
  node scripts/yjs-test-cli.ts observe --duration 30000

  # Wait for a message to be added
  node scripts/yjs-test-cli.ts wait-for-event --eventType "message_added" --timeout 10000
`);
}

// Run the CLI
main().catch((error) => {
  printError(error.message || "Unknown error");
});
