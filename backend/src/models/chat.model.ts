import mongoose, {
  Document as MongooseDocument,
  Model,
  Types,
  Schema,
} from "mongoose";

export interface IChatSource {
  documentName: string;
  pageNumber: number | null;
  excerpt: string;
  similarity: number;
}

export interface IChatMessage extends MongooseDocument {
  sessionId: string;
  documentId: Types.ObjectId;
  question: string;
  answer: string;
  sources: IChatMessage[];
  suggestedQuestions: string[];
  requestId?: string;
  createAt: Date;
  updatedAt: Date;
}

const chatSourceSchema = new Schema<IChatSource>(
  {
    documentName: {
      type: String,
      required: [true, "Source document name is required."],
      trim: true,
    },
    pageNumber: {
      type: Number,
      default: null,
    },
    excerpt: {
      type: String,
      required: [true, "Source excerpt is required."],
    },
    similarity: {
      type: Number,
      required: [true, "Similarity score is required."],
    },
  },
  { _id: false }, //Sub-document doesn't need its own _id
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    sessionId: {
      type: String,
      required: [true, "Session ID is required."],
      trim: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document Id is required."],
    },
    question: {
      type: String,
      required: [true, "Answer is required."],
    },
    sources: {
      type: [chatSourceSchema],
      default: [],
    },
    suggestedQuestions: {
      type: [String],
      default: [],
    },
    requestId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

chatMessageSchema.index({ sessionId: 1, createdAt: -1 });

const chatMessageModel: Model<IChatMessage> = mongoose.model<IChatMessage>(
  "ChatMessage",
  chatMessageSchema,
);

export default chatMessageModel;
