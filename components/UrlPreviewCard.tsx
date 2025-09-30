import React from 'react';
import {supabase} from "./SupabaseClient";

interface UrlPreviewCardProps {
  previewUrl: string;
  className?: string;
}

/**
 * Component to display URL preview screenshots
 */
export const UrlPreviewCard: React.FC<UrlPreviewCardProps> = ({ previewUrl, className = '' }) => {
  const fullImageUrl = supabase.storage.from('content').getPublicUrl(previewUrl).data.publicUrl;

  return (
    <div className={`mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {/* Image container with fixed aspect ratio for Pinterest-like cards */}
      <div className="relative w-full" style={{ paddingBottom: '52.5%' /* 630/1200 = 0.525 */ }}>
        <img
          src={fullImageUrl}
          alt="URL Preview"
          className="absolute inset-0 w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            // Open image in new tab
            window.open(fullImageUrl, '_blank');
          }}
          onError={(e) => {
            // Hide entire card on error
            const card = e.currentTarget.closest('.mt-3') as HTMLElement;
            if (card) {
              card.style.display = 'none';
            }
          }}
          loading="lazy"
        />
      </div>
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs text-gray-500">Website Preview</span>
          </div>
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </div>
    </div>
  );
};

interface UrlPreviewLoadingProps {
  url: string;
  className?: string;
}

/**
 * Loading state component for URL preview generation
 */
export const UrlPreviewLoading: React.FC<UrlPreviewLoadingProps> = ({ url, className = '' }) => {
  return (
    <div className={`mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 ${className}`}>
      <div className="px-3 py-3">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-500">Generating preview...</span>
            </div>
            <p className="text-xs text-gray-400 truncate mt-1">{url}</p>
          </div>
        </div>
      </div>
    </div>
  );
};