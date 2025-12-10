import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { MonthCard, MonthSummary } from './MonthCard';
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

interface MonthlyViewProps {
  groupId: string;
  userId: string;
}

// Calculate outlier threshold using IQR method
function findOutlierThreshold(amounts: number[]): number {
  if (amounts.length < 4) return Infinity; // Not enough data
  const sorted = amounts.slice().sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return q3 + (1.5 * iqr);
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({ groupId, userId }) => {
  const [accounts, setAccounts] = useState<Content[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([]);
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      // Step 3: Get all transactions from all accounts
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

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);

      // Step 4: Group by month and calculate summaries
      const monthMap = new Map<string, TransactionWithAccount[]>();
      for (const txn of allTransactions) {
        if (!txn.date) continue;
        const monthKey = txn.date.substring(0, 7); // "2024-12"
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, []);
        }
        monthMap.get(monthKey)!.push(txn);
      }

      const summaries: MonthSummary[] = Array.from(monthMap.entries())
        .map(([month, txns]) => {
          let income = 0;
          let spending = 0;

          for (const txn of txns) {
            const isCredit = txn.accountType.toLowerCase() === 'credit';
            // For credit cards, flip the sign for net worth impact
            const netWorthAmount = isCredit ? -txn.amount : txn.amount;

            if (netWorthAmount > 0) {
              income += netWorthAmount;
            } else {
              spending += Math.abs(netWorthAmount);
            }
          }

          const date = new Date(month + '-01');
          return {
            month,
            label: date.toLocaleDateString('en-US', { month: 'short' }),
            year: date.getFullYear().toString(),
            income,
            spending,
            net: income - spending,
            transactionCount: txns.length,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month)); // Sort chronologically

      setMonthSummaries(summaries);

      // Select most recent month by default
      if (summaries.length > 0 && !selectedMonth) {
        setSelectedMonth(summaries[summaries.length - 1].month);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedMonth]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Scroll to selected month card
  useEffect(() => {
    if (scrollRef.current && selectedMonth) {
      const selectedIndex = monthSummaries.findIndex(s => s.month === selectedMonth);
      if (selectedIndex >= 0) {
        const cardWidth = 120; // approximate width + gap
        scrollRef.current.scrollLeft = Math.max(0, selectedIndex * cardWidth - 100);
      }
    }
  }, [selectedMonth, monthSummaries]);

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

  const selectedSummary = monthSummaries.find(s => s.month === selectedMonth);
  const selectedTransactions = selectedMonth
    ? transactions.filter(t => t.date?.startsWith(selectedMonth))
    : [];

  // Calculate outlier threshold from all spending amounts
  const spendingAmounts = transactions
    .map(t => {
      const isCredit = t.accountType.toLowerCase() === 'credit';
      // Get the absolute net worth impact
      return Math.abs(isCredit ? -t.amount : t.amount);
    })
    .filter(a => a > 0);
  const outlierThreshold = findOutlierThreshold(spendingAmounts);

  // Helper to check if a transaction is an outlier
  const isOutlier = (txn: TransactionWithAccount): boolean => {
    const isCredit = txn.accountType.toLowerCase() === 'credit';
    const absAmount = Math.abs(isCredit ? -txn.amount : txn.amount);
    return absAmount > outlierThreshold;
  };

  // Group selected month's transactions by date
  const transactionsByDate = selectedTransactions.reduce((acc, txn) => {
    const date = txn.date || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {} as Record<string, TransactionWithAccount[]>);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === 'Unknown') return 'Unknown Date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-neutral-400">Loading monthly data...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Month Cards Carousel */}
      {monthSummaries.length > 0 && (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {monthSummaries.map((summary) => (
            <MonthCard
              key={summary.month}
              summary={summary}
              isSelected={summary.month === selectedMonth}
              onClick={() => setSelectedMonth(summary.month)}
            />
          ))}
        </div>
      )}

      {/* Selected Month Summary */}
      {selectedSummary && (
        <div className="bg-neutral-900 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">
              {new Date(selectedSummary.month + '-01').toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <button
              onClick={syncAllTransactions}
              disabled={syncing || accounts.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-400">Earned</span>
              <span className="text-emerald-400 font-medium">+{formatCurrency(selectedSummary.income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Spent</span>
              <span className="text-neutral-200 font-medium">-{formatCurrency(selectedSummary.spending)}</span>
            </div>
            <div className="border-t border-neutral-800 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Net</span>
                <span className={`font-medium ${selectedSummary.net >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedSummary.net >= 0 ? '+' : ''}{formatCurrency(selectedSummary.net)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Count */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-neutral-400 text-sm">
          {selectedTransactions.length} transactions
        </span>
      </div>

      {/* Empty State */}
      {monthSummaries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-400">No transaction data available</p>
          <p className="text-neutral-500 text-sm mt-1">Connect accounts and sync transactions</p>
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
                  <UnifiedTransactionRow key={txn.id} transaction={txn} isOutlier={isOutlier(txn)} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
