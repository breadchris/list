"use client";

import React, { useState, useEffect } from 'react';
import { LambdaClient } from '@/lib/list/LambdaClient';
import { Shield, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

interface StripeOnboardingSectionProps {
  userId: string;
  existingAccount?: {
    stripe_account_id?: string;
    details_submitted?: boolean;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
  } | null;
  onComplete: () => void;
}

export function StripeOnboardingSection({
  userId,
  existingAccount,
  onComplete
}: StripeOnboardingSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const currentUrl = window.location.href.split('?')[0];
      const result = await LambdaClient.invoke({
        action: 'stripe-connect-onboard',
        payload: {
          user_id: userId,
          return_url: `${currentUrl}?onboarding=complete`,
          refresh_url: `${currentUrl}?onboarding=refresh`,
        },
        sync: true,
      });

      if (result.success && result.data?.onboarding_url) {
        window.location.href = result.data.onboarding_url;
      } else if (result.data?.already_onboarded) {
        onComplete();
      } else {
        setError(result.error || 'Failed to start onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Check URL params for onboarding return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'complete') {
      onComplete();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onComplete]);

  const hasStartedOnboarding = existingAccount?.stripe_account_id;
  const needsMoreInfo = hasStartedOnboarding && !existingAccount?.details_submitted;

  return (
    <div className="bg-neutral-900 rounded-xl p-6 mb-6 border border-neutral-800">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Shield className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-1">
            {hasStartedOnboarding ? 'Complete Your Account' : 'Set Up Your Account'}
          </h2>
          <p className="text-neutral-400 text-sm mb-4">
            {needsMoreInfo
              ? 'You need to complete identity verification to send and receive money.'
              : 'To send and receive money, you\'ll need to verify your identity through Stripe\'s secure process.'}
          </p>

          {/* Status indicators for partial onboarding */}
          {hasStartedOnboarding && (
            <div className="space-y-2 mb-4">
              <StatusItem
                label="Account Created"
                complete={true}
              />
              <StatusItem
                label="Identity Verified"
                complete={existingAccount?.details_submitted || false}
              />
              <StatusItem
                label="Can Send Money"
                complete={existingAccount?.charges_enabled || false}
              />
              <StatusItem
                label="Can Receive Payouts"
                complete={existingAccount?.payouts_enabled || false}
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleStartOnboarding}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {hasStartedOnboarding ? 'Continue Setup' : 'Start Verification'}
          </button>

          <p className="text-neutral-500 text-xs mt-3">
            Powered by Stripe. Your financial information is encrypted and secure.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {complete ? (
        <CheckCircle className="w-4 h-4 text-green-400" />
      ) : (
        <AlertCircle className="w-4 h-4 text-neutral-500" />
      )}
      <span className={complete ? 'text-green-400' : 'text-neutral-500'}>
        {label}
      </span>
    </div>
  );
}
