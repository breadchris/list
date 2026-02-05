import { useQuery } from '@tanstack/react-query';
import { LambdaClient } from '@/lib/list/LambdaClient';

export interface StripeAccountStatus {
  id: string;
  user_id: string;
  stripe_account_id: string;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  business_type?: string;
  country: string;
  default_currency: string;
  email?: string;
  balance: number;
  pending_balance: number;
}

export function useStripeAccountStatus(userId: string | null) {
  return useQuery({
    queryKey: ['stripe-account-status', userId],
    queryFn: async (): Promise<StripeAccountStatus | null> => {
      if (!userId) return null;
      const result = await LambdaClient.invoke({
        action: 'stripe-connect-status',
        payload: { user_id: userId },
        sync: true,
      });
      return result.success ? result.data : null;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
}
