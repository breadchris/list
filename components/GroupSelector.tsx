import React, { useState, useEffect } from 'react';
import { Group, contentRepository } from './ContentRepository';

interface GroupSelectorProps {
  currentGroup: Group | null;
  onGroupChange: (group: Group) => void;
}

export const GroupSelector: React.FC<GroupSelectorProps> = ({ 
  currentGroup, 
  onGroupChange 
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const userGroups = await contentRepository.getUserGroups();
      setGroups(userGroups);
      
      // If no current group and we have groups, select the first one
      if (!currentGroup && userGroups.length > 0) {
        onGroupChange(userGroups[0]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const newGroup = await contentRepository.createGroup(groupName.trim());
      setGroups(prev => [newGroup, ...prev]);
      onGroupChange(newGroup);
      setShowModal(false);
      setGroupName('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const group = await contentRepository.joinGroupWithUserCode(joinCode.trim());
      
      // Check if user was already a member
      if ((group as any).alreadyMember) {
        setError(`You're already a member of "${group.name}"`);
        // Still switch to the group
        onGroupChange(group);
        setShowModal(false);
        setJoinCode('');
        return;
      }
      
      // Check if group is already in our list
      const existingGroup = groups.find(g => g.id === group.id);
      if (!existingGroup) {
        setGroups(prev => [group, ...prev]);
      }
      
      onGroupChange(group);
      setShowModal(false);
      setJoinCode('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatJoinCode = (code: string): string => {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {currentGroup ? (
              <div>
                <h2 data-testid="current-group-name" className="text-lg font-medium text-gray-900 truncate">
                  {currentGroup.name}
                </h2>
                <p className="text-sm text-gray-500">
                  Click to view your invite code
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  No Group Selected
                </h2>
                <p className="text-sm text-gray-500">
                  Create or join a group to get started
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {groups.length > 1 && (
              <select
                data-testid="group-selector"
                value={currentGroup?.id || ''}
                onChange={(e) => {
                  const group = groups.find(g => g.id === e.target.value);
                  if (group) onGroupChange(group);
                }}
                className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
            
            <button
              onClick={() => {
                setModalMode('create');
                setShowModal(true);
                setError(null);
              }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              +
            </button>
            
            <button
              onClick={() => {
                setModalMode('join');
                setShowModal(true);
                setError(null);
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                 onClick={() => setShowModal(false)} />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {modalMode === 'create' ? 'Create New Group' : 'Join Group'}
                </h3>

                {error && (
                  <div data-testid="join-error-message" className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {modalMode === 'create' ? (
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        maxLength={50}
                        required
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!groupName.trim() || loading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading ? 'Creating...' : 'Create Group'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleJoinGroup}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Join Code
                      </label>
                      <input
                        data-testid="join-code-input"
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(formatJoinCode(e.target.value))}
                        placeholder="Enter 6-character code..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider uppercase"
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="join-group-submit"
                        type="submit"
                        disabled={joinCode.length !== 6 || loading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading ? 'Joining...' : 'Join Group'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};