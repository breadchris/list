import React, { useState } from 'react';
import { SpotifyPlaylist } from './SpotifyService';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { useSpotifyPlaylists, useImportSpotifyPlaylist } from '../hooks/useSpotifyPlaylists';
import { useToast } from './ToastProvider';
import { unlinkSpotifyAccount } from './SupabaseClient';

interface SpotifyPlaylistModalProps {
  isVisible: boolean;
  groupId: string;
  onClose: () => void;
  onPlaylistImported: () => void;
}

export const SpotifyPlaylistModal: React.FC<SpotifyPlaylistModalProps> = ({
  isVisible,
  groupId,
  onClose,
  onPlaylistImported
}) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const toast = useToast();

  const { isAuthenticated, accessToken, isLoading: authLoading, login } = useSpotifyAuth();
  const { data: playlists, isLoading: playlistsLoading } = useSpotifyPlaylists(accessToken, isAuthenticated);
  const importMutation = useImportSpotifyPlaylist();

  if (!isVisible) return null;

  const handleImport = async () => {
    if (!selectedPlaylist || !accessToken) return;

    importMutation.mutate({
      playlist: selectedPlaylist,
      groupId,
      accessToken
    }, {
      onSuccess: () => {
        toast.success(
          'Playlist Imported!',
          `Successfully imported "${selectedPlaylist.name}" with ${selectedPlaylist.tracks.total} tracks`
        );
        onPlaylistImported();
        onClose();
      },
      onError: (error) => {
        toast.error('Import Failed', error instanceof Error ? error.message : 'Unknown error');
      }
    });
  };

  const handleSpotifyLogin = async () => {
    try {
      await login();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Spotify';
      toast.error('Connection Failed', errorMessage);
    }
  };

  const handleSpotifyUnlink = async () => {
    try {
      await unlinkSpotifyAccount();
      toast.success('Spotify Unlinked', 'Your Spotify account has been unlinked');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unlink Spotify';
      toast.error('Unlink Failed', errorMessage);
    }
  };

  const isLoading = authLoading || playlistsLoading;
  const isImporting = importMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span>Import Spotify Playlist</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {!isAuthenticated ? 'Connect to Spotify to import playlists' :
                 isLoading ? 'Loading playlists...' :
                 `${playlists?.length || 0} playlists available`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isImporting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Not Authenticated State */}
          {!isAuthenticated && !authLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-20 h-20 text-green-500 mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Link Spotify Account</h3>
              <p className="text-gray-600 text-center mb-2 max-w-md">
                Connect your Spotify account to access your playlists and import them to your content library.
              </p>
              <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
                This will link Spotify to your current account. You can unlink it at any time.
              </p>
              <button
                onClick={handleSpotifyLogin}
                className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors font-medium flex items-center space-x-2 shadow-md"
                style={{ backgroundColor: '#1DB954', color: '#FFFFFF' }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span>Link Spotify Account</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Loading your playlists...</p>
            </div>
          )}

          {/* Playlists List */}
          {!isLoading && isAuthenticated && playlists && playlists.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">🎵</div>
              <p>No playlists found</p>
              <p className="text-sm mt-2">Create some playlists on Spotify to import them here</p>
            </div>
          )}

          {!isLoading && isAuthenticated && playlists && playlists.length > 0 && (
            <div className="space-y-3">
              {playlists.map((playlist) => {
                const isSelected = selectedPlaylist?.id === playlist.id;
                const imageUrl = playlist.images?.[0]?.url;

                return (
                  <div
                    key={playlist.id}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className={`cursor-pointer rounded-lg border-2 transition-all p-3 ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Playlist Cover */}
                      <div className="flex-shrink-0 relative w-24 h-24 rounded overflow-hidden bg-gray-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                        )}

                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Playlist Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-gray-900 mb-1">
                          {playlist.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {playlist.tracks.total} track{playlist.tracks.total !== 1 ? 's' : ''}
                          {playlist.owner.display_name && ` • by ${playlist.owner.display_name}`}
                        </p>
                        {playlist.description && (
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {playlist.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {isAuthenticated && !isLoading && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  {selectedPlaylist ? (
                    <span className="font-medium text-green-600">
                      {selectedPlaylist.name} selected
                    </span>
                  ) : (
                    <span>Select a playlist to import</span>
                  )}
                </div>
                <button
                  onClick={handleSpotifyUnlink}
                  className="text-xs text-red-600 hover:text-red-700 underline"
                  disabled={isImporting}
                >
                  Unlink Spotify
                </button>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    !selectedPlaylist || isImporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                  disabled={!selectedPlaylist || isImporting}
                >
                  {isImporting ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Importing...
                    </span>
                  ) : (
                    'Import Playlist'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
