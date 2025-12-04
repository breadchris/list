import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryProvider } from '@/providers/list/QueryProvider';
import { ToastProvider } from './ToastProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { ListApp } from './ListApp';
import { GroupSettingsPage } from './GroupSettingsPage';
import { PublicContentView } from './PublicContentView';
import { TermsOfService } from './TermsOfService';
import { PrivacyPolicy } from './PrivacyPolicy';
import { RefundPolicy } from './RefundPolicy';
import { PricingPage } from './PricingPage';
import { AdminPage } from './AdminPage';
import { UserSettingsPage } from './UserSettingsPage';
import BranchingChatPage from './BranchingChatPage';

/**
 * Main App component that wraps the application with providers and React Router
 * This ensures QueryProvider is established before any hooks are called
 */
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Main app routes */}
              <Route path="/" element={<ListApp />} />
              <Route path="/group/:groupId" element={<ListApp />} />
              <Route path="/group/:groupId/content/:contentId" element={<ListApp />} />
              <Route path="/group/:groupId/settings" element={<GroupSettingsPage />} />
              <Route path="/group/:groupId/chat" element={<BranchingChatPage />} />
              <Route path="/invite/:joinCode" element={<ListApp />} />

              {/* Public content route */}
              <Route path="/public/content/:contentId" element={<PublicContentView />} />

              {/* Admin page */}
              <Route path="/admin" element={<AdminPage />} />

              {/* Pricing page */}
              <Route path="/pricing" element={<PricingPage />} />

              {/* User settings page */}
              <Route path="/settings" element={<UserSettingsPage />} />

              {/* Legal pages */}
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};