import React, { useState, useRef } from 'react';
import { contentRepository } from './ContentRepository';

interface AudioUploadInputProps {
  groupId: string;
  parentContentId?: string | null;
  onAudioUploaded: (audioUrl: string, contentId: string) => void;
  onClose: () => void;
}

export const AudioUploadInput: React.FC<AudioUploadInputProps> = ({
  groupId,
  parentContentId,
  onAudioUploaded,
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm'];
    if (!file.type.startsWith('audio/') && !validTypes.includes(file.type)) {
      setError('Please select an audio file (MP3, WAV, M4A, OGG, FLAC, AAC, or WebM)');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('Audio file size must be less than 50MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Get audio duration
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      URL.revokeObjectURL(url);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an audio file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create content first to get the content ID
      const metadata: any = {
        filename: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      };

      if (duration !== null) {
        metadata.duration = duration;
      }

      const newContent = await contentRepository.createContent({
        type: 'audio',
        data: '', // Will be updated with audio URL
        group_id: groupId,
        parent_content_id: parentContentId,
        metadata
      });

      console.log('Created content:', newContent.id);
      setUploadProgress(30);

      // Upload audio with content UUID prefix
      const audioUrl = await contentRepository.uploadAudio(selectedFile, newContent.id);
      console.log('Uploaded audio:', audioUrl);
      setUploadProgress(70);

      // Update content with audio URL
      await contentRepository.updateContent(newContent.id, {
        data: audioUrl
      });
      console.log('Updated content with audio URL');
      setUploadProgress(100);

      // Notify parent
      onAudioUploaded(audioUrl, newContent.id);

      // Reset state
      setSelectedFile(null);
      setDuration(null);
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload audio');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setDuration(null);
    setError(null);
    setUploadProgress(0);
    onClose();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="text-sm text-gray-600">Click to select an audio file</span>
              <span className="text-xs text-gray-400">MP3, WAV, M4A, OGG, FLAC, AAC up to 50MB</span>
            </button>
          ) : (
            <div className="relative">
              {/* Audio File Info */}
              <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-pink-50 to-purple-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-pink-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-600">{formatFileSize(selectedFile.size)}</span>
                      {duration !== null && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600">{formatTime(duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {uploading && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <div className="text-pink-700 text-sm font-medium">{uploadProgress}%</div>
                      </div>
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
                className="bg-pink-600 h-2 rounded-full transition-all duration-300"
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
                setDuration(null);
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
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
