"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminMobileNavProps {
  open: boolean;
  onClose: () => void;
}

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

export function AdminMobileNav({
  open,
  onClose,
}: AdminMobileNavProps) {
  const pathname = usePathname();

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-background shadow-xl md:hidden">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-5 py-5">
            <div>
              <p className="font-semibold tracking-tight">
                RAG Chatbot
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Admin Panel
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
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
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
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
    </>
  );
}