import React, { useState } from 'react';
import {
  FacebookEmbed,
  InstagramEmbed,
  LinkedInEmbed,
  PinterestEmbed,
  TikTokEmbed,
  XEmbed,
  YouTubeEmbed
} from 'react-social-media-embed';
import { SocialMediaPlatform } from '../utils/socialMediaDetector';

interface SocialMediaEmbedProps {
  platform: SocialMediaPlatform;
  url: string;
  onError?: () => void;
}

const platformDisplayNames: Record<SocialMediaPlatform, string> = {
  twitter: 'X/Twitter',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  pinterest: 'Pinterest'
};

const platformIcons: Record<SocialMediaPlatform, string> = {
  twitter: '𝕏',
  instagram: '📷',
  tiktok: '🎵',
  youtube: '▶️',
  linkedin: '💼',
  facebook: '👥',
  pinterest: '📌'
};

export const SocialMediaEmbed: React.FC<SocialMediaEmbedProps> = ({ platform, url, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleClick = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // If there's an error, let parent component handle fallback
  if (hasError) {
    return null;
  }

  // Click-to-load placeholder
  if (!isLoaded) {
    return (
      <div
        onClick={handleClick}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer p-8 text-center"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">{platformIcons[platform]}</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Click to load {platformDisplayNames[platform]} embed
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {url.length > 60 ? url.substring(0, 60) + '...' : url}
          </div>
        </div>
      </div>
    );
  }

  // Render the appropriate embed component
  const embedProps = {
    url,
    width: '100%'
  };

  return (
    <div className="w-full my-2 max-h-[400px] sm:max-h-[500px] overflow-hidden" onError={handleError}>
      {platform === 'twitter' && <XEmbed {...embedProps} />}
      {platform === 'instagram' && <InstagramEmbed {...embedProps} />}
      {platform === 'tiktok' && <TikTokEmbed {...embedProps} />}
      {platform === 'youtube' && <YouTubeEmbed {...embedProps} />}
      {platform === 'linkedin' && <LinkedInEmbed {...embedProps} />}
      {platform === 'facebook' && <FacebookEmbed {...embedProps} />}
      {platform === 'pinterest' && <PinterestEmbed {...embedProps} />}
    </div>
  );
};
