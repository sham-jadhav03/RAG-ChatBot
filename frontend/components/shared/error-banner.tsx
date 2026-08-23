import { AlertCircle, X } from "lucide-react";
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  AiServiceError,
  ServiceUnavailableError,
  TimeoutError,
} from "@/lib/api-client";

function getUserMessage(error: Error): string {
  if (error instanceof BadRequestError) {
    return "Please check your question and try again.";
  }
  if (error instanceof UnauthorizedError) {
    return "Your session has expired. Please sign in again.";
  }
  if (error instanceof NotFoundError) {
    return "The selected document is no longer available.";
  }
  if (error instanceof ConflictError) {
    return "The document or conversation is no longer valid. Please select the document again.";
  }
  if (error instanceof AiServiceError) {
    return "The AI service couldn\u2019t generate an answer right now. Please try again.";
  }
  if (error instanceof ServiceUnavailableError) {
    return "The service is temporarily unavailable. Please try again shortly.";
  }
  if (error instanceof TimeoutError) {
    return "The AI response took too long. Please try again.";
  }
  if (error instanceof ApiError) {
    return "Something went wrong. Please check your connection and try again.";
  }
  // Generic / network error
  return "Something went wrong. Please check your connection and try again.";
}

interface ErrorBannerProps {
  error: Error;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const message = getUserMessage(error);

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 text-destructive/70 transition hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
