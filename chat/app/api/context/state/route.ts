import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Generic state management endpoint for context app components.
 * Maps component state to content table entries.
 *
 * Query params:
 *   - type: content type slug (e.g. "sandbox", "todo", "flow", "editor")
 *   - sessionId: optional session identifier for per-session state
 *   - groupId: required group identifier
 *   - userId: required user identifier
 *
 * GET: Retrieve state
 * POST: Save state (body: { value: any } or { sessionId, value })
 */

function contentType(slug: string): string {
  return `context-${slug}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const sessionId = searchParams.get("sessionId");
  const groupId = searchParams.get("groupId");

  if (!type || !groupId) {
    return NextResponse.json(
      { error: "Missing type or groupId" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const fullType = contentType(type);

  let query = supabase
    .from("content")
    .select("*")
    .eq("group_id", groupId)
    .eq("type", fullType);

  if (sessionId) {
    query = query.contains("metadata", { session_id: sessionId });
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("State GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ value: null });
  }

  // The value is stored in data field as JSON string, metadata has extra info
  try {
    const value = JSON.parse(data.data);
    return NextResponse.json({ value, id: data.id });
  } catch {
    return NextResponse.json({ value: data.data, id: data.id });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const userId = searchParams.get("userId");

  if (!type || !groupId || !userId) {
    return NextResponse.json(
      { error: "Missing type, groupId, or userId" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const sessionId = body.sessionId || searchParams.get("sessionId");
  const value = body.value !== undefined ? body.value : body;

  const supabase = createServerSupabaseClient();
  const fullType = contentType(type);
  const serializedValue = JSON.stringify(value);

  // Try to find existing entry to update
  let existingQuery = supabase
    .from("content")
    .select("id")
    .eq("group_id", groupId)
    .eq("type", fullType);

  if (sessionId) {
    existingQuery = existingQuery.contains("metadata", {
      session_id: sessionId,
    });
  }

  const { data: existing } = await existingQuery.limit(1).maybeSingle();

  if (existing) {
    // Update
    const { error } = await supabase
      .from("content")
      .update({
        data: serializedValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error("State POST update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: existing.id });
  } else {
    // Insert
    const metadata: Record<string, any> = {};
    if (sessionId) metadata.session_id = sessionId;

    const { data: inserted, error } = await supabase
      .from("content")
      .insert({
        type: fullType,
        data: serializedValue,
        group_id: groupId,
        user_id: userId,
        metadata,
      })
      .select("id")
      .single();

    if (error) {
      console.error("State POST insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  }
}
