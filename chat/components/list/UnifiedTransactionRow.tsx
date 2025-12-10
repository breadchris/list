import React from 'react';
import { Zap } from 'lucide-react';

export interface TransactionWithAccount {
  id: string;
  description: string;
  amount: number;
  category: string;
  status: string;
  date: string;
  accountType: string;
  accountName: string;
  currency: string;
}

interface UnifiedTransactionRowProps {
  transaction: TransactionWithAccount;
  isOutlier?: boolean;
}

const getAccountBadgeStyle = (accountType: string): string => {
  switch (accountType.toLowerCase()) {
    case 'checking':
      return 'bg-slate-700 text-slate-300';
    case 'savings':
      return 'bg-emerald-900/50 text-emerald-300';
    case 'credit':
      return 'bg-purple-900/50 text-purple-300';
    default:
      return 'bg-neutral-700 text-neutral-300';
  }
};

export const UnifiedTransactionRow: React.FC<UnifiedTransactionRowProps> = ({ transaction, isOutlier = false }) => {
  const badgeStyle = getAccountBadgeStyle(transaction.accountType);
  const isCredit = transaction.accountType.toLowerCase() === 'credit';

  // For credit cards: spending (positive from Teller) = BAD for net worth
  // For bank accounts: spending (negative) = BAD, deposits (positive) = GOOD
  // Credit card payments show as negative from Teller = GOOD for net worth
  const isPositiveImpact = isCredit
    ? transaction.amount < 0  // Credit payment reduces debt = good
    : transaction.amount > 0; // Bank deposit = good

  // For credit cards, flip the sign so purchases show as negative (taking from net worth)
  const displayAmount = isCredit ? -transaction.amount : transaction.amount;

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: transaction.currency || 'USD',
    }).format(Math.abs(amount));

    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className={`flex items-center gap-3 py-2 px-2 -mx-2 rounded ${isOutlier ? 'bg-amber-900/10' : ''}`}>
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded truncate max-w-[120px] ${badgeStyle}`}>
        {transaction.accountName}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-neutral-200 text-sm truncate">
          {transaction.description}
        </p>
        <p className="text-xs text-neutral-500 capitalize">
          {transaction.category}
          {transaction.status !== 'posted' && (
            <span className="ml-2 text-amber-500">({transaction.status})</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-medium ${isPositiveImpact ? 'text-emerald-300' : 'text-neutral-200'}`}>
          {formatCurrency(displayAmount)}
        </span>
        {isOutlier && (
          <Zap className="w-3.5 h-3.5 text-amber-400" title="Unusually large transaction" />
        )}
      </div>
    </div>
  );
};
