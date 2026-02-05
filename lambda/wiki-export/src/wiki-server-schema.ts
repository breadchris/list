/**
 * Server-side BlockNote schema for wiki export
 * Uses React-based specs since ServerBlockNoteEditor uses React rendering internally
 */

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core';
import { createReactInlineContentSpec, createReactBlockSpec } from '@blocknote/react';
import React from 'react';

/**
 * Server-side wikiLink inline content spec using React
 * ServerBlockNoteEditor uses React rendering internally via JSDOM
 */
const WikiLinkInlineContent = createReactInlineContentSpec(
  {
    type: 'wikiLink' as const,
    propSchema: {
      page_path: { default: '' },
      display_text: { default: '' },
      exists: { default: true },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { page_path, display_text, exists } = props.inlineContent.props;
      const text = display_text || page_path;

      return React.createElement('a', {
        href: `/wiki/${encodeURIComponent(page_path)}`,
        className: exists ? 'wiki-link' : 'wiki-link wiki-link-missing',
        'data-wiki-link': 'true',
        'data-page-path': page_path,
      }, text);
    },
  }
);

/**
 * Server-side YouTube block spec using React
 */
const YouTubeBlock = createReactBlockSpec(
  {
    type: 'youtube' as const,
    propSchema: {
      video_id: { default: '' },
      title: { default: 'YouTube video' },
    },
    content: 'none',
  },
  {
    render: ({ block }) => {
      const { video_id, title } = block.props;

      if (video_id) {
        return React.createElement('div', { className: 'youtube-embed' },
          React.createElement('iframe', {
            src: `https://www.youtube.com/embed/${video_id}`,
            title: title,
            width: '560',
            height: '315',
            frameBorder: '0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowFullScreen: true,
          })
        );
      }

      return React.createElement('div', { className: 'youtube-embed' },
        React.createElement('p', { className: 'youtube-placeholder' }, 'No video specified')
      );
    },
  }
)();

/**
 * Server-side wiki schema combining default specs with custom wiki types
 */
export const wikiServerSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    youtube: YouTubeBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikiLink: WikiLinkInlineContent,
  },
});

export type WikiServerSchema = typeof wikiServerSchema;
