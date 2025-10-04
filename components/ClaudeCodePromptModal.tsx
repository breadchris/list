import React, { useState, useRef, useEffect } from 'react';
import { Content, contentRepository } from './ContentRepository';
import { ClaudeCodeService } from './ClaudeCodeService';
import { useToast } from './ToastProvider';

interface ClaudeCodePromptModalProps {
  isVisible: boolean;
  selectedContent: Content[];
  groupId: string;
  parentContentId?: string | null;
  onClose: () => void;
  onContentGenerated: () => void;
}

export const ClaudeCodePromptModal: React.FC<ClaudeCodePromptModalProps> = ({
  isVisible,
  selectedContent,
  groupId,
  parentContentId = null,
  onClose,
  onContentGenerated
}) => {
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{
    session_id: string;
    initial_prompt: string;
    created_at: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  // Check for existing session when modal opens
  useEffect(() => {
    const checkForSession = async () => {
      if (isVisible && parentContentId) {
        const session = await contentRepository.getClaudeCodeSession(parentContentId);
        setSessionInfo(session);
      } else {
        setSessionInfo(null);
      }
    };

    checkForSession();
  }, [isVisible, parentContentId]);

  // Auto-focus and resize textarea
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize functionality
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [isVisible]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const handleExecute = async () => {
    const validation = ClaudeCodeService.validatePrompt(prompt);
    if (!validation.isValid) {
      toast.error('Invalid Prompt', validation.error || 'Please check your prompt');
      return;
    }

    setIsExecuting(true);
    setExecutionProgress('Preparing Claude Code execution...');

    try {
      setExecutionProgress('Calling Claude Code worker...');

      // Execute Claude Code with optional session continuation
      const response = await ClaudeCodeService.executeClaudeCode(
        prompt,
        sessionInfo?.session_id
      );

      if (!response.success) {
        throw new Error(response.error || 'Execution failed');
      }

      if (!response.session_id || !response.r2_url) {
        throw new Error('Invalid response from Claude Code worker');
      }

      setExecutionProgress('Creating content record...');

      // Create content item to store the prompt and session
      const newContent = await contentRepository.createContent({
        type: 'claude-code',
        data: prompt,
        group_id: groupId,
        parent_content_id: parentContentId
      });

      // Store session metadata
      await contentRepository.storeClaudeCodeSession(newContent.id, {
        session_id: response.session_id,
        r2_url: response.r2_url,
        initial_prompt: sessionInfo?.initial_prompt || prompt,
        last_updated_at: new Date().toISOString()
      });

      const isNewSession = !sessionInfo;
      const actionText = isNewSession ? 'started' : 'continued';

      toast.success(
        `Claude Code ${actionText}!`,
        `Session ${response.session_id.substring(0, 12)}... ${actionText} successfully`
      );

      // Reset form and close modal
      setPrompt('');
      onContentGenerated();
      onClose();

    } catch (error) {
      console.error('Claude Code execution failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Execution Failed', errorMessage);

      setExecutionProgress('');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    if (!isExecuting) {
      setPrompt('');
      setSessionInfo(null);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isExecuting) {
      e.preventDefault();
      handleExecute();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Claude Code {sessionInfo ? 'Session' : 'Execution'}
            </h2>
            {sessionInfo && (
              <p className="text-sm text-gray-500 mt-1">
                Continuing session from: "{ClaudeCodeService.formatPromptPreview(sessionInfo.initial_prompt, 60)}"
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Session Info */}
          {sessionInfo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Session Active</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Session ID: {sessionInfo.session_id.substring(0, 20)}...
                  </p>
                  <p className="text-xs text-blue-700">
                    Started: {new Date(sessionInfo.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected Content Info */}
          {selectedContent.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Content ({selectedContent.length} item{selectedContent.length !== 1 ? 's' : ''})
              </label>
              <div className="max-h-24 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-3">
                {selectedContent.map((content, index) => (
                  <div key={content.id} className="text-sm text-gray-600 truncate">
                    {index + 1}. {content.data.substring(0, 80)}{content.data.length > 80 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="mb-4">
            <label htmlFor="claude-code-prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Coding Prompt
            </label>
            <textarea
              ref={textareaRef}
              id="claude-code-prompt"
              value={prompt}
              onChange={handlePromptChange}
              onKeyPress={handleKeyPress}
              disabled={isExecuting}
              placeholder={sessionInfo
                ? "Continue your Claude Code session with a new prompt..."
                : "Enter a coding task for Claude Code to execute..."
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">
              Press Cmd/Ctrl + Enter to execute
            </p>
          </div>

          {/* Execution Progress */}
          {isExecuting && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-sm text-blue-900">{executionProgress}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {sessionInfo
              ? 'This will continue the existing Claude Code session'
              : 'This will start a new Claude Code session'
            }
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={isExecuting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={isExecuting || !prompt.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <span>{sessionInfo ? 'Continue Session' : 'Execute Code'}</span>
              {!isExecuting && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
