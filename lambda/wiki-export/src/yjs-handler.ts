/**
 * Y.js Document Export Handler
 * Uses Y-Sweet SDK to fetch document and BlockNote server utils to convert to blocks
 */

import { DocumentManager } from '@y-sweet/sdk';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import * as Y from 'yjs';
import { wikiServerSchema } from './wiki-server-schema.js';
import { createClient } from '@supabase/supabase-js';

export interface YjsExportPayload {
  doc_id: string;
  page_ids?: string[];
  /** Optional - if not provided, Lambda reads wiki-pages Map directly from Y.js */
  pages?: Array<{ id: string; path: string; title: string }>;
  format: 'html_full' | 'html_lossy' | 'markdown' | 'all';
  /** If provided, Lambda stores backup directly in Supabase and returns just metadata */
  store_backup?: {
    wiki_id: string;
    group_id: string;
    wiki_title: string;
    user_id: string;
    trigger: 'manual' | 'auto';
  };
}

export interface PageExportResult {
  path: string;
  title: string;
  html: string;
  markdown: string;
  error?: string;
}

export interface YjsExportResponse {
  success: boolean;
  data?: {
    pages: PageExportResult[];
    /** Only present when store_backup was used */
    backup_id?: string;
    page_count?: number;
  };
  error?: string;
}

/**
 * Export pages from a Y.js document using Y-Sweet
 */
export async function handleYjsExport(payload: YjsExportPayload): Promise<YjsExportResponse> {
  const connectionString = process.env.CONNECTION_STRING;

  if (!connectionString) {
    return {
      success: false,
      error: 'CONNECTION_STRING environment variable not set',
    };
  }

  if (!payload.doc_id) {
    return {
      success: false,
      error: 'doc_id is required',
    };
  }

  try {
    console.log(`[YjsExport] Connecting to doc: ${payload.doc_id}`);

    // Connect to Y-Sweet and get document as update
    const manager = new DocumentManager(connectionString);
    const update = await manager.getDocAsUpdate(payload.doc_id);

    if (!update) {
      return {
        success: false,
        error: `Document not found: ${payload.doc_id}`,
      };
    }

    console.log(`[YjsExport] Got document update, size: ${update.length} bytes`);

    // Create Y.Doc and apply update
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);

    // Determine pages to export
    let pages: Array<{ id: string; path: string; title: string }>;

    if (payload.pages && payload.pages.length > 0) {
      // Use provided pages (backward compatible)
      pages = payload.pages;
      console.log(`[YjsExport] Using ${pages.length} pages from payload`);
    } else {
      // Read pages directly from Y.js wiki-pages Map
      const pagesMap = doc.getMap<any>('wiki-pages');
      pages = [];

      pagesMap.forEach((page, path) => {
        pages.push({
          id: page.id,
          path: page.path || path,
          title: page.title || path,
        });
      });

      console.log(`[YjsExport] Found ${pages.length} pages in wiki-pages Map`);

      if (pages.length === 0) {
        doc.destroy();
        return {
          success: false,
          error: 'No pages found in wiki-pages Map',
        };
      }
    }

    // Create BlockNote editor for exports
    const editor = ServerBlockNoteEditor.create({
      schema: wikiServerSchema,
    });

    // Export each page
    const results: PageExportResult[] = [];

    for (const page of pages) {
      try {
        // Get the fragment for this page
        const fragmentName = `wiki-page-${page.id}`;
        const fragment = doc.getXmlFragment(fragmentName);

        // Check if fragment has content
        if (fragment.length === 0) {
          console.log(`[YjsExport] Page ${page.path} (${page.id}) has no content`);
          results.push({
            path: page.path,
            title: page.title,
            html: '',
            markdown: '',
          });
          continue;
        }

        console.log(`[YjsExport] Converting page ${page.path} (${page.id}), fragment length: ${fragment.length}`);

        // Convert Y.XmlFragment to BlockNote blocks using editor instance method
        const blocks = editor.yXmlFragmentToBlocks(fragment);

        if (!blocks || blocks.length === 0) {
          console.log(`[YjsExport] Page ${page.path} converted to empty blocks`);
          results.push({
            path: page.path,
            title: page.title,
            html: '',
            markdown: '',
          });
          continue;
        }

        console.log(`[YjsExport] Page ${page.path} has ${blocks.length} blocks`);

        // Export to HTML and Markdown
        const html = await editor.blocksToFullHTML(blocks);
        const markdown = await editor.blocksToMarkdownLossy(blocks);

        results.push({
          path: page.path,
          title: page.title,
          html,
          markdown,
        });
      } catch (pageError: any) {
        console.error(`[YjsExport] Error exporting page ${page.path}:`, pageError);
        results.push({
          path: page.path,
          title: page.title,
          html: '',
          markdown: '',
          error: pageError.message,
        });
      }
    }

    // Cleanup
    doc.destroy();

    const successCount = results.filter(r => !r.error && (r.html || r.markdown)).length;
    console.log(`[YjsExport] Successfully exported ${successCount}/${results.length} pages`);

    // If store_backup is provided, store directly in Supabase and return just metadata
    if (payload.store_backup) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return {
          success: false,
          error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required for store_backup',
        };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Filter to pages with content - only store markdown to reduce size
      const exportedPages = results
        .filter(r => !r.error && (r.html || r.markdown))
        .map(r => ({
          path: r.path,
          title: r.title,
          markdown: r.markdown,
        }));

      if (exportedPages.length === 0) {
        return {
          success: false,
          error: 'No pages were successfully exported',
        };
      }

      // Create backup data structure matching WikiBackupData type
      const backupData = {
        pages: exportedPages,
      };

      // Create backup metadata matching WikiBackupMetadata type
      const backupMetadata = {
        wiki_id: payload.store_backup.wiki_id,
        wiki_title: payload.store_backup.wiki_title,
        backup_date: new Date().toISOString().split('T')[0],
        page_count: exportedPages.length,
        trigger: payload.store_backup.trigger,
      };

      console.log(`[YjsExport] Storing backup in Supabase: ${exportedPages.length} pages`);

      const { data: insertData, error: insertError } = await supabase
        .from('content')
        .insert({
          type: 'wiki_backup',
          data: JSON.stringify(backupData),
          group_id: payload.store_backup.group_id,
          user_id: payload.store_backup.user_id,
          parent_content_id: payload.store_backup.wiki_id,
          metadata: backupMetadata,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[YjsExport] Supabase insert error:', insertError);
        return {
          success: false,
          error: `Failed to store backup: ${insertError.message}`,
        };
      }

      console.log(`[YjsExport] Backup stored successfully: ${insertData.id}`);

      return {
        success: true,
        data: {
          pages: [], // Don't return full pages when storing directly
          backup_id: insertData.id,
          page_count: exportedPages.length,
        },
      };
    }

    // Return full pages if not storing directly (for backwards compatibility)
    return {
      success: true,
      data: {
        pages: results,
      },
    };
  } catch (error: any) {
    console.error('[YjsExport] Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during Y.js export',
    };
  }
}
