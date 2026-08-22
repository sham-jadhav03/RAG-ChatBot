import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { Document } from "@/lib/types";

interface RecentDocumentsProps {
    documents: Document[];
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(date));
}

function getStatusClasses(status: Document["processingStatus"]) {
    switch (status) {
        case "COMPLETED":
            return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

        case "PROCESSING":
            return "bg-blue-500/10 text-blue-700 dark:text-blue-400";

        case "PENDING":
            return "bg-amber-500/10 text-amber-700 dark:text-amber-400";

        case "FAILED":
            return "bg-red-500/10 text-red-700 dark:text-red-400";
    }
}

export function RecentDocuments({
    documents,
}: RecentDocumentsProps) {
    return (
        <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                    <h2 className="font-semibold">Recent Documents</h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                        Latest documents in your knowledge base.
                    </p>
                </div>

                <Link
                    href="/admin/documents"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    View all
                    <ArrowRight className="size-4" />
                </Link>
            </div>

            {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FileText className="size-8 text-muted-foreground/50" />

                    <p className="mt-3 text-sm font-medium">
                        No documents yet
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                        Upload your first PDF to build the knowledge base.
                    </p>
                </div>
            ) : (
                <div className="divide-y">
                    {documents.slice(0, 5).map((document) => (
                        <div
                            key={document._id}
                            className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {document.fileName}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {formatDate(document.uploadDate)}
                                </p>
                            </div>

                            <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                    document.processingStatus,
                                )}`}
                            >
                                {document.processingStatus}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}