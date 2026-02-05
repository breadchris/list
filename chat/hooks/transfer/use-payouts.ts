import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LambdaClient } from '@/lib/list/LambdaClient';

export interface Payout {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'cancelled';
  stripe_payout_id?: string;
  bank_account_last4?: string;
  arrival_date?: string;
  created_at: string;
}

export function usePayouts(userId: string | null) {
  return useQuery({
    queryKey: ['payouts', userId],
    queryFn: async (): Promise<{ payouts: Payout[] }> => {
      if (!userId) return { payouts: [] };
      const result = await LambdaClient.invoke({
        action: 'stripe-list-payouts',
        payload: { user_id: userId },
        sync: true,
      });
      return result.success ? result.data : { payouts: [] };
    },
    enabled: !!userId,
    staleTime: 30000,
  });
}

export function useInitiatePayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      user_id: string;
      amount_cents: number;
      currency?: string;
    }) => {
      const result = await LambdaClient.invoke({
        action: 'stripe-initiate-payout',
        payload: params,
        sync: true,
      });
      if (!result.success) {
        throw new Error(result.error || 'Payout failed');
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payouts', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['stripe-account-status', variables.user_id] });
    },
  });
}
