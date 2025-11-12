import React from 'react';
import { CONTENT_TYPE_SCHEMAS } from './contentTypeSchemas';

interface ContentGenerationSuggestionProps {
  contentTypeId: string;
  userMessage: string;
  onConfirm: () => void;
  onCancel: () => void;
  isGenerating: boolean;
}

/**
 * Confirmation dialog for structured content generation
 * Shows before generating recipes, task lists, events, or book summaries
 * Allows user to confirm or cancel the generation
 */
export const ContentGenerationSuggestion: React.FC<ContentGenerationSuggestionProps> = ({
  contentTypeId,
  userMessage,
  onConfirm,
  onCancel,
  isGenerating,
}) => {
  const contentTypeConfig = CONTENT_TYPE_SCHEMAS[contentTypeId];

  if (!contentTypeConfig) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="text-4xl flex items-center justify-center w-14 h-14 rounded-lg"
            style={{ backgroundColor: `${contentTypeConfig.color}20` }}
          >
            {contentTypeConfig.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Create {contentTypeConfig.display_name}?
            </h3>
            <p className="text-sm text-gray-500">
              AI detected structured content request
            </p>
          </div>
        </div>

        {/* User message preview */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2 font-medium">Your request:</p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-sm text-gray-700 line-clamp-3">
              {userMessage}
            </p>
          </div>
        </div>

        {/* What will be created */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2 font-medium">What will be created:</p>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-sm text-blue-900">
              A structured <strong>{contentTypeConfig.display_name}</strong> with all relevant details,
              saved as a new content item in your workspace.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send as message
          </button>
          <button
            onClick={onConfirm}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: contentTypeConfig.color }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </span>
            ) : (
              `Create ${contentTypeConfig.display_name}`
            )}
          </button>
        </div>

        {/* Info footer */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          You can always edit or delete the generated content later
        </p>
      </div>
    </div>
  );
};
