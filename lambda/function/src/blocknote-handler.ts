/**
 * BlockNote Server-Side Export Handler
 * Uses @blocknote/server-util to export documents to HTML and Markdown
 */

import { ServerBlockNoteEditor } from '@blocknote/server-util';
import * as Y from 'yjs';
import type { ContentResponse, BlockNoteExportPayload, BlockNoteExportResult } from './types.js';
import { wikiServerSchema } from './wiki-server-schema.js';

/**
 * Known block and inline content types from the wiki schema
 * Used for sanitization of unknown types
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

    // Keep known types as-is
    if (KNOWN_INLINE_TYPES.has(item.type)) return item;

    // Convert unknown inline types to plain text with marker
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
 * Pre-process blocks to handle any unknown types not in schema
 * Converts unknown block types to paragraphs with their content preserved
 * Converts unknown inline content to plain text
 */
function sanitizeBlocksForExport(blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    if (!block || !block.type) return block;

    // Sanitize inline content in block.content
    const sanitizedContent = sanitizeInlineContent(block.content);

    // Recursively sanitize children
    const sanitizedChildren = block.children
      ? sanitizeBlocksForExport(block.children)
      : [];

    // Handle unknown block types
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
 * Supports both BlockNote JSON blocks and Y.js state as input
 * Exports to HTML (full/lossy) and Markdown formats
 */
export async function handleBlockNoteExport(
	supabase: any,
	payload: BlockNoteExportPayload
): Promise<ContentResponse> {
	try {
		// Validate input - must have either blocks or yjs_state
		if (!payload.blocks && !payload.yjs_state) {
			return {
				success: false,
				error: 'Must provide either blocks or yjs_state',
			};
		}

		// Validate format
		const validFormats = ['html_full', 'html_lossy', 'markdown', 'all'];
		if (!validFormats.includes(payload.format)) {
			return {
				success: false,
				error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
			};
		}

		// Create server-side editor with wiki schema (supports wikiLink and youtube types)
		const editor = ServerBlockNoteEditor.create({
			schema: wikiServerSchema,
		});

		// Get blocks from input
		let blocks: any[];

		if (payload.blocks) {
			// Direct blocks input
			blocks = payload.blocks;
		} else if (payload.yjs_state) {
			// Y.js state input - decode and convert to blocks
			try {
				const state = Buffer.from(payload.yjs_state, 'base64');
				const doc = new Y.Doc();
				Y.applyUpdate(doc, new Uint8Array(state));
				const fragmentName = payload.yjs_fragment_name || 'prosemirror';
				blocks = editor.yDocToBlocks(doc, fragmentName);
			} catch (yjsError: any) {
				return {
					success: false,
					error: `Failed to parse Y.js state: ${yjsError.message}`,
				};
			}
		} else {
			// Should not reach here due to validation above
			return {
				success: false,
				error: 'No input provided',
			};
		}

		// Validate blocks array
		if (!Array.isArray(blocks)) {
			return {
				success: false,
				error: 'Blocks must be an array',
			};
		}

		// Sanitize blocks to handle any unknown types gracefully
		blocks = sanitizeBlocksForExport(blocks);

		// Export based on format
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
