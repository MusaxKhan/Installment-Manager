"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "sitara-install-prompt-dismissed";

/**
 * Custom install prompt. The browser's default beforeinstallprompt
 * banner is easy to miss or accidentally dismiss permanently on some
 * Android/Chrome versions. This captures the event, suppresses the
 * automatic banner, and shows our own dismissable card so it's a
 * deliberate choice the person can act on whenever's convenient
 * rather than a one-shot popup.
 *
 * iOS Safari doesn't fire beforeinstallprompt at all (Apple's
 * "Add to Home Screen" is manual, under the share sheet) — this
 * component simply never shows there, which is the correct behavior;
 * we don't try to fake an install prompt Safari doesn't support.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    function handler(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
  }

  function handleDismiss() {
    setIsVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!isVisible || !deferredEvent) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 border-accent/30 shadow-lg sm:left-auto sm:right-4 sm:w-80">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Install Sitara Traders
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add it to your home screen for quick access — and so it works
            offline.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
