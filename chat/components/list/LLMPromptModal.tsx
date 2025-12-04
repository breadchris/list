import React, { useState, useRef, useEffect } from 'react';
import { Content } from '@/lib/list/ContentRepository';
import { LLMService, LLMRequest } from '@/lib/list/LLMService';
import { useToast } from './ToastProvider';

interface LLMPromptModalProps {
  isVisible: boolean;
  selectedContent: Content[];
  groupId: string;
  parentContentId?: string | null;
  onClose: () => void;
  onContentGenerated: () => void;
}

export const LLMPromptModal: React.FC<LLMPromptModalProps> = ({
  isVisible,
  selectedContent,
  groupId,
  parentContentId = null,
  onClose,
  onContentGenerated
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

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
    setSystemPrompt(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const handleGenerate = async () => {
    const validation = LLMService.validatePrompt(systemPrompt);
    if (!validation.isValid) {
      toast.error('Invalid Prompt', validation.error || 'Please check your prompt');
      return;
    }

    if (selectedContent.length === 0) {
      toast.error('No Content Selected', 'Please select at least one content item');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Preparing request...');

    try {
      setGenerationProgress('Calling AI service...');

      const request: LLMRequest = {
        system_prompt: systemPrompt,
        selected_content: selectedContent,
        group_id: groupId,
        parent_content_id: parentContentId
      };

      const response = await LLMService.generateContent(request);

      if (!response.success) {
        throw new Error(response.error || 'Generation failed');
      }

      setGenerationProgress('Creating content...');

      // Success! Content has been created by the Edge Function
      const generatedCount = response.generated_content?.length || 0;

      toast.success(
        'Content Generated!',
        `Successfully generated ${generatedCount} item${generatedCount !== 1 ? 's' : ''} from your prompt`
      );

      // Reset form and close modal
      setSystemPrompt('');
      onContentGenerated();
      onClose();

    } catch (error) {
      console.error('LLM Generation failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Generation Failed', errorMessage);

      setGenerationProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Cmd/Ctrl + Enter to generate
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
    // Escape to close
    else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const selectedContentSummary = LLMService.formatSelectedContentSummary(selectedContent);

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span>Generate with AI</span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Selected: {selectedContentSummary}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* System Prompt Input */}
            <div>
              <label htmlFor="system-prompt" className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                ref={textareaRef}
                id="system-prompt"
                value={systemPrompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                placeholder="Enter your prompt (e.g., 'Summarize these items', 'Create action items', 'Extract key insights')..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                rows={3}
                maxLength={4000}
              />
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-gray-500">
                  {systemPrompt.length}/4000 characters
                </div>
                <div className="text-xs text-gray-500">
                  ⌘+Enter to generate
                </div>
              </div>
            </div>

            {/* Selected Content Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Selected Content ({selectedContent.length} item{selectedContent.length !== 1 ? 's' : ''})
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedContent.map((item, index) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {item.type}
                      </span>
                      <span className="text-gray-600 truncate flex-1">
                        {item.data.substring(0, 60)}{item.data.length > 60 ? '...' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                  <div>
                    <div className="text-sm font-medium text-purple-800">Generating content...</div>
                    {generationProgress && (
                      <div className="text-xs text-purple-600 mt-1">{generationProgress}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Generated content will be added as children of a new prompt item
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !systemPrompt.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};