import { Request, Response, NextFunction } from "express";
import { redisPublisher } from "../redis/publisher.js";

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export interface RateLimiterOptions {
  prefix: string;
  maxRequests: number;
  windowSeconds: number;
  message?: string;
}

/**
 * Creates a Redis-backed atomic fixed-window rate limiter middleware.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    prefix,
    maxRequests,
    windowSeconds,
    message = "Too many requests. Please try again later.",
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const key = `${prefix}:${clientIp}`;

      const result = (await redisPublisher.eval(
        RATE_LIMIT_LUA,
        1,
        key,
        windowSeconds,
      )) as [number, number];

      const [currentRequests, ttlSeconds] = result;

      if (currentRequests > maxRequests) {
        const retryAfter = ttlSeconds > 0 ? ttlSeconds : windowSeconds;
        res.setHeader("Retry-After", retryAfter.toString());
        res.status(429).json({
          success: false,
          message,
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error("Rate limiter error:", error.message);
      // Fail closed: reject request safely if rate-limit evaluation fails
      res.status(503).json({
        success: false,
        message: "Service is temporarily unavailable. Please try again later.",
      });
    }
  };
}

export const chatRateLimiter = createRateLimiter({
  prefix: "rate_limit:chat",
  maxRequests: 10,
  windowSeconds: 60, // 1 minute
});

export const loginRateLimiter = createRateLimiter({
  prefix: "rate_limit:login",
  maxRequests: 5,
  windowSeconds: 15 * 60, // 15 minutes
});

export const registerRateLimiter = createRateLimiter({
  prefix: "rate_limit:register",
  maxRequests: 5,
  windowSeconds: 15 * 60, // 15 minutes
});
