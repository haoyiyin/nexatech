"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAIL_DOMAIN = "nexatech.edu.kg";

export default function CreateMailboxForm() {
  const router = useRouter();
  const [emailPrefix, setEmailPrefix] = useState("");
  const [password, setPassword] = useState("");
  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/mail/api/admin/mailboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailPrefix,
          password,
          studentIdentifier,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Failed to create mailbox account.");
        return;
      }

      setSuccess("Mailbox account created successfully.");
      setEmailPrefix("");
      setPassword("");
      setStudentIdentifier("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Create Student Mailbox</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-[#dc2626]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {success ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="emailPrefix">Mailbox Username</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Input
                id="emailPrefix"
                type="text"
                value={emailPrefix}
                onChange={(event) => setEmailPrefix(event.target.value)}
                placeholder="student"
                required
                autoComplete="off"
                className="border-0 shadow-none focus-visible:ring-0"
              />
              <span className="pr-3 text-sm text-[#64748b]">@{MAIL_DOMAIN}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Initial Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studentIdentifier">Student ID</Label>
            <Input
              id="studentIdentifier"
              value={studentIdentifier}
              onChange={(event) => setStudentIdentifier(event.target.value)}
              placeholder="S-2025-001"
            />
          </div>

          <Button type="submit" variant="accent" disabled={loading}>
            {loading ? "Creating..." : "Create Mailbox"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
