import { v4 as uuidv4 } from "uuid";
import documentModel from "../../models/document.models.js";
import chatMessageModel, {
  IChatMessage,
  IChatSource,
} from "../../models/chat.model.js";
import pendingRequests from "../../redis/pendingRequests.js";
import { redisPublisher } from "../../redis/publisher.js";
import { REDIS_CHANNELS } from "../../redis/channels.js";

const CONVERSATION_HISTORY_LIMIT = 5;

const CHAT_REQUEST_TIMEOUT_MS = 3000;

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
   * Verify the document exists and has finished processing.
   * Throws a tagged error (statusCode attached) for the controller layer
   * to map directly to the correct HTTP response.
   */
  async verifyDocumentReady(documentId: string): Promise<void> {
    const document = await documentModel.findById(documentId);

    if (!document) {
      const err = new Error("Document not found.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (document.processingStatus !== "COMPLETED") {
      const err = new Error(
        `Document is not ready for chat yet (status: ${document.processingStatus})`,
      );
      (err as any).statusCode = 409;
      throw err;
    }
  }

  /**
   * Build the AI conversation history server-side from MongoDB.
   * conversationHistory is NEVER accepted from the client (see
   * chat.validator.ts) — this is the single source of truth for it.
   *
   * Pulls the last `limit` Q&A pairs for this session, oldest first,
   * and expands each pair into two {role, content} entries matching
   * the format Python's ChatState expects.
   */
  async getConversationHistory(
    sessionId: string,
    limit: number,
  ): Promise<{ role: string; content: string }[]> {
    const recent = await chatMessageModel
      .find({ sessionId })
      .sort({ createAt: -1 })
      .limit(limit)
      .select("question answer")
      .lean();

    const chronological = recent.reverse();

    const history: { role: string; content: string }[] = [];

    for (const msg of chronological) {
      history.push({ role: "user", content: msg.question });
      history.push({ role: "assistant", content: msg.answer });
    }

    return history;
  }

  /**
   * Map Python's raw source payload (which may carry either the fully
   * formed {documentName, pageNumber, excerpt, similarity} shape, or the
   * looser {text, metadata} chunk shape) into chat.model.ts's stricter,
   * required sub-schema. Missing fields fall back to safe defaults so a
   * malformed/partial source never blocks persisting an otherwise
   * successful answer.
   */
  private normalizeSources(sources: SourceDocument[] = []): IChatSource[] {
    return sources.map((source) => {
      const documentName =
        source.documentName ??
        source.metadata?.source_filename ??
        "Unknown Source";

      const pageNumber =
        typeof source.pageNumber === "number"
          ? sources.pageNumber
          : typeof source.metadata?.page === "number"
            ? source.metadata.page
            : null;

      const excerpt =
        source.excerpt && source.excerpt.length > 0
          ? source.excerpt
          : source.text
            ? source.text.slice(0, 200)
            : "";

      const similarity =
        typeof source.similarity === "number" ? source.similarity : 0;

      return { documentName, pageNumber, excerpt, similarity };
    });
  }

  /**
   * Main orchestration: validate document readiness, build history,
   * correlate a Redis round-trip to Python via requestId, and persist
   * only successful exchanges.
   *
   * Node.js NEVER calls Python directly — communication happens only
   * through Redis Pub/Sub (pdf_chat_requests / pdf_chat_responses).
   */
  async askQuestion(input: AskQuestionInput): Promise<IChatMessage> {
    const { sessionId, documentId, question } = input;

    // 1. Verify document exists and finished processing
    await this.verifyDocumentReady(documentId);

    // 2. Build conversion history  server-side (never client-suplied)
    const conversationHistory = await this.getConversationHistory(
      sessionId,
      CONVERSATION_HISTORY_LIMIT,
    );

    // 3. Generate correlation ID for this round-trip
    const requestId = uuidv4();

    // 4. Register BEFORE publishing — guarantees the pending entry exists
    //    before Python could possibly respond, avoiding a race condition.
    const responsePromise = pendingRequests.register(
      requestId,
      CHAT_REQUEST_TIMEOUT_MS,
    );

    // 5. Publish to Redis
    const requestPayload = {
      type: "ask_question",
      requestId,
      sessionId,
      documentId,
      question,
      conversationHistory,
    };
    try {
      await redisPublisher.publish(
        REDIS_CHANNELS.PDF_CHAT_REQUESTS,
        JSON.stringify(requestPayload),
      );
    } catch (publishErr: any) {
      pendingRequests.reject(requestId, publishErr);
      const err = new Error("AI service is temporarily unavailable.");
      (err as any).statusCode = 503;
      throw err;
    }

    // 6. Wait for the correlated response (resolved/rejected by
    //    subscriber.ts when the matching requestId arrives on
    //    pdf_chat_responses, or rejected internally on timeout).
    let response;
    try {
      response = await responsePromise;
    } catch (err: any) {
      if (!err.statusCode) {
        err.statusCode = 502;
      }
      throw err;
    }

    // 7. Normalize sources into the shape chat.model.ts requires

    const normalizeSources = this.normalizeSources(response.sources);

    // 8. Persist ONLY successful exchanges. Failures (timeout, AI error,
    //    publish failure) already threw above and never reach this line.
    const saved = await chatMessageModel.create({
      sessionId,
      documentId,
      question,
      answer: response.answer,
      sources: normalizeSources,
      suggestedQuestions: response.suggestedQuestions || [],
      requestId,
    });

    return saved;
  }

  /**
   * Retrieve paginated chat history for a session, oldest first.
   */
  async getHistory(input: GetHistoryInput) {
    const page = input.page || 1;
    const limit = input.limit || 10;
    const skip = (page - 1) * limit;

    const [message, total] = await Promise.all([
      chatMessageModel
        .find({ sessionId: input.sessionId })
        .sort({ createAt: 1 })
        .skip(skip)
        .limit(limit),
      chatMessageModel.countDocuments({ sessionId: input.sessionId }),
    ]);

    return {
      message,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new chatService()
