import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">List App</h3>
            <p className="text-sm text-gray-600">Minimalist list management with real-time collaboration</p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-1 text-sm">
            <Link
              to="/pricing"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Pricing
            </Link>
            <span className="text-gray-400">·</span>
            <Link
              to="/terms-of-service"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-gray-400">·</span>
            <Link
              to="/privacy-policy"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-gray-400">·</span>
            <Link
              to="/refund-policy"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Refund Policy
            </Link>
          </div>

          <div className="text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} List App. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};