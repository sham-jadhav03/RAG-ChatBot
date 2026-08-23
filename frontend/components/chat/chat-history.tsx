"use client";

import { FileText } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
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
  const hasNoMessages = messages.length === 0 && !pendingQuestion;

  if (hasNoMessages) {
    return (
      <div className="flex min-h-[300px] flex-1 items-center justify-center py-12">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Start a conversation</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask a question about the selected document to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {messages.map((message, index) => (
        <div
          key={message.requestId || `${message.createdAt}-${index}`}
          className="space-y-3"
        >
          <MessageBubble role="user" content={message.question} />
          <MessageBubble
            role="assistant"
            content={message.answer}
            sources={message.sources}
            suggestedQuestions={message.suggestedQuestions}
            isLoading={isLoading}
            onSelectQuestion={onSelectQuestion}
          />
        </div>
      ))}

      {/* Optimistic pending question + typing indicator */}
      {pendingQuestion && (
        <div className="space-y-3">
          <MessageBubble role="user" content={pendingQuestion} />
          {isLoading && <TypingIndicator />}
        </div>
      )}
    </div>
  );
}