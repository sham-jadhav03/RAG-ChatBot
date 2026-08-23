import { FileText } from "lucide-react";
import type { ChatSource } from "@/lib/types";

interface SourceCardProps {
  source: ChatSource;
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-foreground">
        <span className="flex items-center gap-1 truncate">
          <FileText className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{source.documentName}</span>
        </span>
        {source.pageNumber !== null && source.pageNumber !== undefined && (
          <span className="shrink-0 text-muted-foreground">
            · Page {source.pageNumber}
          </span>
        )}
        {source.similarity > 0 && (
          <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
            {Math.round(source.similarity * 100)}% match
          </span>
        )}
      </div>

      {source.excerpt && (
        <p className="mt-1.5 line-clamp-3 leading-relaxed text-muted-foreground italic">
          &ldquo;{source.excerpt}&rdquo;
        </p>
      )}
    </div>
  );
}
