"use client";

import React, { useState } from 'react';
import { useRecipientSearch } from '@/hooks/transfer/use-recipient-search';
import { useCreateTransfer } from '@/hooks/transfer/use-transfers';
import { Send, User, DollarSign, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TransferFormProps {
  userId: string;
  onSuccess: () => void;
}

export function TransferForm({ userId, onSuccess }: TransferFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; username: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: searchResults, isLoading: searching } = useRecipientSearch(
    searchQuery,
    userId
  );

  const createTransfer = useCreateTransfer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient || !amount) return;

    setError(null);
    setSuccess(false);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (amountCents < 100) {
        setError('Minimum transfer amount is $1.00');
        return;
      }

      await createTransfer.mutateAsync({
        sender_user_id: userId,
        recipient_user_id: selectedRecipient.id,
        amount_cents: amountCents,
        description: description || undefined,
        idempotency_key: uuidv4(),
      });

      setSuccess(true);
      setAmount('');
      setDescription('');
      setSelectedRecipient(null);
      setSearchQuery('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
      <h3 className="text-lg font-semibold text-white mb-4">Send Money</h3>

      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-300 text-sm">
          Transfer sent successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient Search */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Recipient</label>
          {selectedRecipient ? (
            <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-400" />
                <span className="text-white">{selectedRecipient.username}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipient(null)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {/* Search Results Dropdown */}
              {searchQuery.length >= 2 && (searchResults?.users?.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden z-10">
                  {searching ? (
                    <div className="p-3 text-neutral-400 text-sm">Searching...</div>
                  ) : searchResults?.users?.length === 0 ? (
                    <div className="p-3 text-neutral-400 text-sm">No users found</div>
                  ) : (
                    searchResults?.users?.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedRecipient(user);
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-2 p-3 hover:bg-neutral-700 text-left"
                      >
                        <User className="w-4 h-4 text-neutral-400" />
                        <span className="text-white">{user.username}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Amount</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="1"
              step="0.01"
              className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-2xl font-semibold placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Note (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this for?"
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createTransfer.isPending || !selectedRecipient || !amount}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {createTransfer.isPending ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send ${amount || '0.00'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
