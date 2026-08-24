"use client";

import { Loader2, Trash2, X } from "lucide-react";

interface DeleteDocumentDialogProps {
  fileName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDocumentDialog({
  fileName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteDocumentDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-document-title"
        className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="size-5 text-destructive" />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2
          id="delete-document-title"
          className="mt-5 text-lg font-semibold"
        >
          Delete document?
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently delete{" "}
          <span className="font-medium text-foreground">
            {fileName}
          </span>
          . This action cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isDeleting && (
              <Loader2 className="size-4 animate-spin" />
            )}

            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}