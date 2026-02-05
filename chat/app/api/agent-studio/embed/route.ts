import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { CollectionConfig } from "@/types/agent-studio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Split text into chunks using recursive character splitting
 */
function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  strategy: CollectionConfig["chunk_strategy"]
): string[] {
  const chunks: string[] = [];

  if (strategy === "sentence") {
    // Split by sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep overlap from previous chunk
        const words = currentChunk.split(" ");
        currentChunk = words.slice(-Math.ceil(chunkOverlap / 10)).join(" ") + " " + sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  } else if (strategy === "paragraph") {
    // Split by paragraphs
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = "";

    for (const para of paragraphs) {
      if ((currentChunk + para).length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  } else {
    // Recursive character splitting (default)
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunkEnd = end;

      // Try to find a good break point (newline, sentence end, or space)
      if (end < text.length) {
        const searchStart = Math.max(end - 100, start);
        const searchText = text.slice(searchStart, end);

        // Look for paragraph break
        const paraBreak = searchText.lastIndexOf("\n\n");
        if (paraBreak > 0) {
          chunkEnd = searchStart + paraBreak;
        } else {
          // Look for sentence break
          const sentenceBreak = Math.max(
            searchText.lastIndexOf(". "),
            searchText.lastIndexOf("! "),
            searchText.lastIndexOf("? ")
          );
          if (sentenceBreak > 0) {
            chunkEnd = searchStart + sentenceBreak + 2;
          } else {
            // Look for word break
            const wordBreak = searchText.lastIndexOf(" ");
            if (wordBreak > 0) {
              chunkEnd = searchStart + wordBreak;
            }
          }
        }
      }

      const chunk = text.slice(start, chunkEnd).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      // Calculate next start position with overlap
      const nextStart = chunkEnd - chunkOverlap;
      // Ensure we always make forward progress to avoid infinite loops
      if (nextStart <= start) {
        start = chunkEnd;
      } else {
        start = nextStart;
      }
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Generate embeddings for text using OpenAI via AI SDK
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collection_id,
      file_content,
      filename,
      file_type,
      config,
    } = body as {
      collection_id: string;
      file_content: string;
      filename: string;
      file_type: "text" | "markdown" | "pdf";
      config: CollectionConfig;
    };

    if (!collection_id || !file_content || !filename) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the collection to verify it exists and get group_id/user_id
    const { data: collection, error: collectionError } = await supabase
      .from("content")
      .select("*")
      .eq("id", collection_id)
      .eq("type", "agent-collection")
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Process based on file type
    let textContent = file_content;

    // For markdown, we could add special handling but for now treat as text
    // PDF support would require a PDF parser library

    // Chunk the text
    const chunks = chunkText(
      textContent,
      config.chunk_size,
      config.chunk_overlap,
      config.chunk_strategy
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No content to process" },
        { status: 400 }
      );
    }

    // Generate embeddings and store chunks
    const storedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];

      // Generate embedding
      const embedding = await generateEmbedding(chunkText);

      // Store chunk
      const { data: storedChunk, error: storeError } = await supabase
        .from("content")
        .insert({
          type: "agent-chunk",
          data: chunkText,
          group_id: collection.group_id,
          user_id: collection.user_id,
          parent_content_id: collection_id,
          metadata: {
            chunk_index: i,
            embedding,
            source_filename: filename,
          },
        })
        .select()
        .single();

      if (storeError) {
        console.error("Error storing chunk:", storeError);
        continue;
      }

      storedChunks.push(storedChunk);
    }

    // Update collection chunk count
    const { data: allChunks } = await supabase
      .from("content")
      .select("id")
      .eq("type", "agent-chunk")
      .eq("parent_content_id", collection_id);

    await supabase
      .from("content")
      .update({
        metadata: {
          ...collection.metadata,
          chunk_count: allChunks?.length || 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", collection_id);

    return NextResponse.json({
      success: true,
      chunks_created: storedChunks.length,
      chunks: storedChunks,
    });
  } catch (error) {
    console.error("Embed API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process document" },
      { status: 500 }
    );
  }
}
