/**
 * Single source of truth for which routes must be guaranteed to work
 * offline. Both the service worker (public/sw.js) and the client-side
 * warm-up (service-worker-registration.tsx) need this exact list.
 *
 * The service worker can't import this file (service workers run in
 * an isolated worker scope with no bundler — public/sw.js is plain,
 * unbundled JS served as-is). Its copy of this list is a manually kept
 * literal at the top of public/sw.js. Keep these two lists in sync —
 * if you add an offline-capable page here, add the same path to
 * SHELL_ASSETS in public/sw.js.
 *
 * Static routes only. Dynamic routes (/contracts/[id]) can't be
 * precached generically — those are handled separately in
 * service-worker-registration.tsx by warming whichever specific
 * contracts are already present in the Dexie cache.
 */
export const OFFLINE_CAPABLE_STATIC_ROUTES = [
  "/dashboard",
  "/clients",
  "/clients/new",
  "/contracts",
  "/contracts/new",
] as const;