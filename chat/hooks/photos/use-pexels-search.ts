import { useQuery } from "@tanstack/react-query";
import type { PexelsSearchResponse } from "@/types/photos";

export function usePexelsSearch(query: string, page: number = 1) {
  return useQuery<PexelsSearchResponse>({
    queryKey: ["pexels-search", query, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        query,
        page: page.toString(),
        per_page: "30",
      });
      const res = await fetch(`/api/photos/search?${params}`);
      if (!res.ok) {
        throw new Error("Failed to search photos");
      }
      return res.json();
    },
    enabled: !!query && query.trim().length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
