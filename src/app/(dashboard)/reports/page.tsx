"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileBarChart,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";

interface Report {
  id: string;
  reportType: string;
  periodLabel: string;
  content: string;
  tone: string;
  createdAt: string;
}

type Tone = "concise" | "detailed";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tone, setTone] = useState<Tone>("concise");
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) return;
      const data = await res.json();
      setReports(data.reports || []);
      if (data.reports?.length > 0 && !activeReport) {
        setActiveReport(data.reports[0]);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [activeReport]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate report");
      }

      const data = await res.json();
      const newReport = data.report as Report;
      setReports((prev) => [newReport, ...prev]);
      setActiveReport(newReport);
      toast.success("Report generated successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Reports
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-generated monthly financial narratives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(["concise", "detailed"] as Tone[]).map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  tone === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-400 hover:to-indigo-300 text-white border-0"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-4 animate-fade-up [animation-delay:100ms]">
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${90 - i * 10}%` }} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : reports.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 animate-fade-up [animation-delay:100ms]">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <FileBarChart className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-lg font-semibold">No reports yet</h2>
            <p className="text-sm text-muted-foreground">
              Generate your first AI-powered financial narrative. Reports
              analyze your income, spending, portfolio, and provide actionable
              observations.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            size="lg"
            className="bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-400 hover:to-indigo-300 text-white border-0 shadow-lg shadow-indigo-500/25"
          >
            {generating ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            {generating ? "Generating..." : "Generate First Report"}
          </Button>
        </div>
      ) : (
        /* Reports layout */
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-4 animate-fade-up [animation-delay:100ms]">
          {/* History sidebar */}
          <div className="lg:col-span-1">
            <Card className="hover:border-primary/20 transition-colors duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Report History</CardTitle>
                <CardDescription className="text-xs">
                  {reports.length} report{reports.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-1">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setActiveReport(report)}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                          activeReport?.id === report.id
                            ? "bg-primary/15 text-primary border border-primary/20"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className="font-medium text-xs">
                          {report.periodLabel}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDate(report.createdAt)}
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[9px]">
                            {report.tone}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Active report */}
          <div className="lg:col-span-3">
            {activeReport ? (
              <Card className="hover:border-primary/20 transition-colors duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {activeReport.periodLabel} Report
                      </CardTitle>
                      <CardDescription>
                        Generated {formatDate(activeReport.createdAt)} &middot;{" "}
                        {activeReport.tone} format
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReportContent content={activeReport.content} />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                  Select a report to view
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple markdown-ish renderer for report content
function ReportContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold mt-6 mb-2 text-foreground first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("- **") || line.startsWith("- ")) {
      // Bullet point
      const text = line.slice(2);
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-muted-foreground ml-2 my-1">
          <span className="text-primary mt-1.5 shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p
          key={i}
          className="text-sm text-muted-foreground leading-relaxed my-1"
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      );
    }
  }

  return <>{elements}</>;
}

function formatInline(text: string): string {
  // Bold
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>');
}
