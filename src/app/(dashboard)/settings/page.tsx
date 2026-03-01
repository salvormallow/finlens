"use client";

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
import { Shield, Database, Key, Trash2 } from "lucide-react";

export default function SettingsPage() {
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
          <CardDescription>
            Manage your login credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
            />
          </div>
          <Button variant="outline" size="sm">
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
            <span className="text-sm font-medium">0</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Financial Records</p>
              <p className="text-xs text-muted-foreground">
                Extracted data points stored
              </p>
            </div>
            <span className="text-sm font-medium">0</span>
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
          <div className="pt-2">
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Data
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2">
              This will permanently delete all your financial data, documents,
              and analysis history. This action cannot be undone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
