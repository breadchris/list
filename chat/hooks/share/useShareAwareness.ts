'use client';

/**
 * Hook to manage awareness state for file sharing
 * Tracks online users and what files they have available
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { WebrtcProvider } from 'y-webrtc';
import type { Awareness } from 'y-protocols/awareness';
import type { ShareAwarenessState } from '@/types/share';
import { generateUserColor } from '@/lib/share/webrtc-provider';

export interface UseShareAwarenessOptions {
  provider: WebrtcProvider | null;
  user_id: string;
  user_name: string;
}

export interface AwarenessUser {
  client_id: number;
  user_id: string;
  user_name: string;
  color: string;
  available_files: string[];
  serving_files: string[];
  client_ready: boolean;
  current_action?: 'idle' | 'uploading' | 'downloading';
  transfer_target?: string;
}

export interface UseShareAwarenessReturn {
  /** All online users (excluding self) */
  onlineUsers: AwarenessUser[];
  /** Local user's awareness state */
  localState: ShareAwarenessState | null;
  /** Update local awareness state field */
  setLocalField: <K extends keyof ShareAwarenessState>(
    field: K,
    value: ShareAwarenessState[K]
  ) => void;
  /** Set files available locally */
  setAvailableFiles: (hashes: string[]) => void;
  /** Add a file to available files */
  addAvailableFile: (hash: string) => void;
  /** Remove a file from available files */
  removeAvailableFile: (hash: string) => void;
  /** Set files currently being served */
  setServingFiles: (hashes: string[]) => void;
  /** Check if any user has a file available */
  isFileAvailable: (hash: string) => boolean;
  /** Get users who have a file */
  getUsersWithFile: (hash: string) => AwarenessUser[];
}

/**
 * Hook to manage awareness state for file sharing
 */
export function useShareAwareness(
  options: UseShareAwarenessOptions
): UseShareAwarenessReturn {
  const { provider, user_id, user_name } = options;
  const [onlineUsers, setOnlineUsers] = useState<AwarenessUser[]>([]);
  const [localState, setLocalState] = useState<ShareAwarenessState | null>(null);

  // Get awareness instance
  const awareness = provider?.awareness as Awareness | undefined;

  // Initialize local awareness state
  useEffect(() => {
    if (!awareness || !user_id || !user_name) return;

    const initialState: ShareAwarenessState = {
      user_id,
      user_name,
      color: generateUserColor(user_id),
      available_files: [],
      serving_files: [],
      client_ready: true,
    };

    awareness.setLocalState(initialState);
    setLocalState(initialState);
  }, [awareness, user_id, user_name]);

  // Subscribe to awareness changes
  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const states = awareness.getStates();
      const users: AwarenessUser[] = [];

      states.forEach((state, clientId) => {
        // Skip if no state or missing user_id
        if (!state || !state.user_id) return;
        // Skip self
        if (state.user_id === user_id) return;

        users.push({
          client_id: clientId,
          user_id: state.user_id,
          user_name: state.user_name || 'Unknown',
          color: state.color || '#888',
          available_files: state.available_files || [],
          serving_files: state.serving_files || [],
          client_ready: state.client_ready || false,
          current_action: state.current_action,
          transfer_target: state.transfer_target,
        });
      });

      setOnlineUsers(users);
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      awareness.off('change', updateUsers);
    };
  }, [awareness, user_id]);

  // Update local awareness field
  const setLocalField = useCallback(
    <K extends keyof ShareAwarenessState>(
      field: K,
      value: ShareAwarenessState[K]
    ) => {
      if (!awareness) return;
      awareness.setLocalStateField(field, value);
      setLocalState(prev => (prev ? { ...prev, [field]: value } : null));
    },
    [awareness]
  );

  // Set available files
  const setAvailableFiles = useCallback(
    (hashes: string[]) => {
      setLocalField('available_files', hashes);
    },
    [setLocalField]
  );

  // Add a file to available files
  const addAvailableFile = useCallback(
    (hash: string) => {
      if (!localState) return;
      const current = localState.available_files || [];
      if (!current.includes(hash)) {
        setAvailableFiles([...current, hash]);
      }
    },
    [localState, setAvailableFiles]
  );

  // Remove a file from available files
  const removeAvailableFile = useCallback(
    (hash: string) => {
      if (!localState) return;
      const current = localState.available_files || [];
      setAvailableFiles(current.filter(h => h !== hash));
    },
    [localState, setAvailableFiles]
  );

  // Set serving files
  const setServingFiles = useCallback(
    (hashes: string[]) => {
      setLocalField('serving_files', hashes);
    },
    [setLocalField]
  );

  // Check if any user has a file available
  const isFileAvailable = useCallback(
    (hash: string): boolean => {
      return onlineUsers.some(
        user =>
          user.client_ready && user.available_files.includes(hash)
      );
    },
    [onlineUsers]
  );

  // Get users who have a file
  const getUsersWithFile = useCallback(
    (hash: string): AwarenessUser[] => {
      return onlineUsers.filter(
        user =>
          user.client_ready && user.available_files.includes(hash)
      );
    },
    [onlineUsers]
  );

  return {
    onlineUsers,
    localState,
    setLocalField,
    setAvailableFiles,
    addAvailableFile,
    removeAvailableFile,
    setServingFiles,
    isFileAvailable,
    getUsersWithFile,
  };
}
