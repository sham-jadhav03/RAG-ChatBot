"use client";

import { useAuth } from "@/components/hooks/useAuth";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.replace("/auth/login");
            } else if (user && user.role !== "admin") {
                router.replace("/");
            }
        }
    }, [isAuthenticated, isLoading, user, router]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Checking authentication...
                </p>
            </main>
        );
    }

    if (!isAuthenticated || (user && user.role !== "admin")) {
        return null;
    }

    return <AdminShell>{children}</AdminShell>;
}
