"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Lightbulb,
  TrendingUp,
  Shield,
  Wallet,
  PiggyBank,
  Target,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const RECOMMENDATION_CATEGORIES = [
  {
    title: "Immediate Actions",
    icon: AlertTriangle,
    color: "text-amber-500",
    items: [
      {
        priority: "high" as const,
        title: "Review overlapping subscriptions",
        impact: "Save ~$120/mo",
        description:
          "You have 3 streaming services and 2 cloud storage subscriptions that overlap in functionality.",
      },
      {
        priority: "high" as const,
        title: "Increase emergency fund",
        impact: "Risk reduction",
        description:
          "Current emergency fund covers 2.1 months of expenses. Target is 3-6 months.",
      },
    ],
  },
  {
    title: "Investment Optimization",
    icon: TrendingUp,
    color: "text-blue-500",
    items: [
      {
        priority: "medium" as const,
        title: "Rebalance portfolio allocation",
        impact: "Better risk-adjusted returns",
        description:
          "US equities are 15% overweight vs your target allocation. Consider rebalancing to bonds/international.",
      },
      {
        priority: "low" as const,
        title: "Tax-loss harvesting opportunity",
        impact: "Save ~$800 in taxes",
        description:
          "3 positions have unrealized losses that could offset capital gains.",
      },
    ],
  },
  {
    title: "Tax Strategies",
    icon: Shield,
    color: "text-emerald-500",
    items: [
      {
        priority: "medium" as const,
        title: "Evaluate Roth conversion",
        impact: "Long-term tax savings",
        description:
          "Based on your current tax bracket, a partial Roth conversion could save taxes in retirement.",
      },
    ],
  },
  {
    title: "Debt Optimization",
    icon: Wallet,
    color: "text-red-500",
    items: [
      {
        priority: "low" as const,
        title: "Refinance opportunity",
        impact: "Save ~$200/mo",
        description:
          "Current rates may allow refinancing your auto loan at a lower rate.",
      },
    ],
  },
  {
    title: "Savings & Retirement",
    icon: PiggyBank,
    color: "text-purple-500",
    items: [
      {
        priority: "medium" as const,
        title: "Max out 401(k) contributions",
        impact: "$3,200 tax savings",
        description:
          "You're contributing 8% but could increase to 15% and still maintain your budget.",
      },
    ],
  },
  {
    title: "Risk Assessment",
    icon: Target,
    color: "text-orange-500",
    items: [
      {
        priority: "low" as const,
        title: "Review insurance coverage",
        impact: "Risk mitigation",
        description:
          "No umbrella policy detected. Consider one given your net worth level.",
      },
    ],
  },
];

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          AI Recommendations
        </h1>
        <p className="text-muted-foreground text-sm">
          Prioritized actions to improve your financial health
        </p>
      </div>

      <div className="p-4 rounded-lg border border-border bg-muted/30 flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Sample Recommendations</p>
          <p className="text-xs text-muted-foreground">
            These are example recommendations. Upload your financial documents
            to receive personalized, AI-powered advice based on your actual
            financial data.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {RECOMMENDATION_CATEGORIES.map((category) => (
          <Card key={category.title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <category.icon className={`h-5 w-5 ${category.color}`} />
                <CardTitle className="text-base">{category.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.items.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <Badge
                    variant={
                      item.priority === "high"
                        ? "destructive"
                        : item.priority === "medium"
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] shrink-0 mt-0.5"
                  >
                    {item.priority}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      {item.impact && (
                        <span className="text-xs text-emerald-500 font-medium shrink-0">
                          {item.impact}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
