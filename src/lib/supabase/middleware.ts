import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session cookie on every request and
 * enforces route protection:
 *  - Unauthenticated users are redirected to /login (except /login itself).
 *  - Authenticated users hitting /login are redirected to /dashboard.
 *  - No public registration route exists, so there's nothing to block there.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // A stale/invalid refresh token (e.g. from a session that was revoked,
  // or a cookie left over from a previous deploy/environment) makes
  // getUser() fail the same way on every single request until the
  // cookie is cleared — the Supabase client logs this as a console
  // error every time even though we handle it correctly below by
  // treating it as "not logged in." Explicitly clearing the auth
  // cookies here means it self-heals after one failed attempt instead
  // of repeating indefinitely.
  if (userError?.code === "refresh_token_not_found") {
    const authCookieNames = request.cookies
      .getAll()
      .map((c) => c.name)
      .filter((name) => name.includes("-auth-token"));

    authCookieNames.forEach((name) => {
      supabaseResponse.cookies.set(name, "", { maxAge: 0 });
    });
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isStaticOrApi =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".");

  if (!user && !isAuthRoute && !isStaticOrApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}