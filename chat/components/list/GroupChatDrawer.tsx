import React from 'react';
import { Drawer } from './vaul/index';
import { RealtimeChat } from './RealtimeChat';

interface GroupChatDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  username: string;
}

/**
 * Group chat drawer using Supabase Realtime
 * Messages are ephemeral and not persisted in the database
 */
export const GroupChatDrawer: React.FC<GroupChatDrawerProps> = ({
  isOpen,
  onOpenChange,
  groupId,
  username,
}) => {
  const roomName = `group-chat-${groupId}`;

  return (
    <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="bg-white flex flex-col rounded-t-[10px] h-[85vh] mt-24 fixed bottom-0 left-0 right-0 z-50">
          {/* Handle */}
          <div className="p-4 bg-white rounded-t-[10px] flex-shrink-0">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-4" />
            <div className="flex items-center justify-between">
              <Drawer.Title className="font-bold text-lg text-gray-900">
                💬 Group Chat
              </Drawer.Title>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Component */}
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <RealtimeChat roomName={roomName} username={username} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
