'use client';

/**
 * Main share page component
 * Orchestrates all file sharing functionality
 */

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShareRoom } from '@/hooks/share/useShareRoom';
import { useShareAwareness, type AwarenessUser } from '@/hooks/share/useShareAwareness';
import { useSharedFiles } from '@/hooks/share/useSharedFiles';
import { useTransferRequests } from '@/hooks/share/useTransferRequests';
import { useFileTransfer } from '@/hooks/share/useFileTransfer';
import { FileGrid } from './FileGrid';
import { FileDropZone } from './FileDropZone';
import { OnlineMembers } from './OnlineMembers';
import { TransferRequestToast, type IncomingRequest } from './TransferRequestToast';
import type { SharedFile, FileHolder, TransferProgress, TransferRequest } from '@/types/share';

export interface SharePageProps {
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  /** Whether to show the header (default: false, header is in parent route) */
  showHeader?: boolean;
  onBack?: () => void;
}

/**
 * Main share page component
 */
export function SharePage({
  groupId,
  groupName,
  userId,
  userName,
  showHeader = false,
  onBack,
}: SharePageProps) {
  // Track files the user has locally (in memory for this session)
  const localFilesRef = useRef<Map<string, File>>(new Map());
  const [transferProgress, setTransferProgress] = useState<Map<string, TransferProgress>>(
    new Map()
  );

  // Initialize share room
  const { doc, provider, isConnected, peerCount, isReady, error } = useShareRoom({
    group_id: groupId,
    user_id: userId,
    user_name: userName,
  });

  // Awareness for presence
  const {
    onlineUsers,
    localState,
    setAvailableFiles,
    addAvailableFile,
    setLocalField,
    getUsersWithFile,
  } = useShareAwareness({
    provider,
    user_id: userId,
    user_name: userName,
  });

  // Shared files
  const {
    files,
    isLoading: filesLoading,
    addFile,
    getFile,
    isHolder,
    addAsHolder,
    getHolders: getHolderIds,
  } = useSharedFiles({
    doc,
    user_id: userId,
    user_name: userName,
  });

  // Transfer requests
  const {
    requests,
    incomingRequests,
    createRequest,
    acceptRequest,
    cancelRequest,
    updateProgress,
    completeRequest,
    failRequest,
    getActiveRequestForFile,
  } = useTransferRequests({
    doc,
    user_id: userId,
    user_name: userName,
  });

  // File transfer
  const { sendFile, cancelTransfer, transfers, isTransferring } = useFileTransfer({
    provider,
    user_id: userId,
    onFileReceived: useCallback(
      async (file: File, request: TransferRequest) => {
        // Store the file locally
        const hash = request.file_hash || '';
        if (hash) {
          localFilesRef.current.set(hash, file);
          addAsHolder(hash);
          addAvailableFile(hash);
        }

        // Trigger download for user
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      [addAsHolder, addAvailableFile]
    ),
    onProgress: useCallback(
      (progress: TransferProgress) => {
        setTransferProgress(prev => {
          const next = new Map(prev);
          next.set(progress.request_id, progress);
          return next;
        });
        updateProgress(progress.request_id, progress.progress);
      },
      [updateProgress]
    ),
    onComplete: useCallback(
      (requestId: string) => {
        completeRequest(requestId);
        setTransferProgress(prev => {
          const next = new Map(prev);
          next.delete(requestId);
          return next;
        });
      },
      [completeRequest]
    ),
    onError: useCallback(
      (requestId: string, error: string) => {
        failRequest(requestId, error);
        setTransferProgress(prev => {
          const next = new Map(prev);
          next.delete(requestId);
          return next;
        });
      },
      [failRequest]
    ),
  });

  // Get holders with online status
  const getHolders = useCallback(
    (hash: string): FileHolder[] => {
      const holderIds = getHolderIds(hash);
      const onlineUserIds = new Set(onlineUsers.map(u => u.user_id));

      return holderIds.map(holderId => {
        const onlineUser = onlineUsers.find(u => u.user_id === holderId);
        const isOnline = onlineUserIds.has(holderId) || holderId === userId;
        const isServing = onlineUser?.serving_files.includes(hash) || false;

        return {
          user_id: holderId,
          user_name: onlineUser?.user_name || (holderId === userId ? userName : 'Unknown'),
          is_online: isOnline,
          is_serving: isServing,
        };
      });
    },
    [getHolderIds, onlineUsers, userId, userName]
  );

  // Get progress for a file
  const getProgress = useCallback(
    (hash: string): TransferProgress | undefined => {
      const request = getActiveRequestForFile(hash);
      if (!request) return undefined;
      return transferProgress.get(request.id);
    },
    [getActiveRequestForFile, transferProgress]
  );

  // Handle file drop
  const handleFilesAdded = useCallback(
    async (droppedFiles: File[], onProgress?: (progress: number) => void) => {
      const totalFiles = droppedFiles.length;
      let completedFiles = 0;

      for (const file of droppedFiles) {
        const sharedFile = await addFile(file, (fileProgress) => {
          // Calculate overall progress: completed files + current file progress
          const overallProgress = ((completedFiles + fileProgress / 100) / totalFiles) * 100;
          onProgress?.(overallProgress);
        });
        // Store locally
        localFilesRef.current.set(sharedFile.hash, file);
        addAvailableFile(sharedFile.hash);
        completedFiles++;
      }
      onProgress?.(100);
    },
    [addFile, addAvailableFile]
  );

  // Handle file request
  const handleRequest = useCallback(
    (hash: string) => {
      createRequest(hash);
    },
    [createRequest]
  );

  // Handle request cancellation
  const handleCancel = useCallback(
    (requestId: string) => {
      cancelRequest(requestId);
      cancelTransfer(requestId);
    },
    [cancelRequest, cancelTransfer]
  );

  // Handle accepting an incoming request
  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const file = localFilesRef.current.get(request.file_hash);
      if (!file) {
        failRequest(requestId, 'File not available locally');
        return;
      }

      // Accept the request
      acceptRequest(requestId);

      // Find the requester's peer ID
      const requester = onlineUsers.find(u => u.user_id === request.requester_id);
      if (!requester) {
        failRequest(requestId, 'Requester not online');
        return;
      }

      // Start the transfer
      try {
        setLocalField('current_action', 'uploading');
        setLocalField('transfer_target', request.file_hash);

        // Get peer ID from connections
        const room = (provider as unknown as {
          room?: { webrtcConns: Map<string, unknown> };
        })?.room;

        if (!room) {
          failRequest(requestId, 'Not connected');
          return;
        }

        // Find the peer connection for this user
        // Note: In a real implementation, we'd need to map user IDs to peer IDs
        // For now, we'll use the first available peer (simplified)
        const peerId = Array.from(room.webrtcConns.keys())[0];
        if (!peerId) {
          failRequest(requestId, 'No peer connection');
          return;
        }

        await sendFile(peerId, file, request);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Transfer failed';
        failRequest(requestId, message);
      } finally {
        setLocalField('current_action', 'idle');
        setLocalField('transfer_target', undefined);
      }
    },
    [
      requests,
      onlineUsers,
      provider,
      acceptRequest,
      failRequest,
      sendFile,
      setLocalField,
    ]
  );

  // Handle declining a request
  const handleDeclineRequest = useCallback(
    (requestId: string) => {
      cancelRequest(requestId);
    },
    [cancelRequest]
  );

  // Filter incoming requests to ones we can serve
  const serveableRequests = useMemo((): IncomingRequest[] => {
    return incomingRequests
      .filter(request => {
        // Check if we have this file locally
        return localFilesRef.current.has(request.file_hash);
      })
      .map(request => ({
        request,
        file: getFile(request.file_hash),
      }));
  }, [incomingRequests, getFile]);

  // Update available files when local files change
  useEffect(() => {
    const hashes = Array.from(localFilesRef.current.keys());
    setAvailableFiles(hashes);
  }, [files, setAvailableFiles]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-center">
          <h2 className="text-lg font-medium mb-2">Connection Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - only shown if showHeader is true */}
      {showHeader && (
        <header className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="font-semibold">{groupName}</h1>
              <p className="text-xs text-muted-foreground">File Sharing</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <OnlineMembers
              users={onlineUsers}
              isConnected={isConnected}
              peerCount={peerCount}
            />
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Online members bar when header not shown */}
      {!showHeader && (
        <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
          <OnlineMembers
            users={onlineUsers}
            isConnected={isConnected}
            peerCount={peerCount}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4">
        {/* Drop zone */}
        <FileDropZone
          onFilesAdded={handleFilesAdded}
          disabled={!isReady}
          className="mb-6"
        />

        {/* Files grid */}
        {filesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <FileGrid
            files={files}
            getHolders={getHolders}
            getRequest={getActiveRequestForFile}
            getProgress={getProgress}
            isHolder={isHolder}
            onRequest={handleRequest}
            onCancel={handleCancel}
          />
        )}
      </main>

      {/* Incoming request toasts */}
      <TransferRequestToast
        requests={serveableRequests}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />
    </div>
  );
}
