"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
    {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        label: "Documents",
        href: "/admin/documents",
        icon: FileText,
    },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">
            <div className="flex h-full min-h-screen flex-col">
                <div className="border-b px-6 py-5">
                    <p className="text-base font-semibold tracking-tight">
                        RAG Chatbot
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                        Admin Panel
                    </p>
                </div>

                <nav className="flex-1 p-4">
                    <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Navigation
                    </p>

                    <div className="space-y-1">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;

                            const isActive =
                                item.href === "/admin"
                                    ? pathname === "/admin"
                                    : pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    <Icon className="size-4" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </div>
        </aside>
    );
}
