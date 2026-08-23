"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatHistory } from "@/components/chat/chat-history";
import { DocumentPicker } from "@/components/chat/document-picker";
import { ErrorBanner } from "@/components/shared/error-banner";
import { useChat } from "@/components/hooks/useChat";
import { useChatHistory } from "@/components/hooks/useChatHistory";
import { getOrCreateSession } from "@/lib/session";
import type { Document } from "@/lib/types";

export function ChatWindow() {
  const [document, setDocument] = useState<Document | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: history,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useChatHistory(sessionId);

  const {
    messages,
    isLoading: isChatLoading,
    pendingQuestion,
    error: chatError,
    sendMessage,
    resetMessages,
    dismissError,
  } = useChat({
    sessionId,
    documentId: document?._id ?? null,
  });

  // Sync initial/updated history from server
  useEffect(() => {
    if (history?.messages) {
      resetMessages(history.messages);
    }
  }, [history?.messages, resetMessages]);

  // Auto-scroll to bottom sentinel on any content change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingQuestion, isChatLoading]);

  function handleDocumentChange(nextDocument: Document) {
    const nextSessionId = getOrCreateSession(nextDocument._id);
    setDocument(nextDocument);
    setSessionId(nextSessionId);
    setQuestion("");
    resetMessages();
  }

  const handleSendQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !document || !sessionId || isChatLoading) return;

      setQuestion("");

      try {
        await sendMessage(trimmed);
      } catch {
        // Error surfaced via chatError; restore input for retry
        setQuestion(trimmed);
      }
    },
    [document, sessionId, isChatLoading, sendMessage],
  );

  async function handleFormSend() {
    await handleSendQuestion(question);
  }

  const isHistoryActive = Boolean(document) && Boolean(sessionId);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">RAG Chatbot</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ask questions about your documents using AI-powered retrieval.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">

          {/* Document picker */}
          <div className="border-b py-3">
            <DocumentPicker value={document} onChange={handleDocumentChange} />
          </div>

          {/* Conversation area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {!isHistoryActive ? (
              /* Empty state — no document selected */
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="max-w-sm text-center">
                  <h2 className="text-base font-semibold">Select a document to start</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Choose a completed document from the list above to begin a conversation.
                  </p>
                </div>
              </div>
            ) : isHistoryLoading ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Loading conversation...
                </div>
              </div>
            ) : isHistoryError ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="w-full max-w-sm">
                  <ErrorBanner
                    error={new Error("Unable to load conversation history.")}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Try selecting the document again.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ChatHistory
                  messages={messages}
                  pendingQuestion={pendingQuestion}
                  isLoading={isChatLoading}
                  onSelectQuestion={(q) => void handleSendQuestion(q)}
                />
                {/* Bottom sentinel for auto-scroll */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error banner for chat send failures */}
          {chatError && (
            <div className="pb-2">
              <ErrorBanner error={chatError} onDismiss={dismissError} />
            </div>
          )}

          {/* Composer */}
          <div className="border-t py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleFormSend();
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleFormSend();
                  }
                }}
                disabled={!document || !sessionId || isHistoryLoading || isChatLoading}
                placeholder={
                  !document
                    ? "Select a document first..."
                    : isChatLoading
                      ? "Waiting for AI response..."
                      : "Ask a question about this document..."
                }
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3.5 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:bg-muted/30 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={
                  !document ||
                  !sessionId ||
                  !question.trim() ||
                  isHistoryLoading ||
                  isChatLoading
                }
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isChatLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Thinking…</span>
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}