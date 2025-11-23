"use client";

import { RecipeCard } from "./recipe-card";
import { QuestionCard } from "./question-card";
import type { RenderMode } from "@/lib/apps.config";

interface AppResultRendererProps {
  renderMode: RenderMode;
  data: any;
  onAnswer?: (answer: string) => void;
  questionIndex?: number;
  totalQuestions?: number;
  isLastQuestion?: boolean;
}

export function AppResultRenderer({
  renderMode,
  data,
  onAnswer,
  questionIndex,
  totalQuestions,
  isLastQuestion,
}: AppResultRendererProps) {
  if (renderMode === "card") {
    // Render recipe card
    if (data && data.recipe) {
      return <RecipeCard recipe={data.recipe} />;
    }
    return null;
  }

  if (renderMode === "question") {
    // Render question card
    if (data && onAnswer && questionIndex !== undefined && totalQuestions !== undefined) {
      return (
        <QuestionCard
          question={data.question}
          questionNumber={questionIndex + 1}
          totalQuestions={totalQuestions}
          onAnswer={onAnswer}
          isLast={isLastQuestion || false}
        />
      );
    }
    return null;
  }

  if (renderMode === "list") {
    // Generic list rendering (for future app types)
    return (
      <div className="bg-neutral-800 rounded-lg p-4">
        <pre className="text-neutral-300 whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return null;
}
