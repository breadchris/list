'use client';

/**
 * Hook to manage file transfer requests
 * Handles the request lifecycle: pending -> active -> completed/failed
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import type { TransferRequest, TransferStatus } from '@/types/share';
import { getRequestsMap } from './useShareRoom';

export interface UseTransferRequestsOptions {
  doc: Y.Doc | null;
  user_id: string;
  user_name: string;
}

export interface UseTransferRequestsReturn {
  /** All transfer requests */
  requests: TransferRequest[];
  /** Requests made by current user */
  myRequests: TransferRequest[];
  /** Pending requests for files the user can serve */
  incomingRequests: TransferRequest[];
  /** Active transfers (sending or receiving) */
  activeTransfers: TransferRequest[];
  /** Create a new request */
  createRequest: (fileHash: string) => TransferRequest;
  /** Accept a request (as holder) */
  acceptRequest: (requestId: string) => void;
  /** Cancel a request */
  cancelRequest: (requestId: string) => void;
  /** Update request progress */
  updateProgress: (requestId: string, progress: number) => void;
  /** Mark request as completed */
  completeRequest: (requestId: string) => void;
  /** Mark request as failed */
  failRequest: (requestId: string, error: string) => void;
  /** Get a request by ID */
  getRequest: (requestId: string) => TransferRequest | undefined;
  /** Get active request for a file (if any) */
  getActiveRequestForFile: (fileHash: string) => TransferRequest | undefined;
}

/**
 * Generate a UUID v4
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Hook to manage transfer requests
 */
export function useTransferRequests(
  options: UseTransferRequestsOptions
): UseTransferRequestsReturn {
  const { doc, user_id, user_name } = options;
  const [requests, setRequests] = useState<TransferRequest[]>([]);

  // Subscribe to requests map changes
  useEffect(() => {
    if (!doc) return;

    const requestsMap = getRequestsMap(doc);

    const updateRequests = () => {
      const requestsList: TransferRequest[] = [];
      requestsMap.forEach((value) => {
        if (value && typeof value === 'object') {
          requestsList.push(value as TransferRequest);
        }
      });
      // Sort by created_at descending
      requestsList.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests(requestsList);
    };

    requestsMap.observe(updateRequests);
    updateRequests();

    return () => {
      requestsMap.unobserve(updateRequests);
    };
  }, [doc]);

  // Filter requests by user
  const myRequests = useMemo(
    () => requests.filter(r => r.requester_id === user_id),
    [requests, user_id]
  );

  // Incoming requests (pending requests that this user could serve)
  // Note: This needs to be filtered by files the user has - done in component
  const incomingRequests = useMemo(
    () => requests.filter(
      r => r.status === 'pending' && r.requester_id !== user_id
    ),
    [requests, user_id]
  );

  // Active transfers (either sending or receiving)
  const activeTransfers = useMemo(
    () => requests.filter(
      r =>
        r.status === 'active' &&
        (r.requester_id === user_id || r.seeder_id === user_id)
    ),
    [requests, user_id]
  );

  // Create a new request
  const createRequest = useCallback(
    (fileHash: string): TransferRequest => {
      if (!doc || !user_id || !user_name) {
        throw new Error('Not connected to share room');
      }

      const requestsMap = getRequestsMap(doc);

      // Check for existing pending/active request for this file
      const existing = requests.find(
        r =>
          r.file_hash === fileHash &&
          r.requester_id === user_id &&
          (r.status === 'pending' || r.status === 'active')
      );

      if (existing) {
        return existing;
      }

      const request: TransferRequest = {
        id: generateId(),
        file_hash: fileHash,
        requester_id: user_id,
        requester_name: user_name,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      requestsMap.set(request.id, request);
      return request;
    },
    [doc, user_id, user_name, requests]
  );

  // Accept a request
  const acceptRequest = useCallback(
    (requestId: string) => {
      if (!doc || !user_id || !user_name) return;

      const requestsMap = getRequestsMap(doc);
      const request = requestsMap.get(requestId) as TransferRequest | undefined;

      if (!request || request.status !== 'pending') return;

      requestsMap.set(requestId, {
        ...request,
        status: 'active' as TransferStatus,
        seeder_id: user_id,
        seeder_name: user_name,
        progress: 0,
      });
    },
    [doc, user_id, user_name]
  );

  // Cancel a request
  const cancelRequest = useCallback(
    (requestId: string) => {
      if (!doc) return;

      const requestsMap = getRequestsMap(doc);
      const request = requestsMap.get(requestId) as TransferRequest | undefined;

      if (!request) return;

      // Only requester or seeder can cancel
      if (request.requester_id !== user_id && request.seeder_id !== user_id) {
        return;
      }

      requestsMap.set(requestId, {
        ...request,
        status: 'cancelled' as TransferStatus,
      });
    },
    [doc, user_id]
  );

  // Update progress
  const updateProgress = useCallback(
    (requestId: string, progress: number) => {
      if (!doc) return;

      const requestsMap = getRequestsMap(doc);
      const request = requestsMap.get(requestId) as TransferRequest | undefined;

      if (!request || request.status !== 'active') return;

      requestsMap.set(requestId, {
        ...request,
        progress: Math.min(100, Math.max(0, progress)),
      });
    },
    [doc]
  );

  // Complete request
  const completeRequest = useCallback(
    (requestId: string) => {
      if (!doc) return;

      const requestsMap = getRequestsMap(doc);
      const request = requestsMap.get(requestId) as TransferRequest | undefined;

      if (!request) return;

      requestsMap.set(requestId, {
        ...request,
        status: 'completed' as TransferStatus,
        progress: 100,
        completed_at: new Date().toISOString(),
      });
    },
    [doc]
  );

  // Fail request
  const failRequest = useCallback(
    (requestId: string, error: string) => {
      if (!doc) return;

      const requestsMap = getRequestsMap(doc);
      const request = requestsMap.get(requestId) as TransferRequest | undefined;

      if (!request) return;

      requestsMap.set(requestId, {
        ...request,
        status: 'failed' as TransferStatus,
        error,
      });
    },
    [doc]
  );

  // Get request by ID
  const getRequest = useCallback(
    (requestId: string): TransferRequest | undefined => {
      return requests.find(r => r.id === requestId);
    },
    [requests]
  );

  // Get active request for a file
  const getActiveRequestForFile = useCallback(
    (fileHash: string): TransferRequest | undefined => {
      return requests.find(
        r =>
          r.file_hash === fileHash &&
          (r.status === 'pending' || r.status === 'active')
      );
    },
    [requests]
  );

  return {
    requests,
    myRequests,
    incomingRequests,
    activeTransfers,
    createRequest,
    acceptRequest,
    cancelRequest,
    updateProgress,
    completeRequest,
    failRequest,
    getRequest,
    getActiveRequestForFile,
  };
}
