import React, { useRef, useEffect, useState } from 'react';
import { ChatHistory } from '../hooks/useAIChatV2';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BasePromptEditor } from './BasePromptEditor';
import { NotesEditorSidebar } from './NotesEditorSidebar';

export interface Content {
  id: string;
  type: string;
  data: string;
  metadata?: {
    chat_history?: ChatHistory;
    created_via?: string;
    last_updated?: string;
  };
  group_id: string;
  user_id?: string;
  parent_content_id?: string;
}

interface AIChatV2SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatContent: Content;
  groupId: string;
  history: ChatHistory;
  currentResponse: any;
  isLoading: boolean;
  error: any;
  onFollowUpClick: (question: string) => void;
  basePrompt: string;
  onBasePromptChange: (prompt: string) => void;
  notesEditorState?: any;
  onNotesChange: (serializedState: any) => void;
}

export const AIChatV2Sidebar: React.FC<AIChatV2SidebarProps> = ({
  isOpen,
  onClose,
  chatContent,
  groupId,
  history = [],
  currentResponse,
  isLoading,
  error,
  onFollowUpClick,
  basePrompt,
  onBasePromptChange,
  notesEditorState,
  onNotesChange,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isPromptEditorCollapsed, setIsPromptEditorCollapsed] = useState(true);
  const [isNotesEditorCollapsed, setIsNotesEditorCollapsed] = useState(() => {
    const saved = localStorage.getItem('aiChatNotesEditorCollapsed');
    return saved !== 'false'; // Default to collapsed
  });

  // Auto-scroll to bottom when history or currentResponse updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, currentResponse]);

  // Persist notes editor collapse state
  useEffect(() => {
    localStorage.setItem('aiChatNotesEditorCollapsed', String(isNotesEditorCollapsed));
  }, [isNotesEditorCollapsed]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-row bg-white h-full">{/* AI Chat Interface with Prompt Editor */}
      {/* Chat Section */}
      <div className="flex-1 flex flex-col bg-white h-full min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
          {history.length === 0 && !currentResponse ? (
            <div className="text-center text-gray-500 py-8">
              Start a conversation with AI...
            </div>
          ) : (
            <>
              {/* Render conversation history */}
              {history.map((message, idx) => (
                <div key={idx}>
                  {/* User or assistant message */}
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-teal-500 text-white'
                          : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                      }`}
                    >
                      <div className="text-sm prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up questions for assistant messages */}
                  {message.role === 'assistant' && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                    <div className="flex justify-start mb-4">
                      <div className="max-w-[80%] space-y-2">
                        <div className="text-xs text-gray-500 px-2">Suggested questions:</div>
                        <div className="flex flex-wrap gap-2">
                          {message.followUpQuestions.map((question, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => onFollowUpClick(question)}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border border-gray-300"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Current streaming response */}
              {currentResponse && isLoading && (
                <div>
                  <div className="flex justify-start mb-2">
                    <div className="max-w-[80%] bg-white text-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                      <div className="text-sm prose prose-sm max-w-none">
                        {currentResponse?.answer ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentResponse.answer}
                          </ReactMarkdown>
                        ) : (
                          isLoading && <span className="text-gray-500">Thinking...</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Streaming follow-up questions */}
                  {currentResponse.follow_up_questions && currentResponse.follow_up_questions.length > 0 && (
                    <div className="flex justify-start mb-4">
                      <div className="max-w-[80%] space-y-2">
                        <div className="text-xs text-gray-500 px-2">Suggested questions:</div>
                        <div className="flex flex-wrap gap-2">
                          {currentResponse.follow_up_questions.map((question, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => onFollowUpClick(question)}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border border-gray-300"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Base Prompt Editor (middle sidebar) */}
      <BasePromptEditor
        value={basePrompt}
        onChange={onBasePromptChange}
        isCollapsed={isPromptEditorCollapsed}
        onToggleCollapse={() => setIsPromptEditorCollapsed(!isPromptEditorCollapsed)}
      />

      {/* Notes Editor (right sidebar) */}
      <NotesEditorSidebar
        isCollapsed={isNotesEditorCollapsed}
        onToggleCollapse={() => setIsNotesEditorCollapsed(!isNotesEditorCollapsed)}
        editorState={notesEditorState}
        onEditorChange={onNotesChange}
      />
    </div>
  );
};
