"use client";

import { authApi } from "@/lib/api-client";
import { getAuthUser, setAuthUser, clearAuth, AUTH_TOKEN_CHANGED_EVENT } from "@/lib/auth";
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

function createAuthChangeSubscription(onStoreChange: () => void): () => void {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onStoreChange);
  };
}

export function useAuth(): UseAuthReturn {
  const user = useSyncExternalStore(createAuthChangeSubscription, getAuthUser, () => null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const storedUser = getAuthUser();

      if (storedUser) {
        try {
          const result = await authApi.refresh();
          if (!result && mounted) {
            clearAuth();
          } else if (result && mounted) {
            setAuthUser(result.user);
          }
        } catch {
          if (mounted) {
            clearAuth();
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
  }, []);

  const register = useCallback(async (credentials: RegisterRequest) => {
    const response = await authApi.register(credentials);
    return response;
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  }, []);

  const isAuthenticated = Boolean(user);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };
}