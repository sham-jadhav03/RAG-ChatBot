import { Bot, User } from "lucide-react";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { SourceCard } from "@/components/chat/source-card";
import { SuggestedQuestions } from "@/components/chat/suggested-questions";
import type { ChatSource } from "@/lib/types";

interface UserBubbleProps {
  role: "user";
  content: string;
}

interface AssistantBubbleProps {
  role: "assistant";
  content: string;
  sources?: ChatSource[];
  suggestedQuestions?: string[];
  isLoading?: boolean;
  onSelectQuestion?: (question: string) => void;
}

type MessageBubbleProps = UserBubbleProps | AssistantBubbleProps;

export function MessageBubble(props: MessageBubbleProps) {
  if (props.role === "user") {
    return (
      <div className="flex items-start justify-end gap-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm sm:max-w-[70%] whitespace-pre-wrap break-words">
          {props.content}
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="size-4" />
        </div>
      </div>
    );
  }

  const { content, sources = [], suggestedQuestions = [], isLoading = false, onSelectQuestion } = props;
  const hasSources = sources.length > 0;
  const hasSuggestions = suggestedQuestions.length > 0;

  return (
    <div className="flex items-start justify-start gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Bot className="size-4" />
      </div>

      <div className="flex min-w-0 max-w-[85%] flex-col gap-2 sm:max-w-[70%]">
        {/* Answer */}
        <div className="min-w-0 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          <MarkdownRenderer content={content} />
        </div>

        {/* Sources */}
        {hasSources && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground px-0.5">Sources</p>
            <div className="space-y-1.5">
              {sources.map((source, i) => (
                <SourceCard key={i} source={source} />
              ))}
            </div>
          </div>
        )}

        {/* Suggested questions */}
        {hasSuggestions && onSelectQuestion && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            disabled={isLoading}
            onSelect={onSelectQuestion}
          />
        )}
      </div>
    </div>
  );
}
