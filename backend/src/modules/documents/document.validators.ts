import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export class DocumentValidator {
  /**
   * Validate PDF upload request (runs after Multer)
   */
  static validateUpload(req: Request, res: Response, next: NextFunction): void {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: ["A PDF file is required in 'file' field."],
      });
      return;
    }

    if (req.file.mimetype !== "application/pdf") {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: ["Only PDF documents are allowed."],
      });
      return;
    }

    next();
  }

  /**
   * Validate MongoDB ObjectId parameter (:id) for delete & reprocess
   */
  static validateDocumentId(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: ["Invalid Document ID format."],
      });
      return;
    }

    next();
  }

  /**
   * Validate List/Search Query Params
   */
  static validateQuery(req: Request, res: Response, next: NextFunction): void {
    const { page, limit } = req.query;
    const errors: string[] = [];

    if (page && (isNaN(Number(page)) || Number(page) < 1)) {
      errors.push("Page must be a positive number.");
    }

    if (limit !== undefined) {
      if (isNaN(Number(limit)) || Number(limit) < 1) {
        errors.push("Limit must be a positive number.");
      } else if (Number(limit) > 50) {
        errors.push("Limit must not exceed 50.");
      }
    }

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

export default DocumentValidator;
