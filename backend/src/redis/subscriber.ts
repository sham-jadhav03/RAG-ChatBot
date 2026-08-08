import { Redis } from "ioredis";
import { REDIS_CHANNELS } from "./channels.js";
import { config } from "../config/config.js";
import documentModel from "../models/document.models.js";

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

    // 1. python PDF processing completed Response Listener
    if (channel === REDIS_CHANNELS.PDF_PROCESS_RESPONSES) {
      const { documentId, status, errorMessage } = payload;

      if (documentId) {
        await documentModel.findByIdAndUpdate(documentId, {
          processingStatus: status, // "completed" or "failed"
          errorMessage: errorMessage || null,
        });
        console.log(`Document ${documentId} status updated to: ${status}`);
      }
    }
  } catch (error: any) {
    console.error("Error handling Redis message:", error.message);
  }
});
