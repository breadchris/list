import React, { useEffect, useState } from 'react';
import { Content, contentRepository } from './ContentRepository';

interface TellerEnrollmentMetadata {
  enrollment_id: string;
  access_token: string;
  institution_id: string;
  institution_name: string;
  status: 'connected' | 'disconnected' | 'error';
  last_synced?: string;
}

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

interface TellerEnrollmentViewProps {
  content: Content;
  onClick?: () => void;
}

// Declare globals injected by esbuild
declare const LAMBDA_ENDPOINT: string;

export const TellerEnrollmentView: React.FC<TellerEnrollmentViewProps> = ({ content, onClick }) => {
  const [accounts, setAccounts] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadata = content.metadata as TellerEnrollmentMetadata;

  useEffect(() => {
    fetchAccounts();
  }, [content.id, content.group_id]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await contentRepository.getContentByParent(
        content.group_id,
        content.id,
        0,
        100,
        'newest'
      );
      setAccounts(data.filter(item => item.type === 'teller_account'));
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const syncAccounts = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'teller-accounts',
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

      // Refresh accounts list
      await fetchAccounts();
    } catch (err) {
      console.error('Error syncing accounts:', err);
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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const totalBalance = accounts.reduce((sum, account) => {
    const meta = account.metadata as TellerAccountMetadata;
    return sum + (meta?.balance_current || 0);
  }, 0);

  return (
    <div className="bg-neutral-900 rounded-lg p-4 cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium">{metadata?.institution_name || content.data}</h3>
            <p className="text-xs text-neutral-400">
              {metadata?.status === 'connected' ? (
                <span className="text-emerald-400">Connected</span>
              ) : (
                <span className="text-red-400">{metadata?.status || 'Unknown'}</span>
              )}
              {metadata?.last_synced && (
                <span className="ml-2">Last synced: {formatDate(metadata.last_synced)}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            syncAccounts();
          }}
          disabled={syncing}
          className="px-3 py-1 text-sm bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Total Balance */}
      {accounts.length > 0 && (
        <div className="mb-4 p-3 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">Total Balance</p>
          <p className="text-2xl font-semibold text-white">{formatCurrency(totalBalance)}</p>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-neutral-400 text-sm mt-2">Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-neutral-400">No accounts found</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              syncAccounts();
            }}
            className="mt-2 text-emerald-400 text-sm hover:underline"
          >
            Sync accounts now
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const accountMeta = account.metadata as TellerAccountMetadata;
            return (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 bg-neutral-800 rounded hover:bg-neutral-750 transition-colors"
              >
                <div>
                  <p className="text-white font-medium">{account.data}</p>
                  <p className="text-xs text-neutral-400 capitalize">
                    {accountMeta?.account_type} {accountMeta?.subtype && `• ${accountMeta.subtype}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    {formatCurrency(accountMeta?.balance_current, accountMeta?.currency)}
                  </p>
                  {accountMeta?.balance_available !== undefined && accountMeta?.balance_available !== accountMeta?.balance_current && (
                    <p className="text-xs text-neutral-400">
                      Available: {formatCurrency(accountMeta.balance_available, accountMeta.currency)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
