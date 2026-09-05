import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { redisPublisher } from "../redis/publisher.js";

const REVOCATION_PREFIX = "token:revoked:";

// Extend Express Request interface to attach decoded user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const secret = config.JWT_SECRET;

    const decoded = jwt.verify(token, secret) as { id: string; role: string; jti?: string };
    
    // Check if token is revoked
    if (decoded.jti) {
      const revokedKey = `${REVOCATION_PREFIX}${decoded.jti}`;
      // Use a separate Redis client for revocation check to avoid blocking
      // We'll use a fire-and-forget check with a short timeout
      checkRevocation(revokedKey).then((revoked) => {
        if (revoked) {
          res.status(401).json({
            success: false,
            message: "Token has been revoked.",
          });
          return;
        }
        req.user = { id: decoded.id, role: decoded.role };
        next();
      }).catch(() => {
        // On Redis error, allow request through (fail open for availability)
        req.user = { id: decoded.id, role: decoded.role };
        next();
      });
    } else {
      req.user = { id: decoded.id, role: decoded.role };
      next();
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

async function checkRevocation(key: string): Promise<boolean> {
  try {
    const result = await redisPublisher.get(key);
    return result === "1";
  } catch {
    return false;
  }
}

// Middleware to restrict access to Admins only
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Forbidden. Admin access required.",
    });
    return;
  }
  next();
};
