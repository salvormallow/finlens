"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  User,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  StickyNote,
} from "lucide-react";
import type {
  AdvisorClientProfile,
  AdvisorMemoryNote,
  MemoryNoteCategory,
} from "@/types/financial";

const CATEGORY_LABELS: Record<MemoryNoteCategory, string> = {
  life_event: "Life Event",
  financial_plan: "Financial Plan",
  correction: "Correction",
  preference: "Preference",
  follow_up: "Follow-up",
  pattern: "Pattern",
};

const CATEGORY_COLORS: Record<MemoryNoteCategory, string> = {
  life_event: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  financial_plan: "bg-green-500/15 text-green-500 border-green-500/30",
  correction: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  preference: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  follow_up: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
  pattern: "bg-rose-500/15 text-rose-500 border-rose-500/30",
};

const PROFILE_LABELS = {
  risk_tolerance: { label: "Risk Tolerance", options: ["conservative", "moderate", "aggressive"] },
  financial_literacy: { label: "Financial Literacy", options: ["beginner", "intermediate", "advanced"] },
  communication_preference: { label: "Communication Style", options: ["concise", "detailed", "conversational"] },
  life_stage: { label: "Life Stage", options: ["early_career", "mid_career", "pre_retirement", "retired"] },
};

const LIFE_STAGE_DISPLAY: Record<string, string> = {
  early_career: "Early Career",
  mid_career: "Mid-Career",
  pre_retirement: "Pre-Retirement",
  retired: "Retired",
};

function formatLabel(value: string): string {
  if (LIFE_STAGE_DISPLAY[value]) return LIFE_STAGE_DISPLAY[value];
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function MemoryPage() {
  const [profile, setProfile] = useState<AdvisorClientProfile | null>(null);
  const [notes, setNotes] = useState<AdvisorMemoryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProfile(data.profile);
      setNotes(data.notes);
    } catch {
      toast.error("Failed to load memory data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateProfileField(field: string, value: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "profile",
          fields: { [field]: value },
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setProfile(data.profile);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveNoteEdit(noteId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "note",
          noteId,
          content: editContent,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? data.note : n))
      );
      setEditingNoteId(null);
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteNoteId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/memory?noteId=${deleteNoteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
      setDeleteNoteId(null);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setSaving(false);
    }
  }

  const activeNotes = notes.filter((n) => n.isActive);
  const filteredNotes =
    filterCategory === "all"
      ? activeNotes
      : activeNotes.filter((n) => n.category === filterCategory);

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advisor Memory</h1>
          <p className="text-muted-foreground mt-1">
            What your financial advisor remembers about you
          </p>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Advisor Memory</h1>
        <p className="text-muted-foreground mt-1">
          What your financial advisor remembers about you. You can edit or
          delete anything here.
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Client Profile</CardTitle>
          </div>
          <CardDescription>
            Your advisor builds this profile over time from conversations. You
            can adjust any field.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(PROFILE_LABELS).map(([field, config], i) => {
            const value =
              profile?.[
                field === "risk_tolerance"
                  ? "riskTolerance"
                  : field === "financial_literacy"
                    ? "financialLiteracy"
                    : field === "communication_preference"
                      ? "communicationPreference"
                      : "lifeStage"
              ] ?? undefined;

            return (
              <div key={field}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{config.label}</p>
                    {value ? (
                      <p className="text-sm text-muted-foreground">
                        {formatLabel(value)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Not yet determined
                      </p>
                    )}
                  </div>
                  <Select
                    value={value ?? ""}
                    onValueChange={(v) => updateProfileField(field, v)}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Set..." />
                    </SelectTrigger>
                    <SelectContent>
                      {config.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {formatLabel(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Memory Notes Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Memory Notes</CardTitle>
            </div>
            <Badge variant="secondary">{activeNotes.length} notes</Badge>
          </div>
          <CardDescription>
            Facts and context your advisor has noted from your conversations.
          </CardDescription>
          <div className="pt-2">
            <Select
              value={filterCategory}
              onValueChange={setFilterCategory}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <StickyNote className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {activeNotes.length === 0
                  ? "No memories yet. Chat with your advisor and it will start remembering important details."
                  : "No notes in this category."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="group rounded-lg border border-border/50 p-3 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${CATEGORY_COLORS[note.category]}`}
                        >
                          {CATEGORY_LABELS[note.category]}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {editingNoteId === note.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-sm"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => saveNoteEdit(note.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setEditingNoteId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm">{note.content}</p>
                      )}
                    </div>

                    {editingNoteId !== note.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditContent(note.content);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteNoteId(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteNoteId}
        onOpenChange={(open) => !open && setDeleteNoteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Memory Note</DialogTitle>
            <DialogDescription>
              This will permanently remove this note from your advisor&apos;s
              memory. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteNoteId(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
