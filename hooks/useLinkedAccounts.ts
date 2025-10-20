import { useEffect, useState } from 'react';
import { supabase, getLinkedIdentities } from '../components/SupabaseClient';

interface LinkedAccount {
  id: string;
  provider: string;
  email?: string;
  created_at: string;
}

interface LinkedAccountsState {
  linkedProviders: string[];
  accounts: LinkedAccount[];
  isSpotifyLinked: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing and displaying linked OAuth identities
 * Returns information about all linked providers (Google, Apple, Spotify, etc.)
 */
export const useLinkedAccounts = () => {
  const [state, setState] = useState<LinkedAccountsState>({
    linkedProviders: [],
    accounts: [],
    isSpotifyLinked: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const identities = await getLinkedIdentities();

        const linkedProviders = identities.map(identity => identity.provider);
        const isSpotifyLinked = linkedProviders.includes('spotify');

        setState({
          linkedProviders,
          accounts: identities.map(identity => ({
            id: identity.id,
            provider: identity.provider,
            email: identity.email,
            created_at: identity.created_at
          })),
          isSpotifyLinked,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setState({
          linkedProviders: [],
          accounts: [],
          isSpotifyLinked: false,
          isLoading: false,
          error: error as Error
        });
      }
    };

    fetchLinkedAccounts();

    // Listen for auth state changes to refresh linked accounts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event) => {
      await fetchLinkedAccounts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const identities = await getLinkedIdentities();

      const linkedProviders = identities.map(identity => identity.provider);
      const isSpotifyLinked = linkedProviders.includes('spotify');

      setState({
        linkedProviders,
        accounts: identities.map(identity => ({
          id: identity.id,
          provider: identity.provider,
          email: identity.email,
          created_at: identity.created_at
        })),
        isSpotifyLinked,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  };

  return {
    ...state,
    refresh
  };
};
