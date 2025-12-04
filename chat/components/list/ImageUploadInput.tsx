import React, { useState, useRef } from 'react';
import { contentRepository } from '@/lib/list/ContentRepository';

interface ImageUploadInputProps {
  groupId: string;
  parentContentId?: string | null;
  onImageUploaded: (imageUrl: string, contentId: string) => void;
  onClose: () => void;
}

interface ImagePreview {
  file: File;
  previewUrl: string;
  progress: number;
  uploading: boolean;
  error: string | null;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  groupId,
  parentContentId,
  onImageUploaded,
  onClose
}) => {
  const [selectedImages, setSelectedImages] = useState<ImagePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    const maxImages = 10; // Limit to 10 images per batch
    const errors: string[] = [];

    // Check total count
    if (selectedImages.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed per batch`);
      return;
    }

    // Process each file
    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        errors.push(`${file.name}: Size exceeds 10MB`);
        return;
      }

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        // Update state immediately for each image as its preview is generated
        setSelectedImages(prev => [...prev, {
          file,
          previewUrl,
          progress: 0,
          uploading: false,
          error: null
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Show errors if any
    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError(null);
    }

    // Reset input to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setUploading(true);
    setError(null);

    const results: { success: boolean; contentId?: string; error?: string }[] = [];

    try {
      // Upload all images concurrently
      const uploadPromises = selectedImages.map(async (imagePreview, index) => {
        try {
          // Update individual image status
          setSelectedImages(prev => prev.map((img, i) =>
            i === index ? { ...img, uploading: true, progress: 0 } : img
          ));

          // Create content first to get the content ID
          const newContent = await contentRepository.createContent({
            type: 'image',
            data: '', // Will be updated with image URL
            group_id: groupId,
            parent_content_id: parentContentId
          });

          console.log('Created content:', newContent.id);

          // Update progress
          setSelectedImages(prev => prev.map((img, i) =>
            i === index ? { ...img, progress: 30 } : img
          ));

          // Upload image with content UUID prefix
          const imageUrl = await contentRepository.uploadImage(imagePreview.file, newContent.id);
          console.log('Uploaded image:', imageUrl);

          // Update progress
          setSelectedImages(prev => prev.map((img, i) =>
            i === index ? { ...img, progress: 70 } : img
          ));

          // Update content with image URL
          await contentRepository.updateContent(newContent.id, {
            data: imageUrl
          });
          console.log('Updated content with image URL');

          // Update progress
          setSelectedImages(prev => prev.map((img, i) =>
            i === index ? { ...img, progress: 100, uploading: false } : img
          ));

          // Notify parent for each successful upload
          onImageUploaded(imageUrl, newContent.id);

          return { success: true, contentId: newContent.id };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Upload failed';
          console.error('Upload error for image:', imagePreview.file.name, err);

          // Update image with error
          setSelectedImages(prev => prev.map((img, i) =>
            i === index ? { ...img, uploading: false, error: errorMessage } : img
          ));

          return { success: false, error: errorMessage };
        }
      });

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);
      results.push(...uploadResults);

      // Count successes and failures
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (successCount > 0 && failureCount === 0) {
        // All uploads succeeded
        console.log(`Successfully uploaded ${successCount} images`);
        setSelectedImages([]);
      } else if (successCount > 0 && failureCount > 0) {
        // Some uploads succeeded, some failed
        setError(`Uploaded ${successCount} images. ${failureCount} failed.`);
        // Keep only failed images in the list
        setSelectedImages(prev => prev.filter(img => img.error !== null));
      } else {
        // All uploads failed
        setError('All uploads failed. Please try again.');
      }
    } catch (err) {
      console.error('Batch upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedImages([]);
    setError(null);
    onClose();
  };

  // Calculate overall progress
  const overallProgress = selectedImages.length > 0
    ? Math.round(selectedImages.reduce((sum, img) => sum + img.progress, 0) / selectedImages.length)
    : 0;

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2"
            disabled={uploading}
          >
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600">
              {selectedImages.length > 0 ? 'Add more images' : 'Click to select images'}
            </span>
            <span className="text-xs text-gray-400">PNG, JPG, GIF up to 10MB each (max 10 images)</span>
          </button>

          {/* Image Grid Preview */}
          {selectedImages.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedImages.map((imagePreview, index) => (
                <div key={index} className="relative group">
                  {/* Image Preview */}
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square">
                    <img
                      src={imagePreview.previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover bg-gray-50"
                    />

                    {/* Upload Overlay */}
                    {imagePreview.uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                          <div className="text-white text-xs font-medium">{imagePreview.progress}%</div>
                        </div>
                      </div>
                    )}

                    {/* Success Indicator */}
                    {imagePreview.progress === 100 && !imagePreview.uploading && (
                      <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* Error Indicator */}
                    {imagePreview.error && (
                      <div className="absolute inset-0 bg-red-600 bg-opacity-20 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}

                    {/* Remove Button */}
                    {!imagePreview.uploading && (
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={uploading}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="mt-1 text-xs text-gray-600 truncate">
                    {imagePreview.file.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {(imagePreview.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>

                  {/* Individual Error */}
                  {imagePreview.error && (
                    <div className="mt-1 text-xs text-red-600">
                      {imagePreview.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Overall Upload Progress */}
        {uploading && selectedImages.length > 0 && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Uploading {selectedImages.filter(img => img.uploading).length} of {selectedImages.length} images... ({overallProgress}%)
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            {selectedImages.length > 0 ? 'Clear All' : 'Cancel'}
          </button>

          {selectedImages.length > 0 && (
            <button
              onClick={handleUpload}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              {uploading ? `Uploading... (${selectedImages.filter(img => img.uploading).length}/${selectedImages.length})` : `Upload ${selectedImages.length} ${selectedImages.length === 1 ? 'Image' : 'Images'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
