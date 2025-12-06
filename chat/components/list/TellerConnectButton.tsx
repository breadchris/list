import React from 'react';
import { useTellerConnect } from 'teller-connect-react';
import { contentRepository } from '@/lib/list/ContentRepository';

// Get Teller config from environment variables
const TELLER_APPLICATION_ID = process.env.NEXT_PUBLIC_TELLER_APPLICATION_ID || '';
const TELLER_ENVIRONMENT = process.env.NEXT_PUBLIC_TELLER_ENVIRONMENT || 'sandbox';

interface TellerConnectButtonProps {
  groupId: string;
  userId: string;
  parentContentId?: string;
  onSuccess?: (enrollmentId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}

interface TellerAuthorization {
  accessToken: string;
  enrollment: {
    id: string;
    institution: {
      name: string;
    };
  };
}

export const TellerConnectButton: React.FC<TellerConnectButtonProps> = ({
  groupId,
  userId,
  parentContentId,
  onSuccess,
  onError,
  className = '',
  children,
}) => {
  const handleTellerSuccess = async (authorization: TellerAuthorization) => {
    try {
      // Create teller_enrollment content item
      const enrollmentContent = await contentRepository.createContent({
        type: 'teller_enrollment',
        data: authorization.enrollment.institution.name,
        group_id: groupId,
        user_id: userId,
        parent_content_id: parentContentId,
        metadata: {
          enrollment_id: authorization.enrollment.id,
          access_token: authorization.accessToken,
          institution_id: authorization.enrollment.institution.name.toLowerCase().replace(/\s+/g, '-'),
          institution_name: authorization.enrollment.institution.name,
          status: 'connected',
          last_synced: new Date().toISOString(),
        },
      });

      if (enrollmentContent && onSuccess) {
        onSuccess(enrollmentContent.id);
      }
    } catch (error) {
      console.error('Error creating Teller enrollment:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Failed to save enrollment'));
      }
    }
  };

  const { open, ready } = useTellerConnect({
    applicationId: TELLER_APPLICATION_ID,
    environment: TELLER_ENVIRONMENT as 'sandbox' | 'development' | 'production',
    onSuccess: handleTellerSuccess,
    onExit: () => {
      // User closed the modal without completing
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {!ready ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )}
      {children || 'Connect Bank Account'}
    </button>
  );
};
