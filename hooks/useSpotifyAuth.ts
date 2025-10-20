import { useEffect, useState } from 'react';
import { supabase, signInWithSpotify, linkSpotifyAccount } from '../components/SupabaseClient';

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

        if (spotifyIdentity) {
          setAuthState({
            isAuthenticated: true,
            accessToken: session?.provider_token || null,
            isLoading: false,
            error: null
          });
        } else {
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

      if (spotifyIdentity) {
        setAuthState({
          isAuthenticated: true,
          accessToken: session?.provider_token || null,
          isLoading: false,
          error: null
        });
      } else {
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
