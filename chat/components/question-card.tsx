"use client";

import { memo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

interface QuestionCardProps {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string) => void;
  isLast: boolean;
}

export const QuestionCard = memo(function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  isLast,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onAnswer(answer);
      setAnswer("");
    }
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full border shadow-lg bg-neutral-800 border-neutral-700 transition-colors duration-200">
          <CardHeader className="border-b bg-neutral-800 border-neutral-700 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <HelpCircle className="h-6 w-6 text-purple-400" />
                <CardTitle className="text-xl font-bold text-neutral-100 transition-colors duration-200">
                  Question {questionNumber} of {totalQuestions}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <p className="text-lg text-neutral-200 mb-6">
                {question}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer..."
                className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-400"
                autoFocus
              />
              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!answer.trim()}
              >
                {isLast ? "Finish" : "Next Question →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
});
