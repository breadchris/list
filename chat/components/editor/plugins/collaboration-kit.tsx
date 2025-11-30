'use client';

import { YjsPlugin } from '@platejs/yjs/react';

import { RemoteCursorOverlay } from '@/components/ui/remote-cursor-overlay';

export const CollaborationKit = [
  YjsPlugin.configure({
    render: {
      afterEditable: RemoteCursorOverlay,
    },
  }),
];
