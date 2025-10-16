import React, { useState, useRef } from 'react';
import { contentRepository } from './ContentRepository';

interface ImageUploadInputProps {
  groupId: string;
  parentContentId?: string | null;
  onImageUploaded: (imageUrl: string, contentId: string) => void;
  onClose: () => void;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  groupId,
  parentContentId,
  onImageUploaded,
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Image size must be less than 10MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create content first to get the content ID
      const newContent = await contentRepository.createContent({
        type: 'image',
        data: '', // Will be updated with image URL
        group_id: groupId,
        parent_content_id: parentContentId
      });

      console.log('Created content:', newContent.id);
      setUploadProgress(30);

      // Upload image with content UUID prefix
      const imageUrl = await contentRepository.uploadImage(selectedFile, newContent.id);
      console.log('Uploaded image:', imageUrl);
      setUploadProgress(70);

      // Update content with image URL
      await contentRepository.updateContent(newContent.id, {
        data: imageUrl
      });
      console.log('Updated content with image URL');
      setUploadProgress(100);

      // Notify parent
      onImageUploaded(imageUrl, newContent.id);

      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
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
            accept="image/*"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-600">Click to select an image</span>
              <span className="text-xs text-gray-400">PNG, JPG, GIF up to 10MB</span>
            </button>
          ) : (
            <div className="relative">
              {/* Image Preview */}
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={previewUrl || ''}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain bg-gray-50"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <div className="text-white text-sm font-medium">{uploadProgress}%</div>
                    </div>
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                <span className="truncate">{selectedFile.name}</span>
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
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
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">Uploading...</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setError(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              Change Image
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
