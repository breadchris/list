"use client";

import { createReactBlockSpec } from "@blocknote/react";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

/**
 * Check if string is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/,
  ];
  return patterns.some((pattern) => pattern.test(url.trim()));
}

/**
 * Extract video ID from YouTube URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Custom BlockNote block for embedding YouTube videos
 *
 * Uses react-lite-youtube-embed for privacy-friendly, performant embeds.
 * Only loads the actual YouTube iframe when the user clicks play.
 */
export const YouTubeBlock = createReactBlockSpec(
  {
    type: "youtube",
    propSchema: {
      video_id: { default: "" },
      title: { default: "YouTube video" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const { video_id, title } = block.props;

      if (!video_id) {
        return (
          <div className="w-full max-w-2xl my-4 p-8 bg-neutral-800 rounded-lg border border-neutral-700 text-center text-neutral-400">
            No video ID specified
          </div>
        );
      }

      return (
        <div className="w-full max-w-2xl my-4 rounded-lg overflow-hidden">
          <LiteYouTubeEmbed id={video_id} title={title} />
        </div>
      );
    },
  }
)();
