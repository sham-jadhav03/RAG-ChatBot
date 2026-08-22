import {AUTH_TOKEN_STORAGE_KEY} from "@/lib/api-client";

export const AUTH_TOKEN_CHANGED_EVENT = "rag-chatbot-auth-token-changed";

export function getAuthToken(): string | null {
    if(typeof window == "undefined") {
        return null;
    }

    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function removeAuthToken(): void {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function hasAuthToken(): boolean {
 return getAuthToken() !== null;
}
