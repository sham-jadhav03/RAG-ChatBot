import { v4 as uuidv4 } from "uuid";

import documentModel from "../../models/document.models.js";
import chatMessageModel, {
  IChatMessage,
  IChatSource,
} from "../../models/chat.model.js";
import { redisPublisher } from "../../redis/publisher.js";
import { REDIS_CHANNELS } from "../../redis/channels.js";
import {
  pendingRequests,
  SourceDocument,
} from "../../redis/pendingRequests.js";

const CONVERSATION_HISTORY_LIMIT = 5;
const CHAT_REQUEST_TIMEOUT_MS = 30000;

export interface AskQuestionInput {
  sessionId: string;
  documentId: string;
  question: string;
}

export interface GetHistoryInput {
  sessionId: string;
  page?: number;
  limit?: number;
}

class chatService {
  /**
   * Verify that the document exists and has completed processing.
   */
  private async verifyDocumentReady(documentId: string) {
    const document = await documentModel.findById(documentId);

    if (!document) {
      const error = new Error("Document not found.");
      (error as any).statusCode = 404;
      throw error;
    }

    if (document.processingStatus !== "COMPLETED") {
      const error = new Error(
        `Document is not ready for chat yet (status: ${document.processingStatus}).`,
      );
      (error as any).statusCode = 409;
      throw error;
    }

    return document;
  }

  /**
   * A session must remain associated with the same document.
   */
  private async enforceSessionDocumentBinding(
    sessionId: string,
    documentId: string,
  ): Promise<void> {
    const conflictingMessage = await chatMessageModel
      .findOne({
        sessionId,
        documentId: { $ne: documentId },
      })
      .select("_id")
      .lean();

    if (conflictingMessage) {
      const error = new Error(
        "This session is already associated with a different document. " +
          "Start a new session to chat with a different document.",
      );
      (error as any).statusCode = 409;
      throw error;
    }
  }

  /**
   * Build conversation history server-side from MongoDB.
   *
   * Only the latest N Q&A pairs are used.
   * MongoDB is the source of truth; client-supplied history is never used.
   */
  private async getConversationHistory(
    sessionId: string,
    documentId: string,
    limit: number,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const recentMessages = await chatMessageModel
      .find({
        sessionId,
        documentId,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("question answer")
      .lean();

    const chronologicalMessages = recentMessages.reverse();

    const history: {
      role: "user" | "assistant";
      content: string;
    }[] = [];

    for (const message of chronologicalMessages) {
      history.push({
        role: "user",
        content: message.question,
      });

      history.push({
        role: "assistant",
        content: message.answer,
      });
    }

    return history;
  }

  /**
   * Normalize Python source payload into the MongoDB ChatSource schema.
   *
   * Python's current contract provides:
   * documentName
   * pageNumber
   * excerpt
   * similarity
   *
   * Node uses the actual document filename as the authoritative source name.
   */
  private normalizeSources(
    sources: SourceDocument[] = [],
    realDocumentName: string,
  ): IChatSource[] {
    return sources.map((source) => ({
      documentName: realDocumentName,
      pageNumber:
        typeof source.pageNumber === "number" ? source.pageNumber : null,
      excerpt: typeof source.excerpt === "string" ? source.excerpt : "",
      similarity: typeof source.similarity === "number" ? source.similarity : 0,
    }));
  }

  /**
   * Ask a question against a processed document.
   *
   * Node communicates with Python exclusively through Redis Pub/Sub.
   */
  public async askQuestion(input: AskQuestionInput): Promise<IChatMessage> {
    const { sessionId, documentId, question } = input;

    // 1. Verify document exists and is ready.
    const document = await this.verifyDocumentReady(documentId);

    // 2. Prevent one session from being reused across documents.
    await this.enforceSessionDocumentBinding(sessionId, documentId);

    // 3. Build conversation history from MongoDB.
    const conversationHistory = await this.getConversationHistory(
      sessionId,
      documentId,
      CONVERSATION_HISTORY_LIMIT,
    );

    // 4. Generate correlation ID.
    const requestId = uuidv4();

    // 5. Register the pending request BEFORE publishing to Redis.
    const responsePromise = pendingRequests.register(
      requestId,
      CHAT_REQUEST_TIMEOUT_MS,
    );

    const requestPayload = {
      type: "ask_question",
      requestId,
      sessionId,
      documentId,
      question,
      conversationHistory,
    };

    // 6. Publish request to Python through Redis.
    try {
      await redisPublisher.publish(
        REDIS_CHANNELS.PDF_CHAT_REQUESTS,
        JSON.stringify(requestPayload),
      );
    } catch (publishError) {
      pendingRequests.reject(requestId, publishError as Error);

      const error = new Error("AI service is temporarily unavailable.");
      (error as any).statusCode = 503;

      throw error;
    }

    // 7. Wait for the correlated Python response.
    let response;

    try {
      response = await responsePromise;
    } catch (error: any) {
      // Timeout from pendingRequests → 504.
      // Python returned an error → 502.
      if (!error.statusCode) {
        error.statusCode = 502;
      }

      throw error;
    }

    // 8. A successful response must contain an actual answer.
    if (
      typeof response.answer !== "string" ||
      response.answer.trim().length === 0
    ) {
      const error = new Error(
        "AI service returned an invalid or empty answer.",
      );
      (error as any).statusCode = 502;
      throw error;
    }

    // 9. Normalize sources into MongoDB's strict schema.
    const normalizedSources = this.normalizeSources(
      response.sources,
      document.fileName,
    );

    // 10. Re-verify document still exists (prevents REL-03 race: deleted during AI processing).
    const stillExists = await documentModel.findById(documentId).select("_id").lean();
    if (!stillExists) {
      const error = new Error("Document was deleted while processing your question.");
      (error as any).statusCode = 410;
      throw error;
    }

    // 11. Persist only successful Q&A exchanges.
    const savedMessage = await chatMessageModel.create({
      sessionId,
      documentId,
      question,
      answer: response.answer,
      sources: normalizedSources,
      suggestedQuestions: Array.isArray(response.suggestedQuestions)
        ? response.suggestedQuestions
        : [],
      requestId,
    });

    return savedMessage;
  }

  /**
   * Retrieve paginated chat history for a session.
   *
   * History is returned oldest → newest for natural conversation rendering.
   */
  public async getHistory(input: GetHistoryInput) {
    const page = input.page || 1;
    const limit = input.limit || 10;
    const skip = (page - 1) * limit;

    const filter = {
      sessionId: input.sessionId,
    };

    const [messages, total] = await Promise.all([
      chatMessageModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),

      chatMessageModel.countDocuments(filter),
    ]);

    return {
      messages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new chatService();
