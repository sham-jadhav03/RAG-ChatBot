"use client";

import {authApi} from "@/lib/api-client"
import {
    AUTH_TOKEN_CHANGED_EVENT,
    getAuthToken,
    removeAuthToken,
    setAuthToken,
} from "@/lib/auth";
import type { AuthResponseData, LoginRequest } from "@/lib/types";
import { useCallback, useState, useSyncExternalStore } from "react";

interface UseAuthReturn {
    user: AuthResponseData["user"] | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login:(credentials: LoginRequest) => Promise<void>;
    logout: () => void;
}

function subscribeToAuthToken(onStoreChange: () => void): () => void {
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
    window.addEventListener("storage", onStoreChange);

    return () => {
        window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
    };
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<AuthResponseData["user"] | null>(null);
    const token = useSyncExternalStore(subscribeToAuthToken, getAuthToken, () => null);
    const isLoading = false;

    const login = useCallback(async (credentials: LoginRequest) => {
        const response = await authApi.login(credentials);
        setAuthToken(response.token);
        setUser(response.user);
    }, []);

    const logout = useCallback(() => {
        removeAuthToken();
        setUser(null)
    }, []);

    return {
        user,
        isAuthenticated: Boolean(user) || Boolean(token),
        isLoading,
        login,
        logout
    }
}
