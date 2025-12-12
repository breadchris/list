'use client';

/**
 * Grid view of shared files
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCard } from './FileCard';
import type { SharedFile, TransferRequest, FileHolder, TransferProgress } from '@/types/share';

export interface FileGridProps {
  files: SharedFile[];
  getHolders: (hash: string) => FileHolder[];
  getRequest: (hash: string) => TransferRequest | undefined;
  getProgress: (hash: string) => TransferProgress | undefined;
  isHolder: (hash: string) => boolean;
  onRequest: (hash: string) => void;
  onCancel: (requestId: string) => void;
  onFileClick?: (file: SharedFile) => void;
}

/**
 * File grid component
 */
export const FileGrid = memo(function FileGrid({
  files,
  getHolders,
  getRequest,
  getProgress,
  isHolder,
  onRequest,
  onCancel,
  onFileClick,
}: FileGridProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-1">No files shared yet</h3>
        <p className="text-sm text-muted-foreground">
          Drop files here or click the button above to share with your group
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <AnimatePresence mode="popLayout">
        {files.map((file, index) => {
          const request = getRequest(file.hash);
          const progress = getProgress(file.hash);
          const holders = getHolders(file.hash);

          return (
            <motion.div
              key={file.hash}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 25,
                delay: index * 0.05,
              }}
            >
              <FileCard
                file={file}
                holders={holders}
                request={request}
                progress={progress?.progress}
                isHolder={isHolder(file.hash)}
                onRequest={() => onRequest(file.hash)}
                onCancel={request ? () => onCancel(request.id) : undefined}
                onClick={() => onFileClick?.(file)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
