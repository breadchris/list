import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/list/SupabaseClient';

interface UserAvatarData {
  avatar_url: string | null;
  full_name?: string | null;
  email?: string | null;
}

export const useUserAvatar = (userId: string | undefined) => {
  return useQuery<UserAvatarData>({
    queryKey: ['user-avatar', userId],
    queryFn: async () => {
      if (!userId) {
        return { avatar_url: null };
      }

      // First, try to get user metadata from auth.users table
      // This requires admin access, so we'll use a workaround
      // Get the user's public profile data
      const { data: userData, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return { avatar_url: null };
      }

      // Since we don't have direct access to user_metadata from client,
      // we need to use a different approach. For now, we'll check if the
      // current session user matches this userId, then we can get their avatar
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user?.id === userId) {
        return {
          avatar_url: session.user.user_metadata?.avatar_url || null,
          full_name: session.user.user_metadata?.full_name || null,
          email: session.user.email || null
        };
      }

      // For other users, we can't access their user_metadata from the client
      // We would need to store avatar URLs in a public user profile table
      // For now, return null for other users
      return { avatar_url: null };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    cacheTime: 1000 * 60 * 10 // Keep in cache for 10 minutes
  });
};
