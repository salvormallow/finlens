"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Database,
  Key,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { UserDataStats } from "@/types/financial";

export default function SettingsPage() {
  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Stats
  const [stats, setStats] = useState<UserDataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Data management
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/settings/stats");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error("Failed to load account statistics");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in both password fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to change password");
        return;
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (res.status === 404) {
        toast.error("No data to export");
        return;
      }
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finlens-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setDeleting(true);
    try {
      const res = await fetch("/api/settings/data", { method: "DELETE" });
      if (!res.ok) throw new Error();

      toast.success("All data has been deleted");
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      fetchStats();
    } catch {
      toast.error("Failed to delete data");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account and application preferences
        </p>
      </div>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Account</CardTitle>
          </div>
          <CardDescription>Manage your login credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePasswordChange}
            disabled={changingPassword}
          >
            {changingPassword && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">API Configuration</CardTitle>
          </div>
          <CardDescription>
            Claude API settings for document analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Anthropic API Key</p>
              <p className="text-xs text-muted-foreground">
                Set via environment variable
              </p>
            </div>
            <Badge variant="outline">
              {process.env.NEXT_PUBLIC_HAS_API_KEY === "true"
                ? "Configured"
                : "Not Set"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Analysis Model</p>
              <p className="text-xs text-muted-foreground">
                Model used for financial analysis
              </p>
            </div>
            <Badge variant="secondary">claude-sonnet-4-20250514</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Data Management</CardTitle>
          </div>
          <CardDescription>
            Manage your stored financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Documents Uploaded</p>
              <p className="text-xs text-muted-foreground">
                Total documents processed
              </p>
            </div>
            {loadingStats ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <span className="text-sm font-medium">
                {stats?.documentCount ?? 0}
              </span>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Financial Records</p>
              <p className="text-xs text-muted-foreground">
                Extracted data points stored
              </p>
            </div>
            {loadingStats ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <span className="text-sm font-medium">
                {stats?.financialRecordCount ?? 0}
              </span>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Accounts Detected</p>
              <p className="text-xs text-muted-foreground">
                Bank, brokerage, and credit accounts
              </p>
            </div>
            {loadingStats ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <span className="text-sm font-medium">
                {stats?.accountCount ?? 0}
              </span>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Encryption</p>
              <p className="text-xs text-muted-foreground">
                All financial data encrypted with AES-256-GCM
              </p>
            </div>
            <Badge variant="outline" className="text-emerald-500">
              Active
            </Badge>
          </div>
          <Separator />
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Data
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Export downloads all your financial data as CSV. Delete permanently
            removes all documents, financial data, goals, and analysis history.
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all your financial data, documents,
              goals, chat history, and analysis cache. Your account will remain
              active but empty. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="delete-confirm">
              Type <span className="font-bold text-destructive">DELETE</span> to
              confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder="Type DELETE to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deleteConfirmText !== "DELETE" || deleting}
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
