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
  ConversationListData,
} from "@/lib/types";
import { getAccessToken, setAccessToken, setAuthUser } from "@/lib/auth";

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

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing) {
    return refreshPromise!;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      if (body.success && body.data?.accessToken) {
        return body.data.accessToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
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

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });

      let retryBody: ApiSuccessBody<T> | ApiErrorBody | undefined;
      try {
        retryBody = await retryResponse.json();
      } catch {
        throw new ApiError(
          `Backend returned an invalid response (${retryResponse.status})`,
          retryResponse.status,
        );
      }

      if (!retryResponse.ok || !retryBody || retryBody.success === false) {
        const errorBody = retryBody as ApiErrorBody | undefined;
        const message = errorBody?.message || "Request failed after refresh";
        throw new UnauthorizedError(message, errorBody);
      }

      return retryBody.data as T;
    }
    throw new UnauthorizedError("Session expired. Please log in again.");
  }

  if (!response.ok || !body || body.success === false) {
    const errorBody = body as ApiErrorBody | undefined;
    const message = errorBody?.message || "Request failed";

    switch (response.status) {
      case 400:
        throw new BadRequestError(message, errorBody);
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

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponseData> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const body = await response.json();

    if (!response.ok || !body.success) {
      throw new UnauthorizedError(body.message || "Login failed");
    }

    if (body.data?.accessToken) {
      setAccessToken(body.data.accessToken);
      setAuthUser(body.data.user);
    }

    return body.data as AuthResponseData;
  },

  async register(payload: RegisterRequest): Promise<AuthResponseData> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const body = await response.json();

    if (!response.ok || !body.success) {
      throw new BadRequestError(body.message || "Registration failed");
    }

    if (body.data?.accessToken) {
      setAccessToken(body.data.accessToken);
      setAuthUser(body.data.user);
    }

    return body.data as AuthResponseData;
  },

  async refresh(): Promise<{ accessToken: string; user: AuthResponseData["user"] } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      const body = await response.json();

      if (!response.ok || !body.success || !body.data?.accessToken) {
        return null;
      }

      setAccessToken(body.data.accessToken);
      return { accessToken: body.data.accessToken, user: body.data.user };
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore errors
    }
  },
};

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

  async listConversations(
    page: number,
    limit: number,
  ): Promise<ConversationListData> {
    const searchParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return request<ConversationListData>(
      `/api/chat/conversations?${searchParams.toString()}`,
    );
  },
};