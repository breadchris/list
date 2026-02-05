"use client";

import React from 'react';
import { useTransfers } from '@/hooks/transfer/use-transfers';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TransferHistoryProps {
  userId: string;
}

export function TransferHistory({ userId }: TransferHistoryProps) {
  const { data, isLoading } = useTransfers(userId);

  if (isLoading) {
    return (
      <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const transfers = data?.transfers || [];

  if (transfers.length === 0) {
    return (
      <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
        <p className="text-neutral-400 text-center py-8">No transfers yet</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <div className="divide-y divide-neutral-800">
        {transfers.map((transfer) => {
          const isSender = transfer.sender_user_id === userId;
          const amount = (transfer.amount_cents / 100).toFixed(2);
          const date = new Date(transfer.created_at).toLocaleDateString();

          return (
            <div key={transfer.id} className="p-4 flex items-center gap-4">
              {/* Direction Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isSender ? 'bg-red-500/20' : 'bg-green-500/20'
              }`}>
                {isSender ? (
                  <ArrowUpRight className="w-5 h-5 text-red-400" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-green-400" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {isSender ? 'Sent' : 'Received'}
                </p>
                {transfer.description && (
                  <p className="text-neutral-400 text-sm truncate">{transfer.description}</p>
                )}
                <p className="text-neutral-500 text-xs">{date}</p>
              </div>

              {/* Amount & Status */}
              <div className="text-right">
                <p className={`font-semibold ${isSender ? 'text-red-400' : 'text-green-400'}`}>
                  {isSender ? '-' : '+'}${amount}
                </p>
                <div className="flex items-center gap-1 justify-end">
                  <StatusIcon status={transfer.status} />
                  <span className="text-neutral-500 text-xs capitalize">{transfer.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Clock className="w-3 h-3 text-yellow-400" />;
  }
}
