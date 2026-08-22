"use client";

import { useAuth } from "@/components/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter();

    const pathname = usePathname();

    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && pathname !== "/admin/login") {
            router.replace("/admin/login");
        }
    }, [isAuthenticated, isLoading, pathname, router]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Checking authentication...
                </p>
            </main>
        )
    }

    if (!isAuthenticated && pathname !== "/admin/login") {
        return null;
    }

    return <AdminShell>{children}</AdminShell>;
}
