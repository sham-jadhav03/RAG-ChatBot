import { Redis } from "ioredis";
import { config } from "../config/config.js";

const REDIS_URL = config.REDIS_URL;

export const redisPublisher = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
});

redisPublisher.on("connect", () => {
  console.log("Redis Publisher Connected.");
});

redisPublisher.on("error", (err) => {
  console.error("Redis Publisher Error:", err.message);
});

/**
 * Add a message to a Redis Stream.
 * Returns the stream message ID on success.
 * Throws on Redis connection error.
 */
export async function xadd(
  stream: string,
  payload: Record<string, string>,
): Promise<string> {
  const args: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    args.push(key, value);
  }
  const messageId = await redisPublisher.xadd(stream, "*", ...args);
  console.log(`XADD to ${stream}: ${messageId}`);
  return messageId!;
}
