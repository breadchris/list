import React, { useState, useRef } from 'react';
import { contentRepository } from './ContentRepository';

interface EpubUploadInputProps {
  groupId: string;
  parentContentId?: string | null;
  onEpubUploaded: (epubUrl: string, contentId: string) => void;
  onClose: () => void;
}

export const EpubUploadInput: React.FC<EpubUploadInputProps> = ({
  groupId,
  parentContentId,
  onEpubUploaded,
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.epub') && file.type !== 'application/epub+zip') {
      setError('Please select a book file (.epub format)');
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a book file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create content first to get the content ID
      const newContent = await contentRepository.createContent({
        type: 'epub',
        data: '', // Will be updated with epub URL
        group_id: groupId,
        parent_content_id: parentContentId
      });

      console.log('Created content:', newContent.id);
      setUploadProgress(30);

      // Upload epub with content UUID
      const epubUrl = await contentRepository.uploadEpub(selectedFile, newContent.id);
      console.log('Uploaded epub:', epubUrl);
      setUploadProgress(70);

      // Update content with epub URL and metadata
      await contentRepository.updateContent(newContent.id, {
        data: epubUrl,
        metadata: {
          filename: selectedFile.name,
          fileSize: selectedFile.size
        }
      });
      console.log('Updated content with epub URL');
      setUploadProgress(100);

      // Notify parent
      onEpubUploaded(epubUrl, newContent.id);

      // Reset state
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload book');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
    onClose();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/epub+zip,.epub"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {!selectedFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2"
              disabled={uploading}
            >
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-sm text-gray-600">Click to select a book file</span>
              <span className="text-xs text-gray-400">EPUB format</span>
            </button>
          ) : (
            <div className="relative">
              {/* File Info Display */}
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <div className="text-blue-600 text-sm font-medium">{uploadProgress}%</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && uploadProgress > 0 && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">Uploading book...</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setError(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              Change File
            </button>
          )}

          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            Cancel
          </button>

          {selectedFile && (
            <button
              onClick={handleUpload}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
