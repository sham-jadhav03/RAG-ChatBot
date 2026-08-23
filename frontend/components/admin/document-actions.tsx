"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api-client";
import type { Document } from "@/lib/types";
import { DeleteDocumentDialog } from "@/components/admin/delete-document-dialog"

interface DocumentActionsProps {
  document: Document;
}

export function DocumentActions({ document }: DocumentActionsProps) {
  const queryClient = useQueryClient();

  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  async function handleReprocess() {
    if (isReprocessing || isDeleting) {
      return;
    }

    setIsReprocessing(true);
    setError("");

    try {
      await documentsApi.reprocess(document._id);

      await queryClient.invalidateQueries({
        queryKey: ["documents"],
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to reprocess document.",
      );
    } finally {
      setIsReprocessing(false);
    }
  }

  async function handleDelete() {
    if (isDeleting || isReprocessing) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await documentsApi.remove(document._id);

      await queryClient.invalidateQueries({
        queryKey: ["documents"],
      });

      setShowDeleteDialog(false);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to delete document.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const isBusy = isReprocessing || isDeleting;

  return (
    <div className="flex items-center justify-end gap-1">
      {document.processingStatus === "FAILED" && (
        <button
          type="button"
          onClick={handleReprocess}
          disabled={isBusy}
          title="Reprocess document"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {isReprocessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isBusy}
        title="Delete document"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
      >
        {isDeleting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>

      {error && (
        <span
          role="alert"
          className="ml-2 max-w-48 truncate text-xs text-destructive"
          title={error}
        >
          {error}
        </span>
      )}

      {showDeleteDialog && (
        <DeleteDocumentDialog
          fileName={document.fileName}
          isDeleting={isDeleting}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={async () => {
            await handleDelete();
          }}
        />
      )}
    </div>
  );
}
