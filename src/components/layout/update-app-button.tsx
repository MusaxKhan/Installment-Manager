"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manually checks for a new deployed build and, if one exists, waits
 * for it to take over and reloads. sw.js already calls skipWaiting()
 * and clients.claim() unconditionally on install/activate, so a new
 * service worker takes control on its own the moment it's installed
 * — the only thing a person still has to do themselves is reload the
 * page to actually load the new HTML/JS, which is what this button
 * does on demand instead of waiting for the passive "update ready"
 * toast in service-worker-registration.tsx (which stays in place for
 * anyone who doesn't happen to click this first).
 */
export function UpdateAppButton() {
  const [checking, setChecking] = React.useState(false);

  const handleClick = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      toast.error("Updates aren't available in this browser.");
      return;
    }

    setChecking(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        // No service worker registered at all (e.g. still on the very
        // first load, or running outside production). A plain reload
        // is the most useful thing this button can still do.
        window.location.reload();
        return;
      }

      // Force a check right now rather than waiting for the browser's
      // own periodic check, which can be infrequent.
      await registration.update();

      if (registration.waiting || registration.installing) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            navigator.serviceWorker.removeEventListener(
              "controllerchange",
              finish
            );
            resolve();
          };
          navigator.serviceWorker.addEventListener("controllerchange", finish);
          // The new worker calls skipWaiting()/clients.claim() itself,
          // so this should fire quickly — but don't leave the button
          // stuck on "Updating..." forever if it doesn't for some
          // reason (e.g. this tab is somehow already the controller).
          setTimeout(finish, 4000);
        });
        toast.success("Updated — loading the latest version…");
        window.location.reload();
      } else {
        toast.success("You're already on the latest version.");
      }
    } catch {
      toast.error(
        "Couldn't check for updates. Check your connection and try again."
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 text-muted-foreground"
      onClick={handleClick}
      disabled={checking}
    >
      <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
      {checking ? "Checking for updates…" : "Check for updates"}
    </Button>
  );
}