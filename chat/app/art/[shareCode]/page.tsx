"use client";

import { useState, useEffect, use } from "react";
import { contentRepository, Content } from "@/lib/list/ContentRepository";
import { ArtGallery } from "@/components/ineedart/art-gallery";
import { SubmitArtModal } from "@/components/ineedart/submit-art-modal";
import { Plus, Palette, Loader2 } from "lucide-react";

export default function PublicArtRequestPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = use(params);
  const [request, setRequest] = useState<Content | null>(null);
  const [inspirations, setInspirations] = useState<Content[]>([]);
  const [submissions, setSubmissions] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch the art request by share code
        const artRequest = await contentRepository.getContentByShareCode(shareCode);

        if (!artRequest) {
          setError("Art request not found");
          setLoading(false);
          return;
        }

        setRequest(artRequest);

        // Fetch children (inspirations and submissions)
        const children = await contentRepository.getContentByParent(
          artRequest.group_id,
          artRequest.id,
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
        console.error("Error fetching art request:", err);
        setError("Failed to load art request");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [shareCode]);

  const handleSubmissionCreated = (submission: Content) => {
    setSubmissions((prev) => [submission, ...prev]);
    setShowSubmitModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-8">
        <Palette className="w-16 h-16 text-neutral-600 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Art Request Not Found</h1>
        <p className="text-neutral-400 text-center">
          This link may be invalid or the art request has been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Palette className="w-8 h-8 text-pink-400" />
          <h1 className="text-xl font-semibold text-white">Art Request</h1>
        </div>

        {/* Prompt */}
        <div className="mb-8 p-6 bg-neutral-900 border border-neutral-800 rounded-xl">
          <p className="text-xl text-white leading-relaxed">{request.data}</p>
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
        <div className="mb-24">
          <h2 className="text-lg font-semibold text-white mb-4">
            Submissions ({submissions.length})
          </h2>
          <ArtGallery
            submissions={submissions}
            isOwner={false}
            onToggleFavorite={() => {}}
          />
        </div>

        {/* Submit Art FAB */}
        <button
          onClick={() => setShowSubmitModal(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-30"
        >
          <Plus className="w-5 h-5" />
          Submit Your Art
        </button>

        {/* Submit Art Modal */}
        {showSubmitModal && (
          <SubmitArtModal
            requestId={request.id}
            groupId={request.group_id}
            onClose={() => setShowSubmitModal(false)}
            onSubmitted={handleSubmissionCreated}
          />
        )}
      </div>
    </div>
  );
}
