import type { ProcessingStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ProcessingStatus;
}

const statusStyles: Record<ProcessingStatus, string> = {
  COMPLETED:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PROCESSING:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PENDING:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  FAILED:
    "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}