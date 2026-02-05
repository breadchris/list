import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LambdaClient } from '@/lib/list/LambdaClient';

export interface Transfer {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  amount_cents: number;
  currency: string;
  description?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  stripe_transfer_id?: string;
}

export function useTransfers(userId: string | null, options?: { status?: string }) {
  return useQuery({
    queryKey: ['transfers', userId, options?.status],
    queryFn: async (): Promise<{ transfers: Transfer[] }> => {
      if (!userId) return { transfers: [] };
      const result = await LambdaClient.invoke({
        action: 'stripe-list-transfers',
        payload: {
          user_id: userId,
          status: options?.status,
        },
        sync: true,
      });
      return result.success ? result.data : { transfers: [] };
    },
    enabled: !!userId,
    staleTime: 30000,
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sender_user_id: string;
      recipient_user_id: string;
      amount_cents: number;
      description?: string;
      idempotency_key: string;
    }) => {
      const result = await LambdaClient.invoke({
        action: 'stripe-create-transfer',
        payload: params,
        sync: true,
      });
      if (!result.success) {
        throw new Error(result.error || 'Transfer failed');
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transfers', variables.sender_user_id] });
      queryClient.invalidateQueries({ queryKey: ['stripe-account-status', variables.sender_user_id] });
    },
  });
}
