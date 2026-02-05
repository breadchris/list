/**
 * BlockNote Server-Side Export Handler
 * Minimal version for wiki export Lambda
 */

import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { wikiServerSchema } from './wiki-server-schema.js';

export interface BlockNoteExportPayload {
  blocks: any[];
  format: 'html_full' | 'html_lossy' | 'markdown' | 'all';
}

export interface BlockNoteExportResult {
  html_full?: string;
  html_lossy?: string;
  markdown?: string;
}

export interface ExportResponse {
  success: boolean;
  data?: BlockNoteExportResult;
  error?: string;
}

/**
 * Known block and inline content types from the wiki schema
 */
const KNOWN_BLOCK_TYPES = new Set(Object.keys(wikiServerSchema.blockSpecs));
const KNOWN_INLINE_TYPES = new Set(Object.keys(wikiServerSchema.inlineContentSpecs));

/**
 * Sanitize inline content array, converting unknown types to plain text
 */
function sanitizeInlineContent(content: any): any {
  if (!content) return content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;

  return content.map((item) => {
    if (typeof item === 'string') return item;
    if (!item || !item.type) return item;

    if (KNOWN_INLINE_TYPES.has(item.type)) return item;

    console.warn(`[BlockNote] Unknown inline type: ${item.type}, converting to text`);
    const displayText =
      item.props?.display_text || item.props?.text || item.text || `[${item.type}]`;
    return {
      type: 'text',
      text: displayText,
      styles: item.styles || {},
    };
  });
}

/**
 * Pre-process blocks to handle any unknown types
 */
function sanitizeBlocksForExport(blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    if (!block || !block.type) return block;

    const sanitizedContent = sanitizeInlineContent(block.content);
    const sanitizedChildren = block.children
      ? sanitizeBlocksForExport(block.children)
      : [];

    if (!KNOWN_BLOCK_TYPES.has(block.type)) {
      console.warn(`[BlockNote] Unknown block type: ${block.type}, converting to paragraph`);
      return {
        ...block,
        type: 'paragraph',
        props: {},
        content: sanitizedContent,
        children: sanitizedChildren,
      };
    }

    return {
      ...block,
      content: sanitizedContent,
      children: sanitizedChildren,
    };
  });
}

/**
 * Handle BlockNote document export
 */
export async function handleBlockNoteExport(
  payload: BlockNoteExportPayload
): Promise<ExportResponse> {
  try {
    if (!payload.blocks) {
      return {
        success: false,
        error: 'Must provide blocks array',
      };
    }

    const validFormats = ['html_full', 'html_lossy', 'markdown', 'all'];
    if (!validFormats.includes(payload.format)) {
      return {
        success: false,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      };
    }

    const editor = ServerBlockNoteEditor.create({
      schema: wikiServerSchema,
    });

    let blocks = payload.blocks;

    if (!Array.isArray(blocks)) {
      return {
        success: false,
        error: 'Blocks must be an array',
      };
    }

    blocks = sanitizeBlocksForExport(blocks);

    const result: BlockNoteExportResult = {};

    if (payload.format === 'html_full' || payload.format === 'all') {
      result.html_full = await editor.blocksToFullHTML(blocks);
    }

    if (payload.format === 'html_lossy' || payload.format === 'all') {
      result.html_lossy = await editor.blocksToHTMLLossy(blocks);
    }

    if (payload.format === 'markdown' || payload.format === 'all') {
      result.markdown = await editor.blocksToMarkdownLossy(blocks);
    }

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error('BlockNote export error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during BlockNote export',
    };
  }
}
