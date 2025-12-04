import React from 'react';
import { SEOMetadata } from '@/lib/list/ContentRepository';

interface SEOCardProps {
  metadata: SEOMetadata;
  className?: string;
  onClick?: () => void;
}

export const SEOCard: React.FC<SEOCardProps> = ({ metadata, className = '', onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (metadata.url) {
      window.open(metadata.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      handleClick(e);
    }
  };

  const getDomainDisplay = () => {
    if (metadata.siteName) return metadata.siteName;
    if (metadata.domain) return metadata.domain;
    if (metadata.url) {
      try {
        return new URL(metadata.url).hostname;
      } catch {
        return 'Unknown';
      }
    }
    return 'Unknown';
  };

  const getFaviconUrl = () => {
    if (metadata.favicon) return metadata.favicon;
    if (metadata.domain) {
      return `https://www.google.com/s2/favicons?domain=${metadata.domain}&sz=16`;
    }
    if (metadata.url) {
      try {
        const url = new URL(metadata.url);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const getImageUrl = () => {
    if (!metadata.image) return null;
    
    // If it's already a full URL, return it
    if (metadata.image.startsWith('http')) {
      return metadata.image;
    }
    
    // If it's a relative URL and we have a base URL, combine them
    if (metadata.url) {
      try {
        return new URL(metadata.image, metadata.url).toString();
      } catch {
        return metadata.image;
      }
    }
    
    return metadata.image;
  };

  const faviconUrl = getFaviconUrl();
  const imageUrl = getImageUrl();

  return (
    <div 
      className={`
        border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 
        transition-all duration-200 cursor-pointer bg-white hover:shadow-sm
        ${className}
      `}
      onClick={handleCardClick}
    >
      {/* Preview Image */}
      {imageUrl && (
        <div className="aspect-video bg-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={metadata.title || 'Preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      
      {/* Content */}
      <div className="p-3 space-y-1">
        {/* Domain/Site Name */}
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt="Favicon"
              className="w-4 h-4 rounded-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="truncate">{getDomainDisplay()}</span>
        </div>
        
        {/* Title */}
        {metadata.title && (
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 hover:underline">
            {metadata.title}
          </h3>
        )}
        
        {/* Description */}
        {metadata.description && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {metadata.description}
          </p>
        )}
        
        {/* URL */}
        {metadata.url && (
          <div className="text-xs text-gray-400 truncate pt-1">
            {metadata.url}
          </div>
        )}
      </div>
    </div>
  );
};

// Add custom CSS for line clamping
const style = document.createElement('style');
style.textContent = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;
document.head.appendChild(style);