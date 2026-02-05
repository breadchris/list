"use client";

import { useState, useRef } from "react";
import { Content, contentRepository } from "@/lib/list/ContentRepository";
import { X, ImagePlus, Loader2 } from "lucide-react";

// Anonymous group ID for unauthenticated submissions
const ANONYMOUS_GROUP_ID = "00000000-0000-0000-0000-000000000001";

interface SubmitArtModalProps {
  requestId: string;
  groupId: string;
  onClose: () => void;
  onSubmitted: (submission: Content) => void;
}

interface ImagePreview {
  file: File;
  previewUrl: string;
}

export function SubmitArtModal({
  requestId,
  groupId,
  onClose,
  onSubmitted,
}: SubmitArtModalProps) {
  const [artistName, setArtistName] = useState("");
  const [image, setImage] = useState<ImagePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setImage({
        file,
        previewUrl: evt.target?.result as string,
      });
      setError(null);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError("Please select an image to submit");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create submission content - use the same group as the request
      // This allows the submission to be a child of the request
      const submission = await contentRepository.createContent({
        type: "art-submission",
        data: "", // Will be updated with URL
        group_id: groupId,
        parent_content_id: requestId,
        metadata: {
          artist_name: artistName.trim() || "Anonymous",
          is_favorited: false,
        },
      });

      // Upload image
      const imageUrl = await contentRepository.uploadImage(
        image.file,
        submission.id
      );

      // Update with URL
      const updatedSubmission = await contentRepository.updateContent(submission.id, {
        data: imageUrl,
      });

      onSubmitted({ ...submission, data: imageUrl });
    } catch (err) {
      console.error("Error submitting art:", err);
      setError(err instanceof Error ? err.message : "Failed to submit art");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 rounded-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Submit Your Art</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={submitting}
            />

            {image ? (
              <div className="relative">
                <img
                  src={image.previewUrl}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full"
                  disabled={submitting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square border-2 border-dashed border-neutral-700 rounded-lg hover:border-pink-600/50 transition-colors flex flex-col items-center justify-center gap-3"
                disabled={submitting}
              >
                <ImagePlus className="w-12 h-12 text-neutral-500" />
                <span className="text-neutral-400">Click to select your artwork</span>
                <span className="text-neutral-500 text-sm">PNG, JPG up to 10MB</span>
              </button>
            )}
          </div>

          {/* Artist Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Your name (optional)
            </label>
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Anonymous"
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500"
              disabled={submitting}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={submitting || !image}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Submit Art"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
