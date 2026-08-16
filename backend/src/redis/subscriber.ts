import { Redis } from "ioredis";
import { REDIS_CHANNELS } from "./channels.js";
import { config } from "../config/config.js";
import documentModel from "../models/document.models.js";
import { pendingRequests } from "./pendingRequests.js";

const REDIS_URL = config.REDIS_URL;

export const redisSubscriber = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * Listen to channels
 */
redisSubscriber.on("connect", () => {
  console.log("Redis Subscriber Connected.");

  redisSubscriber.subscribe(
    REDIS_CHANNELS.PDF_PROCESS_RESPONSES,
    REDIS_CHANNELS.PDF_CHAT_RESPONSES,
    (err, count) => {
      if (err) console.error("Failed to subscribe:", err.message);
      else console.log(`Subscribed successfully to ${count} Redis channels.`);
    },
  );
});

/**
 * Message listener for background tasks
 *
 */

redisSubscriber.on("message", async (channel, message) => {
  try {
    const payload = JSON.parse(message);

    // 1. Python PDF processing completed Response Listener
    if (channel === REDIS_CHANNELS.PDF_PROCESS_RESPONSES) {
      const { documentId, status, errorMessage } = payload;

      if (documentId) {
        await documentModel.findByIdAndUpdate(documentId, {
          processingStatus: status, // "COMPLETED" or "FAILED"
          errorMessage: errorMessage || null,
        });
        console.log(`Document ${documentId} status updated to: ${status}`);
      }
    }

    // 2. Python Chat RAG response Listener
    if (channel === REDIS_CHANNELS.PDF_CHAT_RESPONSES) {
      const { requestId } = payload;
      if (requestId) {
        const matched = pendingRequests.resolve(requestId, payload);
        if (matched) {
          console.log(`Correlated chat response for requestId: ${requestId}`);
        } else {
          console.warn(
            `No pending request found for requestId: ${requestId} (may have timed out)`,
          );
        }
      }
    }
  } catch (error: any) {
    console.error("Error handling Redis message:", error.message);
  }
});

