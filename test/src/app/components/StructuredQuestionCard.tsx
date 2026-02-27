import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles, Send, Circle, CheckCircle } from 'lucide-react';
import { StructuredQuestion } from '../types';
import { clsx } from 'clsx';

interface StructuredQuestionCardProps {
  data: StructuredQuestion;
  onSelect: (optionId: string, text: string) => void;
  onRefine: (text: string) => Promise<string>;
}

type Answer = {
  optionId: string;
  text: string;
  isCustom: boolean;
};

export function StructuredQuestionCard({ data, onSelect, onRefine }: StructuredQuestionCardProps) {
  // Normalize data to support both legacy and new schema
  const questions = data.questions || (data.question ? [{
    id: 'root',
    text: data.question,
    options: data.options || [],
    allowCustomInput: data.allowCustomInput
  }] : []);

  const title = data.title || "Requirements";

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [refiningId, setRefiningId] = useState<string | null>(null);

  const handleSelectOption = (questionId: string, optionId: string, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { optionId, text, isCustom: false }
    }));
  };

  const handleCustomInputChange = (questionId: string, text: string) => {
     setAnswers(prev => ({
       ...prev,
       [questionId]: { optionId: 'custom', text, isCustom: true }
     }));
  };

  const handleRefine = async (questionId: string) => {
    const currentAnswer = answers[questionId];
    if (!currentAnswer || !currentAnswer.text.trim()) return;
    
    setRefiningId(questionId);
    try {
        const refined = await onRefine(currentAnswer.text);
        setAnswers(prev => ({
            ...prev,
            [questionId]: { ...currentAnswer, text: refined }
        }));
    } catch (e) {
        console.error("Failed to refine", e);
    } finally {
        setRefiningId(null);
    }
  };

  const handleSubmit = () => {
     // Format the output
     if (questions.length === 1) {
         // Simple format for single question
         const q = questions[0];
         const ans = answers[q.id];
         onSelect(ans.optionId, ans.text);
     } else {
         // Multi-line format for multiple questions
         const formattedResponse = questions.map(q => {
             const ans = answers[q.id];
             return `**${q.text}**\n${ans?.text || '(Skipped)'}`;
         }).join('\n\n');
         
         onSelect('multi_response', formattedResponse);
     }
  };

  const isComplete = questions.every(q => !!answers[q.id]?.text.trim());

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 font-sans my-2">
       {/* Header */}
       <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{questions.length > 1 ? 'Structured Interview' : 'Decision Point'}</span>
        </div>
        {title && questions.length > 1 && (
            <span className="text-sm font-medium text-slate-700">{title}</span>
        )}
      </div>

      <div className="p-4 md:p-6 space-y-8">
        {questions.map((q, qIndex) => {
            const currentAnswer = answers[q.id];
            
            return (
                <div key={q.id || qIndex} className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-800 leading-snug">
                        {questions.length > 1 && <span className="text-slate-400 mr-2">{qIndex + 1}.</span>}
                        {q.text}
                    </h3>

                    <div className="space-y-2">
                        {q.options?.map((option, index) => {
                            const isSelected = currentAnswer?.optionId === option.id;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelectOption(q.id, option.id, option.label)}
                                    className={clsx(
                                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all border group",
                                        isSelected 
                                            ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200" 
                                            : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                                    )}
                                >
                                    <div className={clsx("mt-0.5 shrink-0", isSelected ? "text-indigo-600" : "text-slate-300")}>
                                        {isSelected ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <div className={clsx("font-medium text-sm", isSelected ? "text-indigo-900" : "text-slate-700")}>
                                            {option.label}
                                        </div>
                                        {option.description && (
                                            <div className="text-slate-500 text-xs mt-0.5">
                                                {option.description}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {(q.allowCustomInput !== false) && (
                        <div className="mt-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block ml-1">
                                Or custom response
                            </label>
                            <div className="relative">
                                <textarea
                                    value={currentAnswer?.isCustom ? currentAnswer.text : ''}
                                    onChange={(e) => handleCustomInputChange(q.id, e.target.value)}
                                    placeholder="Type your specific requirement..."
                                    className={clsx(
                                        "w-full rounded-lg p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-y border",
                                        currentAnswer?.isCustom ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-200"
                                    )}
                                />
                                {currentAnswer?.isCustom && currentAnswer.text.trim() && (
                                     <button
                                        onClick={() => handleRefine(q.id)}
                                        disabled={refiningId === q.id}
                                        className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-indigo-100 text-indigo-600 text-[10px] font-medium rounded shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50"
                                    >
                                        {refiningId === q.id ? (
                                            <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3 h-3" />
                                        )}
                                        Refine
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        })}

        {/* Global Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
                onClick={handleSubmit}
                disabled={!isComplete}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:transform active:scale-95"
            >
                <Send className="w-4 h-4" />
                {questions.length > 1 ? 'Submit All Answers' : 'Submit Answer'}
            </button>
        </div>
      </div>
    </div>
  );
}