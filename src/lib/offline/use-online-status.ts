"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Tracks connectivity. navigator.onLine alone is unreliable (it only
 * reflects whether the device has a network interface up, not whether
 * Supabase is actually reachable — a phone on wifi with no internet
 * still reports `true`). We treat the browser event as a fast initial
 * signal, then verify with a real fetch when it fires, and periodically
 * re-verify while "online" so a dead connection doesn't get stuck
 * showing as connected.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return false;
    }
    try {
      setIsVerifying(true);
      // HEAD request to our own origin's favicon — cheap, same-origin,
      // no CORS issues, and actually exercises the network rather than
      // trusting a cached browser flag.
      const response = await fetch("/favicon.ico", {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      return response.ok || response.type === "opaque";
    } catch {
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    async function handleStatusChange() {
      const actuallyOnline = await verifyConnectivity();
      setIsOnline(actuallyOnline);
    }

    handleStatusChange();

    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", () => setIsOnline(false));

    // Re-verify every 30s in case the connection died silently
    // (e.g. wifi shows connected but the router lost upstream internet).
    const intervalId = setInterval(handleStatusChange, 30000);

    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", () => setIsOnline(false));
      clearInterval(intervalId);
    };
  }, [verifyConnectivity]);

  return { isOnline, isVerifying, recheckNow: verifyConnectivity };
}
