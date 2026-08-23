import type {
  ApiErrorBody,
  ApiSuccessBody,
  AuthResponseData,
  Document,
  DocumentListData,
  DocumentListParams,
  ChatHistoryData,
  AskQuestionRequest,
  AskQuestionRequestData,
  LoginRequest,
  RegisterRequest,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const AUTH_TOKEN_STORAGE_KEY = "rag_chatbot_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 400, body);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 401, body);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 404, body);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 409, body);
    this.name = "ConflictError";
  }
}

export class AiServiceError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 502, body);
    this.name = "AiServiceError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 503, body);
    this.name = "ServiceUnavailableError";
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string, body?: ApiErrorBody) {
    super(message, 504, body);
    this.name = "TimeoutError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body: ApiSuccessBody<T> | ApiErrorBody | undefined;

  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      `Backend returned an invalid response (${response.status})`,
      response.status,
    );
  }

  if (!response.ok || !body || body.success === false) {
    const errorBody = body as ApiErrorBody | undefined;
    const message = errorBody?.message || "Request failed";

    switch (response.status) {
      case 400:
        throw new BadRequestError(message, errorBody);

      case 401:
        throw new UnauthorizedError(message, errorBody);

      case 404:
        throw new NotFoundError(message, errorBody);

      case 409:
        throw new ConflictError(message, errorBody);

      case 502:
        throw new AiServiceError(message, errorBody);

      case 503:
        throw new ServiceUnavailableError(message, errorBody);

      case 504:
        throw new TimeoutError(message, errorBody);

      default:
        throw new ApiError(message, response.status, errorBody);
    }
  }

  return body.data as T;
}

// ============================================================
// Authentication API
// ============================================================

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponseData> {
    return request<AuthResponseData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async register(payload: RegisterRequest): Promise<AuthResponseData> {
    return request<AuthResponseData>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

// ============================================================
// Documents API
// ============================================================

export const documentsApi = {
  async list(params: DocumentListParams = {}): Promise<DocumentListData> {
    const searchParams = new URLSearchParams();

    if (params.search) {
      searchParams.set("search", params.search);
    }

    if (params.page !== undefined) {
      searchParams.set("page", String(params.page));
    }

    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }

    const query = searchParams.toString();

    return request<DocumentListData>(
      `/api/documents${query ? `?${query}` : ""}`,
    );
  },

  async upload(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append("file", file);

    return request<Document>("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
  },

  async remove(documentId: string): Promise<void> {
    await request<void>(`/api/documents/${documentId}`, {
      method: "DELETE",
    });
  },

  async reprocess(documentId: string): Promise<Document> {
    return request<Document>(`/api/documents/${documentId}/reprocess`, {
      method: "GET",
    });
  },
};

//ChatApi

export const chatapi = {
  async ask(payload: AskQuestionRequest,): Promise<AskQuestionRequestData>{
    return request<AskQuestionRequestData>("/api/chat/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async history(
    sessionId: string,
    page: number,
    limit: number,
  ): Promise<ChatHistoryData> {
    const searchParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return request<ChatHistoryData>(
      `/api/chat/${encodeURIComponent(sessionId)}/history?${searchParams.toString()}`,
    );
  },
};
