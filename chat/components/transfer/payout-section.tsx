"use client";

import React, { useState } from 'react';
import { useInitiatePayout, usePayouts } from '@/hooks/transfer/use-payouts';
import { Building, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

interface PayoutSectionProps {
  userId: string;
  availableBalance: number;
  onSuccess: () => void;
}

export function PayoutSection({ userId, availableBalance, onSuccess }: PayoutSectionProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initiatePayout = useInitiatePayout();
  const { data: payoutsData, isLoading: payoutsLoading } = usePayouts(userId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (amountCents < 100) {
        setError('Minimum payout amount is $1.00');
        return;
      }
      if (amountCents > availableBalance) {
        setError(`Insufficient balance. Available: $${(availableBalance / 100).toFixed(2)}`);
        return;
      }

      await initiatePayout.mutateAsync({
        user_id: userId,
        amount_cents: amountCents,
      });

      setSuccess(true);
      setAmount('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Payout failed');
    }
  };

  const payouts = payoutsData?.payouts || [];

  return (
    <div className="space-y-6">
      {/* Payout Form */}
      <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
        <h3 className="text-lg font-semibold text-white mb-4">Withdraw to Bank</h3>

        <p className="text-neutral-400 text-sm mb-4">
          Available balance: <span className="text-green-400 font-semibold">${(availableBalance / 100).toFixed(2)}</span>
        </p>

        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-300 text-sm">
            Payout initiated! Funds will arrive in 1-2 business days.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                max={availableBalance / 100}
                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-2xl font-semibold placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={initiatePayout.isPending || !amount || availableBalance === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {initiatePayout.isPending ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Building className="w-5 h-5" />
                Withdraw ${amount || '0.00'}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Payout History */}
      {!payoutsLoading && payouts.length > 0 && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
          <h4 className="text-sm font-medium text-neutral-400 px-4 py-3 border-b border-neutral-800">
            Recent Payouts
          </h4>
          <div className="divide-y divide-neutral-800">
            {payouts.slice(0, 5).map((payout) => {
              const amount = (payout.amount_cents / 100).toFixed(2);
              const date = new Date(payout.created_at).toLocaleDateString();

              return (
                <div key={payout.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center">
                    <Building className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Bank Transfer</p>
                    {payout.bank_account_last4 && (
                      <p className="text-neutral-400 text-sm">****{payout.bank_account_last4}</p>
                    )}
                    <p className="text-neutral-500 text-xs">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">${amount}</p>
                    <div className="flex items-center gap-1 justify-end">
                      <PayoutStatusIcon status={payout.status} />
                      <span className="text-neutral-500 text-xs capitalize">
                        {payout.status === 'in_transit' ? 'In Transit' : payout.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PayoutStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Clock className="w-3 h-3 text-yellow-400" />;
  }
}
