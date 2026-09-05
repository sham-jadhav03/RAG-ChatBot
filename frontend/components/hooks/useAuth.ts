"use client";

import { authApi } from "@/lib/api-client";
import { getAccessToken, getAuthUser, clearAuth, AUTH_TOKEN_CHANGED_EVENT } from "@/lib/auth";
import type { AuthResponseData, LoginRequest, RegisterRequest } from "@/lib/types";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface UseAuthReturn {
    user: AuthResponseData["user"] | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginRequest) => Promise<AuthResponseData>;
    register: (credentials: RegisterRequest) => Promise<AuthResponseData>;
    logout: () => Promise<void>;
}

function subscribeToAuthChanges(onStoreChange: () => void): () => void {
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
    return () => {
        window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
    };
}

export function useAuth(): UseAuthReturn {
    const storedUser = useSyncExternalStore(subscribeToAuthChanges, getAuthUser, () => null);
    const [user, setUser] = useState<AuthResponseData["user"] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize user state from stored user
    useEffect(() => {
        setUser(storedUser);
    }, [storedUser]);

    // Auto-refresh access token on page load if we have a user but no access token
    useEffect(() => {
        let mounted = true;
        
        const initializeAuth = async () => {
            // Check if refresh token cookie exists
            const hasRefreshToken = document.cookie.split('; ').some(row => row.startsWith('refreshToken='));
            
            if (storedUser && !hasRefreshToken) {
                // No refresh token cookie, user is not authenticated
                if (mounted) {
                    clearAuth();
                    setUser(null);
                    setIsLoading(false);
                }
                return;
            }

            // Try to refresh access token if we have a stored user
            if (storedUser) {
                try {
                    const result = await authApi.refresh();
                    if (!result && mounted) {
                        clearAuth();
                        setUser(null);
                    } else if (result && mounted) {
                        setUser(result.user);
                    }
                } catch {
                    if (mounted) {
                        clearAuth();
                        setUser(null);
                    }
                } finally {
                    if (mounted) {
                        setIsLoading(false);
                    }
                }
            } else {
                setIsLoading(false);
            }
        };

        initializeAuth();

        return () => {
            mounted = false;
        };
    }, [storedUser]);

    const register = useCallback(async (credentials: RegisterRequest) => {
        const response = await authApi.register(credentials);
        setUser(response.user);
        return response;
    }, []);

    const login = useCallback(async (credentials: LoginRequest) => {
        const response = await authApi.login(credentials);
        setUser(response.user);
        return response;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            clearAuth();
            setUser(null);
        }
    }, []);

    const currentUser = user ?? storedUser;
    const isAuthenticated = Boolean(currentUser);

    return {
        user: currentUser,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
    };
}

function subscribeToAuthChanges(onStoreChange: () => void): () => void {
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
    return () => {
        window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
    };
}