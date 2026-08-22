import { ProcessingStatus } from "@/lib/types";
import { CheckCircle2, Clock3, FileText, LoaderCircle, XCircle } from "lucide-react";


interface DashboardStatsProps {
    totalDocuments: number;
    statusCounts: Record<ProcessingStatus, number>;
}

const stats = [
    {
        key: "total",
        label: "Total Documents",
        icon: FileText,
    },
    {
        key: "COMPLETED",
        label: "Completed",
        icon: CheckCircle2,
    },
    {
        key: "PROCESSING",
        label: "Processing",
        icon: LoaderCircle,
    },
    {
        key: "PENDING",
        label: "Pending",
        icon: Clock3,
    },
    {
        key: "FAILED",
        label: "Failed",
        icon: XCircle,
    },
] as const;

export function DashboardStats({ totalDocuments, statusCounts }: DashboardStatsProps) {
    const values: Record<string, number> = {
        total: totalDocuments,
        ...statusCounts,
    };

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                    <div
                        key={stat.key}
                        className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {stat.label}
                            </p>

                            <Icon className="size-4 text-muted-foreground" />
                        </div>

                        <p className="mt-3 text-2xl font-semibold tracking-tight">
                            {values[stat.key] ?? 0}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}