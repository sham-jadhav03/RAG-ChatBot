import ImageKit from "@imagekit/nodejs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import documentModel, { IDocument } from "../../models/document.models.js";
import { config } from "../../config/config.js";
import { redisPublisher } from "../../redis/publisher.js";
import { REDIS_CHANNELS } from "../../redis/channels.js";

const imagekit = new ImageKit({
  publicKey: config.IMAGEKIT_PUBLIC_KEY,
  privateKey: config.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: config.IMAGEKIT_URL_ENDPOINT,
} as any);

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, 
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF files are allowed!"));
    }
  },
});

class documentService {
  /**
   * Publish a PDF processing request to Redis with operation tracking.
   * Returns true if published successfully, false if no subscribers.
   * Throws on Redis connection error.
   */
  private async publishPdfRequest(
    documentId: string,
    operationId: string,
    action: "PROCESS" | "REPROCESS" | "DELETE",
    filePath?: string,
    fileName?: string,
  ): Promise<boolean> {
    const payload = JSON.stringify({
      type: "process_pdf",
      operationId,
      documentId,
      filePath,
      fileName,
      action,
    });

    const subscribers = await redisPublisher.publish(
      REDIS_CHANNELS.PDF_PROCESS_REQUESTS,
      payload,
    );

    console.log(
      `Published PDF request to ${REDIS_CHANNELS.PDF_PROCESS_REQUESTS}, action: ${action}, operationId: ${operationId}, subscribers: ${subscribers}`,
    );

    return subscribers > 0;
  }

  /**
   * Handle Redis publish failure by marking document as FAILED.
   */
  private async handlePublishFailure(
    documentId: string,
    operationId: string,
    action: string,
    errorMessage: string,
  ): Promise<void> {
    await documentModel.findByIdAndUpdate(documentId, {
      processingStatus: "FAILED",
      errorMessage: `Publish failed for ${action}: ${errorMessage}`,
      currentOperationId: operationId,
    });
    console.error(
      `Document ${documentId} marked FAILED due to publish failure: ${errorMessage}`,
    );
  }

  /**
   * upload PDF to ImageKit, save metadata in Mongo, trigger redis event
   */
  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
  ): Promise<IDocument> {
    if (!file) {
      throw new Error("PDF file is required.");
    }

    // 1. Upload File Buffer to ImageKit
    const uploadResonse = await (imagekit as any).files.upload({
      file: file.buffer.toString("base64"),
      fileName: `${Date.now()}_${file.originalname}`,
      folder: "/rag_knowledge_base",
    });

    // 2. Generate operation ID and save Document Metadata in MongoDB with PENDING status
    const operationId = uuidv4();
    const document = await documentModel.create({
      fileName: file.originalname,
      filePath: uploadResonse.url,
      fileSize: file.size,
      processingStatus: "PENDING",
      uploadedBy: userId,
      currentOperationId: operationId,
      processingVersion: 1,
    });

    // 3. Publish Redis Event for Python AI Microservice
    try {
      const published = await this.publishPdfRequest(
        document._id.toString(),
        operationId,
        "PROCESS",
        document.filePath,
        document.fileName,
      );

      if (!published) {
        await this.handlePublishFailure(
          document._id.toString(),
          operationId,
          "PROCESS",
          "No Redis subscribers available",
        );
        // Re-fetch to return updated status
        const failedDoc = await documentModel.findById(document._id);
        if (failedDoc) return failedDoc;
      }
    } catch (error: any) {
      await this.handlePublishFailure(
        document._id.toString(),
        operationId,
        "PROCESS",
        error.message,
      );
      const failedDoc = await documentModel.findById(document._id);
      if (failedDoc) return failedDoc;
      throw error;
    }

    return document;
  }

  /**
   * List and Search pdfs with pagination
   */
  async getDocuments(query: { search: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.search) {
      filter.fileName = { $regex: query.search, $options: "i" };
    }

    const [documents, total] = await Promise.all([
      documentModel
        .find(filter)
        .populate("uploadedBy", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      documentModel.countDocuments(filter),
    ]);

    return {
      documents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete PDF record from DataBase and trigger ChromaDB vector Cleanup
   */
  async deleteDocuments(documentId: string): Promise<void> {
    const document = await documentModel.findById(documentId);

    if (!document) {
      throw new Error("Document not found.");
    }

    const operationId = uuidv4();

    // Update document with operation tracking before delete
    await documentModel.findByIdAndUpdate(documentId, {
      currentOperationId: operationId,
      $inc: { processingVersion: 1 },
    });

    // delete record from database
    await documentModel.findByIdAndDelete(documentId);

    // Publish DELETE request (best effort - document already deleted)
    try {
      await this.publishPdfRequest(documentId, operationId, "DELETE");
    } catch (error: any) {
      console.error(
        `Failed to publish DELETE for document ${documentId}: ${error.message}`,
      );
      // Document already deleted, cannot mark FAILED. Log for reconciliation.
    }
  }

  /**
   * Reprocess existing PDF document
   */
  async reprocessDocument(documentId: string): Promise<IDocument> {
    const document = await documentModel.findById(documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    const operationId = uuidv4();
    const newVersion = document.processingVersion + 1;

    // Reset status to PENDING with new operation ID and incremented version
    await documentModel.findByIdAndUpdate(documentId, {
      processingStatus: "PENDING",
      errorMessage: undefined,
      currentOperationId: operationId,
      processingVersion: newVersion,
    });

    // Trigger Redis Event for Python ai worker again
    try {
      const published = await this.publishPdfRequest(
        documentId,
        operationId,
        "REPROCESS",
        document.filePath,
        document.fileName,
      );

      if (!published) {
        await this.handlePublishFailure(
          documentId,
          operationId,
          "REPROCESS",
          "No Redis subscribers available",
        );
      }
    } catch (error: any) {
      await this.handlePublishFailure(
        documentId,
        operationId,
        "REPROCESS",
        error.message,
      );
    }

    const updatedDoc = await documentModel.findById(documentId);
    if (!updatedDoc) {
      throw new Error("Document not found after reprocess update.");
    }
    return updatedDoc;
  }
}

export default new documentService();
