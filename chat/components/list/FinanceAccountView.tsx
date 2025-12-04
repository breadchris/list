import React, { useEffect, useState } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';

interface TransactionMetadata {
  transaction_date: string;
  post_date: string;
  description: string;
  category: string;
  transaction_type: string;
  amount: number;
  memo: string;
}

interface FinanceAccountViewProps {
  content: Content;
  onClick?: () => void;
}

export const FinanceAccountView: React.FC<FinanceAccountViewProps> = ({ content, onClick }) => {
  const [transactions, setTransactions] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchAllTransactions = async () => {
      try {
        const PAGE_SIZE = 1000;
        let allTransactions: Content[] = [];
        let offset = 0;
        let hasMore = true;

        // Paginate through all transactions
        while (hasMore) {
          const data = await contentRepository.getContentByParent(
            content.group_id,
            content.id,
            offset,
            PAGE_SIZE,
            'oldest'
          );
          allTransactions = [...allTransactions, ...data];

          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            offset += PAGE_SIZE;
          }
        }

        setTransactions(allTransactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllTransactions();
  }, [content.id, content.group_id]);

  // Sort transactions
  const sortedTransactions = [...transactions].sort((a, b) => {
    const metaA = a.metadata as TransactionMetadata;
    const metaB = b.metadata as TransactionMetadata;

    let comparison = 0;
    if (sortField === 'date') {
      comparison = new Date(metaA?.transaction_date || '').getTime() - new Date(metaB?.transaction_date || '').getTime();
    } else if (sortField === 'amount') {
      comparison = (metaA?.amount || 0) - (metaB?.amount || 0);
    } else if (sortField === 'category') {
      comparison = (metaA?.category || '').localeCompare(metaB?.category || '');
    }

    return sortAsc ? comparison : -comparison;
  });

  // Calculate totals
  const total = transactions.reduce((sum, t) => {
    const meta = t.metadata as TransactionMetadata;
    return sum + (meta?.amount || 0);
  }, 0);

  // Calculate by category
  const byCategory = transactions.reduce((acc, t) => {
    const meta = t.metadata as TransactionMetadata;
    const category = meta?.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + (meta?.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const handleSort = (field: 'date' | 'amount' | 'category') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading transactions...
      </div>
    );
  }

  return (
    <div className="w-full" onClick={onClick}>
      {/* Header with summary */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{content.data}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Transactions:</span>{' '}
            <span className="font-medium">{transactions.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Net Total:</span>{' '}
            <span className={`font-medium ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">By Category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(byCategory)
            .sort((a, b) => a[1] - b[1])
            .map(([category, amount]) => (
              <div key={category} className="flex justify-between gap-2 p-2 bg-white rounded border">
                <span className="text-gray-600 truncate">{category}</span>
                <span className={amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Transactions table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600 border-b border-gray-200">
              <th
                className="py-3 px-4 font-medium cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th
                className="py-3 px-4 font-medium cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                Category {sortField === 'category' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('amount')}
              >
                Amount {sortField === 'amount' && (sortAsc ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedTransactions.map((t) => {
              const meta = t.metadata as TransactionMetadata;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 text-gray-600 whitespace-nowrap">
                    {meta?.transaction_date}
                  </td>
                  <td className="py-2 px-4 text-gray-900">
                    {t.data}
                  </td>
                  <td className="py-2 px-4 text-gray-500">
                    {meta?.category}
                  </td>
                  <td className={`py-2 px-4 text-right font-medium whitespace-nowrap ${
                    (meta?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(meta?.amount || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
