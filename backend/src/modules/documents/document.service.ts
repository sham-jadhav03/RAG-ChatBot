import ImageKit from "@imagekit/nodejs";
import multer from "multer";
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

    console.log(typeof (imagekit as any).upload);

    
    // 2. Save Document Metadata in MongoDB
    const document = await documentModel.create({
      fileName: file.originalname,
      filePath: uploadResonse.url,
      fileSize: file.size,
      processingStatus: "PENDING",
      uploadedBy: userId,
    });

    // 3. Publish Redis Event for Python AI Microservice
    const payload = JSON.stringify({
      documentId: document._id,
      filePath: document.filePath,
      fileName: document.fileName,
      action: "PROCESS",
    });

    await redisPublisher.publish(REDIS_CHANNELS.PDF_PROCESS_REQUESTS, payload);

    return document;
  }

  /**
   * List and Search pdfs eith pagination
   */
  async getDocuments(query: { search: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.search) {
      filter.fileName = { $regex: query.search, $options: "i" }; // Case-insensitive search
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

    // delete record from databse
    await documentModel.findByIdAndDelete(documentId);

    const payload = JSON.stringify({
      documentId,
      action: "DELETE",
    });

    await redisPublisher.publish(REDIS_CHANNELS.PDF_PROCESS_REQUESTS, payload);
  }

  /**
   * Reprocess existing PDF document
   */
  async reprocessDocument(documentId: string): Promise<IDocument> {
    const document = await documentModel.findById(documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    //Reset status to Pending
    document.processingStatus = "PENDING";
    document.errorMessage = undefined;
    await document.save();

    //Trigger Redis Event for Python ai worker again
    const payload = JSON.stringify({
      documentId: document._id,
      filePath: document.filePath,
      fileName: document.fileName,
      action: "REPROCESS",
    });

    await redisPublisher.publish(REDIS_CHANNELS.PDF_PROCESS_REQUESTS, payload);

    return document;
  }
}

export default new documentService();
