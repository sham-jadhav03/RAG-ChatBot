"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { DocumentTable } from "@/components/admin/document-table";
import { DocumentUploadDropzone } from "@/components/admin/document-upload-dropzone";
import { useDocuments } from "@/components/hooks/useDocuments";

const PAGE_SIZE = 10;

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useDocuments({
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const documents = data?.documents ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Documents
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage the documents used by your RAG knowledge base.
        </p>
      </div>

      <DocumentUploadDropzone />

      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search documents..."
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-md bg-muted/40"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm font-medium">
                  Unable to load documents
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Please refresh the page and try again.
                </p>
              </div>
            </div>
          ) : (
            <DocumentTable documents={documents} />
          )}
        </div>

        {pagination && pagination.totalPages > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
              {isFetching && " · Updating..."}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || isFetching}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  pagination.page >= pagination.totalPages ||
                  isFetching
                }
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}