import React from 'react';

interface NetWorthSummaryProps {
  assets: number;
  liabilities: number;
  currency?: string;
}

export const NetWorthSummary: React.FC<NetWorthSummaryProps> = ({
  assets,
  liabilities,
  currency = 'USD',
}) => {
  const netWorth = assets - liabilities;
  const isPositive = netWorth >= 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  return (
    <div className="bg-neutral-900 rounded-lg p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-neutral-400 text-sm">Net Worth</span>
        <span className={`text-2xl font-semibold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isPositive ? '' : '-'}{formatCurrency(netWorth)}
        </span>
      </div>
      <div className="border-t border-neutral-800 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-sm">Assets</span>
          <span className="text-neutral-300 text-sm">+{formatCurrency(assets)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-sm">Liabilities</span>
          <span className="text-neutral-400 text-sm">-{formatCurrency(liabilities)}</span>
        </div>
      </div>
    </div>
  );
};
