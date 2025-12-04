import React, { useState, useMemo } from 'react';
import { Group } from '@/lib/list/ContentRepository';

interface SendToGroupModalProps {
  isVisible: boolean;
  groups: Group[];
  currentGroupId: string;
  selectedCount: number;
  onClose: () => void;
  onSend: (targetGroupId: string) => void;
  isLoading: boolean;
}

const SendToGroupModal: React.FC<SendToGroupModalProps> = ({
  isVisible,
  groups,
  currentGroupId,
  selectedCount,
  onClose,
  onSend,
  isLoading
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Filter groups: exclude current group and apply search
  const filteredGroups = useMemo(() => {
    return groups
      .filter(g => g.id !== currentGroupId)
      .filter(g =>
        searchQuery === '' ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [groups, currentGroupId, searchQuery]);

  const handleSend = () => {
    if (selectedGroupId) {
      onSend(selectedGroupId);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedGroupId(null);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Send to Group
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Copy {selectedCount} {selectedCount === 1 ? 'item' : 'items'} to another group
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Note: Only selected items will be copied, not their nested content
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Group List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {searchQuery ? 'No groups found' : 'No other groups available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  disabled={isLoading}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedGroupId === group.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-medium text-gray-900">{group.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedGroupId || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendToGroupModal;
