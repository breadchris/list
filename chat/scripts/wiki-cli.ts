#!/usr/bin/env node
/**
 * Wiki CLI - Command-line interface for testing Wiki Yjs document interactions
 * Designed for AI development tools like Claude to drive interactions and observe functionality
 *
 * Usage:
 *   npx tsx scripts/wiki-cli.ts <command> [options]
 *
 * Environment Variables:
 *   AUTH_ENDPOINT - Y-Sweet auth endpoint URL (default: http://localhost:3000/api/y-sweet-auth)
 *   DOC_ID - Document ID to connect to (default: wiki-test)
 */

import { connectToYSweet, waitForSync } from "../lib/test-utils/yjs/client";
import { WikiDocumentManager } from "../lib/test-utils/wiki/document-manager";
import { getWikiState, listPages, listTemplates } from "../lib/test-utils/wiki/operations";
import {
  getPageBlocks,
  setPageBlocks,
  getPageMarkdown,
  setPageFromMarkdown,
} from "../lib/test-utils/wiki/server-editor";
import type * as Y from "yjs";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs/promises";
import * as path from "path";

// Supabase client for Node.js (no browser-specific features)
const SUPABASE_URL = "https://zazsrepfnamdmibcyenx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI5NjI3MywiZXhwIjoyMDcwODcyMjczfQ.dqaqUakGZJfrUibVNjGrTmphbUy1-KwbbuAiWkxGOcc";
const supabaseNode = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Polyfill WebSocket for Node.js
(globalThis as any).WebSocket = require("ws");

interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

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
  const docId = args.docId || process.env.DOC_ID || "wiki-test";

  // Commands that don't need Y-Sweet connection
  if (command === "help") {
    printHelp();
    return;
  }

  if (command === "export-code") {
    await executeExportCode(args);
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

  const wikiManager = new WikiDocumentManager(doc);

  try {
    await executeCommand(command, args, wikiManager, doc, docId);
  } finally {
    // Wait a bit for any pending sync before disconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    disconnect();
  }
}

/**
 * Execute export-code command (doesn't need Y-Sweet)
 */
async function executeExportCode(args: Record<string, any>): Promise<void> {
  const { id, output } = args;

  if (!id) {
    printError("export-code requires --id (content UUID)");
    return;
  }

  if (!output) {
    printError("export-code requires --output (directory path)");
    return;
  }

  // Fetch content from Supabase
  const { data, error } = await supabaseNode
    .from("content")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    printResult({
      success: false,
      error: error?.message || `Content not found: ${id}`,
    });
    return;
  }

  // Validate it's a code session
  if (data.type !== "code_session") {
    printResult({
      success: false,
      error: `Content ${id} is not a code session (type: ${data.type})`,
    });
    return;
  }

  // Get latest version
  const versions = data.metadata?.versions || [];
  if (versions.length === 0) {
    printResult({
      success: false,
      error: "No versions found in code session",
    });
    return;
  }

  const latestVersion = versions[versions.length - 1];

  // Write to output directory
  await fs.mkdir(output, { recursive: true });
  const filePath = path.join(output, latestVersion.filename || "Component.tsx");
  await fs.writeFile(filePath, latestVersion.tsx_code, "utf-8");

  printResult({
    success: true,
    data: {
      session_id: id,
      session_name: data.data,
      version_id: latestVersion.id,
      timestamp: latestVersion.timestamp,
      filename: latestVersion.filename,
      output_path: filePath,
      message: "Code exported successfully",
    },
  });
}

/**
 * Execute a command
 */
async function executeCommand(
  command: string,
  args: Record<string, any>,
  wikiManager: WikiDocumentManager,
  doc: Y.Doc,
  docId: string
): Promise<void> {
  switch (command) {
    case "get-state": {
      const state = getWikiState(wikiManager);

      printResult({
        success: true,
        data: state,
      });
      break;
    }

    case "list-pages": {
      const pages = listPages(wikiManager);

      printResult({
        success: true,
        data: {
          count: pages.length,
          pages,
        },
      });
      break;
    }

    case "list-templates": {
      const templates = listTemplates(wikiManager);

      printResult({
        success: true,
        data: {
          count: templates.length,
          templates,
        },
      });
      break;
    }

    case "create-page": {
      const { path, wikiId } = args;

      if (!path) {
        printError("create-page requires --path");
        return;
      }

      // Use provided wikiId or extract from docId (wiki-{wikiId})
      const resolvedWikiId = wikiId || docId.replace(/^wiki-/, "");
      const page = wikiManager.createPage(path, resolvedWikiId);

      printResult({
        success: true,
        data: {
          page,
          message: "Page created",
        },
      });
      break;
    }

    case "get-page": {
      const { path } = args;

      if (!path) {
        printError("get-page requires --path");
        return;
      }

      const page = wikiManager.getPage(path);

      if (!page) {
        printResult({
          success: false,
          error: `Page not found: ${path}`,
        });
      } else {
        printResult({
          success: true,
          data: { page },
        });
      }
      break;
    }

    case "get-template": {
      const { id } = args;

      if (!id) {
        printError("get-template requires --id");
        return;
      }

      const template = wikiManager.getTemplate(id);

      if (!template) {
        printResult({
          success: false,
          error: `Template not found: ${id}`,
        });
      } else {
        printResult({
          success: true,
          data: { template },
        });
      }
      break;
    }

    case "get-page-content": {
      const { path } = args;

      if (!path) {
        printError("get-page-content requires --path");
        return;
      }

      const page = wikiManager.getPage(path);

      if (!page) {
        printResult({
          success: false,
          error: `Page not found: ${path}`,
        });
      } else {
        const blocks = await getPageBlocks(doc, page.id);
        printResult({
          success: true,
          data: {
            page,
            blocks,
          },
        });
      }
      break;
    }

    case "set-page-content": {
      const { path, blocks } = args;

      if (!path) {
        printError("set-page-content requires --path");
        return;
      }

      if (!blocks) {
        printError("set-page-content requires --blocks (JSON array)");
        return;
      }

      const page = wikiManager.getPage(path);

      if (!page) {
        printResult({
          success: false,
          error: `Page not found: ${path}`,
        });
      } else {
        // blocks should already be parsed from JSON by parseArgs
        const blocksArray = Array.isArray(blocks) ? blocks : JSON.parse(blocks);
        await setPageBlocks(doc, page.id, blocksArray);
        printResult({
          success: true,
          data: {
            page,
            message: "Page content updated",
          },
        });
      }
      break;
    }

    case "get-page-markdown": {
      const { path } = args;

      if (!path) {
        printError("get-page-markdown requires --path");
        return;
      }

      const page = wikiManager.getPage(path);

      if (!page) {
        printResult({
          success: false,
          error: `Page not found: ${path}`,
        });
      } else {
        const markdown = await getPageMarkdown(doc, page.id);
        printResult({
          success: true,
          data: {
            page,
            markdown,
          },
        });
      }
      break;
    }

    case "set-page-markdown": {
      const { path, markdown } = args;

      if (!path) {
        printError("set-page-markdown requires --path");
        return;
      }

      if (!markdown) {
        printError("set-page-markdown requires --markdown");
        return;
      }

      const page = wikiManager.getPage(path);

      if (!page) {
        printResult({
          success: false,
          error: `Page not found: ${path}`,
        });
      } else {
        await setPageFromMarkdown(doc, page.id, markdown);
        printResult({
          success: true,
          data: {
            page,
            message: "Page content updated from markdown",
          },
        });
      }
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
Wiki CLI - Command-line interface for testing Wiki Yjs document interactions

USAGE:
  npx tsx scripts/wiki-cli.ts <command> [options]

ENVIRONMENT VARIABLES:
  AUTH_ENDPOINT  Y-Sweet auth endpoint URL (default: http://localhost:3000/api/y-sweet-auth)
  DOC_ID         Document ID to connect to (default: wiki-test)

DOCUMENT ID FORMAT:
  Wiki documents use the pattern: wiki-{wiki_id}
  Example: wiki-abc123-def456-...

COMMANDS:
  get-state         Get current wiki state (all pages and templates)

  list-pages        List all pages in the wiki

  list-templates    List all templates in the wiki

  create-page       Create a new page (does not overwrite existing content)
    --path <string>      Page path (e.g., "index", "guide/intro")
    --wikiId <string>    Wiki ID (optional, extracted from docId if not provided)

  get-page          Get a specific page by path
    --path <string>      Page path (e.g., "index", "guide/intro")

  get-template      Get a specific template by ID
    --id <string>        Template ID

  get-page-content  Get page content as BlockNote JSON blocks
    --path <string>      Page path (e.g., "index", "guide/intro")

  set-page-content  Set page content from BlockNote JSON blocks
    --path <string>      Page path
    --blocks <json>      JSON array of BlockNote blocks

  get-page-markdown Get page content as markdown
    --path <string>      Page path

  set-page-markdown Set page content from markdown
    --path <string>      Page path
    --markdown <string>  Markdown content

  export-code       Export latest code from a code session to local directory
    --id <uuid>          Code session content ID (from Supabase)
    --output <path>      Local directory to write files to

  help              Show this help message

OPTIONS:
  --docId <string>       Wiki document ID (e.g., wiki-abc123)
  --authEndpoint <url>   Y-Sweet auth endpoint URL

OUTPUT FORMAT:
  All commands output JSON to stdout with structure:
  {
    "success": boolean,
    "data": any,      // Command result data
    "error": string   // Error message if success=false
  }

  Connection events are logged to stderr as JSON objects.

EXAMPLES:
  # Get wiki state (using a specific wiki ID)
  npx tsx scripts/wiki-cli.ts get-state --docId wiki-abc123

  # List all pages
  npx tsx scripts/wiki-cli.ts list-pages --docId wiki-abc123

  # Create a new page (does not overwrite existing content)
  npx tsx scripts/wiki-cli.ts create-page --path "guide/intro" --docId wiki-abc123

  # Get a specific page
  npx tsx scripts/wiki-cli.ts get-page --path "index" --docId wiki-abc123

  # Get page content as JSON blocks
  npx tsx scripts/wiki-cli.ts get-page-content --path "index" --docId wiki-abc123

  # Get page content as markdown
  npx tsx scripts/wiki-cli.ts get-page-markdown --path "index" --docId wiki-abc123

  # Set page content from markdown
  npx tsx scripts/wiki-cli.ts set-page-markdown --path "index" --markdown "# Hello\\n\\nWorld" --docId wiki-abc123

  # Set page content from JSON blocks
  npx tsx scripts/wiki-cli.ts set-page-content --path "index" --blocks '[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]' --docId wiki-abc123

  # Export code session to local directory (no Y-Sweet connection needed)
  npx tsx scripts/wiki-cli.ts export-code --id "abc123-def456-..." --output "./my-component"
`);
}

// Run the CLI
main().catch((error) => {
  printError(error.message || "Unknown error");
});
