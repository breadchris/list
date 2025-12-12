'use client';

/**
 * Hook to manage shared files in the Y.Doc
 * Handles adding, removing, and subscribing to file metadata
 */

import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import type { SharedFile } from '@/types/share';
import { hashFile } from '@/lib/share/file-hasher';
import { getFilesMap, getHoldersMap } from './useShareRoom';

export interface UseSharedFilesOptions {
  doc: Y.Doc | null;
  user_id: string;
  user_name: string;
}

export interface UseSharedFilesReturn {
  /** All shared files */
  files: SharedFile[];
  /** Loading state */
  isLoading: boolean;
  /** Add a file to the group */
  addFile: (file: File, onProgress?: (progress: number) => void) => Promise<SharedFile>;
  /** Remove a file (only if you're the only holder) */
  removeFile: (hash: string) => void;
  /** Get a file by hash */
  getFile: (hash: string) => SharedFile | undefined;
  /** Check if current user is a holder of a file */
  isHolder: (hash: string) => boolean;
  /** Add self as holder of a file */
  addAsHolder: (hash: string) => void;
  /** Remove self as holder of a file */
  removeAsHolder: (hash: string) => void;
  /** Get all holders of a file */
  getHolders: (hash: string) => string[];
}

/**
 * Hook to manage shared files
 */
export function useSharedFiles(options: UseSharedFilesOptions): UseSharedFilesReturn {
  const { doc, user_id, user_name } = options;
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to files map changes
  useEffect(() => {
    if (!doc) {
      setIsLoading(false);
      return;
    }

    const filesMap = getFilesMap(doc);

    const updateFiles = () => {
      const filesList: SharedFile[] = [];
      filesMap.forEach((value) => {
        if (value && typeof value === 'object') {
          filesList.push(value as SharedFile);
        }
      });
      // Sort by added_at descending (newest first)
      filesList.sort((a, b) =>
        new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
      );
      setFiles(filesList);
      setIsLoading(false);
    };

    filesMap.observe(updateFiles);
    updateFiles();

    return () => {
      filesMap.unobserve(updateFiles);
    };
  }, [doc]);

  // Add a file
  const addFile = useCallback(
    async (file: File, onProgress?: (progress: number) => void): Promise<SharedFile> => {
      if (!doc || !user_id || !user_name) {
        throw new Error('Not connected to share room');
      }

      // Compute hash (this is the slow part for large files)
      const hash = await hashFile(file, onProgress);

      const filesMap = getFilesMap(doc);
      const holdersMap = getHoldersMap(doc);

      // Check if file already exists
      const existing = filesMap.get(hash) as SharedFile | undefined;
      if (existing) {
        // File exists, just add self as holder
        const holders = (holdersMap.get(hash) as string[]) || [];
        if (!holders.includes(user_id)) {
          holdersMap.set(hash, [...holders, user_id]);
        }
        return existing;
      }

      // Create new file entry
      const sharedFile: SharedFile = {
        hash,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        added_at: new Date().toISOString(),
        added_by: user_id,
        added_by_name: user_name,
      };

      // Add to Y.Doc
      doc.transact(() => {
        filesMap.set(hash, sharedFile);
        holdersMap.set(hash, [user_id]);
      });

      return sharedFile;
    },
    [doc, user_id, user_name]
  );

  // Remove a file
  const removeFile = useCallback(
    (hash: string) => {
      if (!doc) return;

      const filesMap = getFilesMap(doc);
      const holdersMap = getHoldersMap(doc);

      // Only allow removal if user is the only holder
      const holders = (holdersMap.get(hash) as string[]) || [];
      if (holders.length === 1 && holders[0] === user_id) {
        doc.transact(() => {
          filesMap.delete(hash);
          holdersMap.delete(hash);
        });
      } else if (holders.includes(user_id)) {
        // Remove self as holder but keep the file
        holdersMap.set(
          hash,
          holders.filter(h => h !== user_id)
        );
      }
    },
    [doc, user_id]
  );

  // Get a file by hash
  const getFile = useCallback(
    (hash: string): SharedFile | undefined => {
      return files.find(f => f.hash === hash);
    },
    [files]
  );

  // Check if current user is a holder
  const isHolder = useCallback(
    (hash: string): boolean => {
      if (!doc) return false;
      const holdersMap = getHoldersMap(doc);
      const holders = (holdersMap.get(hash) as string[]) || [];
      return holders.includes(user_id);
    },
    [doc, user_id]
  );

  // Add self as holder
  const addAsHolder = useCallback(
    (hash: string) => {
      if (!doc || !user_id) return;
      const holdersMap = getHoldersMap(doc);
      const holders = (holdersMap.get(hash) as string[]) || [];
      if (!holders.includes(user_id)) {
        holdersMap.set(hash, [...holders, user_id]);
      }
    },
    [doc, user_id]
  );

  // Remove self as holder
  const removeAsHolder = useCallback(
    (hash: string) => {
      if (!doc || !user_id) return;
      const holdersMap = getHoldersMap(doc);
      const holders = (holdersMap.get(hash) as string[]) || [];
      if (holders.includes(user_id)) {
        const newHolders = holders.filter(h => h !== user_id);
        if (newHolders.length > 0) {
          holdersMap.set(hash, newHolders);
        } else {
          // Last holder removed, also remove the file
          const filesMap = getFilesMap(doc);
          doc.transact(() => {
            filesMap.delete(hash);
            holdersMap.delete(hash);
          });
        }
      }
    },
    [doc, user_id]
  );

  // Get all holders of a file
  const getHolders = useCallback(
    (hash: string): string[] => {
      if (!doc) return [];
      const holdersMap = getHoldersMap(doc);
      return (holdersMap.get(hash) as string[]) || [];
    },
    [doc]
  );

  return {
    files,
    isLoading,
    addFile,
    removeFile,
    getFile,
    isHolder,
    addAsHolder,
    removeAsHolder,
    getHolders,
  };
}
