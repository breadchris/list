import React, { useEffect, useState } from 'react';
import { QueryProvider } from '../providers/QueryProvider';
import { ToastProvider } from './ToastProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { ListApp } from './ListApp';
import { PublicContentView } from './PublicContentView';

/**
 * Main App component that wraps the application with providers and handles routing
 * This ensures QueryProvider is established before any hooks are called
 */
export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'main' | 'public'>('main');

  useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname;
      
      // Check if this is a public content URL
      if (pathname.startsWith('/public/content/')) {
        setCurrentRoute('public');
      } else {
        setCurrentRoute('main');
      }
    };

    // Check initial route
    checkRoute();

    // Listen for navigation changes
    const handlePopState = () => {
      checkRoute();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          {currentRoute === 'public' ? <PublicContentView /> : <ListApp />}
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};