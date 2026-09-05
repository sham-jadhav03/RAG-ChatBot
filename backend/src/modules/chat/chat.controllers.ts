import { NextFunction, Request, Response } from "express";
import chatService from "./chat.service.js";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

/**
 * POST /api/chat/ask
 *
 * Public chat endpoint.
 *
 * Business logic is delegated entirely to chatService.
 */
export async function askQuestionController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionId, documentId, question } = req.body;
    const userId = req.user!.id;

    const chatMessage = await chatService.askQuestion({
      sessionId,
      documentId,
      question,
      userId,
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const page = req.query.page 
      ? parseInt(req.query.page as string, 10) 
      : 1;

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    const userId = req.user!.id;

    const result = await chatService.getHistory({
      sessionId,
      userId,
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

/**
 * GET /api/chat/conversations
 * Returns paginated list of all conversations for the current user.
 */
export async function listConversationsController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = req.query.page 
      ? parseInt(req.query.page as string, 10) 
      : 1;

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;

    const userId = req.user!.id;

    const result = await chatService.listConversations({
      userId,
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
      message: error?.message || "Failed to fetch conversations.",
    });
  }
}
