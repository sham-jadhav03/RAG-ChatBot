import mongoose, {
  Schema,
  Document as MongooseDocument,
  Model,
} from "mongoose";

// Processing Status Enum Type
export type ProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

// 1. Document Interface Definition
export interface IDocument extends MongooseDocument {
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadDate: Date;
  processingStatus: ProcessingStatus;
  errorMessage?: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Document Schema Definition
const documentSchema = new Schema<IDocument>(
  {
    fileName: {
      type: String,
      required: [true, "File name is required."],
      trim: true,
    },
    filePath: {
      type: String,
      required: [true, "File path is required for Python worker processing."],
      trim: true,
    },
    fileSize: {
      type: Number, // In Bytes
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    processingStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true, // ⚡ INDEX ADDED: Optimized for Admin Dashboard polling queries
    },
    errorMessage: {
      type: String,
      default: null,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required."],
    },
  },
  {
    timestamps: true, // Handles createdAt & updatedAt
  },
);

// 3. Additional Compound Index for Admin Dashboard Queries ("Recent Uploaded Documents")
documentSchema.index({ createdAt: -1 });

// 4. Model Export
const documentModel: Model<IDocument> = mongoose.model<IDocument>(
  "Document",
  documentSchema,
);

export default documentModel;
