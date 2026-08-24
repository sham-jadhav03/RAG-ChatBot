import { Bot } from "lucide-react";

interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({
  label = "AI is thinking...",
}: TypingIndicatorProps) {
  return (
    <div className="flex items-start justify-start gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Bot className="size-4" />
      </div>

      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
          <span className="size-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
          <span className="size-1.5 rounded-full bg-primary/70 animate-bounce" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
