"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatapi } from "@/lib/api-client";
import type {
  AskQuestionRequest,
  ChatHistoryEntry,
} from "@/lib/types";

interface UseChatOptions {
  sessionId: string | null;
  documentId: string | null;
}

export function useChat({
  sessionId,
  documentId,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [pendingQuestionStartTime, setPendingQuestionStartTime] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmedQuestion = question.trim();

      if (
        !trimmedQuestion ||
        !sessionId ||
        !documentId ||
        isLoading
      ) {
        return;
      }

      const payload: AskQuestionRequest = {
        sessionId,
        documentId,
        question: trimmedQuestion,
      };

      const startTime = Date.now();

      setIsLoading(true);
      setPendingQuestion(trimmedQuestion);
      setPendingQuestionStartTime(startTime);
      setError(null);

      try {
        const response = await chatapi.ask(payload);

        const newMessage: ChatHistoryEntry = {
          question: response.question,
          answer: response.answer,
          sources: response.sources || [],
          suggestedQuestions: response.suggestedQuestions || [],
          requestId: response.requestId,
          createdAt: response.createdAt,
        };

        setMessages((current) => [...current, newMessage]);

        // Keep React Query cache fresh
        queryClient.invalidateQueries({
          queryKey: ["chat-history", sessionId],
        });

        return newMessage;
      } catch (requestError) {
        const normalizedError =
          requestError instanceof Error
            ? requestError
            : new Error("Unable to send message.");

        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsLoading(false);
        setPendingQuestion(null);
        setPendingQuestionStartTime(null);
      }
    },
    [sessionId, documentId, isLoading, queryClient],
  );

  const resetMessages = useCallback((initialMessages: ChatHistoryEntry[] = []) => {
    setMessages(initialMessages);
    setError(null);
    setPendingQuestion(null);
    setPendingQuestionStartTime(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    pendingQuestion,
    pendingQuestionStartTime,
    error,
    sendMessage,
    resetMessages,
    dismissError,
  };
}
