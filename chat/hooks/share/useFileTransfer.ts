'use client';

/**
 * Hook to manage file transfers via WebRTC data channels
 * Handles chunked file sending and receiving
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { WebrtcProvider } from 'y-webrtc';
import type {
  TransferRequest,
  TransferProgress,
  FileStartMessage,
  FileChunkMessage,
  FileEndMessage,
  FileErrorMessage,
} from '@/types/share';
import { hashFile, verifyFileHash } from '@/lib/share/file-hasher';
import {
  chunkFile,
  ChunkAssembler,
  createChunkedFileInfo,
  CHUNK_SIZE,
} from '@/lib/share/file-chunker';

export interface UseFileTransferOptions {
  provider: WebrtcProvider | null;
  user_id: string;
  /** Callback when a file is received */
  onFileReceived?: (file: File, request: TransferRequest) => void;
  /** Callback when transfer progress updates */
  onProgress?: (progress: TransferProgress) => void;
  /** Callback when transfer completes */
  onComplete?: (requestId: string) => void;
  /** Callback when transfer fails */
  onError?: (requestId: string, error: string) => void;
}

export interface UseFileTransferReturn {
  /** Send a file to a peer */
  sendFile: (
    peerId: string,
    file: File,
    request: TransferRequest
  ) => Promise<void>;
  /** Cancel an ongoing transfer */
  cancelTransfer: (requestId: string) => void;
  /** Current transfer progress by request ID */
  transfers: Map<string, TransferProgress>;
  /** Whether currently transferring */
  isTransferring: boolean;
}

/**
 * Hook to manage file transfers
 */
export function useFileTransfer(
  options: UseFileTransferOptions
): UseFileTransferReturn {
  const { provider, user_id, onFileReceived, onProgress, onComplete, onError } = options;

  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(
    new Map()
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Track ongoing transfers
  const activeTransfersRef = useRef<Map<string, AbortController>>(new Map());
  // Track chunk assemblers for receiving
  const assemblersRef = useRef<Map<string, ChunkAssembler>>(new Map());
  // Track transfer start times for speed calculation
  const startTimesRef = useRef<Map<string, number>>(new Map());
  // Track bytes transferred for speed calculation
  const bytesTransferredRef = useRef<Map<string, number>>(new Map());

  // Update transfer progress
  const updateTransferProgress = useCallback(
    (requestId: string, updates: Partial<TransferProgress>) => {
      setTransfers(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(requestId) || {
          request_id: requestId,
          file_hash: '',
          progress: 0,
          speed: 0,
          eta: Infinity,
          transferred: 0,
          total: 0,
          status: 'connecting' as const,
        };
        const updated = { ...existing, ...updates };
        newMap.set(requestId, updated);
        onProgress?.(updated);
        return newMap;
      });
    },
    [onProgress]
  );

  // Calculate transfer speed and ETA
  const calculateSpeed = useCallback(
    (requestId: string, bytesTransferred: number, totalBytes: number) => {
      const startTime = startTimesRef.current.get(requestId) || Date.now();
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
      const remaining = totalBytes - bytesTransferred;
      const eta = speed > 0 ? remaining / speed : Infinity;
      return { speed, eta };
    },
    []
  );

  // Send a file to a peer
  const sendFile = useCallback(
    async (peerId: string, file: File, request: TransferRequest) => {
      if (!provider) {
        throw new Error('WebRTC provider not available');
      }

      // Get the peer connection
      const room = (provider as unknown as {
        room?: {
          webrtcConns: Map<string, { peer: { send: (data: unknown) => void } }>;
        };
      }).room;

      const conn = room?.webrtcConns.get(peerId);
      if (!conn?.peer) {
        throw new Error('Peer not connected');
      }

      const peer = conn.peer;
      const requestId = request.id;
      const abortController = new AbortController();
      activeTransfersRef.current.set(requestId, abortController);

      try {
        setIsTransferring(true);

        // Compute hash
        const hash = await hashFile(file);
        const fileInfo = createChunkedFileInfo(file, hash);

        // Initialize progress tracking
        startTimesRef.current.set(requestId, Date.now());
        bytesTransferredRef.current.set(requestId, 0);

        updateTransferProgress(requestId, {
          file_hash: hash,
          total: file.size,
          transferred: 0,
          progress: 0,
          status: 'transferring',
        });

        // Send file start message
        const startMessage: FileStartMessage = {
          type: 'file-start',
          request_id: requestId,
          name: file.name,
          size: file.size,
          hash,
          total_chunks: fileInfo.total_chunks,
        };
        peer.send(JSON.stringify(startMessage));

        // Send chunks
        let chunkIndex = 0;
        for await (const { index, data, isLast } of chunkFile(file)) {
          // Check for cancellation
          if (abortController.signal.aborted) {
            throw new Error('Transfer cancelled');
          }

          // Send chunk
          const chunkMessage: FileChunkMessage = {
            type: 'file-chunk',
            request_id: requestId,
            index,
            data: data.buffer as ArrayBuffer,
          };

          // For binary data, send the header first then the raw data
          peer.send(
            JSON.stringify({
              type: 'file-chunk',
              request_id: requestId,
              index,
              size: data.length,
            })
          );
          peer.send(data);

          // Update progress
          const bytesTransferred =
            (bytesTransferredRef.current.get(requestId) || 0) + data.length;
          bytesTransferredRef.current.set(requestId, bytesTransferred);

          const progress = Math.round((bytesTransferred / file.size) * 100);
          const { speed, eta } = calculateSpeed(requestId, bytesTransferred, file.size);

          updateTransferProgress(requestId, {
            progress,
            transferred: bytesTransferred,
            speed,
            eta,
          });

          chunkIndex++;
        }

        // Send file end message
        const endMessage: FileEndMessage = {
          type: 'file-end',
          request_id: requestId,
          hash,
        };
        peer.send(JSON.stringify(endMessage));

        // Mark as complete
        updateTransferProgress(requestId, {
          progress: 100,
          status: 'done',
          eta: 0,
        });

        onComplete?.(requestId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateTransferProgress(requestId, {
          status: 'error',
        });
        onError?.(requestId, errorMessage);

        // Send error message to peer
        const errorMsg: FileErrorMessage = {
          type: 'file-error',
          request_id: requestId,
          error: errorMessage,
        };
        try {
          peer.send(JSON.stringify(errorMsg));
        } catch {
          // Peer might be disconnected
        }

        throw error;
      } finally {
        activeTransfersRef.current.delete(requestId);
        startTimesRef.current.delete(requestId);
        bytesTransferredRef.current.delete(requestId);
        setIsTransferring(activeTransfersRef.current.size > 0);
      }
    },
    [provider, updateTransferProgress, calculateSpeed, onComplete, onError]
  );

  // Cancel a transfer
  const cancelTransfer = useCallback((requestId: string) => {
    const controller = activeTransfersRef.current.get(requestId);
    if (controller) {
      controller.abort();
    }
    // Clean up assembler if receiving
    assemblersRef.current.delete(requestId);
  }, []);

  // Handle incoming messages from peers
  useEffect(() => {
    if (!provider) return;

    const room = (provider as unknown as {
      room?: {
        webrtcConns: Map<
          string,
          {
            peer: {
              on: (event: string, handler: (data: unknown) => void) => void;
              off: (event: string, handler: (data: unknown) => void) => void;
            };
          }
        >;
      };
    }).room;

    if (!room) return;

    const messageHandlers = new Map<string, (data: unknown) => void>();

    // Set up message handlers for each peer
    const setupPeerHandlers = () => {
      room.webrtcConns.forEach((conn, peerId) => {
        if (messageHandlers.has(peerId)) return;

        let pendingChunk: { request_id: string; index: number; size: number } | null = null;

        const handler = (data: unknown) => {
          // Handle binary chunk data
          if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            if (pendingChunk) {
              const assembler = assemblersRef.current.get(pendingChunk.request_id);
              if (assembler) {
                const uint8Data =
                  data instanceof ArrayBuffer ? new Uint8Array(data) : data;
                const isComplete = assembler.addChunk(pendingChunk.index, uint8Data);

                // Update progress
                const progress = assembler.getProgress();
                updateTransferProgress(pendingChunk.request_id, {
                  progress,
                  status: 'transferring',
                });

                if (isComplete) {
                  // Assemble and verify file
                  try {
                    const file = assembler.assemble();
                    const request_id = pendingChunk.request_id;

                    updateTransferProgress(request_id, {
                      status: 'verifying',
                      progress: 100,
                    });

                    // Verify hash
                    verifyFileHash(file, assembler.getExpectedHash()).then(
                      isValid => {
                        if (isValid) {
                          updateTransferProgress(request_id, {
                            status: 'done',
                          });
                          // Get the request from somewhere (would need to pass it)
                          onFileReceived?.(file, {
                            id: request_id,
                          } as TransferRequest);
                          onComplete?.(request_id);
                        } else {
                          updateTransferProgress(request_id, {
                            status: 'error',
                          });
                          onError?.(request_id, 'Hash verification failed');
                        }
                        assemblersRef.current.delete(request_id);
                      }
                    );
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error ? error.message : 'Assembly failed';
                    onError?.(pendingChunk.request_id, errorMessage);
                    assemblersRef.current.delete(pendingChunk.request_id);
                  }
                }
              }
              pendingChunk = null;
            }
            return;
          }

          // Handle JSON messages
          if (typeof data === 'string') {
            try {
              const message = JSON.parse(data);

              switch (message.type) {
                case 'file-start': {
                  const startMsg = message as FileStartMessage;
                  const assembler = new ChunkAssembler({
                    name: startMsg.name,
                    size: startMsg.size,
                    type: 'application/octet-stream',
                    hash: startMsg.hash,
                    total_chunks: startMsg.total_chunks,
                    chunk_size: CHUNK_SIZE,
                  });
                  assemblersRef.current.set(startMsg.request_id, assembler);
                  startTimesRef.current.set(startMsg.request_id, Date.now());
                  updateTransferProgress(startMsg.request_id, {
                    file_hash: startMsg.hash,
                    total: startMsg.size,
                    transferred: 0,
                    progress: 0,
                    status: 'transferring',
                  });
                  setIsTransferring(true);
                  break;
                }

                case 'file-chunk': {
                  // This is the chunk header, next message will be binary data
                  pendingChunk = {
                    request_id: message.request_id,
                    index: message.index,
                    size: message.size,
                  };
                  break;
                }

                case 'file-end': {
                  // File transfer complete - verification happens when last chunk received
                  break;
                }

                case 'file-error': {
                  const errorMsg = message as FileErrorMessage;
                  updateTransferProgress(errorMsg.request_id, {
                    status: 'error',
                  });
                  onError?.(errorMsg.request_id, errorMsg.error);
                  assemblersRef.current.delete(errorMsg.request_id);
                  break;
                }
              }
            } catch {
              // Not JSON, ignore
            }
          }
        };

        conn.peer.on('data', handler);
        messageHandlers.set(peerId, handler);
      });
    };

    // Initial setup
    setupPeerHandlers();

    // Listen for new peers
    const peersHandler = () => {
      setupPeerHandlers();
    };
    provider.on('peers', peersHandler);

    return () => {
      provider.off('peers', peersHandler);
      // Clean up message handlers
      room.webrtcConns.forEach((conn, peerId) => {
        const handler = messageHandlers.get(peerId);
        if (handler) {
          conn.peer.off('data', handler);
        }
      });
      messageHandlers.clear();
    };
  }, [provider, updateTransferProgress, onFileReceived, onComplete, onError]);

  return {
    sendFile,
    cancelTransfer,
    transfers,
    isTransferring,
  };
}
