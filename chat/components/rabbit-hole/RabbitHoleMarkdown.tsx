"use client";

import { memo, useCallback, type ReactNode } from "react";
import { Streamdown } from "streamdown";

interface RabbitHoleMarkdownProps {
  content: string;
  onLinkClick: (linkText: string, linkTarget: string, contextSnippet: string) => void;
  isStreaming?: boolean;
}

export const RabbitHoleMarkdown = memo(function RabbitHoleMarkdown({
  content,
  onLinkClick,
  isStreaming = false,
}: RabbitHoleMarkdownProps) {
  // Extract context around a link (surrounding paragraph)
  const getContextSnippet = useCallback(
    (fullContent: string, linkText: string): string => {
      // Find the paragraph containing the link
      const linkIndex = fullContent.indexOf(`[${linkText}]`);
      if (linkIndex === -1) return "";

      // Find paragraph boundaries
      const paragraphStart = fullContent.lastIndexOf("\n\n", linkIndex);
      const paragraphEnd = fullContent.indexOf("\n\n", linkIndex);

      const start = paragraphStart === -1 ? 0 : paragraphStart + 2;
      const end = paragraphEnd === -1 ? fullContent.length : paragraphEnd;

      // Get the paragraph and limit to ~500 chars
      const paragraph = fullContent.slice(start, end).trim();
      return paragraph.length > 500 ? paragraph.slice(0, 500) + "..." : paragraph;
    },
    []
  );

  // Custom link renderer
  const LinkComponent = useCallback(
    ({
      href,
      children,
    }: {
      href?: string;
      children?: ReactNode;
    }) => {
      const linkText = typeof children === "string" ? children : String(children);
      const linkTarget = href || linkText;

      // Check if this is an internal link (not http/https/mailto)
      const isInternalLink =
        !linkTarget.startsWith("http://") &&
        !linkTarget.startsWith("https://") &&
        !linkTarget.startsWith("mailto:");

      if (isInternalLink) {
        return (
          <button
            type="button"
            className="text-purple-400 hover:text-purple-300 hover:underline cursor-pointer font-medium transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const contextSnippet = getContextSnippet(content, linkText);
              onLinkClick(linkText, linkTarget, contextSnippet);
            }}
          >
            {children}
          </button>
        );
      }

      // External link - open in new tab
      return (
        <a
          href={linkTarget}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
        >
          {children}
        </a>
      );
    },
    [content, onLinkClick, getContextSnippet]
  );

  return (
    <div className="prose dark:prose-invert prose-sm max-w-none">
      <Streamdown
        isAnimating={isStreaming}
        components={{
          a: LinkComponent,
        }}
        rehypePlugins={[]}
      >
        {content}
      </Streamdown>
    </div>
  );
});
