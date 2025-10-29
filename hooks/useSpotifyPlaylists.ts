import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SpotifyService, SpotifyPlaylist } from '../components/SpotifyService';
import { contentRepository } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

interface ImportPlaylistOptions {
  playlist: SpotifyPlaylist;
  groupId: string;
  accessToken: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Hook for fetching user's Spotify playlists
 */
export const useSpotifyPlaylists = (accessToken: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['spotify', 'playlists', accessToken],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token provided');
      }

      const spotifyService = new SpotifyService(accessToken);
      const response = await spotifyService.getUserPlaylists(50, 0);

      console.log(`✅ Fetched ${response.items.length} Spotify playlists`);
      return response.items;
    },
    enabled: enabled && !!accessToken,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

/**
 * Hook for importing a Spotify playlist as content
 */
export const useImportSpotifyPlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: ImportPlaylistOptions) => {
      const { playlist, groupId, accessToken, onProgress } = options;

      console.log(`Starting import of Spotify playlist: ${playlist.name}`);

      const spotifyService = new SpotifyService(accessToken);

      // Fetch all tracks from the playlist
      const tracks = await spotifyService.getAllPlaylistTracks(playlist.id);

      console.log(`Fetched ${tracks.length} tracks from playlist ${playlist.name}`);

      // Import the playlist and tracks into ContentRepository
      const result = await contentRepository.importSpotifyPlaylist(
        groupId,
        playlist,
        tracks,
        onProgress
      );

      console.log(`Successfully imported playlist ${playlist.name} with ${tracks.length} tracks`);
      return result;
    },
    onSuccess: () => {
      // Invalidate content queries to refresh the lists
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentList
      });
    },
    onError: (error) => {
      console.error('Failed to import Spotify playlist:', error);
    }
  });
};
