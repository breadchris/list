import React, { useRef, useEffect, useState } from 'react';

interface TruncatedContentProps {
  children: React.ReactNode;
  maxHeight?: number; // in pixels
  className?: string;
}

export const TruncatedContent: React.FC<TruncatedContentProps> = ({
  children,
  maxHeight = 200,
  className = ''
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        setIsOverflowing(scrollHeight > clientHeight);
      }
    };

    checkOverflow();
    // Re-check on window resize
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contentRef}
        style={{ maxHeight: `${maxHeight}px` }}
        className="overflow-hidden"
      >
        {children}
      </div>

      {/* Gradient fade-out overlay when content is truncated */}
      {isOverflowing && (
        <>
          <div
            className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none"
            style={{ zIndex: 1 }}
          />
          <div className="flex items-center justify-center text-xs text-gray-500 mt-1 gap-1">
            <span>Click to view full content</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
};
