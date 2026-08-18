import { NextFunction, Request, Response } from "express";
import chatService from "./chat.service.js";

/**
 * POST /api/chat/ask
 *
 * Public chat endpoint.
 *
 * Business logic is delegated entirely to chatService.
 */
export async function askQuestionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionId, documentId, question } = req.body;

    const chatMessage = await chatService.askQuestion({
      sessionId,
      documentId,
      question,
    });

    res.status(200).json({
      success: true,
      message: "Question answered successfully",
      data: chatMessage,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: error?.message || "Failed to process chat request.",
    });
  }
}

/**
 * GET /api/chat/:sessionId/history
 * Returns paginated conversation history for a session.
 */
export async function getHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionId } = req.params;

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

    const result = await chatService.getHistory({
      sessionId,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: error?.message || "Failed to fetch chat history.",
    });
  }
}
