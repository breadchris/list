'use client';

/**
 * Hook to manage the Y-webrtc room for file sharing
 * Provides Y.Doc and WebRTC provider for a group
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createShareProvider, generateUserColor } from '@/lib/share/webrtc-provider';
import type { ShareRoomConfig, ShareAwarenessState } from '@/types/share';

export interface UseShareRoomOptions {
  group_id: string;
  user_id: string;
  user_name: string;
  password?: string;
  signaling_urls?: string[];
  /** Whether to persist to IndexedDB */
  persist?: boolean;
}

export interface ShareRoomState {
  /** Y.js document */
  doc: Y.Doc | null;
  /** WebRTC provider */
  provider: WebrtcProvider | null;
  /** Whether connected to any peers */
  isConnected: boolean;
  /** Number of connected peers */
  peerCount: number;
  /** Whether room is ready */
  isReady: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * Hook to create and manage a Y-webrtc share room
 */
export function useShareRoom(options: UseShareRoomOptions): ShareRoomState {
  const [state, setState] = useState<ShareRoomState>({
    doc: null,
    provider: null,
    isConnected: false,
    peerCount: 0,
    isReady: false,
    error: null,
  });

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  const { group_id, user_id, user_name, password, signaling_urls, persist = true } = options;

  useEffect(() => {
    if (!group_id || !user_id || !user_name) {
      return;
    }

    const roomName = `share-${group_id}`;

    // Create Y.Doc
    const doc = new Y.Doc();
    docRef.current = doc;

    // Initialize document structure if needed
    doc.getMap('files');
    doc.getMap('requests');
    doc.getMap('holders');

    // Setup IndexedDB persistence
    let persistence: IndexeddbPersistence | null = null;
    if (persist) {
      persistence = new IndexeddbPersistence(roomName, doc);
      persistenceRef.current = persistence;

      persistence.on('synced', () => {
        console.log('[ShareRoom] Synced with IndexedDB');
      });
    }

    // Create WebRTC provider
    const config: ShareRoomConfig = {
      group_id,
      user_id,
      user_name,
      password,
      signaling_urls,
    };

    try {
      const provider = createShareProvider(doc, config);
      providerRef.current = provider;

      // Track peer connections
      const updatePeerCount = () => {
        const room = (provider as unknown as { room?: { webrtcConns: Map<string, unknown> } }).room;
        const count = room?.webrtcConns?.size || 0;
        setState(prev => ({
          ...prev,
          peerCount: count,
          isConnected: count > 0,
        }));
      };

      // Listen for peer events
      provider.on('peers', updatePeerCount);

      // Mark as ready
      setState({
        doc,
        provider,
        isConnected: false,
        peerCount: 0,
        isReady: true,
        error: null,
      });

      // Initial peer count
      updatePeerCount();

    } catch (error) {
      console.error('[ShareRoom] Error creating provider:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }

    // Cleanup
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
      setState({
        doc: null,
        provider: null,
        isConnected: false,
        peerCount: 0,
        isReady: false,
        error: null,
      });
    };
  }, [group_id, user_id, user_name, password, signaling_urls, persist]);

  return state;
}

/**
 * Get the Y.Map for files from a Y.Doc
 */
export function getFilesMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('files');
}

/**
 * Get the Y.Map for requests from a Y.Doc
 */
export function getRequestsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('requests');
}

/**
 * Get the Y.Map for holders from a Y.Doc
 */
export function getHoldersMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('holders');
}
