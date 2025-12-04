import { useEffect, useState } from 'react';
import { supabase, signInWithSpotify, linkSpotifyAccount } from '@/lib/list/SupabaseClient';

interface SpotifyAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const useSpotifyAuth = () => {
  const [authState, setAuthState] = useState<SpotifyAuthState>({
    isAuthenticated: false,
    accessToken: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    // Check initial Spotify authentication status
    const checkSpotifyAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        // Check if user has Spotify identity linked
        const spotifyIdentity = session?.user?.identities?.find(
          identity => identity.provider === 'spotify'
        );

        console.log('🔍 Spotify Auth Check:', {
          hasIdentity: !!spotifyIdentity,
          identityCount: session?.user?.identities?.length || 0,
          providers: session?.user?.identities?.map(i => i.provider) || []
        });

        if (spotifyIdentity) {
          // Extract Spotify-specific token from identity data
          // session.provider_token returns the PRIMARY provider's token (e.g., Google)
          // For linked identities, we need the provider-specific token
          const spotifyToken = (spotifyIdentity.identity_data as any)?.provider_token;

          console.log('🎵 Spotify token extracted:', {
            hasToken: !!spotifyToken,
            tokenPreview: spotifyToken ? `${spotifyToken.substring(0, 15)}...` : 'null'
          });

          setAuthState({
            isAuthenticated: true,
            accessToken: spotifyToken || null,
            isLoading: false,
            error: null
          });
        } else {
          console.log('❌ No Spotify identity found - showing link button');
          setAuthState({
            isAuthenticated: false,
            accessToken: null,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        setAuthState({
          isAuthenticated: false,
          accessToken: null,
          isLoading: false,
          error: error as Error
        });
      }
    };

    checkSpotifyAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Check if user has Spotify identity linked
      const spotifyIdentity = session?.user?.identities?.find(
        identity => identity.provider === 'spotify'
      );

      console.log('🔍 Spotify Auth State Change:', {
        event: _event,
        hasIdentity: !!spotifyIdentity,
        identityCount: session?.user?.identities?.length || 0,
        providers: session?.user?.identities?.map(i => i.provider) || []
      });

      if (spotifyIdentity) {
        // Extract Spotify-specific token from identity data
        // session.provider_token returns the PRIMARY provider's token (e.g., Google)
        // For linked identities, we need the provider-specific token
        const spotifyToken = (spotifyIdentity.identity_data as any)?.provider_token;

        console.log('🎵 Spotify token from state change:', {
          hasToken: !!spotifyToken,
          tokenPreview: spotifyToken ? `${spotifyToken.substring(0, 15)}...` : 'null'
        });

        setAuthState({
          isAuthenticated: true,
          accessToken: spotifyToken || null,
          isLoading: false,
          error: null
        });
      } else {
        console.log('❌ No Spotify identity in state change - should show link button');
        setAuthState({
          isAuthenticated: false,
          accessToken: null,
          isLoading: false,
          error: null
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    try {
      // Check if user is already authenticated with another provider
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // User is already logged in, link Spotify to existing account
        console.log('🔗 User already authenticated, linking Spotify account');
        await linkSpotifyAccount();
      } else {
        // No existing session, sign in with Spotify
        console.log('🔑 No existing session, signing in with Spotify');
        await signInWithSpotify();
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error as Error
      }));
      throw error;
    }
  };

  return {
    ...authState,
    login
  };
};
