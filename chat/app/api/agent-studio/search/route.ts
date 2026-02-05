import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collection_id, query, top_k = 5 } = body as {
      collection_id: string;
      query: string;
      top_k?: number;
    };

    if (!collection_id || !query) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate embedding for the query using AI SDK
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: query,
    });

    // Get all chunks for the collection
    const { data: chunks, error: chunksError } = await supabase
      .from("content")
      .select("*")
      .eq("type", "agent-chunk")
      .eq("parent_content_id", collection_id);

    if (chunksError) {
      console.error("Error fetching chunks:", chunksError);
      return NextResponse.json(
        { error: "Failed to fetch chunks" },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        results: [],
        message: "No chunks found in this collection",
      });
    }

    // Calculate similarity for each chunk
    const results = chunks
      .filter((chunk) => chunk.metadata?.embedding && chunk.metadata.embedding.length > 0)
      .map((chunk) => {
        const similarity = cosineSimilarity(queryEmbedding, chunk.metadata.embedding);
        return {
          id: chunk.id,
          text: chunk.data,
          similarity,
          source_filename: chunk.metadata.source_filename,
          chunk_index: chunk.metadata.chunk_index,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, top_k);

    return NextResponse.json({
      results,
      query,
      collection_id,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
