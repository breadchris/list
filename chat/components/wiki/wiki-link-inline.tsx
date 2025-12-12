"use client";

import { createReactInlineContentSpec } from "@blocknote/react";

/**
 * Custom inline content spec for wiki-style [[links]]
 *
 * Renders as a clickable span that triggers wiki navigation
 * when clicked. Supports both existing and non-existing pages
 * (non-existing pages are styled differently).
 */
export const WikiLinkInlineContent = createReactInlineContentSpec(
  {
    type: "wikiLink",
    propSchema: {
      page_path: {
        default: "",
      },
      display_text: {
        default: "",
      },
      exists: {
        default: true,
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { page_path, display_text, exists } = props.inlineContent.props;
      const text = display_text || page_path;

      return (
        <span
          className={`wiki-link cursor-pointer ${
            exists
              ? "text-blue-400 hover:text-blue-300 hover:underline"
              : "text-orange-400 hover:text-orange-300 hover:underline"
          }`}
          data-wiki-link
          data-page-path={page_path}
          data-exists={exists}
          title={exists ? page_path : `${page_path} (page not found)`}
        >
          {text}
        </span>
      );
    },
  }
);

/**
 * Schema extension for BlockNote editor with wiki links
 */
export const wikiLinkSchema = {
  wikiLink: WikiLinkInlineContent,
};

/**
 * Helper to insert a wiki link into the editor
 */
export function insertWikiLink(
  editor: any,
  pagePath: string,
  displayText?: string,
  exists: boolean = true
) {
  editor.insertInlineContent([
    {
      type: "wikiLink",
      props: {
        page_path: pagePath,
        display_text: displayText || "",
        exists,
      },
    },
  ]);
}

/**
 * Parse text input for wiki link syntax and convert to inline content
 * Returns null if no wiki link found at cursor position
 */
export function parseWikiLinkInput(text: string): {
  pagePath: string;
  displayText?: string;
} | null {
  // Match [[path]] or [[path|display text]]
  const match = text.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);

  if (!match) {
    return null;
  }

  return {
    pagePath: match[1].trim(),
    displayText: match[2]?.trim(),
  };
}
