import type { AuthUser } from "@/lib/types";

export const AUTH_TOKEN_CHANGED_EVENT = "rag-chatbot-auth-token-changed";
export const AUTH_USER_STORAGE_KEY = "rag_chatbot_user";

let cachedUserRaw: string | null = null;
let cachedUser: AuthUser | null = null;
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
    return inMemoryAccessToken;
}

export function getAuthUser(): AuthUser | null {
    if (typeof window === "undefined") {
        return null;
    }

    const stored = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!stored) {
        cachedUserRaw = null;
        cachedUser = null;
        return null;
    }

    if (stored === cachedUserRaw && cachedUser !== null) {
        return cachedUser;
    }

    try {
        cachedUser = JSON.parse(stored) as AuthUser;
        cachedUserRaw = stored;
        return cachedUser;
    } catch {
        cachedUserRaw = null;
        cachedUser = null;
        return null;
    }
}

export function setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
    if (token) {
        window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    }
}

export function setAuthUser(user: AuthUser | null): void {
    if (typeof window === "undefined") return;
    
    if (user) {
        cachedUser = user;
        cachedUserRaw = JSON.stringify(user);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, cachedUserRaw);
    } else {
        cachedUser = null;
        cachedUserRaw = null;
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function clearAuth(): void {
    inMemoryAccessToken = null;
    cachedUser = null;
    cachedUserRaw = null;
    if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    }
}

export function hasAccessToken(): boolean {
    return inMemoryAccessToken !== null;
}