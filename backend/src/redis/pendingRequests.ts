import { EventEmitter } from "events";

export interface SourceDocument {
  documentName?: string;
  pageNumber?: number | null;
  excerpt?: string;
  similarity?: number;
  text?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponsePayload {
  type: string;
  requestId: string;
  answer: string | null;
  sources: SourceDocument[];
  suggestedQuestions: string[];
  error: string | null;
  timestamp: string | null;
}

interface PendingRequestEntry {
  resolve: (value: ChatResponsePayload) => void;
  reject: (reason: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

export class PendingRequests {
  private pending = new Map<string, PendingRequestEntry>();

  /**
   * Register a new pending request by requestId.
   * Returns a promise that resolves when the response is received via Redis,
   * or rejects on timeout (default 30 seconds) / error.
   */
  public register(
    requestId: string,
    timeoutMs: number = 30000,
  ): Promise<ChatResponsePayload> {
    return new Promise<ChatResponsePayload>((resolve, reject) => {
      // If already registered for some reason, clean up previous
      if (this.pending.has(requestId)) {
        this.cleanup(requestId);
      }

      const timeoutId = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          const timeoutError = new Error(
            `Request timed out after ${timeoutMs}ms waiting for AI service response`,
          );
          (timeoutError as any).name = "TimeoutError";
          (timeoutError as any).statusCode = 504;
          reject(timeoutError);
        }
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
      });
    });
  }

  /**
   * Resolve a pending request with the response payload from Redis.
   */
  public resolve(requestId: string, payload: ChatResponsePayload): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeoutId);
    this.pending.delete(requestId);

    if (payload.error) {
      const err = new Error(payload.error);
      entry.reject(err);
    } else {
      entry.resolve(payload);
    }

    return true;
  }

  /**
   * Reject a pending request with an error.
   */
  public reject(requestId: string, error: Error): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeoutId);
    this.pending.delete(requestId);
    entry.reject(error);
    return true;
  }

  /**
   * Check if a request is currently pending.
   */
  public has(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Get the current count of pending requests.
   */
  public get size(): number {
    return this.pending.size;
  }

  /**
   * Clean up a pending request and clear its timer.
   */
  private cleanup(requestId: string): void {
    const entry = this.pending.get(requestId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.pending.delete(requestId);
    }
  }
}

// Export singleton instance
export const pendingRequests = new PendingRequests();
