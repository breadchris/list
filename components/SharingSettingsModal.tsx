import React, { useState, useEffect } from 'react';
import { Content, contentRepository, SharingResponse } from './ContentRepository';
import { useToast } from './ToastProvider';

interface SharingSettingsModalProps {
  isVisible: boolean;
  content: Content | null;
  onClose: () => void;
}

export const SharingSettingsModal: React.FC<SharingSettingsModalProps> = ({
  isVisible,
  content,
  onClose
}) => {
  const [isPublic, setIsPublic] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canModify, setCanModify] = useState(false);
  const toast = useToast();

  // Load sharing status when content changes
  useEffect(() => {
    if (content && isVisible) {
      loadSharingStatus();
      checkModifyPermissions();
    }
  }, [content, isVisible]);

  const loadSharingStatus = async () => {
    if (!content) return;
    
    setIsLoading(true);
    try {
      const status = await contentRepository.getContentSharingStatus(content.id);
      setIsPublic(status.isPublic);
      setPublicUrl(status.publicUrl || '');
    } catch (error) {
      console.error('Failed to load sharing status:', error);
      toast.error('Failed to load sharing settings', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkModifyPermissions = async () => {
    if (!content) return;
    
    try {
      const canMod = await contentRepository.canModifyContentSharing(content.id);
      setCanModify(canMod);
    } catch (error) {
      console.error('Failed to check permissions:', error);
      setCanModify(false);
    }
  };

  const handleToggleSharing = async () => {
    if (!content || !canModify) return;

    setIsSaving(true);
    try {
      const newPublicState = !isPublic;
      const response: SharingResponse = await contentRepository.toggleContentSharing(content.id, newPublicState);
      
      if (response.success) {
        setIsPublic(response.isPublic);
        setPublicUrl(response.publicUrl || '');
        
        if (response.isPublic) {
          toast.success('Content is now public', 'Anyone with the link can view this content.');
        } else {
          toast.success('Content is now private', 'Only group members can view this content.');
        }
      } else {
        throw new Error('Failed to update sharing settings');
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error);
      toast.error('Failed to update sharing settings', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied!', 'Public link copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy link', 'Please copy the URL manually.');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isVisible || !content) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Sharing Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Content Preview */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Content:</div>
            <div className="text-sm text-gray-900 line-clamp-2">
              {content.type === 'seo' && content.metadata?.title 
                ? content.metadata.title
                : content.data.substring(0, 100) + (content.data.length > 100 ? '...' : '')
              }
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : !canModify ? (
            <div className="text-center py-4">
              <div className="text-gray-500 text-sm">
                You don't have permission to modify sharing settings for this content.
              </div>
            </div>
          ) : (
            <>
              {/* Public Toggle */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">
                      Public Access
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Allow anyone with the link to view this content
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSharing}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      isPublic ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Public URL Section */}
              {isPublic && publicUrl && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-900 mb-2 block">
                    Public Link
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Anyone with this link can view the content, even without an account.
                  </p>
                </div>
              )}

              {/* Status Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {isPublic ? (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-blue-900">
                      {isPublic ? 'Content is Public' : 'Content is Private'}
                    </div>
                    <div className="text-blue-700 mt-1">
                      {isPublic 
                        ? 'This content can be viewed by anyone with the link, including people who don\'t have an account.'
                        : 'This content is only visible to members of your group.'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};