"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import type { HoldingsResponse, HoldingDetail } from "@/types/financial";

export function HoldingsTable() {
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch("/api/dashboard/holdings");
        if (!res.ok) throw new Error();
        const json: HoldingsResponse = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetch_data();
  }, []);

  // Don't render at all if no holdings
  if (!loading && (!data || data.holdings.length === 0)) {
    return null;
  }

  return (
    <ChartCard
      title="Portfolio Holdings"
      description="Individual positions and performance"
      className="col-span-full"
      loading={loading}
    >
      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
            <div>
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-sm font-semibold">
                {formatCurrency(data.totalValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost Basis</p>
              <p className="text-sm font-semibold">
                {formatCurrency(data.totalCostBasis)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Gain/Loss</p>
              <p
                className={`text-sm font-semibold ${
                  data.totalGainLoss >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {data.totalGainLoss >= 0 ? "+" : ""}
                {formatCurrency(data.totalGainLoss)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Return</p>
              <p
                className={`text-sm font-semibold ${
                  data.totalGainLossPercent >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {data.totalGainLossPercent >= 0 ? "+" : ""}
                {data.totalGainLossPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  Cost Basis
                </TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  Return
                </TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.holdings.map((h: HoldingDetail) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.symbol}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {h.quantity.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                    {formatCurrency(h.costBasis)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(h.currentValue)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      h.gainLoss >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {h.gainLoss >= 0 ? "+" : ""}
                    {formatCurrency(h.gainLoss)}
                  </TableCell>
                  <TableCell
                    className={`text-right hidden md:table-cell ${
                      h.gainLossPercent >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {h.gainLossPercent >= 0 ? "+" : ""}
                    {h.gainLossPercent.toFixed(1)}%
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {h.accountName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell />
                <TableCell className="text-right hidden sm:table-cell font-semibold">
                  {formatCurrency(data.totalCostBasis)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(data.totalValue)}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    data.totalGainLoss >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {data.totalGainLoss >= 0 ? "+" : ""}
                  {formatCurrency(data.totalGainLoss)}
                </TableCell>
                <TableCell
                  className={`text-right hidden md:table-cell font-semibold ${
                    data.totalGainLossPercent >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {data.totalGainLossPercent >= 0 ? "+" : ""}
                  {data.totalGainLossPercent.toFixed(1)}%
                </TableCell>
                <TableCell className="hidden lg:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </>
      )}
    </ChartCard>
  );
}
