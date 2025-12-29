/**
 * Shared BlockNote schema for wiki editor
 * Used by wiki-editor.tsx (client) and /api/wiki/publish (server)
 */

import { BlockNoteSchema, defaultInlineContentSpecs, defaultBlockSpecs } from "@blocknote/core";
import { WikiLinkInlineContent } from "./wiki-link-inline";
import { YouTubeBlock } from "./youtube-block";

/**
 * Wiki schema with custom blocks:
 * - youtube: Embedded YouTube videos
 * - wikiLink: Internal wiki page links
 */
export const wikiSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    youtube: YouTubeBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLinkInlineContent,
  },
});

export type WikiSchema = typeof wikiSchema;
