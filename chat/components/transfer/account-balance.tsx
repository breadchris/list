"use client";

import React from 'react';
import { Wallet, Clock } from 'lucide-react';

interface AccountBalanceProps {
  balance: number;
  pendingBalance: number;
}

export function AccountBalance({ balance, pendingBalance }: AccountBalanceProps) {
  const formattedBalance = (balance / 100).toFixed(2);
  const formattedPending = (pendingBalance / 100).toFixed(2);

  return (
    <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-green-100 text-sm mb-1">Available Balance</p>
          <p className="text-white text-3xl font-bold">${formattedBalance}</p>
          {pendingBalance > 0 && (
            <div className="flex items-center gap-1 mt-2 text-green-100 text-sm">
              <Clock className="w-3 h-3" />
              <span>${formattedPending} pending</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <Wallet className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
