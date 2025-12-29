"use client";

import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { usePexelsSearch } from "@/hooks/photos/use-pexels-search";
import type { PexelsPhoto } from "@/types/photos";

interface PhotoSearchPanelProps {
  onSelectPhoto: (photo: PexelsPhoto) => void;
  selectedPhotoId?: number;
}

export function PhotoSearchPanel({ onSelectPhoto, selectedPhotoId }: PhotoSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = usePexelsSearch(searchQuery, page);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        setSearchQuery(query.trim());
        setPage(1);
      }
    },
    [query]
  );

  const handleLoadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="p-4 border-b border-neutral-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pexels for photos..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
          />
        </div>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
          </div>
        )}

        {!isLoading && !data?.photos?.length && searchQuery && (
          <div className="text-center text-neutral-400 py-8">
            No photos found for &quot;{searchQuery}&quot;
          </div>
        )}

        {!searchQuery && (
          <div className="text-center text-neutral-400 py-8">
            Search for photos to get started
          </div>
        )}

        {data?.photos && data.photos.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo)}
                  className={`relative aspect-square rounded-lg overflow-hidden group transition-all ${
                    selectedPhotoId === photo.id
                      ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-neutral-900"
                      : "hover:opacity-90"
                  }`}
                >
                  <img
                    src={photo.src.medium}
                    alt={photo.alt || `Photo by ${photo.photographer}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs truncate">
                        {photo.photographer}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {data.next_page && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  className="px-4 py-2 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
                  Load More
                </button>
              </div>
            )}

            <div className="mt-4 text-center text-xs text-neutral-500">
              Photos provided by{" "}
              <a
                href="https://www.pexels.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-400 hover:underline"
              >
                Pexels
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
