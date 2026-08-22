import { FileText } from "lucide-react";
import type { Document } from "@/lib/types";
import { StatusBadge } from "@/components/admin/status-badge";
import { DocumentActions } from "@/components/admin/document-actions";

interface DocumentTableProps {
    documents: Document[];
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(date));
}

export function DocumentTable({ documents }: DocumentTableProps) {
    if (documents.length === 0) {
        return (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="size-6 text-muted-foreground" />
                </div>

                <h2 className="mt-4 text-sm font-semibold">
                    No documents found
                </h2>

                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Upload a PDF document to start building your knowledge base.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/30 text-left">
                        <th className="px-5 py-3 font-medium text-muted-foreground">
                            Document
                        </th>

                        <th className="px-5 py-3 font-medium text-muted-foreground">
                            Status
                        </th>

                        <th className="px-5 py-3 font-medium text-muted-foreground">
                            Uploaded
                        </th>

                        <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                            Actions
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y">
                    {documents.map((document) => (
                        <tr
                            key={document._id}
                            className="transition-colors hover:bg-muted/20"
                        >
                            <td className="max-w-[360px] px-5 py-4">
                                {/* existing document cell */}
                            </td>

                            <td className="px-5 py-4">
                                <StatusBadge status={document.processingStatus} />
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                                {formatDate(document.uploadDate)}
                            </td>

                            <td className="px-5 py-4 text-right">
                                <DocumentActions document={document} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}