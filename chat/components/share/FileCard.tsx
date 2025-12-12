'use client';

/**
 * File card component displaying file info and availability
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Download,
  Check,
  Clock,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import type { SharedFile, TransferRequest, FileHolder } from '@/types/share';
import { formatBytes } from '@/lib/share/file-chunker';

export interface FileCardProps {
  file: SharedFile;
  holders: FileHolder[];
  request?: TransferRequest;
  progress?: number;
  isHolder: boolean;
  onRequest: () => void;
  onCancel?: () => void;
  onClick?: () => void;
}

/**
 * Get icon for file type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar'))
    return Archive;
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  )
    return Code;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet;
  if (mimeType.includes('text')) return FileText;
  return File;
}

/**
 * Get file extension from name
 */
function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return '';
}

/**
 * Availability indicator dot
 */
function AvailabilityDot({ isAvailable }: { isAvailable: boolean }) {
  return (
    <motion.div
      className={`w-2.5 h-2.5 rounded-full ${
        isAvailable
          ? 'bg-green-500'
          : 'bg-gray-300 dark:bg-gray-600'
      }`}
      animate={
        isAvailable
          ? {
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1],
            }
          : {}
      }
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * File card component
 */
export const FileCard = memo(function FileCard({
  file,
  holders,
  request,
  progress,
  isHolder,
  onRequest,
  onCancel,
  onClick,
}: FileCardProps) {
  const FileIcon = getFileIcon(file.type);
  const extension = getFileExtension(file.name);
  const availableHolders = holders.filter(h => h.is_online);
  const isAvailable = availableHolders.length > 0;

  const status = useMemo(() => {
    if (!request) return null;
    switch (request.status) {
      case 'pending':
        return { label: 'Waiting...', icon: Clock, color: 'bg-yellow-500' };
      case 'active':
        return { label: 'Transferring', icon: Loader2, color: 'bg-blue-500' };
      case 'completed':
        return { label: 'Downloaded', icon: Check, color: 'bg-green-500' };
      case 'failed':
        return { label: 'Failed', icon: null, color: 'bg-red-500' };
      case 'cancelled':
        return { label: 'Cancelled', icon: null, color: 'bg-gray-500' };
      default:
        return null;
    }
  }, [request]);

  const isTransferring = request?.status === 'active';
  const isPending = request?.status === 'pending';
  const canRequest = !isHolder && isAvailable && !request;

  return (
    <TooltipProvider>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
          onClick={onClick}
        >
          <CardContent className="p-4">
            {/* File icon and extension badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-muted rounded-lg">
                <FileIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                {extension && (
                  <Badge variant="secondary" className="text-xs">
                    {extension}
                  </Badge>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <AvailabilityDot isAvailable={isAvailable} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAvailable
                      ? `${availableHolders.length} holder${availableHolders.length > 1 ? 's' : ''} online`
                      : 'No holders online'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* File name */}
            <h3 className="font-medium text-sm truncate mb-1" title={file.name}>
              {file.name}
            </h3>

            {/* File size */}
            <p className="text-xs text-muted-foreground mb-3">
              {formatBytes(file.size)}
            </p>

            {/* Transfer progress */}
            {isTransferring && progress !== undefined && (
              <div className="mb-3">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(progress)}%
                </p>
              </div>
            )}

            {/* Status badge or action button */}
            <div className="flex items-center justify-between">
              {status ? (
                <Badge
                  variant={
                    request?.status === 'completed'
                      ? 'default'
                      : request?.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-xs"
                >
                  {status.icon && (
                    <status.icon
                      className={`w-3 h-3 mr-1 ${
                        request?.status === 'active' ? 'animate-spin' : ''
                      }`}
                    />
                  )}
                  {status.label}
                </Badge>
              ) : isHolder ? (
                <Badge variant="outline" className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  You have this
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant={canRequest ? 'default' : 'secondary'}
                  disabled={!canRequest}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequest();
                  }}
                  className="text-xs h-7"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {isAvailable ? 'Request' : 'Unavailable'}
                </Button>
              )}

              {/* Cancel button for pending/active transfers */}
              {(isPending || isTransferring) && onCancel && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* Holders avatars */}
            {holders.length > 0 && (
              <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground mr-1">
                  {holders.length} holder{holders.length > 1 ? 's' : ''}
                </span>
                <div className="flex -space-x-2">
                  {holders.slice(0, 3).map((holder, i) => (
                    <Tooltip key={holder.user_id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium ${
                            holder.is_online
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                          style={{ zIndex: 3 - i }}
                        >
                          {holder.user_name.charAt(0).toUpperCase()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {holder.user_name}
                        {holder.is_online ? ' (online)' : ' (offline)'}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {holders.length > 3 && (
                    <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs">
                      +{holders.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
});
