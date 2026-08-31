"use client";

import { useAuth } from "@/components/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isLoading } = useAuth();

    const isAuthPage = pathname === "/admin/login" || pathname === "/admin/register";

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !isAuthPage) {
            router.replace("/admin/login");
        }
    }, [isAuthenticated, isLoading, pathname, router, isAuthPage]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Checking authentication...
                </p>
            </main>
        );
    }

    if (!isAuthenticated && !isAuthPage) {
        return null;
    }

    if (isAuthPage) {
        return <>{children}</>;
    }

    return <AdminShell>{children}</AdminShell>;
}
