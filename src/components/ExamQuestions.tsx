import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const SAMPLE_QUESTIONS = [
  {
    id: 1,
    question: "What is the time complexity of binary search?",
    options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
  },
  {
    id: 2,
    question: "Which data structure uses FIFO ordering?",
    options: ["Stack", "Queue", "Tree", "Graph"],
  },
  {
    id: 3,
    question: "What does HTML stand for?",
    options: [
      "Hyper Text Markup Language",
      "High Tech Modern Language",
      "Hyper Transfer Markup Language",
      "Home Tool Markup Language",
    ],
  },
  {
    id: 4,
    question: "Which sorting algorithm has the best average time complexity?",
    options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Insertion Sort"],
  },
  {
    id: 5,
    question: "What is the primary purpose of an operating system?",
    options: [
      "Run applications",
      "Manage hardware resources",
      "Connect to internet",
      "Store data",
    ],
  },
];

interface ExamQuestionsProps {
  onSubmit: () => void;
}

export function ExamQuestions({ onSubmit }: ExamQuestionsProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQ, setCurrentQ] = useState(0);

  const q = SAMPLE_QUESTIONS[currentQ];
  const answered = Object.keys(answers).length;

  return (
    <div className="gradient-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Question {currentQ + 1} of {SAMPLE_QUESTIONS.length}
        </span>
        <span className="text-xs text-muted-foreground">
          {answered}/{SAMPLE_QUESTIONS.length} answered
        </span>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{q.question}</h3>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                    : "border-border bg-muted/30 text-secondary-foreground hover:border-primary/40"
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground mr-3">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
                {selected && <CheckCircle className="inline-block w-4 h-4 text-primary ml-2" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
            disabled={currentQ === 0}
          >
            Previous
          </Button>
          <div className="flex gap-1">
            {SAMPLE_QUESTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentQ
                    ? "bg-primary"
                    : answers[SAMPLE_QUESTIONS[i].id] !== undefined
                    ? "bg-success"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          {currentQ < SAMPLE_QUESTIONS.length - 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentQ((p) => p + 1)}
            >
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={onSubmit} disabled={answered < SAMPLE_QUESTIONS.length} className="rounded-lg">
              Submit Exam
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
