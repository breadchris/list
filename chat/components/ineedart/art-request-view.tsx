"use client";

import { useState, useEffect } from "react";
import { Content, contentRepository } from "@/lib/list/ContentRepository";
import { ArtGallery } from "./art-gallery";
import { SubmitArtModal } from "./submit-art-modal";
import { ArrowLeft, Share2, Trash2, Plus, Copy, Check } from "lucide-react";

interface ArtRequestViewProps {
  request: Content;
  groupId: string;
  isOwner: boolean;
  onBack: () => void;
  onDelete: () => void;
}

export function ArtRequestView({
  request,
  groupId,
  isOwner,
  onBack,
  onDelete,
}: ArtRequestViewProps) {
  const [inspirations, setInspirations] = useState<Content[]>([]);
  const [submissions, setSubmissions] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const shareCode = request.metadata?.share_code;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/art/${shareCode}`
    : "";

  // Fetch children (inspirations and submissions)
  useEffect(() => {
    async function fetchChildren() {
      setLoading(true);
      try {
        const children = await contentRepository.getContentByParent(
          groupId,
          request.id,
          0,
          100
        );

        const insps = children.filter((c) => c.type === "art-inspiration");
        const subs = children.filter((c) => c.type === "art-submission");

        // Sort inspirations by display_order
        insps.sort((a, b) => (a.metadata?.display_order || 0) - (b.metadata?.display_order || 0));

        setInspirations(insps);
        setSubmissions(subs);
      } catch (err) {
        console.error("Error fetching children:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchChildren();
  }, [request.id, groupId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSubmissionCreated = (submission: Content) => {
    setSubmissions((prev) => [submission, ...prev]);
    setShowSubmitModal(false);
  };

  const handleToggleFavorite = async (submissionId: string, isFavorited: boolean) => {
    try {
      await contentRepository.updateContent(submissionId, {
        metadata: {
          ...submissions.find((s) => s.id === submissionId)?.metadata,
          is_favorited: isFavorited,
        },
      });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, metadata: { ...s.metadata, is_favorited: isFavorited } }
            : s
        )
      );
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {/* Share button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share
              </>
            )}
          </button>

          {/* Delete button (owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-white mb-3">Delete this art request and all submissions?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="mb-8">
        <p className="text-xl text-white leading-relaxed">{request.data}</p>
      </div>

      {/* Share Link */}
      <div className="mb-8 p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
        <p className="text-sm text-neutral-400 mb-2">Share this link with artists:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-neutral-800 text-pink-400 rounded font-mono text-sm truncate">
            {shareUrl}
          </code>
          <button
            onClick={handleCopyLink}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Inspiration Images */}
      {inspirations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Inspiration</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {inspirations.map((insp) => (
              <img
                key={insp.id}
                src={insp.data}
                alt="Inspiration"
                className="w-full aspect-square object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      {/* Submissions Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Submissions ({submissions.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-neutral-400 text-center py-8">Loading...</div>
        ) : (
          <ArtGallery
            submissions={submissions}
            isOwner={isOwner}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </div>

      {/* Submit Art FAB */}
      <button
        onClick={() => setShowSubmitModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-pink-600 hover:bg-pink-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-30"
        aria-label="Submit art"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Submit Art Modal */}
      {showSubmitModal && (
        <SubmitArtModal
          requestId={request.id}
          groupId={groupId}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={handleSubmissionCreated}
        />
      )}
    </div>
  );
}
