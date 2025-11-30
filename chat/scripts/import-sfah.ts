#!/usr/bin/env npx tsx
/**
 * SFAH (Salt, Fat, Acid, Heat) Book Import Script
 *
 * This script:
 * 1. Uploads 192 images to Supabase Storage
 * 2. Parses 25 markdown chapters into fine-grained messages
 * 3. Generates Y.js-compatible import data for the chat interface
 *
 * Usage: npx tsx chat/scripts/import-sfah.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Configuration
// =============================================================================

const SFAH_DIR = "/Users/hacked/Downloads/sfah";
const MARKDOWN_DIR = path.join(SFAH_DIR, "markdown", "chapters");
const IMAGES_DIR = path.join(SFAH_DIR, "markdown", "images");
const OUTPUT_FILE = path.join(
  "/Users/hacked/Documents/GitHub/list/chat/scripts",
  "sfah-import-data.json"
);

const SUPABASE_URL = "https://zazsrepfnamdmibcyenx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM";

const BUCKET_NAME = "sfah-images";

// =============================================================================
// Types
// =============================================================================

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  thread_ids?: string[];
}

interface Thread {
  id: string;
  parent_message_id: string;
  message_ids: string[];
}

interface ImportData {
  root_thread_title: string;
  messages: Message[];
  threads: Thread[];
  metadata: {
    total_chapters: number;
    total_sections: number;
    total_messages: number;
    total_images: number;
    imported_at: string;
  };
}

interface ChapterInfo {
  filename: string;
  title: string;
  order: number;
}

// =============================================================================
// Chapter Configuration
// =============================================================================

const CHAPTER_ORDER: ChapterInfo[] = [
  { filename: "cover.md", title: "Cover", order: 0 },
  { filename: "01-praise.md", title: "Praise", order: 1 },
  { filename: "02-title.md", title: "Title Page", order: 2 },
  { filename: "03-copyright.md", title: "Copyright", order: 3 },
  { filename: "04-dedication.md", title: "Dedication", order: 4 },
  { filename: "06-contents.md", title: "Contents", order: 5 },
  { filename: "07-foreword.md", title: "Foreword", order: 6 },
  { filename: "08-introduction.md", title: "Introduction", order: 7 },
  { filename: "09-how-to-use.md", title: "How to Use This Book", order: 8 },
  { filename: "10-part-one.md", title: "Part One", order: 9 },
  { filename: "11-salt.md", title: "Salt", order: 10 },
  { filename: "12-fat.md", title: "Fat", order: 11 },
  { filename: "13-acid.md", title: "Acid", order: 12 },
  { filename: "14-heat.md", title: "Heat", order: 13 },
  { filename: "15-what-to-cook.md", title: "What to Cook", order: 14 },
  { filename: "16-part-two.md", title: "Part Two", order: 15 },
  { filename: "17-kitchen-basics.md", title: "Kitchen Basics", order: 16 },
  { filename: "18-recipes.md", title: "Recipes", order: 17 },
  {
    filename: "18a-recipes-continued.md",
    title: "Recipes (Continued)",
    order: 18,
  },
  { filename: "19-cooking-lessons.md", title: "Cooking Lessons", order: 19 },
  { filename: "20-suggested-menus.md", title: "Suggested Menus", order: 20 },
  {
    filename: "21-further-reading.md",
    title: "Tips for Further Reading",
    order: 21,
  },
  { filename: "22-acknowledgements.md", title: "Acknowledgements", order: 22 },
  { filename: "23-bibliography.md", title: "Bibliography", order: 23 },
  { filename: "24-index.md", title: "Index", order: 24 },
  { filename: "26-about.md", title: "About the Author", order: 25 },
];

// =============================================================================
// Supabase Client
// =============================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================================================
// Helper Functions
// =============================================================================

let messageCounter = 0;
let threadCounter = 0;

function generateMessageId(): string {
  messageCounter++;
  const timestamp = Date.now() + messageCounter;
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
}

function generateThreadId(): string {
  threadCounter++;
  const timestamp = Date.now() + threadCounter;
  const random = Math.random().toString(36).substr(2, 9);
  return `thread-${timestamp}-${random}`;
}

function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

// =============================================================================
// Image Upload Functions
// =============================================================================

async function ensureBucketExists(): Promise<boolean> {
  console.log(`\nChecking if bucket "${BUCKET_NAME}" exists...`);

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error("Error listing buckets:", error.message);
    return false;
  }

  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (bucketExists) {
    console.log(`Bucket "${BUCKET_NAME}" already exists.`);
    return true;
  }

  console.log(`Creating bucket "${BUCKET_NAME}"...`);
  const { error: createError } = await supabase.storage.createBucket(
    BUCKET_NAME,
    {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    }
  );

  if (createError) {
    // Bucket might already exist (race condition) or we don't have permission
    if (createError.message.includes("already exists")) {
      console.log("Bucket already exists (created by another process).");
      return true;
    }
    console.error("Error creating bucket:", createError.message);
    console.log(
      "\nNote: You may need to create the bucket manually in Supabase Dashboard:"
    );
    console.log("1. Go to Storage > Create Bucket");
    console.log(`2. Name: ${BUCKET_NAME}`);
    console.log("3. Public: Yes");
    return false;
  }

  console.log(`Bucket "${BUCKET_NAME}" created successfully.`);
  return true;
}

async function uploadImages(): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  console.log("\n=== Uploading Images to Supabase Storage ===\n");

  // Check if bucket exists
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    console.log("\nSkipping image upload - bucket not available.");
    console.log("Images will use local file:// paths instead.\n");
    return urlMap;
  }

  // Get list of images
  const imageFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f));

  console.log(`Found ${imageFiles.length} images to upload.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of imageFiles) {
    const filepath = path.join(IMAGES_DIR, filename);
    const fileBuffer = fs.readFileSync(filepath);

    // Check if already uploaded
    const { data: existing } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", { search: filename });

    if (existing && existing.length > 0) {
      // Already uploaded, get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

      urlMap.set(filename, publicUrl);
      skipped++;
      process.stdout.write(`\rProgress: ${uploaded + skipped}/${imageFiles.length} (${skipped} cached)`);
      continue;
    }

    // Upload the image
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, fileBuffer, {
        contentType: filename.endsWith(".png") ? "image/png" : "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error(`\nFailed to upload ${filename}:`, error.message);
      failed++;
      continue;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

    urlMap.set(filename, publicUrl);
    uploaded++;
    process.stdout.write(`\rProgress: ${uploaded + skipped}/${imageFiles.length} (${uploaded} new, ${skipped} cached)`);
  }

  console.log(`\n\nUpload complete: ${uploaded} new, ${skipped} cached, ${failed} failed.`);

  return urlMap;
}

// =============================================================================
// Markdown Parsing Functions
// =============================================================================

interface ParsedContent {
  type: "text" | "image" | "header";
  content: string;
}

function parseMarkdownContent(
  markdown: string,
  imageUrlMap: Map<string, string>
): ParsedContent[] {
  const results: ParsedContent[] = [];

  // Split into lines for processing
  const lines = markdown.split("\n");
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("\n").trim();
      if (text) {
        results.push({ type: "text", content: text });
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for image
    const imageMatch = trimmedLine.match(/!\[.*?\]\((\.\.\/images\/([^)]+))\)/);
    if (imageMatch) {
      flushParagraph();
      const imageName = imageMatch[2];
      const imageUrl =
        imageUrlMap.get(imageName) || `file://${IMAGES_DIR}/${imageName}`;
      results.push({ type: "image", content: imageUrl });
      continue;
    }

    // Check for section header (ALL CAPS with optional ? at end)
    if (
      trimmedLine.length > 3 &&
      trimmedLine === trimmedLine.toUpperCase() &&
      /^[A-Z][A-Z\s,\-'?!]+$/.test(trimmedLine)
    ) {
      flushParagraph();
      results.push({ type: "header", content: trimmedLine });
      continue;
    }

    // Check for markdown header
    if (trimmedLine.startsWith("#")) {
      flushParagraph();
      const headerText = trimmedLine.replace(/^#+\s*/, "");
      results.push({ type: "header", content: headerText });
      continue;
    }

    // Empty line = paragraph break
    if (trimmedLine === "") {
      flushParagraph();
      continue;
    }

    // Regular text - add to current paragraph
    currentParagraph.push(line);
  }

  flushParagraph();

  return results;
}

// =============================================================================
// Main Import Function
// =============================================================================

async function importSFAH(): Promise<void> {
  console.log("===========================================");
  console.log("  SFAH Book Import Script");
  console.log("===========================================\n");

  // Step 1: Upload images
  const imageUrlMap = await uploadImages();

  // Step 2: Parse chapters and build import structure
  console.log("\n=== Parsing Markdown Chapters ===\n");

  const allMessages: Message[] = [];
  const allThreads: Thread[] = [];
  const timestamp = getCurrentTime();

  // Create root message for "sfah" thread
  const rootMessage: Message = {
    id: generateMessageId(),
    username: "system",
    timestamp,
    content: "**Salt, Fat, Acid, Heat**\n\nby Samin Nosrat\n\nIllustrated by Wendy MacNaughton",
    thread_ids: [],
  };
  allMessages.push(rootMessage);

  // Process each chapter
  let totalSections = 0;
  let totalImages = 0;

  for (const chapter of CHAPTER_ORDER) {
    const filepath = path.join(MARKDOWN_DIR, chapter.filename);

    if (!fs.existsSync(filepath)) {
      console.log(`  Skipping ${chapter.filename} (not found)`);
      continue;
    }

    console.log(`  Processing: ${chapter.title}`);

    const markdown = fs.readFileSync(filepath, "utf-8");
    const parsedContent = parseMarkdownContent(markdown, imageUrlMap);

    if (parsedContent.length === 0) {
      continue;
    }

    // Create a chapter message that starts a thread
    const chapterMessage: Message = {
      id: generateMessageId(),
      username: "sfah",
      timestamp,
      content: `## ${chapter.title}`,
      thread_ids: [],
    };
    allMessages.push(chapterMessage);

    // Create thread for this chapter
    const chapterThread: Thread = {
      id: generateThreadId(),
      parent_message_id: chapterMessage.id,
      message_ids: [chapterMessage.id],
    };

    // Track current section for sub-threading
    let currentSectionThread: Thread | null = null;
    let currentSectionMessage: Message | null = null;

    for (const content of parsedContent) {
      if (content.type === "header") {
        totalSections++;

        // Create section message
        const sectionMessage: Message = {
          id: generateMessageId(),
          username: "sfah",
          timestamp,
          content: `### ${content.content}`,
          thread_ids: [],
        };
        allMessages.push(sectionMessage);

        // Add to chapter thread
        chapterThread.message_ids.push(sectionMessage.id);

        // Create sub-thread for this section
        currentSectionThread = {
          id: generateThreadId(),
          parent_message_id: sectionMessage.id,
          message_ids: [sectionMessage.id],
        };
        currentSectionMessage = sectionMessage;

        // Link thread to message
        sectionMessage.thread_ids = [currentSectionThread.id];
        allThreads.push(currentSectionThread);
      } else if (content.type === "image") {
        totalImages++;

        const imageMessage: Message = {
          id: generateMessageId(),
          username: "sfah",
          timestamp,
          content: `![SFAH Illustration](${content.content})`,
          thread_ids: [],
        };
        allMessages.push(imageMessage);

        // Add to current section thread or chapter thread
        if (currentSectionThread) {
          currentSectionThread.message_ids.push(imageMessage.id);
        } else {
          chapterThread.message_ids.push(imageMessage.id);
        }
      } else if (content.type === "text") {
        // Split long text into smaller messages (max ~500 chars per message)
        const chunks = splitTextIntoChunks(content.content, 500);

        for (const chunk of chunks) {
          const textMessage: Message = {
            id: generateMessageId(),
            username: "sfah",
            timestamp,
            content: chunk,
            thread_ids: [],
          };
          allMessages.push(textMessage);

          // Add to current section thread or chapter thread
          if (currentSectionThread) {
            currentSectionThread.message_ids.push(textMessage.id);
          } else {
            chapterThread.message_ids.push(textMessage.id);
          }
        }
      }
    }

    // Link chapter thread to chapter message
    chapterMessage.thread_ids = [chapterThread.id];
    allThreads.push(chapterThread);
  }

  // Step 3: Write output file
  console.log("\n=== Writing Import Data ===\n");

  const importData: ImportData = {
    root_thread_title: "sfah",
    messages: allMessages,
    threads: allThreads,
    metadata: {
      total_chapters: CHAPTER_ORDER.length,
      total_sections: totalSections,
      total_messages: allMessages.length,
      total_images: totalImages,
      imported_at: new Date().toISOString(),
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importData, null, 2));

  console.log(`Output written to: ${OUTPUT_FILE}`);
  console.log("\n=== Import Summary ===\n");
  console.log(`  Chapters: ${importData.metadata.total_chapters}`);
  console.log(`  Sections: ${importData.metadata.total_sections}`);
  console.log(`  Messages: ${importData.metadata.total_messages}`);
  console.log(`  Images: ${importData.metadata.total_images}`);
  console.log(`  Threads: ${allThreads.length}`);
  console.log("\n===========================================");
  console.log("  Import data ready!");
  console.log("  Next: Load sfah-import-data.json into the chat interface");
  console.log("===========================================\n");
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];

  // Split by sentences first
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If single sentence is too long, just add it as-is
      if (sentence.length > maxLength) {
        chunks.push(sentence);
        currentChunk = "";
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

// =============================================================================
// Run
// =============================================================================

importSFAH().catch(console.error);
