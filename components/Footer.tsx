import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-base-200 border-t border-base-300">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold mb-2">List App</h3>
            <p className="text-sm text-gray-600">Minimalist list management with real-time collaboration</p>
          </div>

          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-6 text-center">
            <Link
              to="/terms-of-service"
              className="link link-primary text-sm hover:text-primary-focus"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy-policy"
              className="link link-primary text-sm hover:text-primary-focus"
            >
              Privacy Policy
            </Link>
            <Link
              to="/refund-policy"
              className="link link-primary text-sm hover:text-primary-focus"
            >
              Refund Policy
            </Link>
          </div>
        </div>

        <div className="divider my-4"></div>

        <div className="text-center text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} List App. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};