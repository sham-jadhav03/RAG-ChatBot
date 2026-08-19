import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

export class ChatValidator {

  static validateAskQuestion(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const { sessionId, documentId, question } = req.body;
    
    const errors: string[] = [];

    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0
    ) {
      errors.push("Session ID is required and must be a non-empty string.");
    } else if (sessionId.trim().length > 100) {
      errors.push("Session ID must not exceed 100 characters.");
    }

    if (
      !documentId ||
      typeof documentId !== "string" ||
      !mongoose.Types.ObjectId.isValid(documentId)
    ) {
      errors.push("A valid Document ID is required.");
    }

    // 3. question validation
    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      errors.push("Question is required and must be a non-empty string.");
    } else if (question.trim().length > 1000) {
      errors.push("Question must not exceed 1000 characters.");
    }

    // If validation errors exist, short-circuit request
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors,
      });
      return;
    }

    // Sanitize for consistency
    req.body.sessionId = sessionId.trim();
    req.body.documentId = documentId.trim();
    req.body.question = question.trim();

    next();
  }

  static validateHistoryQuery(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const { sessionId } = req.params;
    const { page, limit } = req.query;
    const errors: string[] = [];

    // 1. sessionId (route param) validation
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0
    ) {
      errors.push("Session ID is required and must be a non-empty string.");
    } else if (sessionId.trim().length > 100) {
      errors.push("Session ID must not exceed 100 characters.");
    }

    // 2. page validation (optional)
    if (page !== undefined && (isNaN(Number(page)) || Number(page) < 1)) {
      errors.push("Page must be a positive number.");
    }

    // 3. limit validation (optional, capped at 50)
    if (limit !== undefined) {
      if (isNaN(Number(limit)) || Number(limit) < 1) {
        errors.push("Limit must be a positive number.");
      } else if (Number(limit) > 50) {
        errors.push("Limit must not exceed 50.");
      }
    }

    // If validation errors exist, short-circuit request
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors,
      });
      return;
    }

    next();
  }

}
export default ChatValidator;
