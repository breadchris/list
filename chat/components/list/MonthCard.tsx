import React from 'react';

export interface MonthSummary {
  month: string;        // "2024-12"
  label: string;        // "December"
  year: string;         // "2024"
  income: number;
  spending: number;
  net: number;
  transactionCount: number;
}

interface MonthCardProps {
  summary: MonthSummary;
  isSelected: boolean;
  onClick: () => void;
}

export const MonthCard: React.FC<MonthCardProps> = ({
  summary,
  isSelected,
  onClick,
}) => {
  const formatCompact = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1000) {
      return `$${(abs / 1000).toFixed(1)}k`;
    }
    return `$${abs.toFixed(0)}`;
  };

  const isPositiveNet = summary.net >= 0;

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-28 p-3 rounded-lg text-left transition-all ${
        isSelected
          ? 'bg-neutral-800 ring-2 ring-emerald-500'
          : 'bg-neutral-900 hover:bg-neutral-800'
      }`}
    >
      <div className="text-sm font-medium text-white mb-1">{summary.label}</div>
      <div className="text-xs text-neutral-500 mb-2">{summary.year}</div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-500">In</span>
          <span className="text-emerald-400">+{formatCompact(summary.income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Out</span>
          <span className="text-neutral-300">-{formatCompact(summary.spending)}</span>
        </div>
        <div className="border-t border-neutral-700 pt-1 mt-1">
          <div className="flex justify-between">
            <span className="text-neutral-500">Net</span>
            <span className={isPositiveNet ? 'text-emerald-400' : 'text-amber-400'}>
              {isPositiveNet ? '+' : '-'}{formatCompact(summary.net)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
