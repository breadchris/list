import { useQuery } from "@tanstack/react-query";

const CACHE_NAME = "epub-cache-v1";

interface EpubLoaderResult {
  blobUrl: string | null;
  isLoading: boolean;
  isCached: boolean;
  error: Error | null;
}

interface EpubData {
  blobUrl: string;
  isCached: boolean;
}

async function loadEpubFromCacheOrNetwork(fileUrl: string): Promise<EpubData> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(fileUrl);

  if (cachedResponse) {
    // Load from cache - fast path
    const blob = await cachedResponse.blob();
    return {
      blobUrl: URL.createObjectURL(blob),
      isCached: true,
    };
  }

  // Not cached - fetch from network
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Cache for next time (fire and forget, don't block on this)
  cache
    .put(
      fileUrl,
      new Response(blob.slice(), {
        headers: { "Content-Type": "application/epub+zip" },
      })
    )
    .catch((err) => {
      // Quota exceeded or other cache error - continue without caching
      console.warn("Could not cache EPUB:", err);
    });

  return {
    blobUrl: URL.createObjectURL(blob),
    isCached: false,
  };
}

/**
 * React Query hook for loading EPUB files with automatic caching.
 *
 * Features:
 * - Checks Cache API first for instant loading of previously viewed books
 * - Falls back to network fetch if not cached
 * - Caches fetched EPUBs for future use
 * - Never refetches (EPUBs are immutable)
 * - Keeps blob URL in memory for 30 minutes
 */
export function useEpubLoader(fileUrl: string | null): EpubLoaderResult {
  const query = useQuery({
    queryKey: ["epub-file", fileUrl],
    queryFn: () => loadEpubFromCacheOrNetwork(fileUrl!),
    enabled: !!fileUrl,
    staleTime: Infinity, // Never refetch - EPUBs don't change
    gcTime: 1000 * 60 * 30, // Keep in memory 30 min
  });

  return {
    blobUrl: query.data?.blobUrl ?? null,
    isLoading: query.isLoading,
    isCached: query.data?.isCached ?? false,
    error: query.error as Error | null,
  };
}
