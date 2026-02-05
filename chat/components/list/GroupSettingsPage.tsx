import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Group, contentRepository } from '@/lib/list/ContentRepository';
import { useGroupsQuery, useUserInviteStatsQuery, useCreateInviteCodeMutation, useLeaveGroupMutation, useCreateGroupMutation, useJoinGroupMutation } from '@/hooks/list/useGroupQueries';
import { useToast } from './ToastProvider';
import { InviteTreeVisualization } from './InviteTreeVisualization';
import { AccessLinksManager } from './AccessLinksManager';

export const GroupSettingsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteTree, setShowInviteTree] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Fetch user's groups
  const { data: groups = [], isLoading: groupsLoading } = useGroupsQuery({ enabled: true });
  const currentGroup = groups.find(g => g.id === groupId);

  // Fetch invite stats for current group
  const { data: inviteStats } = useUserInviteStatsQuery(groupId);
  const currentInviteCode = inviteStats?.find(stat => stat.group_id === groupId);

  // Mutations
  const createInviteCodeMutation = useCreateInviteCodeMutation();
  const leaveGroupMutation = useLeaveGroupMutation();
  const createGroupMutation = useCreateGroupMutation();
  const joinGroupMutation = useJoinGroupMutation();

  const generateInviteUrl = (inviteCode: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/list/invite/${inviteCode}`;
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
      toast.success('Invite code created!', 'You can now share this code with others.');
    } catch (error) {
      console.error('Failed to create invite code:', error);
      toast.error('Failed to create invite code', 'Please try again.');
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
      toast.success('Left group', `You've left "${currentGroup.name}".`);

      // Navigate to first available group or home
      const remainingGroups = groups.filter(g => g.id !== currentGroup.id);
      if (remainingGroups.length > 0) {
        router.push(`/list/group/${remainingGroups[0].id}`);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to leave group:', error);
      toast.error('Failed to leave group', 'Please try again.');
    }
  };

  const handleGroupSwitch = (group: Group) => {
    router.push(`/list/group/${group.id}`);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const newGroup = await createGroupMutation.mutateAsync(groupName.trim());
      setShowCreateModal(false);
      setGroupName('');
      toast.success('Group created!', `Successfully created "${newGroup.name}".`);
      router.push(`/list/group/${newGroup.id}`);
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group', 'Please try again.');
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      const group = await joinGroupMutation.mutateAsync(joinCode.trim());
      setShowJoinModal(false);
      setJoinCode('');

      if ((group as any).alreadyMember) {
        toast.success('Already a member', `You're already part of "${group.name}".`);
      } else {
        toast.success('Joined group!', `Successfully joined "${group.name}".`);
      }

      router.push(`/list/group/${group.id}`);
    } catch (error) {
      console.error('Failed to join group:', error);
      toast.error('Failed to join group', 'Please check the code and try again.');
    }
  };

  const formatJoinCode = (code: string): string => {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  };

  if (groupsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Group Not Found</h2>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/list/group/${groupId}`)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Content</span>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Group Settings</h1>
          <div className="w-24"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Current Group Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Group</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Group Name</label>
                <p className="mt-1 text-lg text-gray-900">{currentGroup.name}</p>
              </div>

              {currentInviteCode ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Your Invite Code</label>
                    <p className="mt-1 text-2xl font-mono text-gray-900">{currentInviteCode.invite_code}</p>
                  </div>
                  <div className="text-sm text-gray-600">
                    Used: {currentInviteCode.current_uses}/{currentInviteCode.max_uses || '∞'} times
                  </div>

                  {!showInviteUrl ? (
                    <button
                      onClick={() => setShowInviteUrl(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Show invite link
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Invite URL</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={generateInviteUrl(currentInviteCode.invite_code)}
                          readOnly
                          className="flex-1 text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 font-mono"
                        />
                        <button
                          onClick={() => copyInviteUrl(currentInviteCode.invite_code)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
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
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    You don't have an invite code for this group yet.
                  </p>
                  <button
                    onClick={handleCreateInviteCode}
                    disabled={createInviteCodeMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {createInviteCodeMutation.isPending ? 'Creating...' : 'Create Invite Code'}
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleLeaveGroup}
                  disabled={leaveGroupMutation.isPending}
                  className="w-full px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                >
                  {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
                </button>
              </div>
            </div>
          </div>

          {/* Invite Tree Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Group Invite Tree</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Visualize who invited whom in this group
                </p>
              </div>
              <button
                onClick={() => setShowInviteTree(!showInviteTree)}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <span>{showInviteTree ? 'Hide' : 'Show'} Tree</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showInviteTree ? 'rotate-180' : 'rotate-0'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {showInviteTree && (
              <div className="mt-4">
                <InviteTreeVisualization groupId={groupId!} />
              </div>
            )}
          </div>

          {/* Access Links Card */}
          <AccessLinksManager groupId={groupId!} />

          {/* All Groups Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Groups</h2>
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSwitch(group)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentGroup.id === group.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{group.name}</div>
                  {currentGroup.id === group.id && (
                    <div className="text-xs text-blue-600 mt-1">Current group</div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create New Group
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Join Group
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setGroupName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={createGroupMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim() || createGroupMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Join Group</h3>
            <form onSubmit={handleJoinGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Join Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(formatJoinCode(e.target.value))}
                  placeholder="Enter 6-character code..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono tracking-wider uppercase"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCode('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={joinGroupMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinCode.length !== 6 || joinGroupMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {joinGroupMutation.isPending ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
