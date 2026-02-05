"use client";

import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/list/SupabaseClient';
import { useGlobalGroup } from '@/components/GlobalGroupContext';
import { StripeOnboardingSection } from './stripe-onboarding-section';
import { TransferForm } from './transfer-form';
import { TransferHistory } from './transfer-history';
import { PayoutSection } from './payout-section';
import { AccountBalance } from './account-balance';
import { useStripeAccountStatus } from '@/hooks/transfer/use-stripe-account';
import { Banknote, ArrowUpRight, ArrowDownLeft, Building } from 'lucide-react';

type Tab = 'send' | 'history' | 'payout';

export function TransferAppInterface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const { isLoading: groupsLoading } = useGlobalGroup();

  // Fetch Stripe account status
  const {
    data: accountStatus,
    isLoading: statusLoading,
    refetch: refetchStatus
  } = useStripeAccountStatus(userId);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error('Error initializing transfer app:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading || groupsLoading || statusLoading) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400">Please sign in to use transfers</p>
      </div>
    );
  }

  const isOnboarded = accountStatus?.onboarding_complete;

  return (
    <div className="h-full bg-neutral-950 overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pay</h1>
            <p className="text-neutral-500 text-xs">Send & receive money</p>
          </div>
        </div>

        {/* Onboarding Section - always show if not onboarded */}
        {!isOnboarded && (
          <StripeOnboardingSection
            userId={userId}
            existingAccount={accountStatus}
            onComplete={refetchStatus}
          />
        )}

        {/* Main Content - only show if onboarded */}
        {isOnboarded && (
          <>
            {/* Balance Card */}
            <AccountBalance
              balance={accountStatus.balance || 0}
              pendingBalance={accountStatus.pending_balance || 0}
            />

            {/* Tab Navigation */}
            <div className="flex bg-neutral-800 rounded-lg p-1 mb-6">
              <button
                onClick={() => setActiveTab('send')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'send'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Send
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'history'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                History
              </button>
              <button
                onClick={() => setActiveTab('payout')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'payout'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Building className="w-4 h-4" />
                Payout
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'send' && (
              <TransferForm
                userId={userId}
                onSuccess={() => refetchStatus()}
              />
            )}
            {activeTab === 'history' && (
              <TransferHistory userId={userId} />
            )}
            {activeTab === 'payout' && (
              <PayoutSection
                userId={userId}
                availableBalance={accountStatus.balance || 0}
                onSuccess={() => refetchStatus()}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
