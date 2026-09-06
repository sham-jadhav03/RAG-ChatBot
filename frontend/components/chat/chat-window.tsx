"use client";

import { Loader2, LogOut, MessageSquare, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatHistory } from "@/components/chat/chat-history";
import { ConversationList } from "@/components/chat/conversation-list";
import { DocumentPicker } from "@/components/chat/document-picker";
import { ErrorBanner } from "@/components/shared/error-banner";
import { useAuth } from "@/components/hooks/useAuth";
import { useChat } from "@/components/hooks/useChat";
import { useChatHistory } from "@/components/hooks/useChatHistory";
import { useConversations } from "@/components/hooks/useConversations";
import { getOrCreateSession, resetSession } from "@/lib/session";
import type { Document } from "@/lib/types";

export function ChatWindow() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [showConversations, setShowConversations] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleLogout() {
    logout();
    router.replace("/auth/login");
  }

  const {
    data: history,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useChatHistory(sessionId);

  const {
    data: conversationsData,
    isLoading: isConversationsLoading,
    refetch: refetchConversations,
  } = useConversations(1, 20);

  const {
    messages,
    isLoading: isChatLoading,
    pendingQuestion,
    pendingQuestionStartTime,
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
    setShowConversations(false);
  }

  function handleNewConversation() {
    if (!document) return;
    resetSession(document._id);
    const nextSessionId = getOrCreateSession(document._id);
    setSessionId(nextSessionId);
    setQuestion("");
    resetMessages();
    refetchConversations();
    setShowConversations(false);
  }

  function handleConversationSelect(nextSessionId: string, documentId: string) {
    const doc = document?._id === documentId ? document : null;
    if (doc) {
      setSessionId(nextSessionId);
      setQuestion("");
      resetMessages();
      setShowConversations(false);
    }
  }

  function handleConversationDelete() {
    // Could implement delete API call here
    refetchConversations();
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
  const conversations = conversationsData?.conversations ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">RAG Chatbot</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ask questions about your documents using AI-powered retrieval.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Shield className="size-3.5" />
                <span>Admin</span>
              </Link>
            )}

            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{user.username}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">

          {/* Document picker & conversation controls */}
          <div className="border-b py-3 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DocumentPicker value={document} onChange={handleDocumentChange} />
            </div>

            {document && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowConversations((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <MessageSquare className="size-3.5" />
                  <span className="hidden sm:inline">History</span>
                </button>
                <button
                  type="button"
                  onClick={handleNewConversation}
                  disabled={isChatLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* Conversation area with sidebar */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Conversation list sidebar (mobile drawer) */}
            {showConversations && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowConversations(false)} />
                <div className="absolute right-0 top-0 h-full w-96 bg-popover border-l shadow-xl flex flex-col">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="font-medium">Conversations</h3>
                    <button onClick={() => setShowConversations(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <ConversationList
                      conversations={conversations}
                      currentSessionId={sessionId}
                      onSelect={handleConversationSelect}
                      onDelete={handleConversationDelete}
                      isLoading={isConversationsLoading}
                      emptyMessage="No conversations yet. Start a new one!"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
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
                    pendingQuestionStartTime={pendingQuestionStartTime}
                    isLoading={isChatLoading}
                    onSelectQuestion={(q) => void handleSendQuestion(q)}
                  />
                  {/* Bottom sentinel for auto-scroll */}
                  <div ref={messagesEndRef} />
                </>
              )}

              {/* Error banner for chat send failures */}
              {chatError && (
                <div className="pb-2 px-4">
                  <ErrorBanner error={chatError} onDismiss={dismissError} />
                </div>
              )}

              {/* Composer */}
              <div className="border-t py-3 px-4">
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
          </div>
        </div>
      </main>
    </div>
  );
}