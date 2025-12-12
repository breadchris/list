'use client';

/**
 * Toast notification for incoming file transfer requests
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TransferRequest, SharedFile } from '@/types/share';
import { formatBytes } from '@/lib/share/file-chunker';

export interface IncomingRequest {
  request: TransferRequest;
  file: SharedFile | undefined;
}

export interface TransferRequestToastProps {
  requests: IncomingRequest[];
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

/**
 * Single request toast item
 */
const RequestToastItem = memo(function RequestToastItem({
  request,
  file,
  onAccept,
  onDecline,
}: {
  request: TransferRequest;
  file: SharedFile | undefined;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [isNew, setIsNew] = useState(true);

  // Remove "new" badge after a few seconds
  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card className="p-4 shadow-lg border-2 border-primary/20">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <motion.div
            className="p-2 bg-primary/10 rounded-full"
            animate={isNew ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: isNew ? Infinity : 0 }}
          >
            <Download className="w-5 h-5 text-primary" />
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate">
                {request.requester_name}
              </span>
              {isNew && (
                <motion.span
                  className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  New
                </motion.span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-2">
              wants to download
            </p>

            {file && (
              <div className="text-sm bg-muted rounded px-2 py-1 mb-3">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onAccept} className="flex-1">
                <Check className="w-4 h-4 mr-1" />
                Send
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDecline}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-1" />
                Decline
              </Button>
            </div>
          </div>

          {/* Close button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDecline}
            className="h-6 w-6 -mt-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
});

/**
 * Container for incoming request toasts
 */
export const TransferRequestToast = memo(function TransferRequestToast({
  requests,
  onAccept,
  onDecline,
}: TransferRequestToastProps) {
  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {requests.map(({ request, file }) => (
          <RequestToastItem
            key={request.id}
            request={request}
            file={file}
            onAccept={() => onAccept(request.id)}
            onDecline={() => onDecline(request.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});
