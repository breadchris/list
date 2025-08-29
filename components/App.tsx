import React from 'react';
import { QueryProvider } from '../providers/QueryProvider';
import { ListApp } from './ListApp';

/**
 * Main App component that wraps the application with providers
 * This ensures QueryProvider is established before any hooks are called
 */
export const App: React.FC = () => {
  return (
    <QueryProvider>
      <ListApp />
    </QueryProvider>
  );
};