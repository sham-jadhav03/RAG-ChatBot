"use client";

import { Check, ChevronDown, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDocuments } from "@/components/hooks/useDocuments";
import type { Document } from "@/lib/types";

interface DocumentPickerProps {
  value: Document | null;
  onChange: (document: Document) => void;
}

export function DocumentPicker({
  value,
  onChange,
}: DocumentPickerProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useDocuments({
    page: 1,
    limit: 50,
  });

  const documents =
    data?.documents.filter(
      (document) => document.processingStatus === "COMPLETED",
    ) ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={isLoading || isError}
        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Document
            </p>

            <p className="truncate text-sm font-medium">
              {isLoading
                ? "Loading documents..."
                : value?.fileName ?? "Select a document"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {documents.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <FileText className="mx-auto size-5 text-muted-foreground" />

              <p className="mt-2 text-sm font-medium">
                No completed documents
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                There are no documents ready for chat yet.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto p-1">
              {documents.map((document) => {
                const selected = value?._id === document._id;

                return (
                  <button
                    key={document._id}
                    type="button"
                    onClick={() => {
                      onChange(document);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />

                    <span className="min-w-0 flex-1 truncate text-sm">
                      {document.fileName}
                    </span>

                    {selected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isError && (
        <p className="mt-2 text-xs text-destructive">
          Unable to load available documents.
        </p>
      )}
    </div>
  );
}