"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { experimental_useObject as useObject } from "ai/react";
import { useRef, useEffect, useCallback } from "react";
import { AppResultRenderer } from "./app-result-renderer";
import ProjectOverview from "./project-overview";
import { useArray, useMap, useYDoc } from "@y-sweet/react";
import type { AppConfig } from "@/lib/apps.config";

type Message = {
  role: "user" | "assistant";
  content: string | any;
};

interface SearchInterfaceProps {
  appConfig: AppConfig;
}

export function SearchInterface({ appConfig }: SearchInterfaceProps) {
  // Y-Sweet shared state
  const doc = useYDoc();
  const chatHistory = useArray<Message>("chatHistory");
  const sharedState = useMap("sharedState");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Validate required fields for SearchInterface
  if (!appConfig.apiEndpoint || !appConfig.schema) {
    throw new Error(`SearchInterface requires apiEndpoint and schema for app: ${appConfig.id}`);
  }

  // Get shared state values (with defaults)
  const inputValue = (sharedState.get("inputValue") as string) || "";
  const currentQuestionIndex = (sharedState.get("currentQuestionIndex") as number) || 0;
  const activeQuestions = (sharedState.get("activeQuestions") as any[] | null) || null;

  const {
    object: generatedObject,
    submit: submitGeneration,
    isLoading,
  } = useObject({
    api: appConfig.apiEndpoint,
    schema: appConfig.schema,
  });

  // Auto-scroll to bottom when new messages arrive (not on every content update)
  const messageCount = chatHistory.length;
  useEffect(() => {
    if (chatContainerRef.current && messageCount > prevMessageCountRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount]);

  // When generatedObject updates, handle based on render mode
  // Batch YJS operations in a transaction to prevent jitter on receiving clients
  useEffect(() => {
    if (!generatedObject) return;

    if (appConfig.renderMode === "card") {
      // For card mode (recipes), add to chat history
      // Use transaction to batch delete+push as a single sync update
      doc.transact(() => {
        const messages = chatHistory.toArray();
        if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
          // Replace last assistant message
          chatHistory.delete(messages.length - 1, 1);
        }
        chatHistory.push([{ role: "assistant", content: generatedObject }]);
      });
    } else if (appConfig.renderMode === "question") {
      // For question mode, set active questions
      // Use transaction to batch state updates
      doc.transact(() => {
        const questions = (generatedObject as any).questions;
        if (questions && questions.length > 0) {
          sharedState.set("activeQuestions", questions);
          sharedState.set("currentQuestionIndex", 0);
        }
      });
    }
  }, [generatedObject, appConfig.renderMode, chatHistory, sharedState, doc]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Add user message to chat history
    chatHistory.push([{ role: "user", content: inputValue }]);

    // Submit to configured API
    submitGeneration({ prompt: inputValue });

    // Clear input
    sharedState.set("inputValue", "");
  };

  const handleAnswer = (answer: string) => {
    if (!activeQuestions) return;

    const questionNumber = currentQuestionIndex + 1;
    const question = activeQuestions[currentQuestionIndex].question;

    // Log answer to console
    console.log(`Q${questionNumber}: ${question}`);
    console.log(`A${questionNumber}: ${answer}`);

    // Add Q&A to chat history
    chatHistory.push([
      {
        role: "assistant",
        content: `Q${questionNumber}: ${question}`,
      },
      {
        role: "user",
        content: answer,
      },
    ]);

    // Move to next question or finish
    if (currentQuestionIndex < activeQuestions.length - 1) {
      sharedState.set("currentQuestionIndex", currentQuestionIndex + 1);
    } else {
      // Finished all questions
      chatHistory.push([
        {
          role: "assistant",
          content: "🎉 All questions completed! Check the console for your answers.",
        },
      ]);
      sharedState.set("activeQuestions", null);
      sharedState.set("currentQuestionIndex", 0);
    }
  };

  const handleClear = () => {
    // Clear all messages from chat history
    chatHistory.delete(0, chatHistory.length);
    sharedState.set("inputValue", "");
    sharedState.set("activeQuestions", null);
    sharedState.set("currentQuestionIndex", 0);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-foreground flex flex-col max-w-5xl mx-auto">
      <div className="flex-1 overflow-hidden flex flex-col px-8 pt-8 pb-8">
        {/* Chat History */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-6 mb-6"
        >
          {chatHistory.length === 0 && !isLoading && !activeQuestions && <ProjectOverview />}

          {chatHistory.toArray().map((message, index) => (
            <div key={index} className="space-y-2">
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                    {message.content as string}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {typeof message.content === "string" ? (
                    <div className="flex justify-start">
                      <div className="bg-neutral-800 text-neutral-100 rounded-lg px-4 py-2 max-w-[80%]">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-start">
                        <div className="bg-neutral-800 text-neutral-100 rounded-lg px-4 py-2 max-w-[80%]">
                          Assistant
                        </div>
                      </div>
                      <div className="w-full">
                        <AppResultRenderer
                          renderMode={appConfig.renderMode}
                          data={message.content}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Active Question */}
          {activeQuestions && currentQuestionIndex < activeQuestions.length && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="bg-neutral-800 text-neutral-100 rounded-lg px-4 py-2 max-w-[80%]">
                  Assistant
                </div>
              </div>
              <AppResultRenderer
                renderMode={appConfig.renderMode}
                data={activeQuestions[currentQuestionIndex]}
                onAnswer={handleAnswer}
                questionIndex={currentQuestionIndex}
                totalQuestions={activeQuestions.length}
                isLastQuestion={currentQuestionIndex === activeQuestions.length - 1}
              />
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-neutral-800 text-neutral-100 rounded-lg px-4 py-2">
                {appConfig.loadingText}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-neutral-800 pt-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => sharedState.set("inputValue", e.target.value)}
              placeholder={appConfig.placeholder}
              className="flex-1 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              disabled={isLoading || activeQuestions !== null}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={isLoading || !inputValue.trim() || activeQuestions !== null}
            >
              Send
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={chatHistory.length === 0 && !activeQuestions}
            >
              Clear
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
