// ============================================================
// Shared API contracts
// ============================================================

export interface ApiSuccessBody<T = undefined> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: string[];
}

// ============================================================
// Authentication
// ============================================================

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthResponseData {
  user: AuthUser;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// ============================================================
// Documents
// ============================================================

export type ProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface DocumentUploaderRef {
  _id: string;
  username: string;
  email: string;
}

export interface Document {
  _id: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadDate: string;
  processingStatus: ProcessingStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: string | DocumentUploaderRef;
}

export interface DocumentListData {
  documents: Document[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DocumentListParams {
  search?: string;
  page?: number;
  limit?: number;
}

// Chat

export interface ChatSource {
  documentName: string;
  pageNumber: number | null;
  excerpt: string;
  similarity: number;
}

export interface AskQuestionRequest {
  sessionId: string;
  documentId: string;
  question: string;
}

export interface AskQuestionRequestData {
  sessionId: string;
  documentId: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  suggestedQuestions: string[];
  requestId?: string;
  createdAt: string;
}

export interface ChatHistoryEntry {
  question: string;
  answer: string;
  sources: ChatSource[];
  suggestedQuestions: string[];
  requestId?: string;
  createdAt: string;
}

export interface ChatHistoryData {
  messages: ChatHistoryEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}