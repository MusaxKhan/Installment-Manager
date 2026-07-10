"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, KeyRound, ShieldAlert } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

type LinkState = "checking" | "valid" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  // Clicking the emailed recovery link gives this page a short-lived
  // "recovery" session — Supabase's JS client parses that out of the
  // URL itself and fires a PASSWORD_RECOVERY auth event once it's
  // established. Until that fires (or we find a session already
  // present, in case it fired before this listener attached), there's
  // no verified basis for letting anyone set a new password here.
  const [linkState, setLinkState] = React.useState<LinkState>("checking");

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setLinkState("valid");
      }
    });

    // In case the event already fired before this listener was
    // attached, an active session at this point still counts as valid
    // — this page is only ever reached via the recovery link redirect.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!settled && session) {
        settled = true;
        setLinkState("valid");
      }
    });

    // Don't leave the page stuck on "checking" forever if no recovery
    // session ever materializes (expired or already-used link).
    const timeout = setTimeout(() => {
      if (!settled) setLinkState("invalid");
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setIsLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    // The recovery session is single-purpose — sign out and require a
    // fresh sign-in with the new password rather than leaving them
    // logged in through it.
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login"), 2000);
  }

  if (linkState === "checking") {
    return (
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying your link...</p>
        </CardContent>
      </Card>
    );
  }

  if (linkState === "invalid") {
    return (
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardHeader className="items-center gap-2 pb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-overdue-bg text-status-overdue">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Link expired or invalid
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            This password reset link is no longer valid. Request a new one to
            continue.
          </p>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-completed-bg text-status-completed">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Password updated
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Redirecting you to sign in...
          </p>
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
          Set a new password
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
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
                Updating...
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}