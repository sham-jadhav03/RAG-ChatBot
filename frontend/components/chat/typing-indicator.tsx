"use client";

import { Bot, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface TypingIndicatorProps {
  label?: string;
  startTime?: number;
}

export function TypingIndicator({
  label = "AI is thinking...",
  startTime,
}: TypingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

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
        {startTime && (
          <span className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground/70">
            <Clock className="size-2.5" />
            <span className="font-mono">{formatTime(elapsed)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
