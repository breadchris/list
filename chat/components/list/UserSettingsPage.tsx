import React from 'react';
import { useRouter } from 'next/navigation';
import { useFeatureFlags } from '@/hooks/list/useFeatureFlags';
import { FeatureFlagKey } from '@/utils/list/featureFlags';

/**
 * User Settings Page
 *
 * Full-page settings view with:
 * - Feature flags toggles
 * - Back navigation
 */
export const UserSettingsPage: React.FC = () => {
  const router = useRouter();
  const { flags, toggleFlag, metadata } = useFeatureFlags();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(-1)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1 -ml-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <div className="w-24"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Feature Flags Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Feature Flags</h2>
              <p className="text-sm text-gray-600 mt-1">
                Enable experimental features and customize your experience
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {(Object.keys(flags) as FeatureFlagKey[]).map((key) => {
                const flag = metadata[key];
                const isEnabled = flags[key];

                return (
                  <div key={key} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      {/* Flag Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{flag.label}</h3>
                          {isEnabled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Enabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        onClick={() => toggleFlag(key)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`Toggle ${flag.label}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">About Feature Flags</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Feature flags allow you to enable experimental features that are still in development.
                  These settings are stored locally in your browser and won't sync across devices.
                  You can toggle them on or off at any time.
                </p>
              </div>
            </div>
          </div>

          {/* Warning Card - Only show if any flag is enabled */}
          {Object.values(flags).some((value) => value) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-900">Experimental Features Active</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    You have experimental features enabled. These features may be unstable or change
                    without notice. If you experience issues, try disabling these features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
