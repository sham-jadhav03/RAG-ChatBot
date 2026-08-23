import type { ProcessingStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ProcessingStatus;
}

const statusLabels: Record<ProcessingStatus, string> = {
  COMPLETED: "Ready",
  PROCESSING: "Processing",
  PENDING: "Queued",
  FAILED: "Failed",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusLabels[status]}`}
    >
      {status}
    </span>
  );
}