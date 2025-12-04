import React, { useEffect, useState } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';

interface TellerAccountMetadata {
  account_id: string;
  enrollment_id: string;
  institution_name: string;
  account_type: string;
  subtype: string;
  currency: string;
  last_four: string;
  balance_available?: number;
  balance_current?: number;
  last_synced?: string;
}

interface TellerTransactionMetadata {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  category: string;
  status: string;
  merchant_name?: string;
  running_balance?: number;
}

interface TellerAccountViewProps {
  content: Content;
  onClick?: () => void;
}

// Declare globals injected by esbuild
declare const LAMBDA_ENDPOINT: string;

export const TellerAccountView: React.FC<TellerAccountViewProps> = ({ content, onClick }) => {
  const [transactions, setTransactions] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);

  const metadata = content.metadata as TellerAccountMetadata;

  useEffect(() => {
    if (showTransactions) {
      fetchTransactions();
    }
  }, [content.id, content.group_id, showTransactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await contentRepository.getContentByParent(
        content.group_id,
        content.id,
        0,
        100,
        'newest'
      );
      setTransactions(data.filter(item => item.type === 'teller_transaction'));
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const syncTransactions = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'teller-transactions',
          payload: {
            selectedContent: [content],
            count: 100,
          },
          sync: true,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      // Refresh transactions list
      await fetchTransactions();
    } catch (err) {
      console.error('Error syncing transactions:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const syncBalance = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'teller-balances',
          payload: {
            selectedContent: [content],
          },
          sync: true,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error syncing balance:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount: number | undefined, currency: string = 'USD') => {
    if (amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Group transactions by date
  const transactionsByDate = transactions.reduce((acc, txn) => {
    const meta = txn.metadata as TellerTransactionMetadata;
    const date = meta?.date || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {} as Record<string, Content[]>);

  // Calculate spending by category
  const spendingByCategory = transactions.reduce((acc, txn) => {
    const meta = txn.metadata as TellerTransactionMetadata;
    if (meta && meta.amount < 0) {
      const category = meta.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + Math.abs(meta.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(spendingByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="bg-neutral-900 rounded-lg p-4 cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium">{content.data}</h3>
            <p className="text-xs text-neutral-400 capitalize">
              {metadata?.institution_name} • {metadata?.account_type} {metadata?.subtype && `• ${metadata.subtype}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              syncBalance();
            }}
            disabled={syncing}
            className="px-3 py-1 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Balance */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">Current Balance</p>
          <p className="text-xl font-semibold text-white">
            {formatCurrency(metadata?.balance_current, metadata?.currency)}
          </p>
        </div>
        <div className="p-3 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">Available</p>
          <p className="text-xl font-semibold text-white">
            {formatCurrency(metadata?.balance_available, metadata?.currency)}
          </p>
        </div>
      </div>

      {/* Transactions Toggle */}
      <div className="border-t border-neutral-800 pt-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTransactions(!showTransactions);
          }}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-white font-medium">Transactions</span>
          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <span className="text-neutral-400 text-sm">{transactions.length} transactions</span>
            )}
            <svg
              className={`w-5 h-5 text-neutral-400 transition-transform ${showTransactions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {showTransactions && (
          <div className="mt-4">
            {/* Sync Button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  syncTransactions();
                }}
                disabled={syncing}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? 'Loading...' : 'Load Transactions'}
              </button>
            </div>

            {/* Category Breakdown */}
            {sortedCategories.length > 0 && (
              <div className="mb-4 p-3 bg-neutral-800 rounded">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Top Spending Categories</p>
                <div className="space-y-2">
                  {sortedCategories.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-neutral-300 text-sm capitalize">{category}</span>
                      <span className="text-white text-sm font-medium">
                        {formatCurrency(amount, metadata?.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions List */}
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-neutral-400 text-sm mt-2">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-neutral-400">No transactions found</p>
                <p className="text-neutral-500 text-sm mt-1">Click "Load Transactions" to sync</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(transactionsByDate)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .map(([date, txns]) => (
                    <div key={date}>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
                        {formatDate(date)}
                      </p>
                      <div className="space-y-1">
                        {txns.map((txn) => {
                          const txnMeta = txn.metadata as TellerTransactionMetadata;
                          const isCredit = txnMeta?.amount > 0;
                          return (
                            <div
                              key={txn.id}
                              className="flex items-center justify-between p-2 bg-neutral-800 rounded"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">
                                  {txnMeta?.merchant_name || txn.data}
                                </p>
                                <p className="text-xs text-neutral-400 capitalize">
                                  {txnMeta?.category}
                                  {txnMeta?.status !== 'posted' && (
                                    <span className="ml-2 text-yellow-500">({txnMeta?.status})</span>
                                  )}
                                </p>
                              </div>
                              <p className={`text-sm font-medium ${isCredit ? 'text-emerald-400' : 'text-white'}`}>
                                {isCredit ? '+' : ''}{formatCurrency(txnMeta?.amount, metadata?.currency)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
