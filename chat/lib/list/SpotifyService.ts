const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string; height: number | null; width: number | null }>;
  tracks: {
    total: number;
  };
  owner: {
    display_name: string | null;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number | null; width: number | null }>;
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylistTracksResponse {
  items: Array<{
    track: SpotifyTrack;
  }>;
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}

export class SpotifyService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetchSpotify<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
    }

    return response.json();
  }

  async getUserPlaylists(limit: number = 50, offset: number = 0): Promise<{
    items: SpotifyPlaylist[];
    total: number;
    next: string | null;
  }> {
    return this.fetchSpotify(`/me/playlists?limit=${limit}&offset=${offset}`);
  }

  async getPlaylistTracks(
    playlistId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SpotifyPlaylistTracksResponse> {
    return this.fetchSpotify(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`);
  }

  async getAllPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const allTracks: SpotifyTrack[] = [];
    let offset = 0;
    const limit = 100; // Max allowed by Spotify API

    while (true) {
      const response = await this.getPlaylistTracks(playlistId, limit, offset);

      // Filter out null tracks (can happen with local files or removed tracks)
      const tracks = response.items
        .map(item => item.track)
        .filter(track => track !== null);

      allTracks.push(...tracks);

      if (!response.next) {
        break;
      }

      offset += limit;
    }

    return allTracks;
  }

  async getPlaylistDetails(playlistId: string): Promise<SpotifyPlaylist> {
    return this.fetchSpotify(`/playlists/${playlistId}`);
  }
}
