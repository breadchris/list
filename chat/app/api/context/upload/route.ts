import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const url = new URL(req.url);
    const uploadType = url.searchParams.get("type");
    const groupId = url.searchParams.get("groupId");

    const supabase = createServerSupabaseClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    let fileName: string;
    let contentType: string;

    if (uploadType === "editor-image") {
      const ext = (file as File).name?.split(".").pop() || "png";
      const folder = groupId ? `editor-images/${groupId}` : "editor-images";
      fileName = `${folder}/${crypto.randomUUID()}.${ext}`;
      contentType = (file as File).type || "image/png";
    } else {
      fileName = `context-avatars/${crypto.randomUUID()}.jpg`;
      contentType = "image/jpeg";
    }

    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(data.path);

    return NextResponse.json({ path: data.path, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Upload failed" },
      { status: 500 }
    );
  }
}
