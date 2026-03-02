"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type {
  DashboardPeriod,
  TransactionRecord,
  TransactionListResponse,
} from "@/types/financial";

interface TransactionTableProps {
  period: DashboardPeriod;
  initialFilter?: { type?: string; category?: string } | null;
  onClearFilter?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  income: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  expense: "bg-red-500/10 text-red-400 border border-red-500/20",
  asset: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  liability: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  investment: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  tax: "bg-muted text-muted-foreground border border-border/50",
};

type SortField = "date" | "amount" | "category" | "dataType";

export function TransactionTable({
  period,
  initialFilter,
  onClearFilter,
}: TransactionTableProps) {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<string>(
    initialFilter?.type || "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    initialFilter?.category || "all"
  );

  // Sync initialFilter from drill-down
  useEffect(() => {
    if (initialFilter?.category) {
      setCategoryFilter(initialFilter.category);
      setPage(1);
    }
    if (initialFilter?.type) {
      setTypeFilter(initialFilter.type);
      setPage(1);
    }
  }, [initialFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        sort,
        order,
        period,
      });
      if (typeFilter && typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (categoryFilter && categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }
      const res = await fetch(`/api/dashboard/transactions?${params}`);
      if (!res.ok) throw new Error();
      const json: TransactionListResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, typeFilter, categoryFilter, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter, period]);

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder(field === "date" ? "desc" : "asc");
    }
  };

  const handleClearFilters = () => {
    setTypeFilter("all");
    setCategoryFilter("all");
    onClearFilter?.();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return order === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const hasActiveFilters =
    (typeFilter && typeFilter !== "all") ||
    (categoryFilter && categoryFilter !== "all");

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ChartCard
      title="Transactions"
      description="Detailed view of all financial records"
      className="col-span-full"
      action={
        hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filters
          </Button>
        ) : undefined
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
            <SelectItem value="liability">Liability</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
          </SelectContent>
        </Select>

        {categoryFilter && categoryFilter !== "all" && (
          <Badge variant="secondary" className="gap-1">
            {categoryFilter}
            <button
              onClick={() => {
                setCategoryFilter("all");
                onClearFilter?.();
              }}
              className="ml-1 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data || data.transactions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No transactions found for the selected filters.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("date")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Date
                    <SortIcon field="date" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("dataType")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Type
                    <SortIcon field="dataType" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("category")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Category
                    <SortIcon field="category" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Subcategory
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("amount")}
                    className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                  >
                    Amount
                    <SortIcon field="amount" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  Description
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.map((tx: TransactionRecord) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tx.date)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        TYPE_COLORS[tx.dataType] || ""
                      }`}
                    >
                      {tx.dataType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setCategoryFilter(tx.category)}
                      className="hover:underline text-left"
                    >
                      {tx.category}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {tx.subcategory || "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      tx.dataType === "expense" || tx.dataType === "liability"
                        ? "text-red-600 dark:text-red-400"
                        : tx.dataType === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : ""
                    }`}
                  >
                    {tx.dataType === "expense" || tx.dataType === "liability"
                      ? `-${formatCurrency(tx.amount)}`
                      : formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                    {tx.description || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-muted-foreground">
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}
