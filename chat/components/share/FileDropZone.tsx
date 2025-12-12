'use client';

/**
 * Drag-and-drop zone for adding files to share
 */

import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface FileDropZoneProps {
  onFilesAdded: (files: File[], onProgress?: (progress: number) => void) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

type DropState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

/**
 * File drop zone component
 */
export function FileDropZone({ onFilesAdded, className, disabled }: FileDropZoneProps) {
  const [state, setState] = useState<DropState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;

      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setState('uploading');
      setError(null);
      setUploadProgress(0);
      setFileCount(fileArray.length);

      try {
        await onFilesAdded(fileArray, (progress) => {
          setUploadProgress(progress);
        });
        setState('success');
        // Reset after success animation
        setTimeout(() => {
          setState('idle');
          setUploadProgress(0);
          setFileCount(0);
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add files');
        setState('error');
        setTimeout(() => {
          setState('idle');
          setError(null);
          setUploadProgress(0);
          setFileCount(0);
        }, 3000);
      }
    },
    [onFilesAdded, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setState('idle');

      if (disabled) return;

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [handleFiles, disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && state !== 'uploading') {
        setState('dragging');
      }
    },
    [disabled, state]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (state === 'dragging') {
        setState('idle');
      }
    },
    [state]
  );

  const handleClick = useCallback(() => {
    if (disabled || state === 'uploading') return;
    inputRef.current?.click();
  }, [disabled, state]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFiles(files);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <motion.div
      className={cn(
        'relative border-2 border-dashed rounded-lg transition-colors cursor-pointer',
        state === 'dragging' && 'border-primary bg-primary/5',
        state === 'uploading' && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
        state === 'success' && 'border-green-500 bg-green-50 dark:bg-green-950/20',
        state === 'error' && 'border-red-500 bg-red-50 dark:bg-red-950/20',
        state === 'idle' && 'border-muted-foreground/25 hover:border-muted-foreground/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center py-8 px-4">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Drop files to share</p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </motion.div>
          )}

          {state === 'dragging' && (
            <motion.div
              key="dragging"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <motion.div
                className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Upload className="w-6 h-6 text-primary" />
              </motion.div>
              <p className="text-sm font-medium text-primary">Drop here!</p>
            </motion.div>
          )}

          {state === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center w-full px-4"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                {fileCount > 1
                  ? `Adding ${fileCount} files...`
                  : 'Adding file...'}
              </p>
              <div className="w-full max-w-xs">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <motion.div
                className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </motion.div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Files added!
              </p>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {error || 'Failed to add files'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ripple effect on drop */}
      {state === 'success' && (
        <motion.div
          className="absolute inset-0 rounded-lg bg-green-500/10"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}
