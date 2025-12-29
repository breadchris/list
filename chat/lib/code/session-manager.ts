/**
 * Session Manager for Code App
 *
 * Handles session persistence to Supabase Storage.
 * Sessions are stored as ZIP files containing:
 * - Workspace files (Component.tsx, etc.)
 * - Claude CLI session data (prefixed with .session/)
 */

import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

export interface SessionFile {
  path: string;
  content: Uint8Array;
}

export class SessionManager {
  private supabase;
  private bucket = "code-sessions";

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Download and decompress a session from Supabase Storage
   */
  async downloadSession(sessionId: string): Promise<SessionFile[]> {
    console.log(`Downloading session: ${sessionId}`);

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(`${sessionId}.zip`);

    if (error) {
      console.warn(`Session download error: ${error.message}`);
      return [];
    }

    if (!data) {
      console.warn(`No data for session: ${sessionId}`);
      return [];
    }

    // Decompress using JSZip
    const zip = await JSZip.loadAsync(await data.arrayBuffer());
    const files: SessionFile[] = [];

    for (const [path, entry] of Object.entries(zip.files)) {
      if (!entry.dir) {
        const content = await entry.async("uint8array");
        files.push({ path, content });
      }
    }

    console.log(`Downloaded ${files.length} files from session ${sessionId}`);
    return files;
  }

  /**
   * Compress and upload a session to Supabase Storage
   */
  async uploadSession(sessionId: string, files: SessionFile[]): Promise<void> {
    console.log(`Uploading session: ${sessionId} with ${files.length} files`);

    const zip = new JSZip();

    for (const file of files) {
      if (file && file.path && file.content) {
        zip.file(file.path, file.content);
      }
    }

    // Add placeholder if no files (to ensure valid zip)
    if (files.length === 0) {
      zip.file(
        "session.json",
        JSON.stringify({
          session_id: sessionId,
          created_at: new Date().toISOString(),
        })
      );
    }

    const zipBlob = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(`${sessionId}.zip`, zipBlob, {
        upsert: true,
        contentType: "application/zip",
      });

    if (error) {
      console.error(`Session upload error: ${error.message}`);
      throw error;
    }

    console.log(`Session ${sessionId} uploaded successfully`);
  }

  /**
   * Check if a session exists in Supabase Storage
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list("", { search: `${sessionId}.zip` });

    if (error) {
      console.warn(`Session exists check error: ${error.message}`);
      return false;
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Delete a session from Supabase Storage
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([`${sessionId}.zip`]);

    if (error) {
      console.error(`Session delete error: ${error.message}`);
      throw error;
    }

    console.log(`Session ${sessionId} deleted`);
  }
}
