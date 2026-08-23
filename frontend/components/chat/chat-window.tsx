"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ChatHistory } from "@/components/chat/chat-history";
import { DocumentPicker } from "@/components/chat/document-picker";
import { useChat } from "@/components/hooks/useChat";
import { useChatHistory } from "@/components/hooks/useChatHistory";
import { getOrCreateSession } from "@/lib/session";
import type { Document } from "@/lib/types";

export function ChatWindow() {
  const [document, setDocument] = useState<Document | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

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
  } = useChat({
    sessionId,
    documentId: document?._id ?? null,
  });

  useEffect(() => {
    if (history?.messages) {
      resetMessages(history.messages);
    }
  }, [history?.messages, resetMessages]);

  function handleDocumentChange(nextDocument: Document) {
    const nextSessionId = getOrCreateSession(nextDocument._id);

    setDocument(nextDocument);
    setSessionId(nextSessionId);
    setQuestion("");

    // Clear the previous document's messages immediately.
    // New history will be loaded by useChatHistory().
    resetMessages();
  }

  async function handleSend(customQuestion?: string) {
    const textToSend = (customQuestion ?? question).trim();

    if (
      !textToSend ||
      !document ||
      !sessionId ||
      isChatLoading
    ) {
      return;
    }

    try {
      if (!customQuestion) {
        setQuestion("");
      }
      await sendMessage(textToSend);
    } catch {
      // useChat exposes the error through chatError.
      // If manual input was used, restore it so user can retry.
      if (!customQuestion) {
        setQuestion(textToSend);
      }
    }
  }

  const isHistoryActive =
    Boolean(document) && Boolean(sessionId);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">
            RAG Chatbot
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions about your documents using AI-powered retrieval.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
          {/* Document picker */}
          <div className="py-4 border-b">
            <DocumentPicker
              value={document}
              onChange={handleDocumentChange}
            />
          </div>

          {/* Conversation */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {!isHistoryActive ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="max-w-md text-center">
                  <h2 className="text-lg font-semibold">
                    Select a document to begin
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Choose a completed document from the knowledge base before starting a conversation.
                  </p>
                </div>
              </div>
            ) : isHistoryLoading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Loading conversation...
                </div>
              </div>
            ) : isHistoryError ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="flex max-w-md items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                  <div>
                    <p className="text-sm font-medium">
                      Unable to load conversation
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Please try selecting the document again.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ChatHistory
                messages={messages}
                pendingQuestion={pendingQuestion}
                isLoading={isChatLoading}
                onSelectQuestion={(q) => void handleSend(q)}
              />
            )}
          </div>

          {/* Chat error */}
          {chatError && (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {chatError.message}
            </div>
          )}

          {/* Composer */}
          <div className="border-t py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
              className="flex gap-3"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={
                  !document ||
                  !sessionId ||
                  isHistoryLoading ||
                  isChatLoading
                }
                placeholder={
                  !document
                    ? "Select a document first..."
                    : isChatLoading
                      ? "Waiting for AI response..."
                      : "Ask a question about this document..."
                }
                className="h-11 min-w-0 flex-1 rounded-md border bg-background px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:bg-muted/30"
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isChatLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Thinking...</span>
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