interface SuggestedQuestionsProps {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({
  questions,
  disabled = false,
  onSelect,
}: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Suggested questions</p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="rounded-full border border-border bg-background px-3 py-1 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
