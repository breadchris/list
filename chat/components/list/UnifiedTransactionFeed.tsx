import React, { useEffect, useState, useCallback } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { NetWorthSummary } from './NetWorthSummary';
import { UnifiedTransactionRow, TransactionWithAccount } from './UnifiedTransactionRow';
import { RefreshCw } from 'lucide-react';

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
  access_token?: string;
}

interface TellerTransactionMetadata {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  category: string;
  status: string;
  merchant_name?: string;
}

interface UnifiedTransactionFeedProps {
  groupId: string;
  userId: string;
}

export const UnifiedTransactionFeed: React.FC<UnifiedTransactionFeedProps> = ({
  groupId,
  userId,
}) => {
  const [accounts, setAccounts] = useState<Content[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Get all enrollments
      const allRootContent = await contentRepository.getContentByParent(groupId, null, 0, 100, 'chronological');
      const enrollments = allRootContent.filter((item: Content) => item.type === 'teller_enrollment');

      // Step 2: Get all accounts from all enrollments
      const allAccounts: Content[] = [];
      for (const enrollment of enrollments) {
        const enrollmentContent = await contentRepository.getContentByParent(groupId, enrollment.id, 0, 100, 'chronological');
        const accounts = enrollmentContent.filter((item: Content) => item.type === 'teller_account');
        allAccounts.push(...accounts);
      }
      setAccounts(allAccounts);

      // Step 3: Build account lookup map
      const accountMap = new Map<string, { type: string; name: string; currency: string }>();
      for (const account of allAccounts) {
        const meta = account.metadata as TellerAccountMetadata;
        accountMap.set(account.id, {
          type: meta.account_type,
          name: account.data,
          currency: meta.currency || 'USD',
        });
      }

      // Step 4: Get all transactions from all accounts
      const allTransactions: TransactionWithAccount[] = [];
      for (const account of allAccounts) {
        const accountMeta = account.metadata as TellerAccountMetadata;
        const txnContent = await contentRepository.getContentByParent(groupId, account.id, 0, 500, 'chronological');
        const txns = txnContent.filter((item: Content) => item.type === 'teller_transaction');

        for (const txn of txns) {
          const txnMeta = txn.metadata as TellerTransactionMetadata;
          allTransactions.push({
            id: txn.id,
            description: txnMeta?.merchant_name || txn.data,
            amount: txnMeta?.amount || 0,
            category: txnMeta?.category || 'uncategorized',
            status: txnMeta?.status || 'posted',
            date: txnMeta?.date || '',
            accountType: accountMeta.account_type,
            accountName: account.data,
            currency: accountMeta.currency || 'USD',
          });
        }
      }

      // Step 5: Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
    } catch (err) {
      console.error('Error fetching unified data:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const syncAllTransactions = async () => {
    try {
      setSyncing(true);
      setError(null);

      for (const account of accounts) {
        const meta = account.metadata as TellerAccountMetadata;
        if (!meta.access_token) continue;

        await fetch('/api/teller/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_content_id: account.id,
            access_token: meta.access_token,
            account_id: meta.account_id,
            group_id: groupId,
            user_id: userId,
            count: 100,
          }),
        });
      }

      await fetchAllData();
    } catch (err) {
      console.error('Error syncing transactions:', err);
      setError('Failed to sync some transactions');
    } finally {
      setSyncing(false);
    }
  };

  // Calculate net worth from accounts
  const { assets, liabilities } = accounts.reduce(
    (acc, account) => {
      const meta = account.metadata as TellerAccountMetadata;
      const balance = meta.balance_current || 0;

      if (meta.account_type === 'credit') {
        acc.liabilities += Math.abs(balance);
      } else {
        acc.assets += balance;
      }
      return acc;
    },
    { assets: 0, liabilities: 0 }
  );

  // Group transactions by date
  const transactionsByDate = transactions.reduce((acc, txn) => {
    const date = txn.date || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {} as Record<string, TransactionWithAccount[]>);

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === 'Unknown') return 'Unknown Date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-neutral-400">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Net Worth Summary */}
      <NetWorthSummary assets={assets} liabilities={liabilities} />

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Sync Button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-neutral-400 text-sm">
          {transactions.length} transactions
        </span>
        <button
          onClick={syncAllTransactions}
          disabled={syncing || accounts.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </button>
      </div>

      {/* Empty State */}
      {transactions.length === 0 && accounts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-400">No accounts connected</p>
          <p className="text-neutral-500 text-sm mt-1">Connect a bank account to see transactions</p>
        </div>
      )}

      {transactions.length === 0 && accounts.length > 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-400">No transactions yet</p>
          <p className="text-neutral-500 text-sm mt-1">Click "Sync All" to load transactions</p>
        </div>
      )}

      {/* Transactions grouped by date */}
      <div className="space-y-6">
        {Object.entries(transactionsByDate)
          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
          .map(([date, txns]) => (
            <div key={date}>
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2 pb-2 border-b border-neutral-800">
                {formatDateHeader(date)}
              </div>
              <div className="space-y-1">
                {txns.map((txn) => (
                  <UnifiedTransactionRow key={txn.id} transaction={txn} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
