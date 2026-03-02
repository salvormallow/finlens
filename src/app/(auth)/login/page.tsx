"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[oklch(0.11_0.025_265)] p-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/[0.12] blur-[120px] animate-glow-pulse" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.08] blur-[100px] animate-glow-pulse [animation-delay:1.5s]" />
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.06] blur-[100px] animate-glow-pulse [animation-delay:3s]" />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-up">
        {/* Logo / Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              FinLens
            </h1>
          </div>
          <p className="text-[oklch(0.6_0.02_265)] text-sm">
            Personal Financial Analysis Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-[oklch(0.35_0.03_265_/_0.3)] bg-[oklch(0.16_0.02_265_/_0.7)] backdrop-blur-2xl shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Sign in</CardTitle>
            <CardDescription className="text-[oklch(0.58_0.02_265)]">
              Enter your credentials to access your financial dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[oklch(0.8_0.01_265)]">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="bg-[oklch(0.14_0.02_265_/_0.6)] border-[oklch(0.35_0.03_265_/_0.3)] focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 placeholder:text-[oklch(0.45_0.02_265)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[oklch(0.8_0.01_265)]">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[oklch(0.14_0.02_265_/_0.6)] border-[oklch(0.35_0.03_265_/_0.3)] focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 placeholder:text-[oklch(0.45_0.02_265)]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-[oklch(0.5_0.02_265)]"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-400 hover:to-indigo-300 text-white shadow-lg shadow-indigo-500/25 border-0 transition-all duration-300"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
