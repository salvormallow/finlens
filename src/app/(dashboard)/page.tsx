"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { IncomeExpenseCard } from "@/components/dashboard/income-expense-card";
import { AllocationCard } from "@/components/dashboard/allocation-card";
import { CashFlowCard } from "@/components/dashboard/cash-flow-card";
import { SpendingTrendsCard } from "@/components/dashboard/spending-trends-card";
import { RecurringExpensesCard } from "@/components/dashboard/recurring-expenses-card";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { EmptyDashboardState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import type { DashboardData, DashboardPeriod } from "@/types/financial";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

function computeTrend(
  current: number,
  prior: number | undefined
): { value: number; label: string } | undefined {
  if (prior === undefined || prior === 0) return undefined;
  return {
    value:
      Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10,
    label: "from last month",
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("all");
  const [drillDown, setDrillDown] = useState<{
    category: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json: DashboardData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Financial Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Overview of your financial health
            </p>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Net Worth" value="—" icon={DollarSign} loading />
          <StatCard title="Monthly Income" value="—" icon={TrendingUp} loading />
          <StatCard title="Monthly Expenses" value="—" icon={TrendingDown} loading />
          <StatCard title="Savings Rate" value="—" icon={PiggyBank} loading />
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <NetWorthCard loading />
          <AllocationCard loading />
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <IncomeExpenseCard loading />
        </div>

        <CashFlowCard loading />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (!data || !data.hasData) {
    return <EmptyDashboardState />;
  }

  // Real data
  const { summary, summaryPriorMonth } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Overview of your financial health
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up [animation-delay:100ms]">
        <StatCard
          title="Net Worth"
          value={formatCurrency(summary.netWorth)}
          icon={DollarSign}
          trend={computeTrend(
            summary.netWorth,
            summaryPriorMonth?.netWorth
          )}
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(summary.monthlyIncome)}
          icon={TrendingUp}
          trend={computeTrend(
            summary.monthlyIncome,
            summaryPriorMonth?.monthlyIncome
          )}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(summary.monthlyExpenses)}
          icon={TrendingDown}
          trend={computeTrend(
            summary.monthlyExpenses,
            summaryPriorMonth?.monthlyExpenses
          )}
        />
        <StatCard
          title="Savings Rate"
          value={`${summary.savingsRate.toFixed(1)}%`}
          icon={PiggyBank}
          description="Target: 20%"
        />
      </div>

      {/* Cash Flow Forecast */}
      <div className="animate-fade-up [animation-delay:150ms]">
        <ForecastCard />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 animate-fade-up [animation-delay:200ms]">
        <NetWorthCard data={data.netWorthTrend} />
        <AllocationCard data={data.portfolioAllocation} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 animate-fade-up [animation-delay:300ms]">
        <IncomeExpenseCard data={data.monthlyPnL} />
        <div className="space-y-4">
          {/* Tax Overview */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-3">Tax Overview</h3>
            {data.taxOverview.hasData ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Estimated Tax Liability
                  </span>
                  <span className="font-medium">
                    {formatCurrency(data.taxOverview.estimatedLiability)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Withholdings YTD
                  </span>
                  <span className="font-medium">
                    {formatCurrency(data.taxOverview.withholdingsYtd)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">
                    Estimated Balance Due
                  </span>
                  <span
                    className={`font-medium ${
                      data.taxOverview.estimatedBalanceDue > 0
                        ? "text-amber-500"
                        : "text-green-500"
                    }`}
                  >
                    {formatCurrency(Math.abs(data.taxOverview.estimatedBalanceDue))}
                    {data.taxOverview.estimatedBalanceDue <= 0 ? " refund" : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Upload W-2s and 1099s for tax analysis
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-3">Top Recommendations</h3>
            {data.recommendations.length > 0 ? (
              <div className="space-y-2">
                {data.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Badge
                      variant={
                        rec.priority === "high"
                          ? "destructive"
                          : rec.priority === "medium"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px] shrink-0 mt-0.5"
                    >
                      {rec.priority}
                    </Badge>
                    <span className="text-muted-foreground">{rec.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Upload more documents for personalized recommendations
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="animate-fade-up [animation-delay:400ms]">
      <CashFlowCard
        data={data.cashFlow}
        onCategoryClick={(category) => setDrillDown({ category })}
      />
      </div>

      {/* Spending Trends */}
      <div className="animate-fade-up [animation-delay:500ms]">
      <SpendingTrendsCard period={period} />
      </div>

      {/* Recurring Expenses */}
      <div className="animate-fade-up [animation-delay:600ms]">
      <RecurringExpensesCard />
      </div>

      {/* Portfolio Holdings */}
      <div className="animate-fade-up [animation-delay:700ms]">
      <HoldingsTable />
      </div>

      {/* Transaction Detail Table */}
      <div className="animate-fade-up [animation-delay:800ms]">
      <TransactionTable
        period={period}
        initialFilter={drillDown}
        onClearFilter={() => setDrillDown(null)}
      />
      </div>
    </div>
  );
}
