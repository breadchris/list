#!/usr/bin/env npx tsx
/**
 * Omnivore Articles Typesense Indexer
 *
 * Indexes link articles from the Omnivore group to Typesense with content extraction.
 *
 * Usage:
 *   npx tsx scripts/index-omnivore-to-typesense.ts
 *   npx tsx scripts/index-omnivore-to-typesense.ts --dry-run
 *   npx tsx scripts/index-omnivore-to-typesense.ts --limit 10
 *   npx tsx scripts/index-omnivore-to-typesense.ts --skip-extraction
 *
 * Options:
 *   --dry-run          Show what would be done without making changes
 *   --limit N          Process only first N links
 *   --skip-extraction  Skip content extraction, only index existing content
 *   --recreate         Delete and recreate the Typesense collection
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TYPESENSE_HOST
 *   TYPESENSE_ADMIN_API_KEY
 *   LAMBDA_ENDPOINT (for content extraction)
 */

import { createClient } from "@supabase/supabase-js";
import Typesense from "typesense";
import { config } from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
config({ path: path.join(__dirname, "../.env.local") });

// =============================================================================
// Configuration
// =============================================================================

const OMNIVORE_GROUP_ID = "d69a7093-5378-4c97-9b87-4fe6e2f3eef2";
const COLLECTION_NAME = "omnivore_articles";
const BATCH_SIZE = 50;

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_EXTRACTION = args.includes("--skip-extraction");
const RECREATE_COLLECTION = args.includes("--recreate");
const limitIndex = args.findIndex((a) => a === "--limit");
const LIMIT = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;

// =============================================================================
// Types
// =============================================================================

interface ContentItem {
  id: string;
  type: string;
  data: string;
  metadata: Record<string, any> | null;
  group_id: string;
  user_id: string;
  created_at: string;
}

interface ArticleDocument {
  id: string;
  content_id: string;
  url: string;
  domain: string;
  title: string;
  content: string;
  created_at: number;
}

interface MarkdownResult {
  content_id: string;
  success: boolean;
  total_urls_found: number;
  urls_processed: number;
  markdown_children: Array<{
    id: string;
    type: string;
    data: string;
    metadata: any;
  }>;
  errors?: string[];
}

// =============================================================================
// Initialize Clients
// =============================================================================

function validateEnv() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TYPESENSE_HOST",
    "TYPESENSE_ADMIN_API_KEY",
  ];

  if (!SKIP_EXTRACTION) {
    required.push("LAMBDA_ENDPOINT");
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getTypesenseClient() {
  return new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST!,
        port: parseInt(process.env.TYPESENSE_PORT || "443"),
        protocol: process.env.TYPESENSE_PROTOCOL || "https",
      },
    ],
    apiKey: process.env.TYPESENSE_ADMIN_API_KEY!,
    connectionTimeoutSeconds: 10,
  });
}

// =============================================================================
// Typesense Schema
// =============================================================================

const articlesSchema = {
  name: COLLECTION_NAME,
  fields: [
    { name: "id", type: "string" as const },
    { name: "content_id", type: "string" as const },
    { name: "url", type: "string" as const },
    { name: "domain", type: "string" as const, facet: true },
    { name: "title", type: "string" as const },
    { name: "content", type: "string" as const },
    { name: "created_at", type: "int64" as const },
  ],
  default_sorting_field: "created_at",
};

async function ensureCollection(client: Typesense.Client) {
  try {
    if (RECREATE_COLLECTION) {
      try {
        await client.collections(COLLECTION_NAME).delete();
        console.log("Deleted existing collection");
      } catch (e: any) {
        if (e.httpStatus !== 404) throw e;
      }
    }

    // Check if collection exists
    try {
      await client.collections(COLLECTION_NAME).retrieve();
      console.log("Collection exists");
      return;
    } catch (e: any) {
      if (e.httpStatus !== 404) throw e;
    }

    // Create collection
    await client.collections().create(articlesSchema);
    console.log("Created collection:", COLLECTION_NAME);
  } catch (error) {
    console.error("Error ensuring collection:", error);
    throw error;
  }
}

// =============================================================================
// Content Extraction
// =============================================================================

async function extractMarkdownViaLambda(
  content: ContentItem[]
): Promise<MarkdownResult[]> {
  const endpoint = process.env.LAMBDA_ENDPOINT!;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "markdown-extract",
      payload: {
        selectedContent: content.map((c) => ({
          id: c.id,
          type: c.type,
          data: c.data,
          metadata: c.metadata,
          group_id: c.group_id,
          user_id: c.user_id,
        })),
      },
      sync: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lambda request failed: ${response.status} - ${text}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Markdown extraction failed");
  }

  return result.data || [];
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function extractTitleFromMarkdown(markdown: string): string {
  // Try to find first heading
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Try to find title in first non-empty line
  const lines = markdown.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    // Clean up the first line
    const firstLine = lines[0].replace(/^[#*_\-]+\s*/, "").trim();
    if (firstLine.length > 0 && firstLine.length < 200) {
      return firstLine;
    }
  }

  return "Untitled";
}

// =============================================================================
// Main Indexing Logic
// =============================================================================

async function fetchOmnivoreLinks(
  supabase: ReturnType<typeof createClient>
): Promise<ContentItem[]> {
  console.log("Fetching links from Omnivore group...");

  let query = supabase
    .from("content")
    .select("id, type, data, metadata, group_id, user_id, created_at")
    .eq("group_id", OMNIVORE_GROUP_ID)
    .eq("type", "link")
    .order("created_at", { ascending: false });

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch content: ${error.message}`);
  }

  console.log(`Found ${data?.length || 0} links`);
  return data || [];
}

async function fetchExistingMarkdownChildren(
  supabase: ReturnType<typeof createClient>,
  parentIds: string[]
): Promise<Map<string, ContentItem>> {
  // Fetch markdown children for these parent IDs
  const { data, error } = await supabase
    .from("content")
    .select("id, type, data, metadata, group_id, user_id, created_at, parent_content_id")
    .eq("type", "markdown")
    .in("parent_content_id", parentIds);

  if (error) {
    console.warn("Failed to fetch markdown children:", error.message);
    return new Map();
  }

  // Map by parent_content_id
  const map = new Map<string, ContentItem>();
  for (const item of data || []) {
    if (item.parent_content_id) {
      map.set(item.parent_content_id, item as unknown as ContentItem);
    }
  }

  return map;
}

async function processAndIndexBatch(
  supabase: ReturnType<typeof createClient>,
  typesense: Typesense.Client,
  links: ContentItem[],
  batchNum: number,
  totalBatches: number
): Promise<{ indexed: number; errors: number }> {
  console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${links.length} links)...`);

  const documents: ArticleDocument[] = [];
  let errors = 0;

  // Check for existing markdown children
  const existingMarkdown = await fetchExistingMarkdownChildren(
    supabase,
    links.map((l) => l.id)
  );

  // Links that need extraction
  const needsExtraction = SKIP_EXTRACTION
    ? []
    : links.filter((l) => !existingMarkdown.has(l.id));

  if (needsExtraction.length > 0 && !DRY_RUN) {
    console.log(`  Extracting markdown for ${needsExtraction.length} URLs...`);

    try {
      // Process in smaller sub-batches to avoid timeout
      const SUB_BATCH_SIZE = 5;
      for (let i = 0; i < needsExtraction.length; i += SUB_BATCH_SIZE) {
        const subBatch = needsExtraction.slice(i, i + SUB_BATCH_SIZE);
        console.log(`    Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1}/${Math.ceil(needsExtraction.length / SUB_BATCH_SIZE)}`);

        try {
          const results = await extractMarkdownViaLambda(subBatch);

          // Update existingMarkdown with new results
          for (const result of results) {
            if (result.success && result.markdown_children.length > 0) {
              const child = result.markdown_children[0];
              existingMarkdown.set(result.content_id, {
                id: child.id,
                type: child.type,
                data: child.data,
                metadata: child.metadata,
                group_id: "",
                user_id: "",
                created_at: new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          console.warn(`    Sub-batch extraction failed:`, e);
          errors += subBatch.length;
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      console.warn("  Batch extraction failed:", e);
      errors += needsExtraction.length;
    }
  }

  // Build documents for indexing
  for (const link of links) {
    const markdown = existingMarkdown.get(link.id);

    if (!markdown && !SKIP_EXTRACTION) {
      // Still no markdown after extraction attempt
      errors++;
      continue;
    }

    const content = markdown?.data || "";
    const title =
      link.metadata?.title ||
      markdown?.metadata?.title ||
      extractTitleFromMarkdown(content) ||
      "Untitled";

    const doc: ArticleDocument = {
      id: link.id,
      content_id: link.id,
      url: link.data,
      domain: extractDomain(link.data),
      title: title.substring(0, 500), // Truncate long titles
      content: content.substring(0, 100000), // Truncate very long content
      created_at: new Date(link.created_at).getTime(),
    };

    documents.push(doc);
  }

  // Index to Typesense
  if (documents.length > 0 && !DRY_RUN) {
    try {
      const results = await typesense
        .collections(COLLECTION_NAME)
        .documents()
        .import(documents, { action: "upsert" });

      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success);

      if (failed.length > 0) {
        console.log(`  Indexed ${successful}, failed ${failed.length}`);
        errors += failed.length;
      } else {
        console.log(`  Indexed ${successful} documents`);
      }

      return { indexed: successful, errors };
    } catch (e) {
      console.error("  Typesense import failed:", e);
      return { indexed: 0, errors: documents.length };
    }
  }

  console.log(`  Would index ${documents.length} documents (dry-run)`);
  return { indexed: DRY_RUN ? 0 : documents.length, errors };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Omnivore Articles Typesense Indexer");
  console.log("=".repeat(60));

  if (DRY_RUN) console.log("DRY RUN MODE - no changes will be made");
  if (SKIP_EXTRACTION) console.log("SKIP EXTRACTION - using existing markdown only");
  if (LIMIT) console.log(`LIMIT: ${LIMIT} links`);
  if (RECREATE_COLLECTION) console.log("RECREATE COLLECTION");

  validateEnv();

  const supabase = getSupabaseClient();
  const typesense = getTypesenseClient();

  // Ensure collection exists
  if (!DRY_RUN) {
    await ensureCollection(typesense);
  }

  // Fetch all links
  const links = await fetchOmnivoreLinks(supabase);

  if (links.length === 0) {
    console.log("No links to process");
    return;
  }

  // Process in batches
  const totalBatches = Math.ceil(links.length / BATCH_SIZE);
  let totalIndexed = 0;
  let totalErrors = 0;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { indexed, errors } = await processAndIndexBatch(
      supabase,
      typesense,
      batch,
      batchNum,
      totalBatches
    );

    totalIndexed += indexed;
    totalErrors += errors;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Total links: ${links.length}`);
  console.log(`  Indexed: ${totalIndexed}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log("=".repeat(60));

  // Show collection stats
  if (!DRY_RUN) {
    try {
      const collection = await typesense.collections(COLLECTION_NAME).retrieve();
      console.log(`\nCollection '${COLLECTION_NAME}' stats:`);
      console.log(`  Documents: ${collection.num_documents}`);
    } catch (e) {
      // Ignore
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
