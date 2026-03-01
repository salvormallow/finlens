"use client";

import { useState } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { IncomeExpenseCard } from "@/components/dashboard/income-expense-card";
import { AllocationCard } from "@/components/dashboard/allocation-card";
import { CashFlowCard } from "@/components/dashboard/cash-flow-card";
import { EmptyDashboardState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertCircle,
} from "lucide-react";

export default function DashboardPage() {
  // In production, this would check if the user has any financial data
  const [hasData] = useState(true); // Set to false to see empty state

  if (!hasData) {
    return <EmptyDashboardState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Overview of your financial health
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Sample Data — Upload documents to see real numbers
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Worth"
          value="$173,000"
          icon={DollarSign}
          trend={{ value: 6.1, label: "from last month" }}
        />
        <StatCard
          title="Monthly Income"
          value="$8,500"
          icon={TrendingUp}
          trend={{ value: 0, label: "same as last month" }}
        />
        <StatCard
          title="Monthly Expenses"
          value="$5,400"
          icon={TrendingDown}
          trend={{ value: -4.2, label: "from last month" }}
        />
        <StatCard
          title="Savings Rate"
          value="36.5%"
          icon={PiggyBank}
          description="Target: 30%"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <NetWorthCard />
        <AllocationCard />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <IncomeExpenseCard />
        <div className="space-y-4">
          {/* Tax Overview Placeholder */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-3">Tax Overview</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Estimated Tax Liability
                </span>
                <span className="font-medium">$18,200</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Withholdings YTD
                </span>
                <span className="font-medium">$15,600</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">
                  Estimated Balance Due
                </span>
                <span className="font-medium text-amber-500">$2,600</span>
              </div>
              <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Upload W-2s and 1099s for accurate tax analysis
              </div>
            </div>
          </div>

          {/* Quick Actions Placeholder */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-3">Top Recommendations</h3>
            <div className="space-y-2">
              {[
                {
                  priority: "high" as const,
                  text: "Rebalance portfolio — 15% overweight US equities",
                },
                {
                  priority: "medium" as const,
                  text: "Review $340/mo in subscriptions for savings",
                },
                {
                  priority: "low" as const,
                  text: "Consider Roth conversion for tax optimization",
                },
              ].map((rec) => (
                <div
                  key={rec.text}
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
          </div>
        </div>
      </div>

      {/* Cash Flow */}
      <CashFlowCard />
    </div>
  );
}
