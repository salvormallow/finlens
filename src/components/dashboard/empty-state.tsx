"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileUp, TrendingUp } from "lucide-react";

export function EmptyDashboardState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="relative">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-10 w-10 text-primary" />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold">Welcome to FinLens</h2>
        <p className="text-muted-foreground">
          Upload your financial documents to get started. FinLens will analyze
          your bank statements, tax returns, portfolio statements, and more to
          give you a comprehensive view of your finances.
        </p>
      </div>

      <div className="space-y-3">
        <Button asChild size="lg">
          <Link href="/documents">
            <FileUp className="mr-2 h-5 w-5" />
            Upload Documents
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          Supports PDF, CSV, XLSX, and image files
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mt-8">
        {[
          {
            title: "Net Worth Tracking",
            description:
              "See your total assets, liabilities, and net worth over time",
          },
          {
            title: "Income & Expenses",
            description:
              "Understand where your money comes from and where it goes",
          },
          {
            title: "AI Recommendations",
            description:
              "Get personalized, actionable advice to optimize your finances",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="p-4 rounded-lg border border-border bg-card/50 text-left"
          >
            <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
            <p className="text-xs text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
