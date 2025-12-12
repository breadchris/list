'use client';

/**
 * Shows online members in the share room
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { AwarenessUser } from '@/hooks/share/useShareAwareness';

export interface OnlineMembersProps {
  users: AwarenessUser[];
  isConnected: boolean;
  peerCount: number;
}

/**
 * Online members indicator
 */
export const OnlineMembers = memo(function OnlineMembers({
  users,
  isConnected,
  peerCount,
}: OnlineMembersProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <motion.div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                animate={
                  isConnected
                    ? {}
                    : {
                        opacity: [1, 0.5, 1],
                      }
                }
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              />
              <Wifi className="w-4 h-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected
              ? `Connected to ${peerCount} peer${peerCount !== 1 ? 's' : ''}`
              : 'Connecting...'}
          </TooltipContent>
        </Tooltip>

        {/* Online users */}
        <div className="flex items-center">
          <Users className="w-4 h-4 text-muted-foreground mr-2" />

          <div className="flex -space-x-2">
            <AnimatePresence mode="popLayout">
              {users.slice(0, 5).map((user, index) => (
                <motion.div
                  key={user.user_id}
                  layout
                  initial={{ opacity: 0, scale: 0, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0, x: -10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ zIndex: 5 - index }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium cursor-default"
                        style={{
                          backgroundColor: user.color,
                          color: getContrastColor(user.color),
                        }}
                      >
                        {user.user_name.charAt(0).toUpperCase()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-medium">{user.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.available_files.length} file
                          {user.available_files.length !== 1 ? 's' : ''} available
                        </p>
                        {user.current_action && user.current_action !== 'idle' && (
                          <p className="text-xs text-blue-500">
                            {user.current_action === 'uploading'
                              ? 'Sending file...'
                              : 'Receiving file...'}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
            </AnimatePresence>

            {users.length > 5 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                    +{users.length - 5}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{users.length - 5} more online</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {users.length === 0 && (
            <span className="text-sm text-muted-foreground ml-1">
              No one else online
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});

/**
 * Get contrasting text color for background
 */
function getContrastColor(color: string): string {
  // Parse HSL or hex
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const lightness = parseInt(match[3], 10);
      return lightness > 50 ? '#000' : '#fff';
    }
  }

  // For hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
  }

  return '#fff';
}
