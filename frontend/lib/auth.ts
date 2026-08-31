import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";

export const AUTH_TOKEN_CHANGED_EVENT = "rag-chatbot-auth-token-changed";
export const AUTH_USER_STORAGE_KEY = "rag_chatbot_user";

let cachedUserRaw: string | null = null;
let cachedUser: AuthUser | null = null;

export function getAuthToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
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

export function setAuthToken(token: string, user?: AuthUser): void {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    if (user) {
        cachedUser = user;
        cachedUserRaw = JSON.stringify(user);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, cachedUserRaw);
    }
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function removeAuthToken(): void {
    cachedUser = null;
    cachedUserRaw = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function hasAuthToken(): boolean {
    return getAuthToken() !== null;
}
