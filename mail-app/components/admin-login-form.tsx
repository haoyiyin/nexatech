"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function normalizeRedirectPath(redirectTo: string | null | undefined) {
  if (!redirectTo) {
    return "/admin";
  }

  const normalizedRedirect = redirectTo.startsWith("/mail/")
    ? redirectTo.replace(/^\/mail/, "")
    : redirectTo;

  if (!normalizedRedirect.startsWith("/") || normalizedRedirect.startsWith("//")) {
    return "/admin";
  }

  if (normalizedRedirect === "/admin" || normalizedRedirect.startsWith("/admin/")) {
    return normalizedRedirect;
  }

  return "/admin";
}

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/mail/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Invalid email or password. Please try again.");
        return;
      }

      router.push(normalizeRedirectPath(searchParams.get("redirect") || result.redirectTo));
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-[#1a365d] text-white rounded-full p-3 w-14 h-14 flex items-center justify-center">
            <Shield className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#1a365d]">
            Nexatech Mail Admin
          </CardTitle>
          <p className="text-sm text-[#64748b]">
            Sign in with your administrator mailbox credentials
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-[#dc2626] bg-red-50 rounded-md p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@nexatech.edu.kg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button type="submit" variant="accent" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
