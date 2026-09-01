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
