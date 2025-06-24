"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface Question {
  id: string;
  type: "multiple-choice" | "short-answer" | "essay";
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  onSubmit,
  disabled,
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [textAnswer, setTextAnswer] = useState("");

  const handleSubmit = () => {
    const answer =
      question.type === "multiple-choice" ? selectedAnswer : textAnswer;
    onSubmit(answer);
    setSelectedAnswer("");
    setTextAnswer("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>문제 {questionNumber}</span>
          <Badge>{question.points}점</Badge>
        </CardTitle>
        <CardDescription>
          유형:{" "}
          {question.type === "multiple-choice"
            ? "객관식"
            : question.type === "short-answer"
            ? "단답식"
            : "주관식"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-lg font-medium">{question.question}</div>

        {question.type === "multiple-choice" && question.options && (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedAnswer === option
                    ? "bg-blue-100 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => !disabled && setSelectedAnswer(option)}
              >
                <span className="font-medium mr-2">
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
              </div>
            ))}
          </div>
        )}

        {question.type === "short-answer" && (
          <Input
            placeholder="답을 입력하세요"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={disabled}
          />
        )}

        {question.type === "essay" && (
          <Textarea
            placeholder="답을 작성하세요"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            rows={6}
            disabled={disabled}
          />
        )}

        <Button
          onClick={handleSubmit}
          className="w-full"
          variant="green"
          disabled={
            disabled ||
            (question.type === "multiple-choice" && !selectedAnswer) ||
            (question.type !== "multiple-choice" && !textAnswer.trim())
          }
        >
          답안 제출
        </Button>
      </CardContent>
    </Card>
  );
}
