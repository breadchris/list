'use client';

/**
 * Currently Viewing section for wiki sidebar
 * Shows pages sorted by viewer count with viewer avatars
 */

import { memo, useMemo } from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WikiPresenceUser, WikiPage } from '@/types/wiki';
import { getContrastColor } from '@/lib/wiki/visitor-id';

export interface CurrentlyViewingSectionProps {
  active_pages: Map<string, WikiPresenceUser[]>;
  pages: Map<string, WikiPage>;
  current_path: string;
  onNavigate: (path: string) => void;
}

/**
 * Pinned sidebar section showing pages with active viewers
 */
export const CurrentlyViewingSection = memo(function CurrentlyViewingSection({
  active_pages,
  pages,
  current_path,
  onNavigate,
}: CurrentlyViewingSectionProps) {
  // Sort pages by viewer count (descending), take top 5
  const sortedPages = useMemo(() => {
    return Array.from(active_pages.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);
  }, [active_pages]);

  if (sortedPages.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-gray-200">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Users className="w-3 h-3" />
        <span>Currently Viewing</span>
      </div>

      <ul className="space-y-1">
        <AnimatePresence mode="popLayout">
          {sortedPages.map(([path, viewers]) => {
            const page = pages.get(path);
            const isActive = path === current_path;

            return (
              <motion.li
                key={path}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={() => onNavigate(path)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="truncate flex-1 text-left">
                    {page?.title || path}
                  </span>

                  {/* Viewer avatars */}
                  <ViewerAvatars viewers={viewers} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
});

interface ViewerAvatarsProps {
  viewers: WikiPresenceUser[];
}

/**
 * Stacked avatar circles showing viewers
 */
const ViewerAvatars = memo(function ViewerAvatars({ viewers }: ViewerAvatarsProps) {
  const visibleViewers = viewers.slice(0, 3);
  const overflow = viewers.length - 3;

  return (
    <div className="flex -space-x-1 flex-shrink-0">
      {visibleViewers.map((viewer, index) => (
        <motion.div
          key={viewer.client_id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="w-5 h-5 rounded-full border border-white text-[10px] font-medium flex items-center justify-center"
          style={{
            backgroundColor: viewer.color,
            color: getContrastColor(viewer.color),
            zIndex: 3 - index,
          }}
          title={viewer.display_name}
        >
          {viewer.display_name.charAt(0)}
        </motion.div>
      ))}
      {overflow > 0 && (
        <div
          className="w-5 h-5 rounded-full bg-gray-200 text-[10px] font-medium flex items-center justify-center text-gray-600"
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
});
