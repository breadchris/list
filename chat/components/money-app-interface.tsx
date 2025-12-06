"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { getCurrentUser } from '@/lib/list/SupabaseClient';
import { TellerEnrollmentView } from '@/components/list/TellerEnrollmentView';
import { TellerConnectButton } from '@/components/list/TellerConnectButton';
import { Wallet, RefreshCw, Plus } from 'lucide-react';

interface Group {
  id: string;
  name: string;
}

interface TellerAccountMetadata {
  balance_current?: number;
  currency?: string;
}

export function MoneyAppInterface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [enrollments, setEnrollments] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user and groups on mount
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

        // Get user's groups
        const userGroups = await contentRepository.getUserGroups();
        setGroups(userGroups);

        // Select first group by default
        if (userGroups.length > 0) {
          setSelectedGroup(userGroups[0]);
        }
      } catch (err) {
        console.error('Error initializing money app:', err);
        setError('Failed to load your data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Fetch enrollments when selected group changes
  useEffect(() => {
    if (selectedGroup) {
      fetchEnrollments(selectedGroup.id);
    }
  }, [selectedGroup]);

  const fetchEnrollments = async (groupId: string) => {
    try {
      setLoading(true);

      // Fetch all root-level content and filter for teller_enrollment
      const allContent = await contentRepository.getContentByParent(groupId, null, 0, 100, 'chronological');
      const tellerEnrollments = allContent.filter((item: Content) => item.type === 'teller_enrollment');

      setEnrollments(tellerEnrollments);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setError('Failed to load bank connections');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentSuccess = useCallback(async () => {
    // Refresh enrollments after new bank connection
    if (selectedGroup) {
      await fetchEnrollments(selectedGroup.id);
    }
  }, [selectedGroup]);

  const handleRefresh = useCallback(async () => {
    if (selectedGroup) {
      await fetchEnrollments(selectedGroup.id);
    }
  }, [selectedGroup]);

  // Calculate total balance across all accounts in all enrollments
  const totalBalance = enrollments.reduce((total, enrollment) => {
    // This would need to sum up all child accounts' balances
    // For now, just show a placeholder - the actual balance comes from child accounts
    return total;
  }, 0);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (loading && !userId) {
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Money</h1>
              <p className="text-neutral-400 text-sm">Track your finances</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Group Selector */}
        {groups.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm text-neutral-400 mb-2">Group</label>
            <select
              value={selectedGroup?.id || ''}
              onChange={(e) => {
                const group = groups.find(g => g.id === e.target.value);
                setSelectedGroup(group || null);
              }}
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Connect Bank Button */}
        {userId && selectedGroup && (
          <div className="mb-6">
            <TellerConnectButton
              groupId={selectedGroup.id}
              userId={userId}
              onSuccess={handleEnrollmentSuccess}
              className="w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              Connect Bank Account
            </TellerConnectButton>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && enrollments.length === 0 && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-neutral-400">Loading your accounts...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && enrollments.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No banks connected</h2>
            <p className="text-neutral-400 mb-6">
              Connect your bank accounts to track your finances
            </p>
          </div>
        )}

        {/* Enrollments List */}
        {enrollments.length > 0 && (
          <div className="space-y-4">
            {enrollments.map(enrollment => (
              <TellerEnrollmentView
                key={enrollment.id}
                content={enrollment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
