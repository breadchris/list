import { useQuery } from '@tanstack/react-query';
import { LambdaClient } from '@/lib/list/LambdaClient';

export interface RecipientUser {
  id: string;
  username: string;
}

export function useRecipientSearch(query: string, excludeUserId: string) {
  return useQuery({
    queryKey: ['stripe-search-users', query, excludeUserId],
    queryFn: async (): Promise<{ users: RecipientUser[] }> => {
      const result = await LambdaClient.invoke({
        action: 'stripe-search-users',
        payload: {
          query,
          exclude_user_id: excludeUserId,
          limit: 10,
        },
        sync: true,
      });
      return result.success ? result.data : { users: [] };
    },
    enabled: query.length >= 2,
    staleTime: 30000,
  });
}
