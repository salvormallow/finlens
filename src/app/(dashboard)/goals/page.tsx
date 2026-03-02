"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Target,
  Plus,
  Sparkles,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { GoalProgress, GoalType } from "@/types/financial";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "Emergency Fund",
  debt_payoff: "Debt Payoff",
  savings: "Savings",
  net_worth: "Net Worth",
  retirement: "Retirement",
  custom: "Custom",
};

const GOAL_TYPE_COLORS: Record<GoalType, string> = {
  emergency_fund: "bg-blue-500/10 text-blue-500",
  debt_payoff: "bg-red-500/10 text-red-500",
  savings: "bg-green-500/10 text-green-500",
  net_worth: "bg-purple-500/10 text-purple-500",
  retirement: "bg-amber-500/10 text-amber-500",
  custom: "bg-gray-500/10 text-gray-500",
};

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(199, 89%, 48%)",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState<string | null>(
    null
  );

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<GoalType>("savings");
  const [formTarget, setFormTarget] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGoals(data.goals);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const resetForm = () => {
    setFormName("");
    setFormType("savings");
    setFormTarget("");
    setFormDeadline("");
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a goal name");
      return;
    }
    const target = parseFloat(formTarget);
    if (!target || target <= 0) {
      toast.error("Please enter a valid target amount");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          goalType: formType,
          targetAmount: target,
          deadline: formDeadline || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Goal created!");
      setShowNewDialog(false);
      resetForm();
      fetchGoals();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create goal"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingGoal) return;
    const target = parseFloat(formTarget);
    if (!formName.trim() || !target || target <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${editingGoal.goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          targetAmount: target,
          deadline: formDeadline || null,
        }),
      });
      if (!res.ok) throw new Error();

      toast.success("Goal updated!");
      setShowEditDialog(false);
      setEditingGoal(null);
      resetForm();
      fetchGoals();
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Goal deleted");
      fetchGoals();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const handleMarkComplete = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Goal marked as completed!");
      fetchGoals();
    } catch {
      toast.error("Failed to update goal");
    }
  };

  const handleRefreshInsight = async (goalId: string) => {
    setGeneratingInsight(goalId);
    try {
      const res = await fetch(`/api/goals/${goalId}/insight`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      setGoals((prev) =>
        prev.map((g) =>
          g.goal.id === goalId
            ? {
                ...g,
                goal: {
                  ...g.goal,
                  aiInsight: data.insight,
                  aiInsightUpdatedAt: new Date().toISOString(),
                },
              }
            : g
        )
      );
      toast.success("Insight updated!");
    } catch {
      toast.error("Failed to generate insight");
    } finally {
      setGeneratingInsight(null);
    }
  };

  const openEditDialog = (gp: GoalProgress) => {
    setEditingGoal(gp);
    setFormName(gp.goal.name);
    setFormType(gp.goal.goalType);
    setFormTarget(gp.goal.targetAmount.toString());
    setFormDeadline(gp.goal.deadline || "");
    setShowEditDialog(true);
  };

  const activeGoals = goals.filter((g) => g.goal.status === "active");
  const completedGoals = goals.filter((g) => g.goal.status === "completed");

  // Chart data
  const chartData = activeGoals.map((g, i) => ({
    name:
      g.goal.name.length > 15
        ? g.goal.name.slice(0, 15) + "..."
        : g.goal.name,
    progress: g.percentage,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (goals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Goals
          </h1>
          <p className="text-muted-foreground text-sm">
            Track progress toward your financial targets
          </p>
        </div>
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            Set your first financial goal
          </h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            Create goals for emergency funds, debt payoff, savings targets, and
            more. Track your progress with AI-powered insights.
          </p>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Goal
          </Button>
        </Card>
        <GoalDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          title="New Goal"
          description="Set a financial target to track your progress."
          formName={formName}
          setFormName={setFormName}
          formType={formType}
          setFormType={setFormType}
          formTarget={formTarget}
          setFormTarget={setFormTarget}
          formDeadline={formDeadline}
          setFormDeadline={setFormDeadline}
          submitting={submitting}
          onSubmit={handleCreate}
          submitLabel="Create Goal"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Goals
          </h1>
          <p className="text-muted-foreground text-sm">
            Track progress toward your financial targets
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Progress Overview Chart */}
      {activeGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goal Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(120, activeGoals.length * 50)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  fontSize={12}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Progress"]}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Active Goals */}
      <div className="grid gap-4 md:grid-cols-2">
        {activeGoals.map((gp) => (
          <GoalCard
            key={gp.goal.id}
            goalProgress={gp}
            onEdit={() => openEditDialog(gp)}
            onDelete={() => handleDelete(gp.goal.id)}
            onComplete={() => handleMarkComplete(gp.goal.id)}
            onRefreshInsight={() => handleRefreshInsight(gp.goal.id)}
            generatingInsight={generatingInsight === gp.goal.id}
          />
        ))}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-muted-foreground mt-8">
            Completed Goals
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {completedGoals.map((gp) => (
              <GoalCard
                key={gp.goal.id}
                goalProgress={gp}
                onEdit={() => openEditDialog(gp)}
                onDelete={() => handleDelete(gp.goal.id)}
                onComplete={() => {}}
                onRefreshInsight={() => handleRefreshInsight(gp.goal.id)}
                generatingInsight={generatingInsight === gp.goal.id}
                completed
              />
            ))}
          </div>
        </>
      )}

      {/* New Goal Dialog */}
      <GoalDialog
        open={showNewDialog}
        onOpenChange={(open) => {
          setShowNewDialog(open);
          if (!open) resetForm();
        }}
        title="New Goal"
        description="Set a financial target to track your progress."
        formName={formName}
        setFormName={setFormName}
        formType={formType}
        setFormType={setFormType}
        formTarget={formTarget}
        setFormTarget={setFormTarget}
        formDeadline={formDeadline}
        setFormDeadline={setFormDeadline}
        submitting={submitting}
        onSubmit={handleCreate}
        submitLabel="Create Goal"
      />

      {/* Edit Goal Dialog */}
      <GoalDialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingGoal(null);
            resetForm();
          }
        }}
        title="Edit Goal"
        description="Update your financial target."
        formName={formName}
        setFormName={setFormName}
        formType={formType}
        setFormType={setFormType}
        formTarget={formTarget}
        setFormTarget={setFormTarget}
        formDeadline={formDeadline}
        setFormDeadline={setFormDeadline}
        submitting={submitting}
        onSubmit={handleEdit}
        submitLabel="Save Changes"
        hideTypeSelect
      />
    </div>
  );
}

// --- Goal Card Component ---

function GoalCard({
  goalProgress,
  onEdit,
  onDelete,
  onComplete,
  onRefreshInsight,
  generatingInsight,
  completed = false,
}: {
  goalProgress: GoalProgress;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onRefreshInsight: () => void;
  generatingInsight: boolean;
  completed?: boolean;
}) {
  const { goal, percentage, remaining, isOnTrack, projectedCompletionDate } =
    goalProgress;

  return (
    <Card className={completed ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {completed && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              {goal.name}
            </CardTitle>
            <Badge
              variant="secondary"
              className={GOAL_TYPE_COLORS[goal.goalType]}
            >
              {GOAL_TYPE_LABELS[goal.goalType]}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {!completed && (
                <DropdownMenuItem onClick={onComplete}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(goal.currentAmount)} of{" "}
              {formatCurrency(goal.targetAmount)}
            </span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {goal.goalType !== "debt_payoff" ? (
            <span>{formatCurrency(remaining)} remaining</span>
          ) : (
            <span>{formatCurrency(remaining)} debt remaining</span>
          )}
          {goal.deadline && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {goal.deadline}
            </span>
          )}
          {!completed && goal.deadline && (
            <span
              className={`flex items-center gap-1 ${isOnTrack ? "text-emerald-500" : "text-amber-500"}`}
            >
              {isOnTrack ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isOnTrack ? "On Track" : "Behind"}
            </span>
          )}
        </div>

        {/* Projected completion */}
        {!completed && projectedCompletionDate && (
          <p className="text-xs text-muted-foreground">
            Projected completion:{" "}
            <span className="font-medium">{projectedCompletionDate}</span>
          </p>
        )}

        {/* AI Insight */}
        <div className="border-t pt-3 mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              AI Insight
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onRefreshInsight}
              disabled={generatingInsight}
            >
              {generatingInsight ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
          {generatingInsight ? (
            <div className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : goal.aiInsight ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {goal.aiInsight}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Click refresh to generate an AI insight for this goal.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Goal Form Dialog ---

function GoalDialog({
  open,
  onOpenChange,
  title,
  description,
  formName,
  setFormName,
  formType,
  setFormType,
  formTarget,
  setFormTarget,
  formDeadline,
  setFormDeadline,
  submitting,
  onSubmit,
  submitLabel,
  hideTypeSelect = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  formName: string;
  setFormName: (v: string) => void;
  formType: GoalType;
  setFormType: (v: GoalType) => void;
  formTarget: string;
  setFormTarget: (v: string) => void;
  formDeadline: string;
  setFormDeadline: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  submitLabel: string;
  hideTypeSelect?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Build emergency fund"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>
          {!hideTypeSelect && (
            <div className="space-y-2">
              <Label htmlFor="goal-type">Goal Type</Label>
              <select
                id="goal-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formType}
                onChange={(e) => setFormType(e.target.value as GoalType)}
              >
                <option value="emergency_fund">Emergency Fund</option>
                <option value="debt_payoff">Debt Payoff</option>
                <option value="savings">Savings Target</option>
                <option value="net_worth">Net Worth Target</option>
                <option value="retirement">Retirement</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target Amount ($)</Label>
            <Input
              id="goal-target"
              type="number"
              min="1"
              step="100"
              placeholder="e.g., 25000"
              value={formTarget}
              onChange={(e) => setFormTarget(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-deadline">
              Deadline <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
