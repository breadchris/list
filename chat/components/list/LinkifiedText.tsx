import React from 'react';
import { TruncatedContent } from './TruncatedContent';

interface TextSegment {
  text: string;
  isUrl: boolean;
}

// URL detection regex - matches http/https URLs and www domains
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;

// Function to parse text and identify URL segments
const parseTextWithUrls = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex to ensure consistent behavior
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isUrl: false,
      });
    }

    // Add the URL
    let url = match[0];
    // Add protocol if missing for www URLs
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }

    segments.push({
      text: match[0], // Display original text
      isUrl: true,
    });

    lastIndex = URL_REGEX.lastIndex;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isUrl: false,
    });
  }

  return segments;
};

interface LinkifiedTextProps {
  text: string;
  className?: string;
  maxHeight?: number; // Optional max height for truncation (in pixels)
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = '',
  maxHeight
}) => {
  const segments = parseTextWithUrls(text);

  const content = (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.isUrl) {
          let href = segment.text;
          // Add protocol if missing for www URLs
          if (href.startsWith('www.')) {
            href = 'https://' + href;
          }

          return (
            <a
              key={index}
              href={href}
              className="text-blue-600 hover:underline cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                // Check if running in iOS WKWebView
                const webkit = (window as any).webkit;
                if (webkit?.messageHandlers?.webviewHandler) {
                  webkit.messageHandlers.webviewHandler.postMessage({
                    type: 'openUrl',
                    url: href,
                    title: segment.text
                  });
                } else {
                  // Fallback for web browser
                  window.open(href, '_blank');
                }
              }}
            >
              {segment.text}
            </a>
          );
        } else {
          return <span key={index}>{segment.text}</span>;
        }
      })}
    </span>
  );

  // If maxHeight is provided, wrap in TruncatedContent
  if (maxHeight) {
    return <TruncatedContent maxHeight={maxHeight}>{content}</TruncatedContent>;
  }

  return content;
};