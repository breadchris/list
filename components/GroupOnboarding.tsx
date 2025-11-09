import React, { useState } from 'react';
import { useCreateGroupMutation, useJoinGroupMutation } from '../hooks/useGroupQueries';

interface GroupOnboardingProps {
  onComplete: () => void;
}

export const GroupOnboarding: React.FC<GroupOnboardingProps> = ({ onComplete }) => {
  const [activeMode, setActiveMode] = useState<'create' | 'join' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createGroupMutation = useCreateGroupMutation();
  const joinGroupMutation = useJoinGroupMutation();

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setError(null);

    try {
      await createGroupMutation.mutateAsync(groupName.trim());
      onComplete();
    } catch (error: any) {
      setError(error.message || 'Failed to create group');
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joinCode.length !== 6) return;

    setError(null);

    try {
      const result = await joinGroupMutation.mutateAsync(joinCode.trim());

      // Check if user was already a member
      if ((result as any).alreadyMember) {
        setError(`You're already a member of "${result.name}"`);
        // Still complete onboarding since they have a group
        setTimeout(() => onComplete(), 1500);
        return;
      }

      onComplete();
    } catch (error: any) {
      setError(error.message || 'Failed to join group');
    }
  };

  const formatJoinCode = (code: string): string => {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  };

  const isLoading = createGroupMutation.isPending || joinGroupMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to List
          </h1>
          <p className="text-lg text-gray-600">
            To get started, create a new group or join an existing one
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Group Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Create New Group
              </h2>
              <p className="text-gray-600 mb-6">
                Start fresh with your own group and invite others to join
              </p>

              {activeMode === 'create' ? (
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Enter group name..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={50}
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode(null);
                        setGroupName('');
                        setError(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!groupName.trim() || isLoading}
                      className="flex-1 px-4 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Creating...' : 'Create Group'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setActiveMode('create');
                    setJoinCode('');
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Group
                </button>
              )}
            </div>
          </div>

          {/* Join Group Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Join Existing Group
              </h2>
              <p className="text-gray-600 mb-6">
                Enter a 6-character invite code from a friend
              </p>

              {activeMode === 'join' ? (
                <form onSubmit={handleJoinGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invite Code
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(formatJoinCode(e.target.value))}
                      placeholder="ABC123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-lg font-mono tracking-wider uppercase"
                      maxLength={6}
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode(null);
                        setJoinCode('');
                        setError(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={joinCode.length !== 6 || isLoading}
                      className="flex-1 px-4 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Joining...' : 'Join Group'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setActiveMode('join');
                    setGroupName('');
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Group
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Groups allow you to share and collaborate on lists with others.
            <br />
            You can create multiple groups or join as many as you'd like.
          </p>
        </div>
      </div>
    </div>
  );
};
