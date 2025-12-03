"use client";

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  // Create QueryClient inside component using useState
  // This ensures it's in the client module graph and properly shared via context
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 10 minutes
        gcTime: 1000 * 60 * 10,
        // Data is fresh for 30 seconds for content, 5 minutes for groups
        staleTime: 1000 * 30,
        // Retry failed requests 3 times with exponential backoff
        retry: (failureCount, error) => {
          // Don't retry on 404s or auth errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status as number;
            if (status === 404 || status === 401 || status === 403) {
              return false;
            }
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect to avoid duplicate requests
        refetchOnReconnect: false,
        // Use network mode to handle offline scenarios
        networkMode: 'online',
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        retryDelay: 1000,
        networkMode: 'online',
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
