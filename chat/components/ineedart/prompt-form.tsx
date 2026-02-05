"use client";

import { useState, useRef } from "react";
import { contentRepository, Content } from "@/lib/list/ContentRepository";
import { nanoid } from "nanoid";
import { ImagePlus, X, Loader2 } from "lucide-react";

interface PromptFormProps {
  groupId: string;
  onCreated: (request: Content) => void;
  onCancel: () => void;
}

interface ImagePreview {
  file: File;
  previewUrl: string;
}

export function PromptForm({ groupId, onCreated, onCancel }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const newImages: ImagePreview[] = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} is not an image file`);
        return;
      }
      if (file.size > maxSize) {
        setError(`${file.name} exceeds 10MB limit`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        newImages.push({
          file,
          previewUrl: evt.target?.result as string,
        });
        setImages((prev) => [...prev, ...newImages.filter((img) => img.previewUrl === evt.target?.result)]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Please enter a prompt describing the art you need");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Generate share code
      const shareCode = nanoid(10);

      // Create the art request
      const request = await contentRepository.createContent({
        type: "art-request",
        data: prompt.trim(),
        group_id: groupId,
        metadata: {
          share_code: shareCode,
          sharing: { isPublic: true },
        },
      });

      // Upload inspiration images
      for (let i = 0; i < images.length; i++) {
        const imagePreview = images[i];

        // Create inspiration content
        const inspirationContent = await contentRepository.createContent({
          type: "art-inspiration",
          data: "", // Will be updated with URL
          group_id: groupId,
          parent_content_id: request.id,
          metadata: {
            display_order: i,
            sharing: { isPublic: true },
          },
        });

        // Upload image
        const imageUrl = await contentRepository.uploadImage(
          imagePreview.file,
          inspirationContent.id
        );

        // Update with URL
        await contentRepository.updateContent(inspirationContent.id, {
          data: imageUrl,
        });
      }

      onCreated(request);
    } catch (err) {
      console.error("Error creating art request:", err);
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prompt Input */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Describe the art you need
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="I need a watercolor painting of a cozy cabin in autumn woods with smoke rising from the chimney..."
          className="w-full h-40 px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 resize-none"
          disabled={submitting}
        />
      </div>

      {/* Inspiration Images */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Inspiration images (optional)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={submitting}
        />

        {/* Image Grid */}
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div key={index} className="relative aspect-square group">
              <img
                src={img.previewUrl}
                alt={`Inspiration ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={submitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors flex flex-col items-center justify-center gap-2"
            disabled={submitting}
          >
            <ImagePlus className="w-8 h-8 text-neutral-500" />
            <span className="text-xs text-neutral-500">Add image</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={submitting || !prompt.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Request"
          )}
        </button>
      </div>
    </form>
  );
}
