"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api-client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function DocumentUploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  function validateFile(selectedFile: File): boolean {
    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("PDF size must be 10 MB or less.");
      return false;
    }

    setError("");
    return true;
  }

  function selectFile(selectedFile: File) {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      selectFile(selectedFile);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      selectFile(droppedFile);
    }
  }

  async function handleUpload() {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      await documentsApi.upload(file);

      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      await queryClient.invalidateQueries({
        queryKey: ["documents"],
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the document.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Upload Document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF to add it to the RAG knowledge base.
        </p>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        <FileUp className="mx-auto size-8 text-muted-foreground" />

        <p className="mt-3 text-sm font-medium">
          Drop your PDF here or click to browse
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          PDF only · Maximum 10 MB
        </p>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {file.name}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <button
            type="button"
            onClick={clearFile}
            disabled={isUploading}
            aria-label="Remove selected file"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isUploading && <Loader2 className="size-4 animate-spin" />}
        {isUploading ? "Uploading..." : "Upload PDF"}
      </button>
    </div>
  );
}