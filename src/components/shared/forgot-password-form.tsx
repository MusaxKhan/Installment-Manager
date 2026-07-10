"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, KeyRound, ArrowLeft, MailCheck } from "lucide-react";

export function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    setIsLoading(false);

    // Show the same success state whether or not the email is
    // actually registered — confirming/denying an account exists from
    // this form would let anyone probe which emails have accounts.
    // Only surface a genuine sending failure (e.g. rate limiting).
    if (resetError && resetError.status !== 400) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardHeader className="items-center gap-2 pb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-completed-bg text-status-completed">
            <MailCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Check your email
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            we&apos;ve sent a link to reset the password. It expires shortly,
            so use it soon.
          </p>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm border-border shadow-md">
      <CardHeader className="items-center gap-2 pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Forgot your password?
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          Enter the email your admin set up for you and we&apos;ll send a link
          to reset it.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sitaratraders.com"
            />
          </div>

          {error && (
            <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}