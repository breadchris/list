'use client';

/**
 * Hook to manage presence state for wiki viewers
 * Tracks online users, cursor positions, and current page viewing
 */

import { useEffect, useState, useCallback, useMemo, RefObject } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { WikiPresenceState, WikiPresenceUser } from '@/types/wiki';
import {
  getOrCreateWikiVisitorId,
  generateVisitorColor,
} from '@/lib/wiki/visitor-id';

const IDLE_TIMEOUT_MS = 30000; // 30 seconds
const CURSOR_THROTTLE_MS = 16; // ~60fps

export interface UseWikiPresenceOptions {
  awareness: Awareness | null;
  current_page_path: string;
  editor_container_ref: RefObject<HTMLElement | null>;
}

export interface UseWikiPresenceReturn {
  /** All online viewers (excluding self) */
  viewers: WikiPresenceUser[];
  /** Viewers on the current page (for cursor rendering) */
  viewers_on_current_page: WikiPresenceUser[];
  /** All pages being viewed with viewer lists */
  active_pages: Map<string, WikiPresenceUser[]>;
  /** Local viewer's state */
  local_state: WikiPresenceState | null;
  /** Total viewer count */
  viewer_count: number;
}

/**
 * Generate display name based on client ID order
 */
function generateDisplayName(clientId: number, allClientIds: number[]): string {
  const sortedIds = [...allClientIds].sort((a, b) => a - b);
  const index = sortedIds.indexOf(clientId) + 1;
  return `Anonymous ${index}`;
}

/**
 * Hook to manage wiki presence
 */
export function useWikiPresence(
  options: UseWikiPresenceOptions
): UseWikiPresenceReturn {
  const { awareness, current_page_path, editor_container_ref } = options;
  const [viewers, setViewers] = useState<WikiPresenceUser[]>([]);
  const [localState, setLocalState] = useState<WikiPresenceState | null>(null);

  // Initialize local awareness state
  useEffect(() => {
    if (!awareness) return;

    const visitorId = getOrCreateWikiVisitorId();
    const color = generateVisitorColor(visitorId);

    // Get all client IDs to generate display name
    const allClientIds = Array.from(awareness.getStates().keys());
    const displayName = generateDisplayName(awareness.clientID, allClientIds);

    const initialState: WikiPresenceState = {
      visitor_id: visitorId,
      display_name: displayName,
      color,
      current_page_path,
      cursor_position: null,
      last_active: Date.now(),
    };

    awareness.setLocalState(initialState);
    setLocalState(initialState);
  }, [awareness, current_page_path]);

  // Update current page path when it changes
  useEffect(() => {
    if (!awareness || !localState) return;

    awareness.setLocalStateField('current_page_path', current_page_path);
    awareness.setLocalStateField('last_active', Date.now());
    setLocalState(prev => prev ? { ...prev, current_page_path, last_active: Date.now() } : null);
  }, [awareness, current_page_path, localState?.visitor_id]);

  // Subscribe to awareness changes
  useEffect(() => {
    if (!awareness) return;

    const updateViewers = () => {
      const states = awareness.getStates();
      const allClientIds = Array.from(states.keys());
      const users: WikiPresenceUser[] = [];
      const now = Date.now();

      states.forEach((state, clientId) => {
        // Skip if no state or missing visitor_id
        if (!state || !state.visitor_id) return;
        // Skip self
        if (clientId === awareness.clientID) return;

        const isActive = (now - (state.last_active || 0)) < IDLE_TIMEOUT_MS;

        users.push({
          client_id: clientId,
          visitor_id: state.visitor_id,
          display_name: generateDisplayName(clientId, allClientIds),
          color: state.color || '#888',
          current_page_path: state.current_page_path || '',
          cursor_position: state.cursor_position || null,
          is_active: isActive,
        });
      });

      // Defer state update to avoid setState during render
      // (awareness changes can fire synchronously during BlockNote initialization)
      queueMicrotask(() => {
        setViewers(users);
      });
    };

    awareness.on('change', updateViewers);
    queueMicrotask(updateViewers);

    return () => {
      awareness.off('change', updateViewers);
    };
  }, [awareness]);

  // Track cursor position with throttling
  useEffect(() => {
    if (!awareness || !editor_container_ref.current) return;

    let lastUpdate = 0;
    const container = editor_container_ref.current;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate < CURSOR_THROTTLE_MS) return;
      lastUpdate = now;

      const rect = container.getBoundingClientRect();
      const position = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      awareness.setLocalStateField('cursor_position', position);
      awareness.setLocalStateField('last_active', now);
    };

    const handleMouseLeave = () => {
      awareness.setLocalStateField('cursor_position', null);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [awareness, editor_container_ref]);

  // Filter viewers on current page
  const viewers_on_current_page = useMemo(() => {
    return viewers.filter(
      v => v.is_active && v.current_page_path === current_page_path
    );
  }, [viewers, current_page_path]);

  // Build active pages map
  const active_pages = useMemo(() => {
    const pageMap = new Map<string, WikiPresenceUser[]>();

    for (const viewer of viewers) {
      if (!viewer.is_active || !viewer.current_page_path) continue;

      const existing = pageMap.get(viewer.current_page_path) || [];
      existing.push(viewer);
      pageMap.set(viewer.current_page_path, existing);
    }

    return pageMap;
  }, [viewers]);

  // Total active viewer count
  const viewer_count = useMemo(() => {
    return viewers.filter(v => v.is_active).length;
  }, [viewers]);

  return {
    viewers,
    viewers_on_current_page,
    active_pages,
    local_state: localState,
    viewer_count,
  };
}
