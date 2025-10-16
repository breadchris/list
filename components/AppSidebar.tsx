import React, { useState } from 'react';
import { Group, contentRepository } from './ContentRepository';
import { useUserInviteStatsQuery, useCreateInviteCodeMutation, useLeaveGroupMutation } from '../hooks/useGroupQueries';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Group | null;
  groups: Group[];
  onGroupChange: (group: Group) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onLeaveGroup?: (groupId: string) => void;
  isLoading?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onClose,
  currentGroup,
  groups,
  onGroupChange,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  isLoading = false
}) => {
  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const { data: inviteStats } = useUserInviteStatsQuery(currentGroup?.id);
  const createInviteCodeMutation = useCreateInviteCodeMutation();
  const leaveGroupMutation = useLeaveGroupMutation();

  const currentInviteCode = inviteStats?.find(stat => stat.group_id === currentGroup?.id);

  const generateInviteUrl = (inviteCode: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${inviteCode}`;
  };

  const copyInviteUrl = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(generateInviteUrl(inviteCode));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite URL:', error);
    }
  };

  const handleCreateInviteCode = async () => {
    if (!currentGroup) return;

    try {
      await createInviteCodeMutation.mutateAsync({
        groupId: currentGroup.id
      });
    } catch (error) {
      console.error('Failed to create invite code:', error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentGroup) return;

    const confirmed = window.confirm(
      `Are you sure you want to leave "${currentGroup.name}"? You will lose access to all content in this group.`
    );

    if (!confirmed) return;

    try {
      await leaveGroupMutation.mutateAsync(currentGroup.id);
      // Callback to handle navigation after leaving
      if (onLeaveGroup) {
        onLeaveGroup(currentGroup.id);
      }
      onClose(); // Close sidebar after leaving
    } catch (error) {
      console.error('Failed to leave group:', error);
      // Error handling is done by the mutation
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-10 z-40 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div data-testid="app-sidebar" className="fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Group Info */}
          {currentGroup && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">{currentGroup.name}</h3>
              <div className="space-y-2">
                {currentInviteCode ? (
                  <>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Your Invite Code:</span> <span data-testid="user-invite-code">{currentInviteCode.invite_code}</span>
                    </div>
                    <div className="text-xs text-gray-500" data-testid="invite-stats-container">
                      Used: <span data-testid="current-uses-stat">{currentInviteCode.current_uses}</span>/<span data-testid="max-uses-stat">{currentInviteCode.max_uses || '∞'}</span> times
                    </div>

                    {!showInviteUrl ? (
                      <button
                        data-testid="show-invite-url-button"
                        onClick={() => setShowInviteUrl(true)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Show invite link
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Invite URL:</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            data-testid="invite-url-input"
                            type="text"
                            value={generateInviteUrl(currentInviteCode.invite_code)}
                            readOnly
                            className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 font-mono"
                          />
                          <button
                            data-testid="copy-invite-code-button"
                            onClick={() => copyInviteUrl(currentInviteCode.invite_code)}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            {copySuccess ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={() => setShowInviteUrl(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Hide invite link
                    </button>
                  </div>
                )}
                </>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      You don't have an invite code for this group yet.
                    </div>
                    <button
                      data-testid="create-invite-code-button"
                      onClick={handleCreateInviteCode}
                      disabled={createInviteCodeMutation.isPending}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createInviteCodeMutation.isPending ? 'Creating...' : 'Create Invite Code'}
                    </button>
                  </div>
                )}

                {/* Leave Group Button */}
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <button
                    onClick={handleLeaveGroup}
                    disabled={leaveGroupMutation.isPending}
                    className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Groups List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Your Groups</h4>
                {isLoading && (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                )}
              </div>
              <div className="space-y-2">
                {groups.length === 0 && !isLoading ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No groups yet. Create or join one to get started.
                  </p>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      data-testid="group-button"
                      onClick={() => {
                        onGroupChange(group);
                        onClose();
                      }}
                      disabled={isLoading}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors disabled:opacity-50 ${
                        currentGroup?.id === group.id
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-gray-500">Click to view invite options</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              data-testid="create-group-button"
              onClick={() => {
                onCreateGroup();
                onClose();
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Create New Group
            </button>
            <button
              data-testid="join-group-button"
              onClick={() => {
                onJoinGroup();
                onClose();
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Join Group
            </button>
          </div>
        </div>
      </div>
    </>
  );
};