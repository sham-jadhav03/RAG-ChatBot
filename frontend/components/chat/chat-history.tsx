"use client";

import { useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";
import type { ChatHistoryEntry } from "@/lib/types";

interface ChatHistoryProps {
  messages: ChatHistoryEntry[];
  pendingQuestion?: string | null;
  isLoading?: boolean;
  onSelectQuestion?: (question: string) => void;
}

export function ChatHistory({
  messages,
  pendingQuestion,
  isLoading,
  onSelectQuestion,
}: ChatHistoryProps) {
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});

  const toggleSources = (index: number) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const hasNoMessages = messages.length === 0 && !pendingQuestion;

  if (hasNoMessages) {
    return (
      <div className="flex min-h-[340px] flex-1 items-center justify-center py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>

          <h2 className="mt-4 text-lg font-semibold">Start a conversation</h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask any question about the selected document. The AI will retrieve relevant passages and cite its sources.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {messages.map((message, index) => {
        const isSourcesOpen = Boolean(expandedSources[index]);
        const hasSources = message.sources && message.sources.length > 0;
        const hasSuggestions =
          message.suggestedQuestions && message.suggestedQuestions.length > 0;

        return (
          <div
            key={message.requestId || `${message.createdAt}-${index}`}
            className="space-y-4"
          >
            {/* User Message */}
            <div className="flex items-start justify-end gap-2.5">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm sm:max-w-[75%]">
                {message.question}
              </div>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
            </div>

            {/* Assistant Message */}
            <div className="flex items-start justify-start gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Bot className="size-4" />
              </div>

              <div className="max-w-[90%] space-y-3 sm:max-w-[80%]">
                <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground shadow-sm">
                  <div className="whitespace-pre-wrap">{message.answer}</div>

                  {/* Sources Accordion */}
                  {hasSources && (
                    <div className="mt-3 border-t pt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSources(index)}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <BookOpen className="size-3.5" />
                        <span>
                          {message.sources.length}{" "}
                          {message.sources.length === 1 ? "source cited" : "sources cited"}
                        </span>
                        {isSourcesOpen ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>

                      {isSourcesOpen && (
                        <div className="mt-2 space-y-2">
                          {message.sources.map((source, sIndex) => (
                            <div
                              key={sIndex}
                              className="rounded-md border bg-muted/40 p-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 font-medium text-foreground">
                                <span className="truncate">{source.documentName}</span>
                                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                                  {source.pageNumber !== null && source.pageNumber !== undefined && (
                                    <span>Page {source.pageNumber}</span>
                                  )}
                                  {source.similarity > 0 && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                                      {Math.round(source.similarity * 100)}% match
                                    </span>
                                  )}
                                </div>
                              </div>
                              {source.excerpt && (
                                <p className="mt-1.5 text-muted-foreground leading-relaxed italic">
                                  &ldquo;{source.excerpt}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Suggested Questions */}
                {hasSuggestions && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>Suggested follow-ups:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {message.suggestedQuestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          disabled={isLoading}
                          onClick={() => onSelectQuestion?.(suggestion)}
                          className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-foreground transition-colors hover:bg-primary/10 hover:border-primary/40 text-left disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Pending Question & Typing Indicator */}
      {pendingQuestion && (
        <div className="space-y-4">
          <div className="flex items-start justify-end gap-2.5">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm sm:max-w-[75%]">
              {pendingQuestion}
            </div>
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-4" />
            </div>
          </div>

          <div className="flex items-start justify-start gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <Bot className="size-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Analyzing document and generating answer...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}