"use client";

import { authApi } from "@/lib/api-client";
import {
    AUTH_TOKEN_CHANGED_EVENT,
    getAuthToken,
    getAuthUser,
    removeAuthToken,
    setAuthToken,
} from "@/lib/auth";
import type { AuthResponseData, LoginRequest, RegisterRequest } from "@/lib/types";
import { useCallback, useState, useSyncExternalStore } from "react";

interface UseAuthReturn {
    user: AuthResponseData["user"] | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginRequest) => Promise<AuthResponseData>;
    register: (credentials: RegisterRequest) => Promise<AuthResponseData>;
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
    const token = useSyncExternalStore(subscribeToAuthToken, getAuthToken, () => null);
    const storedUser = useSyncExternalStore(subscribeToAuthToken, getAuthUser, () => null);
    const [user, setUser] = useState<AuthResponseData["user"] | null>(null);

    const currentUser = user ?? storedUser;
    const isAuthenticated = Boolean(currentUser) || Boolean(token);
    const isLoading = false;

    const register = useCallback(async (credentials: RegisterRequest) => {
        const response = await authApi.register(credentials);
        setAuthToken(response.token, response.user);
        setUser(response.user);
        return response;
    }, []);

    const login = useCallback(async (credentials: LoginRequest) => {
        const response = await authApi.login(credentials);
        setAuthToken(response.token, response.user);
        setUser(response.user);
        return response;
    }, []);

    const logout = useCallback(() => {
        removeAuthToken();
        setUser(null);
    }, []);

    return {
        user: currentUser,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
    };
}
