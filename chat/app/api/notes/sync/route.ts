import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Sync endpoint for notes - updates the content row's metadata.yjs_state
 * with the full encoded Y.Doc state
 */
export async function POST(request: NextRequest) {
  try {
    const { note_id, yjs_state, client_id } = await request.json();

    if (!note_id || !yjs_state || !client_id) {
      return NextResponse.json(
        { error: "Missing required fields: note_id, yjs_state, client_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current metadata to merge
    const { data: currentNote, error: fetchError } = await supabase
      .from("content")
      .select("metadata")
      .eq("id", note_id)
      .eq("type", "note")
      .single();

    if (fetchError) {
      console.error("Failed to fetch note:", fetchError);
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    // Merge new yjs_state into existing metadata
    const currentMetadata = currentNote.metadata || {};
    const newMetadata = {
      ...currentMetadata,
      yjs_state,
      client_id,
    };

    // Update the content row
    const { error: updateError } = await supabase
      .from("content")
      .update({
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", note_id)
      .eq("type", "note");

    if (updateError) {
      console.error("Failed to update note:", updateError);
      return NextResponse.json(
        { error: "Failed to sync note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
