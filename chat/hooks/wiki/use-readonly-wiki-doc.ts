'use client';

/**
 * Hook to connect to a Wiki Y.js document in readonly mode
 *
 * Simplified version of use-wiki-yjs-doc.ts for public viewers:
 * - No IndexedDB persistence (public viewers don't need local storage)
 * - Uses readonly auth endpoint (mutations are ignored by server)
 * - No awareness (public viewers don't show presence)
 */

import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { createYjsProvider, YSweetProvider } from '@y-sweet/client';

export interface UseReadonlyWikiDocOptions {
  wiki_id: string;
}

export interface ReadonlyWikiDocState {
  doc: Y.Doc | null;
  provider: YSweetProvider | null;
  is_synced: boolean;
  is_ready: boolean;
  error: Error | null;
  connection_status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const READONLY_AUTH_ENDPOINT = '/api/y-sweet-auth-readonly';

export function useReadonlyWikiDoc(options: UseReadonlyWikiDocOptions): ReadonlyWikiDocState {
  const { wiki_id } = options;

  const [state, setState] = useState<ReadonlyWikiDocState>({
    doc: null,
    provider: null,
    is_synced: false,
    is_ready: false,
    error: null,
    connection_status: 'connecting',
  });

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YSweetProvider | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!wiki_id) return;

    mountedRef.current = true;
    const docId = `wiki-${wiki_id}`;

    // Create Y.Doc
    const doc = new Y.Doc();
    docRef.current = doc;

    setState(prev => ({
      ...prev,
      doc,
      connection_status: 'connecting',
    }));

    async function connectYSweetProvider() {
      try {
        // Fetch readonly token
        const response = await fetch(READONLY_AUTH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId }),
        });

        if (!response.ok) {
          throw new Error('Failed to get readonly token');
        }

        const clientToken = await response.json();

        if (!mountedRef.current) return;

        // Create Y-Sweet provider with readonly token
        const provider = createYjsProvider(doc, docId, READONLY_AUTH_ENDPOINT, {
          initialClientToken: clientToken,
          offlineSupport: false,
        });

        providerRef.current = provider;

        provider.on('sync', () => {
          if (mountedRef.current) {
            console.log('[Wiki Readonly] Synced:', docId);
            setState(prev => ({
              ...prev,
              is_synced: true,
              is_ready: true,
              connection_status: 'connected',
            }));
          }
        });

        provider.on('connection-error', (error: Error) => {
          console.error('[Wiki Readonly] Connection error:', error);
          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              connection_status: 'error',
              error,
            }));
          }
        });

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            provider,
          }));
        }
      } catch (error) {
        console.error('[Wiki Readonly] Failed to connect:', error);
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            connection_status: 'error',
            error: error as Error,
          }));
        }
      }
    }

    connectYSweetProvider();

    // Cleanup
    return () => {
      mountedRef.current = false;

      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
      setState({
        doc: null,
        provider: null,
        is_synced: false,
        is_ready: false,
        error: null,
        connection_status: 'connecting',
      });
    };
  }, [wiki_id]);

  return state;
}
