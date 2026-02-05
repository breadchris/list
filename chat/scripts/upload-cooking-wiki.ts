#!/usr/bin/env node
/**
 * Upload Cooking Wiki - Batch upload markdown files to wiki
 *
 * Usage:
 *   npx tsx scripts/upload-cooking-wiki.ts --docId wiki-<id>
 *
 * Options:
 *   --docId           Wiki document ID (e.g., wiki-dee2d06f-d2cf-49b4-8443-78272f58a206)
 *   --authEndpoint    Y-Sweet auth endpoint (default: http://localhost:3000/api/y-sweet-auth)
 *   --sourceDir       Source directory (default: ../data/cooking)
 *   --prefix          Page path prefix (default: notes)
 */

import * as fs from "fs";
import * as path from "path";
import { connectToYSweet } from "../lib/test-utils/yjs/client";
import { WikiDocumentManager } from "../lib/test-utils/wiki/document-manager";
import { setPageFromMarkdown } from "../lib/test-utils/wiki/server-editor";

// Polyfill WebSocket for Node.js
(globalThis as any).WebSocket = require("ws");

interface UploadOptions {
  docId: string;
  authEndpoint: string;
  sourceDir: string;
  prefix: string;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): UploadOptions {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[i + 1];
    args[key] = value;
  }

  return {
    docId: args.docId || process.env.DOC_ID || "",
    authEndpoint: args.authEndpoint || process.env.AUTH_ENDPOINT || "http://localhost:3000/api/y-sweet-auth",
    sourceDir: args.sourceDir || path.resolve(__dirname, "../../data/cooking"),
    prefix: args.prefix || "notes",
  };
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Convert file path to wiki page path
 * - Removes source directory prefix
 * - Removes .md extension
 * - CLAUDE.md becomes the parent directory path (index page)
 * - Adds prefix
 */
function filePathToWikiPath(filePath: string, sourceDir: string, prefix: string): string {
  // Get relative path from source directory
  let relativePath = path.relative(sourceDir, filePath);

  // Remove .md extension
  relativePath = relativePath.replace(/\.md$/, "");

  // Handle CLAUDE.md as index pages
  if (relativePath.endsWith("/CLAUDE")) {
    relativePath = relativePath.replace(/\/CLAUDE$/, "");
  } else if (relativePath === "CLAUDE") {
    // Root CLAUDE.md becomes just the prefix
    relativePath = "";
  }

  // Add prefix
  if (relativePath) {
    return `${prefix}/${relativePath}`;
  } else {
    return prefix;
  }
}

/**
 * Main upload function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (!options.docId) {
    console.error("Error: --docId is required (e.g., --docId wiki-dee2d06f-d2cf-49b4-8443-78272f58a206)");
    process.exit(1);
  }

  console.log(`\nUploading cooking wiki to ${options.docId}`);
  console.log(`Source: ${options.sourceDir}`);
  console.log(`Prefix: ${options.prefix}/`);
  console.log("");

  // Find all markdown files
  const files = findMarkdownFiles(options.sourceDir);
  console.log(`Found ${files.length} markdown files\n`);

  // Connect to Y-Sweet (60 second timeout)
  console.log("Connecting to Y-Sweet...");
  const { doc, disconnect } = await connectToYSweet({
    auth_endpoint: options.authEndpoint,
    doc_id: options.docId,
    timeout_ms: 60000,
  });

  // Wait a bit for initial sync
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const wikiManager = new WikiDocumentManager(doc);
  const wikiId = options.docId.replace(/^wiki-/, "");

  let success = 0;
  let failed = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const wikiPath = filePathToWikiPath(filePath, options.sourceDir, options.prefix);

      try {
        // Read file content
        const content = fs.readFileSync(filePath, "utf-8");

        // Create page
        const page = wikiManager.createPage(wikiPath, wikiId);

        // Set content from markdown
        await setPageFromMarkdown(doc, page.id, content);

        success++;
        console.log(`[${i + 1}/${files.length}] ${wikiPath}`);

        // Small delay to allow sync
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        failed++;
        console.error(`[${i + 1}/${files.length}] FAILED: ${wikiPath} - ${error.message}`);
      }
    }

    // Wait for final sync before disconnecting
    console.log("\nWaiting for sync...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

  } finally {
    disconnect();
  }

  console.log(`\nUpload complete!`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);
}

// Run the upload
main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
