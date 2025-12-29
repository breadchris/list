"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from '@/lib/list/SupabaseClient';
import { TellerConnectButton } from '@/components/list/TellerConnectButton';
import { UnifiedTransactionFeed } from '@/components/list/UnifiedTransactionFeed';
import { MonthlyView } from '@/components/list/MonthlyView';
import { useGlobalGroup } from '@/components/GlobalGroupContext';
import { Wallet, Plus } from 'lucide-react';

type ViewMode = 'daily' | 'monthly';

export function MoneyAppInterface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // Use global group context
  const { selectedGroup, setSelectedGroup, groups, isLoading: groupsLoading } = useGlobalGroup();

  // Get user on mount
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
          setError('Please sign in to view your finances');
          setLoading(false);
          return;
        }
        setUserId(user.id);
      } catch (err) {
        console.error('Error initializing money app:', err);
        setError('Failed to load your data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleEnrollmentSuccess = useCallback(() => {
    // Trigger refresh of unified feed
    setRefreshKey((k) => k + 1);
  }, []);

  if ((loading || groupsLoading) && !userId) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-neutral-950 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Save</h1>
              <p className="text-neutral-500 text-xs">Track your finances</p>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            {/* Group Selector (compact) */}
            {groups.length > 1 && (
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const group = groups.find(g => g.id === e.target.value);
                  if (group) setSelectedGroup(group);
                }}
                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}

            {/* Connect Bank Button (compact) */}
            {userId && selectedGroup && (
              <TellerConnectButton
                groupId={selectedGroup.id}
                userId={userId}
                onSuccess={handleEnrollmentSuccess}
                className="!p-2 !bg-neutral-800 hover:!bg-neutral-700 !border-neutral-700"
              >
                <Plus className="w-4 h-4" />
              </TellerConnectButton>
            )}

            {/* View Toggle */}
            <div className="flex bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Transaction Views */}
        {userId && selectedGroup && viewMode === 'daily' && (
          <UnifiedTransactionFeed
            key={refreshKey}
            groupId={selectedGroup.id}
            userId={userId}
          />
        )}
        {userId && selectedGroup && viewMode === 'monthly' && (
          <MonthlyView
            key={`monthly-${refreshKey}`}
            groupId={selectedGroup.id}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
}
