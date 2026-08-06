import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import documentService from "./document.service";

/**
 * POST /api/documents/upload
 */
export async function uploadController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please select a valid PDF file to upload.",
      });
      return;
    }

    const userId = req.user!.id;
    const document = await documentService.uploadDocument(req.file, userId);

    res.status(201).json({
      success: true,
      message: "PDF uploaded successfully. Processing started.",
      data: document,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload document.",
    });
  }
}

/**
 * GET /api/documents
 */
export async function listContoller(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const search = req.query.search as string;
    const page = req.query.page ? parseInt(req.query.limit as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const result = await documentService.getDocuments({ search, page, limit });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch documents.",
    });
  }
}

/**
 * DELETE /api/documents/:id
 */
export async function deleteController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await documentService.deleteDocuments(id);

    res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete document.",
    });
  }
}

/**
 * POST /api/documents/:id/reprocess
 */
export async function reprocessController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const document = await documentService.reprocessDocument(id);

    res.status(200).json({
      success: true,
      message: "Document sent for reprocessing.",
      data: document,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to reprocess document.",
    });
  }
}
