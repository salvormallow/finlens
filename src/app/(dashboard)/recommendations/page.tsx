"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb,
  TrendingUp,
  Shield,
  Wallet,
  PiggyBank,
  Target,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";
import type { Recommendation, Priority } from "@/types/financial";
import type { LucideIcon } from "lucide-react";

const CATEGORY_META: Record<string, { icon: LucideIcon; color: string }> = {
  "Immediate Actions": { icon: AlertTriangle, color: "text-amber-500" },
  "Investment Optimization": { icon: TrendingUp, color: "text-blue-500" },
  "Tax Strategies": { icon: Shield, color: "text-emerald-500" },
  "Debt Optimization": { icon: Wallet, color: "text-red-500" },
  "Savings & Retirement": { icon: PiggyBank, color: "text-purple-500" },
  "Risk Assessment": { icon: Target, color: "text-orange-500" },
};

const CATEGORY_ORDER = [
  "Immediate Actions",
  "Investment Optimization",
  "Tax Strategies",
  "Debt Optimization",
  "Savings & Retirement",
  "Risk Assessment",
];

function badgeVariant(priority: Priority) {
  if (priority === "high") return "destructive" as const;
  if (priority === "medium") return "default" as const;
  return "secondary" as const;
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noData, setNoData] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const url = refresh
        ? "/api/recommendations?refresh=true"
        : "/api/recommendations";
      const res = await fetch(url, { method: "POST" });

      if (!res.ok) throw new Error("Failed to fetch recommendations");

      const data = await res.json();

      if (data.noData) {
        setNoData(true);
        setRecommendations([]);
      } else {
        setNoData(false);
        setRecommendations(data.recommendations || []);
      }
    } catch {
      toast.error("Failed to load recommendations. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Group recommendations by category
  const grouped = new Map<string, Recommendation[]>();
  for (const rec of recommendations) {
    const list = grouped.get(rec.category) || [];
    list.push(rec);
    grouped.set(rec.category, list);
  }

  // Sort categories by defined order
  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped.has(c));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Recommendations
          </h1>
          <p className="text-muted-foreground text-sm">
            Prioritized actions to improve your financial health
          </p>
        </div>
        {!noData && !loading && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRecommendations(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Analyzing..." : "Refresh"}
          </Button>
        )}
      </div>

      {/* No data state */}
      {!loading && noData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileUp className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Financial Data Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Upload your financial documents (bank statements, W-2s, portfolio
              statements) to receive personalized, AI-powered recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2].map((j) => (
                  <div key={j} className="p-4 rounded-lg border border-border">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {!loading && !noData && sortedCategories.length > 0 && (
        <div className="space-y-6">
          {sortedCategories.map((category) => {
            const meta = CATEGORY_META[category] || {
              icon: Lightbulb,
              color: "text-muted-foreground",
            };
            const Icon = meta.icon;
            const items = grouped.get(category) || [];

            return (
              <Card key={category}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    <CardTitle className="text-base">{category}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((rec) => {
                    const isExpanded = expandedId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        className="rounded-lg border border-border hover:bg-accent/50 transition-colors"
                      >
                        <button
                          className="flex items-start gap-3 p-4 w-full text-left"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : rec.id)
                          }
                        >
                          <Badge
                            variant={badgeVariant(rec.priority)}
                            className="text-[10px] shrink-0 mt-0.5"
                          >
                            {rec.priority}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium">
                                {rec.title}
                              </h4>
                              {rec.estimatedImpact && (
                                <span className="text-xs text-emerald-500 font-medium shrink-0">
                                  {rec.estimatedImpact}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {rec.description}
                            </p>
                          </div>
                          {rec.actionItems.length > 0 ? (
                            isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            )
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                        </button>
                        {isExpanded && rec.actionItems.length > 0 && (
                          <div className="px-4 pb-4 pt-0 ml-[4.25rem]">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Action Items:
                            </p>
                            <ul className="space-y-1.5">
                              {rec.actionItems.map((item, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-muted-foreground flex items-start gap-2"
                                >
                                  <span className="text-primary mt-0.5">
                                    &bull;
                                  </span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
