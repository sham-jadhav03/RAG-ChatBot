"use client";

import { FileText, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { ConversationEntry } from "@/lib/types";

interface ConversationListProps {
  conversations: ConversationEntry[];
  currentSessionId: string | null;
  onSelect: (sessionId: string, documentId: string) => void;
  onDelete?: (sessionId: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function ConversationList({
  conversations,
  currentSessionId,
  onSelect,
  onDelete,
  isLoading = false,
  emptyMessage = "No conversations yet. Start a new one!",
}: ConversationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm("Delete this conversation?")) {
      setDeletingId(sessionId);
      onDelete(sessionId);
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2">
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/4 bg-muted rounded ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MessageSquare className="mx-auto size-10 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {conversations.map((conversation) => {
        const isActive = currentSessionId === conversation.sessionId;

        return (
          <button
            key={conversation.sessionId}
            type="button"
            onClick={() => onSelect(conversation.sessionId, conversation.documentId)}
            className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              isActive
                ? "bg-primary/10 border-l-2 border-primary"
                : "hover:bg-muted/50"
            }`}
          >
            <FileText className="size-4.5 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {conversation.lastQuestion}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {conversation.lastAnswer}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}</span>
                <span>·</span>
                <span>{conversation.messageCount} msgs</span>
              </div>
            </div>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => handleDelete(conversation.sessionId, e)}
                disabled={deletingId === conversation.sessionId}
                className="flex shrink-0 items-center justify-center size-7 rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                aria-label="Delete conversation"
              >
                {deletingId === conversation.sessionId ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}