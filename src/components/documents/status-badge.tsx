"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessingStatus } from "@/types/financial";

const STATUS_CONFIG: Record<
  ProcessingStatus,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    label: string;
    iconClassName?: string;
  }
> = {
  pending: {
    variant: "secondary",
    icon: Clock,
    label: "Pending",
  },
  processing: {
    variant: "default",
    icon: Loader2,
    label: "Processing",
    iconClassName: "animate-spin",
  },
  completed: {
    variant: "outline",
    icon: CheckCircle,
    label: "Completed",
    iconClassName: "text-emerald-500",
  },
  failed: {
    variant: "destructive",
    icon: XCircle,
    label: "Failed",
  },
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={cn("h-3 w-3", config.iconClassName)} />
      {config.label}
    </Badge>
  );
}
