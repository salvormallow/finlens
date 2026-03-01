"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import type { PortfolioAllocation } from "@/types/financial";

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(180, 70%, 45%)",
];

const PLACEHOLDER_DATA: PortfolioAllocation[] = [
  { assetClass: "US Stocks", value: 95000, percentage: 47.5 },
  { assetClass: "Int'l Stocks", value: 35000, percentage: 17.5 },
  { assetClass: "Bonds", value: 30000, percentage: 15 },
  { assetClass: "Real Estate", value: 20000, percentage: 10 },
  { assetClass: "Cash", value: 15000, percentage: 7.5 },
  { assetClass: "Crypto", value: 5000, percentage: 2.5 },
];

interface AllocationCardProps {
  data?: PortfolioAllocation[];
  loading?: boolean;
}

export function AllocationCard({
  data = PLACEHOLDER_DATA,
  loading = false,
}: AllocationCardProps) {
  return (
    <ChartCard
      title="Portfolio Allocation"
      description="Asset class breakdown"
      loading={loading}
    >
      <div className="flex items-center gap-6">
        <ResponsiveContainer width="50%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="assetClass"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [formatCurrency(value as number), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((item, index) => (
            <div key={item.assetClass} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-muted-foreground">{item.assetClass}</span>
              </div>
              <span className="font-medium">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
