"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import type { RecurringExpensesResponse, RecurringExpense } from "@/lib/analysis/recurring";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export function RecurringExpensesCard() {
  const [data, setData] = useState<RecurringExpensesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/recurring");
        if (!res.ok) throw new Error();
        const json: RecurringExpensesResponse = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (!loading && (!data || data.subscriptions.length === 0)) {
    return null;
  }

  return (
    <ChartCard
      title="Recurring Expenses"
      description="Auto-detected subscriptions and recurring charges"
      className="col-span-full"
      loading={loading}
      action={
        data ? (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatCurrency(data.monthlyTotal)}/mo</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{formatCurrency(data.annualTotal)}/yr</span>
          </div>
        ) : undefined
      }
    >
      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right hidden md:table-cell">
                Monthly Cost
              </TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.subscriptions.map((sub: RecurringExpense) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {sub.description}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {sub.category}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    <RefreshCw className="h-2.5 w-2.5 mr-1" />
                    {FREQ_LABELS[sub.frequency]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(sub.lastAmount)}
                  {sub.priceChange !== null && sub.priceChange > 0 && (
                    <span className="ml-1.5 text-[10px] text-red-400 inline-flex items-center">
                      <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                      +{sub.priceChange}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right hidden md:table-cell font-medium">
                  {formatCurrency(sub.monthlyEquivalent)}
                </TableCell>
                <TableCell className="text-right">
                  {sub.status === "possibly_inactive" ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/30 text-amber-400"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                      Inactive?
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-500/30 text-emerald-400"
                    >
                      Active
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ChartCard>
  );
}
