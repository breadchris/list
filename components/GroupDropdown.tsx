import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Group } from './ContentRepository';
import { useUserInviteStatsQuery } from '../hooks/useGroupQueries';

interface GroupDropdownProps {
  currentGroup: Group | null;
  groups: Group[];
  onGroupChange: (group: Group) => void;
  isLoading?: boolean;
}

export const GroupDropdown: React.FC<GroupDropdownProps> = ({
  currentGroup,
  groups,
  onGroupChange,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch invite stats for current group
  const { data: inviteStats } = useUserInviteStatsQuery(currentGroup?.id);
  const currentInviteCode = inviteStats?.find(stat => stat.group_id === currentGroup?.id);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleGroupSelect = (group: Group) => {
    onGroupChange(group);
    setIsOpen(false);
  };

  const generateInviteUrl = (inviteCode: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${inviteCode}`;
  };

  const handleShowQRCode = () => {
    setIsOpen(false);
    setShowQRModal(true);
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

  if (!currentGroup) {
    return (
      <div className="text-xl font-semibold text-gray-900">
        List App
      </div>
    );
  }

  // If loading, show simple title without dropdown
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-xl font-semibold text-gray-900">
          {currentGroup.name}
        </span>
        <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
        disabled={isLoading}
      >
        <span>{currentGroup.name}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          } ${isLoading ? 'opacity-50' : ''}`}
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

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="py-2">
            {/* Share QR Code - First Option */}
            <button
              onClick={handleShowQRCode}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span className="font-medium">Share QR Code</span>
              </div>
            </button>

            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-t border-b border-gray-100 mt-2">
              Switch Group
            </div>
            <div className="max-h-64 overflow-y-auto">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    currentGroup.id === group.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Code: {group.join_code}
                      </div>
                    </div>
                    {currentGroup.id === group.id && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 mt-2">
              <button
                onClick={() => {
                  if (currentGroup) {
                    navigate(`/group/${currentGroup.id}/settings`);
                    setIsOpen(false);
                  }
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="font-medium">Group Settings</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Share Group Invite
                </h2>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              {currentInviteCode ? (
                <>
                  {/* QR Code */}
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <QRCodeSVG
                        value={generateInviteUrl(currentInviteCode.invite_code)}
                        size={256}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  </div>

                  {/* Invite Code */}
                  <div className="text-center mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invite Code
                    </label>
                    <div className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                      {currentInviteCode.invite_code}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>How to share:</strong> Have someone scan this QR code with their phone camera,
                      or share the invite code for them to enter manually.
                    </p>
                  </div>

                  {/* Copy URL Button */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={generateInviteUrl(currentInviteCode.invite_code)}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                    <button
                      onClick={() => copyInviteUrl(currentInviteCode.invite_code)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* Usage Stats */}
                  <div className="mt-4 text-center text-sm text-gray-600">
                    Used: {currentInviteCode.current_uses}/{currentInviteCode.max_uses || '∞'} times
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Invite Code Yet
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    You need to create an invite code first to share this group.
                  </p>
                  <button
                    onClick={() => {
                      setShowQRModal(false);
                      if (currentGroup) {
                        navigate(`/group/${currentGroup.id}/settings`);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go to Group Settings
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};