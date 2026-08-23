"use client";

import { AlertCircle, FileUp } from "lucide-react";
import Link from "next/link";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { RecentDocuments } from "@/components/admin/recent-documents";
import { useDocuments } from "@/components/hooks/useDocuments";
import type { ProcessingStatus } from "@/lib/types";

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useDocuments({
    page: 1,
    limit: 50,
  });

  const documents = data?.documents ?? [];

  const statusCounts: Record<ProcessingStatus, number> = {
    COMPLETED: 0,
    PROCESSING: 0,
    PENDING: 0,
    FAILED: 0,
  };

  for (const document of documents) {
    statusCounts[document.processingStatus]++;
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your RAG knowledge base.
          </p>
        </div>

        <Link
          href="/admin/documents"
          className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <FileUp className="size-4" />
          Manage Documents
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

          <div>
            <p className="text-sm font-medium">
              Unable to load dashboard data
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Please refresh the page and try again.
            </p>
          </div>
        </div>
      ) : (
        <>
          <DashboardStats
            totalDocuments={data?.pagination.total ?? 0}
            statusCounts={statusCounts}
          />

          <RecentDocuments documents={documents} />
        </>
      )}
    </section>
  );
}
